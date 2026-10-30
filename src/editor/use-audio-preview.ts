import { useEffect, useMemo, useRef, useState } from "react";
import type { Element } from "./model";
import { buildSequence } from "./animation";
import { audioGain, audioPosition, type AudioTrack } from "./sound";

type PreviewEntry = {
  key: string;
  track: AudioTrack;
  /** Offset of the owning frame within the previewed sequence. */
  offset: number;
};
type Player = {
  audio: HTMLAudioElement;
  src: string;
  blobUrl?: string;
  ready: boolean;
  pending: boolean;
  failed: boolean;
  positioned: boolean;
  lastVolume?: number;
  lastRate?: number;
  lastSeekAt?: number;
};

/** Decode a `data:audio/...;base64,...` URL once so preview elements play
 * from a lightweight `blob:` URL instead of re-parsing a multi-MB base64
 * string on every `new Audio()` / seek. Falls back to the original src. */
function toPlayableSrc(src: string): { src: string; blobUrl?: string } {
  const match = /^data:(audio\/[^;,]+);base64,([a-z0-9+/=]+)$/i.exec(
    src.trim(),
  );
  if (!match) return { src };
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blobUrl = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], { type: match[1] }),
    );
    return { src: blobUrl, blobUrl };
  } catch {
    return { src };
  }
}

function revokePlayer(player: Player) {
  player.audio.pause();
  if (player.blobUrl) URL.revokeObjectURL(player.blobUrl);
  player.audio.removeAttribute("src");
  player.audio.load();
}

/**
 * Timeline preview player. It intentionally reuses the same
 * `audioPosition` / `audioGain` helpers as the offline `mixAudio` export so
 * what you hear while scrubbing/playing matches the rendered MP4.
 *
 * HTMLAudio elements are cached by track id and only recreated when the
 * underlying `src` changes. While playing we let each element run freely and
 * only hard-seek when the drift is clearly audible (>0.35 s, at most one
 * correction per 400 ms). Output properties are only written when they
 * change. This avoids the per-tick seek/volume churn that made narration
 * sound choppy on the blue Play button.
 */
export function useAudioPreview(
  frames: Element[],
  time: number,
  playing: boolean,
  enabled: boolean,
  speed = 1,
) {
  const entries = useMemo<PreviewEntry[]>(
    () =>
      buildSequence(frames).flatMap((entry) =>
        (entry.frame.audioTracks ?? []).map((track) => ({
          key: `${entry.frame.id}:${track.id}`,
          track,
          offset: entry.start,
        })),
      ),
    [frames],
  );
  const players = useRef(new Map<string, Player>());
  const state = useRef({ time, playing, enabled, speed });
  state.current = { time, playing, enabled, speed };
  const [error, setError] = useState("");

  // Create / retire elements when the track list changes. Never tear down an
  // element whose src is unchanged so playback survives document edits.
  useEffect(() => {
    setError("");
    const current = players.current;
    const wanted = new Set(entries.map((entry) => entry.key));
    for (const [key, player] of [...current]) {
      if (!wanted.has(key)) {
        revokePlayer(player);
        current.delete(key);
      }
    }
    if (enabled) {
      for (const entry of entries) {
        const existing = current.get(entry.key);
        if (existing && existing.src === entry.track.src) continue;
        if (existing) {
          revokePlayer(existing);
          current.delete(entry.key);
        }
        const playable = toPlayableSrc(entry.track.src);
        const audio = new Audio(playable.src);
        audio.preload = "auto";
        const player: Player = {
          audio,
          src: entry.track.src,
          blobUrl: playable.blobUrl,
          ready: false,
          pending: false,
          failed: false,
          positioned: false,
        };
        const markReady = () => {
          player.ready = true;
        };
        audio.addEventListener("canplay", markReady, { once: true });
        audio.load();
        current.set(entry.key, player);
      }
    } else {
      for (const player of current.values()) player.audio.pause();
    }
    return () => {
      if (!enabled) return;
      // Keep elements alive across time updates; full cleanup happens below.
    };
  }, [entries, enabled]);

  // Full teardown on unmount / when preview is disabled for good.
  useEffect(
    () => () => {
      for (const player of players.current.values()) revokePlayer(player);
      players.current.clear();
    },
    [],
  );

  // Pressing play again clears a previous failure so a retry can succeed.
  useEffect(() => {
    if (playing && enabled) {
      setError("");
      for (const player of players.current.values()) player.failed = false;
    }
  }, [playing, enabled]);

  useEffect(() => {
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    const now = performance.now();
    for (const [key, player] of players.current) {
      const entry = byKey.get(key);
      const audio = player.audio;
      if (!entry || !enabled || !playing) {
        audio.pause();
        player.positioned = false;
        continue;
      }
      const localTime = time - entry.offset;
      const position = audioPosition(entry.track, localTime);
      if (position === undefined || player.failed) {
        audio.pause();
        player.positioned = false;
        continue;
      }
      // Touch the output graph only when something actually changed. Writing
      // `volume` / `muted` 60x/sec forces the media pipeline to reconfigure
      // and is heard as stutter on Task WebViews.
      const volume = Math.min(1, Math.max(0, audioGain(entry.track, localTime)));
      if (
        player.lastVolume === undefined ||
        Math.abs(player.lastVolume - volume) > 0.005
      ) {
        audio.muted = false;
        audio.volume = volume;
        player.lastVolume = volume;
      }
      if (player.lastRate !== speed) {
        try {
          audio.playbackRate = speed;
          player.lastRate = speed;
        } catch {
          /* older engines ignore playbackRate on blob URLs */
        }
      }
      const drift = Math.abs(audio.currentTime - position);
      const seeking = (audio as HTMLAudioElement & { seeking?: boolean })
        .seeking;
      // Only hard-seek when the drift is clearly audible and enough time has
      // passed since the last correction. In particular, never seek just
      // because the element reports `paused` (buffer underrun, pending play,
      // autoplay pause): that rewinds a healthy stream backwards and is
      // heard as choppy/repeating audio. A paused element with small drift
      // only needs `play()`, not a seek.
      const sinceSeek = now - (player.lastSeekAt ?? 0);
      if (
        player.ready &&
        !player.pending &&
        !seeking &&
        !Number.isNaN(audio.duration) &&
        ((!player.positioned && drift > 0.01) ||
          (drift > 0.35 && (sinceSeek > 400 || drift > 1)))
      ) {
        try {
          audio.currentTime = position;
          player.lastSeekAt = now;
          player.positioned = true;
        } catch {
          /* transient while the element is still loading */
        }
      }
      if (player.ready && !player.pending && drift <= 0.01)
        player.positioned = true;
      if (audio.paused && !player.pending) {
        player.pending = true;
        void audio
          .play()
          .catch((error: unknown) => {
            if (
              players.current.get(key) !== player ||
              !state.current.playing ||
              !state.current.enabled ||
              (error instanceof DOMException && error.name === "AbortError")
            )
              return;
            // NotAllowedError before a user gesture is expected; surface only
            // real decode failures for a named track.
            if (audio.currentTime === 0 && !player.ready) return;
            player.failed = true;
            setError(
              `Could not play “${entry.track.name}”. Check the audio format and press Play again.`,
            );
          })
          .finally(() => {
            player.pending = false;
          });
      }
    }
  }, [time, playing, enabled, speed, entries]);

  return error;
}
