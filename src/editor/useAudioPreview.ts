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
  ready: boolean;
  pending: boolean;
  failed: boolean;
};

/**
 * Timeline preview player. It intentionally reuses the same
 * `audioPosition` / `audioGain` helpers as the offline `mixAudio` export so
 * what you hear while scrubbing/playing matches the rendered MP4.
 *
 * HTMLAudio elements are cached by track id and only recreated when the
 * underlying `src` changes. While playing we steer each element toward its
 * expected position and only hard-seek when the drift is audible (>0.18 s),
 * the element is ready, and it is not already seeking. This avoids the
 * seek-storm that made narration stutter or drop out.
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
        player.audio.pause();
        player.audio.removeAttribute("src");
        player.audio.load();
        current.delete(key);
      }
    }
    if (enabled) {
      for (const entry of entries) {
        const existing = current.get(entry.key);
        if (existing && existing.src === entry.track.src) continue;
        if (existing) {
          existing.audio.pause();
          existing.audio.removeAttribute("src");
          existing.audio.load();
          current.delete(entry.key);
        }
        const audio = new Audio(entry.track.src);
        audio.preload = "auto";
        const player: Player = {
          audio,
          src: entry.track.src,
          ready: false,
          pending: false,
          failed: false,
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
      for (const player of players.current.values()) {
        player.audio.pause();
        player.audio.removeAttribute("src");
        player.audio.load();
      }
      players.current.clear();
    },
    [],
  );

  // Pressing play again clears a previous failure so a retry can succeed.
  useEffect(() => {
    if (playing && enabled)
      for (const player of players.current.values()) player.failed = false;
  }, [playing, enabled, time]);

  useEffect(() => {
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    for (const [key, player] of players.current) {
      const entry = byKey.get(key);
      const audio = player.audio;
      if (!entry || !enabled || !playing) {
        audio.pause();
        continue;
      }
      const localTime = time - entry.offset;
      const position = audioPosition(entry.track, localTime);
      if (position === undefined || player.failed) {
        audio.pause();
        continue;
      }
      audio.muted = false;
      audio.volume = Math.min(
        1,
        Math.max(0, audioGain(entry.track, localTime)),
      );
      if (audio.playbackRate !== speed) {
        try {
          audio.playbackRate = speed;
        } catch {
          /* older engines ignore playbackRate on data URLs */
        }
      }
      const drift = Math.abs(audio.currentTime - position);
      const seeking = (audio as HTMLAudioElement & { seeking?: boolean })
        .seeking;
      // Only hard-seek when the drift is audible and the element can accept
      // it. In particular, never seek a paused/loading element every tick —
      // that starves `play()` and causes the reported dropouts.
      if (
        player.ready &&
        !seeking &&
        !Number.isNaN(audio.duration) &&
        (audio.paused || drift > 0.18)
      ) {
        try {
          audio.currentTime = position;
        } catch {
          /* transient while the element is still loading */
        }
      }
      if (audio.paused && !player.pending) {
        player.pending = true;
        void audio
          .play()
          .catch(() => {
            if (!players.current.has(key)) return;
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
