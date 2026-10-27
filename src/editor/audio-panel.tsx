import { FrameContextPanel } from "./frame-context-panel";
import { buildFrameContext } from "../../sidecar/frame-context.mjs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "./use-editor";
import type { AnimationPlayback } from "./use-animation-playback";
import { uid, type Element } from "./model";
import { sceneDuration } from "./animation";
import {
  audioToWav,
  extractVideoAudio,
  mixAudio,
  readAudio,
  validateAudio,
  type AudioTrack,
} from "./sound";
import {
  alignmentToWords,
  defaultSubtitleStyle,
  parseSrt,
  toSrt,
  validateSubtitles,
  wordsToCues,
  type SubtitleCue,
  type SubtitleStyle,
  type TimedWord,
} from "./subtitles";
import { socialRequest, useSocial } from "../social/client";
import { canvasContextText } from "./generation";
import { exportMessage, saveExport } from "../lib/export";
import { Icon } from "../components/ui/icon";
import { Accordion } from "../components/ui/accordion";
import {
  PROTOTYPE_VOICE_ID,
  PROTOTYPE_VOICE_NAME,
} from "../../sidecar/voice-prototype.mjs";

/** Kept for compatibility; the panel is now a single Narration flow. */
export type AudioTool = "audio" | "subtitles" | "voice";

type Speech = {
  src: string;
  alignment: Parameters<typeof alignmentToWords>[0];
  characterCost: number | null;
};

const CAPTION_PRESETS: { name: string; patch: Partial<SubtitleStyle> }[] = [
  {
    name: "Classic",
    patch: {
      color: "#ffffff",
      background: "#000000cc",
      size: 4.5,
      position: "bottom",
    },
  },
  {
    name: "Bold yellow",
    patch: {
      color: "#ffe14d",
      background: "#000000d9",
      size: 5.5,
      position: "bottom",
    },
  },
  {
    name: "Dark box",
    patch: {
      color: "#ffffff",
      background: "#101828e6",
      size: 4,
      position: "bottom",
    },
  },
];

function sizeLabel(size: number) {
  if (size < 3.75) return "Small";
  if (size > 5.25) return "Large";
  return "Medium";
}

function Seconds({
  label,
  value,
  onChange,
  max = 600,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
}) {
  return (
    <Label className="audio-field">
      <span>{label}</span>
      <Input
        type="number"
        aria-label={label}
        step={0.05}
        min={min}
        max={max}
        value={Number(value.toFixed(3))}
        onChange={(ev) => {
          if (
            ev.target.value !== "" &&
            Number.isFinite(ev.target.valueAsNumber)
          )
            onChange(ev.target.valueAsNumber);
        }}
      />
    </Label>
  );
}

export function AudioPanel({
  editor: e,
  playback: p,
  onClose,
  trackId,
}: {
  editor: Editor;
  playback: AnimationPlayback;
  onClose: () => void;
  /** @deprecated Timeline tabs were removed; kept optional for callers. */
  tab?: AudioTool;
  /** @deprecated Timeline tabs were removed; kept optional for callers. */
  onTabChange?: (tab: AudioTool) => void;
  trackId?: string;
}) {
  const frame = e.frame;
  const social = useSocial();
  const accounts = social.config.elevenlabs.accounts.filter(
    (account) => account.enabled && account.configured,
  );
  const draft = frame?.voiceoverDraft ?? {
    script: "",
    voiceId: PROTOTYPE_VOICE_ID,
    accountId: accounts[0]?.id ?? "",
    language: "id",
    subtitles: true,
  };
  const { script, language, subtitles: showCaptions } = draft;
  const accountId = draft.accountId || accounts[0]?.id || "";
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [styleOpen, setStyleOpen] = useState(false);
  const audioInput = useRef<HTMLInputElement>(null),
    srtInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const live = useRef({ e, frame });
  live.current = { e, frame };
  useEffect(() => {
    if (trackId)
      document
        .getElementById(`audio-track-${trackId}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [trackId, frame?.id]);
  useEffect(() => {
    setError("");
    setMessage("");
  }, [frame?.id]);
  const tracks = frame?.audioTracks ?? [],
    cues = frame?.subtitles ?? [];
  const style = frame?.subtitleStyle ?? defaultSubtitleStyle;
  if (!frame)
    return (
      <section className="audio-panel narration-panel">
        <p>Add a frame to work with narration.</p>
        <Button onClick={onClose}>Close</Button>
      </section>
    );
  const duration = sceneDuration(frame);
  const voiceTracks = tracks.filter((track) => track.role === "voiceover");
  const musicTracks = tracks.filter((track) => track.role !== "voiceover");
  function setDraft(patch: Partial<typeof draft>) {
    p.edit();
    update({
      voiceoverDraft: {
        ...draft,
        accountId,
        ...patch,
        voiceId: PROTOTYPE_VOICE_ID,
      },
    });
  }
  function update(patch: Partial<Element>, targetId = frame!.id) {
    const editor = live.current.e;
    const target = editor
      .getDocument()
      .elements.find((o) => o.id === targetId && o.t === "frame");
    if (!target) throw Error("The target frame no longer exists.");
    const next = { ...target, ...patch };
    validateAudio(next);
    validateSubtitles(next);
    editor.patch(patch, [targetId]);
  }
  async function run(label: string, action: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(label);
    setError("");
    setMessage("");
    p.edit();
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      running.current = false;
      setBusy("");
    }
  }
  function patchTrack(id: string, patch: Partial<AudioTrack>) {
    try {
      update({
        audioTracks: tracks.map((track) =>
          track.id === id ? { ...track, ...patch } : track,
        ),
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  function addTrack(
    src: string,
    sourceDuration: number,
    name: string,
    role: AudioTrack["role"],
    targetId: string,
  ) {
    const target = live.current.e
      .getDocument()
      .elements.find((o) => o.id === targetId);
    if (!target) throw Error("The target frame no longer exists.");
    const track: AudioTrack = {
      id: uid(),
      name,
      src,
      role,
      start: 0,
      end: Math.min(
        600,
        role === "music" ? sceneDuration(target) : sourceDuration,
      ),
      trimStart: 0,
      sourceDuration,
      volume: role === "music" ? 0.2 : 1,
      loop: role === "music",
      muted: false,
      fadeIn: role === "music" ? 0.5 : 0,
      fadeOut: role === "music" ? 0.5 : 0,
    };
    update(
      {
        audioTracks: [...(target.audioTracks ?? []), track],
        scene: {
          ...target.scene,
          duration: Math.min(600, Math.max(sceneDuration(target), track.end)),
        },
      },
      targetId,
    );
  }
  function addCues(newCues: SubtitleCue[], targetId = frame!.id) {
    if (!newCues.length)
      throw Error(
        "No speech timings were returned. Your existing subtitles were kept.",
      );
    const target = live.current.e
      .getDocument()
      .elements.find((o) => o.id === targetId);
    if (!target) throw Error("The target frame no longer exists.");
    const combined = [...(target.subtitles ?? []), ...newCues].sort(
      (a, b) => a.start - b.start,
    );
    update(
      {
        subtitles: combined,
        scene: {
          ...target.scene,
          duration: Math.min(
            600,
            Math.max(sceneDuration(target), ...newCues.map((cue) => cue.end)),
          ),
        },
      },
      targetId,
    );
    setMessage(`Added ${newCues.length} editable subtitle cues.`);
  }
  function patchCue(id: string, patch: Partial<SubtitleCue>) {
    try {
      update({
        subtitles: cues.map((cue) =>
          cue.id === id ? { ...cue, ...patch } : cue,
        ),
        ...(patch.end && patch.end > duration
          ? { scene: { ...frame!.scene, duration: patch.end } }
          : {}),
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  function seek(time: number) {
    e.select([frame!.id]);
    p.setOpen(true);
    p.seek(time);
  }
  async function transcribe(track: AudioTrack) {
    const targetId = frame!.id;
    if (track.loop)
      throw Error("Turn off looping before transcribing a speech track.");
    const result = await socialRequest<{ words: TimedWord[] }>(
      "elevenlabs.transcribe",
      { accountId, src: track.src, language, confirmed: true },
    );
    const mapped = result.words
      .filter(
        (word) =>
          word.end > track.trimStart &&
          word.start < track.trimStart + track.end - track.start,
      )
      .map((word) => ({
        ...word,
        start: Math.max(
          track.start,
          word.start - track.trimStart + track.start,
        ),
        end: Math.min(track.end, word.end - track.trimStart + track.start),
      }));
    addCues(wordsToCues(mapped), targetId);
  }
  async function generate() {
    const targetId = frame!.id;
    await run("Generating narration…", async () => {
      const result = await socialRequest<Speech>("elevenlabs.speech", {
        accountId,
        voiceId: PROTOTYPE_VOICE_ID,
        text: script,
        confirmed: true,
      });
      const blob = await (await fetch(result.src)).blob();
      const audio = await readAudio(
        new File([blob], "Voiceover.mp3", {
          type: "audio/mpeg",
        }),
      );
      // Validate everything before replacing, so a failure keeps the old
      // narration and subtitles instead of wiping them.
      const newCues = showCaptions
        ? wordsToCues(alignmentToWords(result.alignment, true))
        : [];
      if (showCaptions && !newCues.length)
        throw Error(
          "No speech timings were returned. Your existing narration and subtitles were kept.",
        );
      const target = live.current.e
        .getDocument()
        .elements.find((o) => o.id === targetId);
      if (!target) throw Error("The target frame no longer exists.");
      const replaced = (target.audioTracks ?? []).some(
        (track) => track.role === "voiceover",
      );
      const track: AudioTrack = {
        id: uid(),
        name: "Voiceover",
        src: audio.src,
        role: "voiceover",
        start: 0,
        end: Math.min(600, audio.duration),
        trimStart: 0,
        sourceDuration: audio.duration,
        volume: 1,
        loop: false,
        muted: false,
        fadeIn: 0,
        fadeOut: 0,
      };
      update(
        {
          audioTracks: [
            ...(target.audioTracks ?? []).filter(
              (track) => track.role !== "voiceover",
            ),
            track,
          ],
          ...(showCaptions
            ? {
                subtitles: [...newCues].sort((a, b) => a.start - b.start),
              }
            : {}),
          scene: {
            ...target.scene,
            duration: Math.min(
              600,
              Math.max(
                sceneDuration(target),
                track.end,
                ...newCues.map((cue) => cue.end),
              ),
            ),
          },
        },
        targetId,
      );
      setMessage(
        `${replaced ? "Narration replaced" : "Narration added"}.${result.characterCost !== null ? ` ElevenLabs reported ${result.characterCost} characters billed.` : " Refresh credits in Settings for actual usage."}${
          showCaptions ? ` ${newCues.length} matching captions.` : ""
        }`,
      );
    });
  }
  const canGenerate = !!accountId && !!script.trim() && !busy;
  const hasVoice = voiceTracks.length > 0;
  const frameTexts = frame
    ? canvasContextText(e.getDocument(), [frame.id])
    : "";
  async function rewriteNarration() {
    const targetId = frame!.id;
    await run("Rewriting narration…", async () => {
      const texts = canvasContextText(live.current.e.getDocument(), [targetId]);
      if (!texts.trim())
        throw Error(
          "This frame has no readable text to narrate. Add text layers first.",
        );
      const result = await socialRequest<{ narration: string }>(
        "ai.narration",
        {
          texts,
          frameContext: buildFrameContext(live.current.e.getDocument(), [
            targetId,
          ]),
          language,
          seconds: sceneDuration(live.current.frame ?? frame!),
          currentScript: script,
          confirmed: true,
        },
      );
      setDraft({ script: result.narration });
      setMessage(
        "Script rewritten from the canvas text. Generate narration to hear it.",
      );
    });
  }
  return (
    <section
      className="audio-panel narration-panel in-inspector"
      aria-label={`Narration for ${frame.n}`}
      onKeyDown={(ev) => ev.stopPropagation()}
    >
      <FrameContextPanel document={e.getDocument()} selection={[frame.id]} />
      <header className="audio-panel-header narration-head flex items-center justify-between w-full">
        <div>
          <strong>Narration</strong>
          <span>
            {frame.n} · {duration.toFixed(1)} s
            {hasVoice ? ` · ${voiceTracks.length} voice` : " · no voice"}
            {cues.length > 0 && ` · ${cues.length} captions`}
          </span>
        </div>
        <Button
          disabled={!!busy || !frameTexts.trim()}
          aria-label="Regenerate script from canvas text"
          size={"icon"}
          title={
            frameTexts.trim()
              ? "Regenerate script from canvas text (same language)"
              : "Add text to the frame first"
          }
          onClick={() => void rewriteNarration()}
        >
          <Icon name="refresh" size={16} />
        </Button>
      </header>
      <div className="audio-panel-body narration-body" aria-busy={!!busy}>
        <fieldset disabled={!!busy}>
          {!accounts.length && (
            <p className="hint narration-warning" role="note">
              No voice account yet. Add your ElevenLabs API key in Settings →
              Audio accounts, then pick an account below.
            </p>
          )}
          <section
            className="narration-step narration-group"
            aria-label="Script"
          >
            <div className="narration-label-row">
              <span className="narration-label">Script</span>
              <small className="narration-step-hint">
                {script.trim()
                  ? `${script.length.toLocaleString()} / 5,000`
                  : "empty"}
              </small>
            </div>
            <Label className="audio-field">
              <span className="sr-only">Narration script</span>
              <Textarea
                aria-label="Narration script"
                rows={3}
                maxLength={5000}
                value={script}
                onChange={(ev) => setDraft({ script: ev.target.value })}
                placeholder="Example: Di HP cepat sekali. Kok pakai mouse masih bingung?"
              />
            </Label>
            <p className="hint narration-tip">
              Tip: [excited] or [softly] changes delivery.
            </p>
          </section>
          <section
            className="narration-step narration-group"
            aria-label="Voice"
          >
            <div className="narration-label-row">
              <span className="narration-label">Voice</span>
              <small className="narration-step-hint">
                {PROTOTYPE_VOICE_NAME} · fixed
              </small>
            </div>
            <Label className="audio-field narration-account">
              <span className="sr-only">Voice account (billed)</span>
              <SelectField
                label="Voice account"
                value={accountId}
                onChange={(accountId) => setDraft({ accountId })}
                options={[
                  { value: "", label: "Choose billing account…" },
                  ...accounts.map((account) => ({
                    value: account.id,
                    label: account.name,
                  })),
                ]}
              />
            </Label>
            <p className="hint narration-tip">
              Billed to this ElevenLabs account.
            </p>
          </section>
          <section
            className="narration-step narration-group"
            aria-label="Captions"
          >
            <div className="narration-captions-row">
              <Label className="audio-check narration-toggle">
                <Checkbox
                  checked={showCaptions}
                  onCheckedChange={(checked) =>
                    setDraft({ subtitles: checked === true })
                  }
                />
                Matching captions
              </Label>
              <Button
                type="button"
                className="narration-style-toggle"
                aria-expanded={styleOpen}
                onClick={() => setStyleOpen((value) => !value)}
              >
                <Icon name={styleOpen ? "up" : "down"} size={14} />
                {styleOpen ? "Hide style" : "Style"}
              </Button>
            </div>
            {styleOpen && (
              <div className="narration-style">
                <div
                  className="narration-presets"
                  role="group"
                  aria-label="Caption presets"
                >
                  {CAPTION_PRESETS.map((preset) => (
                    <Button
                      key={preset.name}
                      type="button"
                      className="narration-preset"
                      style={{
                        color: preset.patch.color,
                        background: preset.patch.background,
                      }}
                      title={`Apply the ${preset.name} caption style`}
                      onClick={() =>
                        update({
                          subtitleStyle: { ...style, ...preset.patch },
                        })
                      }
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
                <div
                  className="narration-segment"
                  role="group"
                  aria-label="Caption position"
                >
                  {(
                    [
                      ["top", "Top"],
                      ["center", "Middle"],
                      ["bottom", "Bottom"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      aria-pressed={style.position === value}
                      title={`Show captions at the ${label.toLowerCase()}`}
                      onClick={() =>
                        update({ subtitleStyle: { ...style, position: value } })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Label className="audio-field">
                  <span>Caption size · {sizeLabel(style.size)}</span>
                  <Slider
                    aria-label="Caption size"
                    min={1}
                    max={15}
                    step={0.5}
                    value={[style.size]}
                    onValueChange={([value]) =>
                      update({
                        subtitleStyle: {
                          ...style,
                          size: value,
                        },
                      })
                    }
                  />
                </Label>
                <div className="narration-colors">
                  <Label className="audio-field">
                    <span>Text</span>
                    <Input
                      type="color"
                      aria-label="Caption text color"
                      value={style.color.slice(0, 7)}
                      onChange={(ev) =>
                        update({
                          subtitleStyle: { ...style, color: ev.target.value },
                        })
                      }
                    />
                  </Label>
                  <Label className="audio-field">
                    <span>Background</span>
                    <Input
                      type="color"
                      aria-label="Caption background color"
                      value={style.background.slice(0, 7)}
                      onChange={(ev) =>
                        update({
                          subtitleStyle: {
                            ...style,
                            background: `${ev.target.value}cc`,
                          },
                        })
                      }
                    />
                  </Label>
                  <p className="narration-preview" aria-hidden="true">
                    <span
                      style={{
                        color: style.color,
                        background: style.background,
                      }}
                    >
                      Captions look like this
                    </span>
                  </p>
                </div>
              </div>
            )}
          </section>
          {voiceTracks.length > 0 && (
            <section
              className="narration-step narration-group"
              aria-label="Generated voice"
            >
              <div className="narration-label-row">
                <span className="narration-label">
                  Voice clips ({voiceTracks.length})
                </span>
              </div>
              {voiceTracks.map((track) => (
                <article
                  className={`audio-track-card${trackId === track.id ? " is-selected" : ""}`}
                  id={`audio-track-${track.id}`}
                  key={track.id}
                  aria-label={track.name}
                >
                  <div className="audio-actions">
                    <strong className="narration-track-name">
                      {track.muted ? "Muted · " : ""}
                      {track.name} · {track.start.toFixed(1)}–
                      {track.end.toFixed(1)} s
                    </strong>
                    <Button onClick={() => seek(track.start)}>
                      Show in timeline
                    </Button>
                    <Button
                      aria-label={`Delete ${track.name}`}
                      onClick={() =>
                        update({
                          audioTracks: tracks.filter((t) => t.id !== track.id),
                        })
                      }
                    >
                      <Icon name="delete" size={15} />
                    </Button>
                  </div>
                  <div className="audio-fields">
                    <Label className="audio-field">
                      <span>Volume · {Math.round(track.volume * 100)}%</span>
                      <Slider
                        aria-label={`Volume for ${track.name}`}
                        min={0}
                        max={1}
                        step={0.01}
                        value={[track.volume]}
                        onValueChange={([value]) =>
                          patchTrack(track.id, {
                            volume: value,
                          })
                        }
                      />
                    </Label>
                    <Label className="audio-check">
                      <Checkbox
                        checked={track.muted}
                        onCheckedChange={(checked) =>
                          patchTrack(track.id, { muted: checked === true })
                        }
                      />
                      Mute
                    </Label>
                  </div>
                </article>
              ))}
            </section>
          )}
          <Accordion
            className="narration-more"
            title={`Music${musicTracks.length ? ` · ${musicTracks.length}` : ""}`}
          >
            <div className="audio-actions">
              <Button onClick={() => audioInput.current?.click()}>
                <Icon name="upload" size={15} /> Import audio
              </Button>
              <Button
                disabled={
                  !tracks.some((track) => !track.muted && track.volume > 0)
                }
                onClick={() =>
                  void run("Mixing audio…", async () => {
                    const buffer = await mixAudio(
                      [frame],
                      new AbortController().signal,
                    );
                    if (!buffer)
                      throw Error("No audible tracks within this frame.");
                    setMessage(
                      exportMessage(
                        await saveExport(audioToWav(buffer), `${frame.n}.wav`),
                      ),
                    );
                  })
                }
              >
                Export audio mix
              </Button>
              <span className="hint">
                MP3, WAV, M4A, OGG, FLAC · up to 25 MB. Starts at 20% volume.
              </span>
            </div>
            <Input
              hidden
              ref={audioInput}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
              aria-label="Import audio file"
              onChange={(ev) => {
                const file = ev.target.files?.[0],
                  targetId = frame.id;
                ev.target.value = "";
                if (file)
                  void run("Importing audio…", async () => {
                    const result = await readAudio(file);
                    addTrack(
                      result.src,
                      result.duration,
                      file.name.slice(0, 200),
                      "music",
                      targetId,
                    );
                  });
              }}
            />
            {e.doc.elements
              .filter((o) => o.t === "video" && o.fid === frame.id && o.src)
              .map((video) => (
                <Button
                  key={video.id}
                  onClick={() => {
                    const targetId = frame.id;
                    void run("Extracting video audio…", async () => {
                      const start = video.animation?.start ?? 0,
                        end = Math.min(
                          duration,
                          video.animation?.end ?? duration,
                        );
                      if (start >= end)
                        throw Error(
                          "Move the video clip inside the frame duration first.",
                        );
                      const result = await extractVideoAudio(
                        video.src!,
                        video.videoStart ?? 0,
                        end - start,
                      );
                      const target = live.current.e
                        .getDocument()
                        .elements.find((o) => o.id === targetId);
                      if (!target)
                        throw Error("The target frame no longer exists.");
                      update(
                        {
                          audioTracks: [
                            ...(target.audioTracks ?? []),
                            {
                              id: uid(),
                              name: `${video.n} audio`.slice(0, 200),
                              src: result.src,
                              role: "voiceover",
                              start,
                              end: Math.min(end, start + result.duration),
                              trimStart: 0,
                              sourceDuration: result.duration,
                              volume: 1,
                              loop: false,
                              muted: false,
                              fadeIn: 0,
                              fadeOut: 0,
                            },
                          ],
                        },
                        targetId,
                      );
                      setMessage(
                        "Video audio added as a voice track. Transcribe it under More options if you need captions.",
                      );
                    });
                  }}
                >
                  Extract audio from {video.n}
                </Button>
              ))}
            {!tracks.length && (
              <p className="audio-empty">
                Plays with the timeline and is included in MP4 exports.
              </p>
            )}
            {tracks.map((track) => (
              <article
                className={`audio-track-card${trackId === track.id ? " is-selected" : ""}`}
                id={`audio-track-${track.id}`}
                key={track.id}
                aria-label={track.name}
              >
                <div className="audio-actions">
                  <Input
                    className="audio-track-name"
                    aria-label="Track name"
                    maxLength={200}
                    value={track.name}
                    onChange={(ev) =>
                      patchTrack(track.id, { name: ev.target.value })
                    }
                  />
                  <SelectField
                    label={`Role for ${track.name}`}
                    value={track.role}
                    onChange={(role) =>
                      patchTrack(track.id, {
                        role: role as AudioTrack["role"],
                        loop: role === "music",
                      })
                    }
                    options={[
                      { value: "music", label: "Background music" },
                      { value: "voiceover", label: "Voiceover" },
                      { value: "sound", label: "Sound effect" },
                    ]}
                  />
                  <Button
                    aria-label={`Delete ${track.name}`}
                    onClick={() =>
                      update({
                        audioTracks: tracks.filter((t) => t.id !== track.id),
                      })
                    }
                  >
                    <Icon name="delete" size={15} />
                  </Button>
                </div>
                <div className="audio-fields">
                  <Seconds
                    label="Start (s)"
                    value={track.start}
                    max={track.end - 0.05}
                    onChange={(start) => patchTrack(track.id, { start })}
                  />
                  <Seconds
                    label="End (s)"
                    value={track.end}
                    min={track.start + 0.05}
                    onChange={(end) => patchTrack(track.id, { end })}
                  />
                  <Label className="audio-field">
                    <span>Volume · {Math.round(track.volume * 100)}%</span>
                    <Slider
                      aria-label={`Volume for ${track.name}`}
                      min={0}
                      max={1}
                      step={0.01}
                      value={[track.volume]}
                      onValueChange={([value]) =>
                        patchTrack(track.id, {
                          volume: value,
                        })
                      }
                    />
                  </Label>
                  <Label className="audio-check">
                    <Checkbox
                      checked={track.muted}
                      onCheckedChange={(checked) =>
                        patchTrack(track.id, { muted: checked === true })
                      }
                    />
                    Mute
                  </Label>
                </div>
                <details className="narration-details">
                  <summary>Timing details</summary>
                  <div className="audio-fields">
                    <Seconds
                      label="Trim source (s)"
                      value={track.trimStart}
                      max={track.sourceDuration - 0.05}
                      onChange={(trimStart) =>
                        patchTrack(track.id, { trimStart })
                      }
                    />
                    <Seconds
                      label="Fade in (s)"
                      value={track.fadeIn}
                      onChange={(fadeIn) => patchTrack(track.id, { fadeIn })}
                    />
                    <Seconds
                      label="Fade out (s)"
                      value={track.fadeOut}
                      onChange={(fadeOut) => patchTrack(track.id, { fadeOut })}
                    />
                    <Label className="audio-check">
                      <Checkbox
                        checked={track.loop}
                        onCheckedChange={(checked) =>
                          patchTrack(track.id, { loop: checked === true })
                        }
                      />
                      Loop
                    </Label>
                  </div>
                </details>
                {track.end > duration && (
                  <p className="hint">
                    This track extends beyond the frame.{" "}
                    <Button
                      onClick={() =>
                        update({
                          scene: { ...frame.scene, duration: track.end },
                        })
                      }
                    >
                      Extend frame to {track.end.toFixed(1)} s
                    </Button>
                  </p>
                )}
              </article>
            ))}
          </Accordion>
          <Accordion
            className="narration-more"
            title={`Captions · ${cues.length}`}
          >
            <div className="audio-actions">
              <Button
                onClick={() => {
                  const start = Math.min(p.time, duration - 0.1);
                  addCues([
                    {
                      id: uid(),
                      start,
                      end: Math.min(duration, start + 2),
                      text: "Your subtitle",
                    },
                  ]);
                }}
              >
                Add caption at playhead
              </Button>
            </div>
            {!cues.length && (
              <p className="audio-empty">
                Generated with narration, or added manually. Previews on canvas
                and burns into video exports.
              </p>
            )}
            <div className="subtitle-cues">
              {cues.map((cue, i) => (
                <div className="subtitle-cue" key={cue.id}>
                  <Button
                    aria-label={`Preview subtitle ${i + 1}`}
                    onClick={() => seek(cue.start)}
                  >
                    {i + 1}
                  </Button>
                  <Seconds
                    label={`Cue ${i + 1} start`}
                    value={cue.start}
                    max={cue.end - 0.001}
                    onChange={(start) => patchCue(cue.id, { start })}
                  />
                  <Seconds
                    label={`Cue ${i + 1} end`}
                    value={cue.end}
                    min={cue.start + 0.001}
                    onChange={(end) => patchCue(cue.id, { end })}
                  />
                  <Textarea
                    rows={2}
                    aria-label={`Subtitle ${i + 1} text`}
                    maxLength={2000}
                    value={cue.text}
                    onChange={(ev) =>
                      patchCue(cue.id, { text: ev.target.value })
                    }
                  />
                  <Button
                    aria-label={`Delete subtitle ${i + 1}`}
                    onClick={() =>
                      update({
                        subtitles: cues.filter((c) => c.id !== cue.id),
                      })
                    }
                  >
                    <Icon name="delete" size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </Accordion>
          <Accordion className="narration-more" title="Files & transcription">
            <div className="audio-actions">
              <Button onClick={() => srtInput.current?.click()}>
                Import SRT
              </Button>
              <Button
                disabled={!cues.length}
                onClick={() =>
                  void run("Exporting SRT…", async () => {
                    setMessage(
                      exportMessage(
                        await saveExport(
                          new Blob([toSrt(cues)], {
                            type: "application/x-subrip;charset=utf-8",
                          }),
                          `${frame.n}.srt`,
                        ),
                      ),
                    );
                  })
                }
              >
                Export SRT
              </Button>
            </div>
            <Input
              hidden
              ref={srtInput}
              type="file"
              accept=".srt,application/x-subrip"
              aria-label="Import SRT file"
              onChange={(ev) => {
                const file = ev.target.files?.[0],
                  targetId = frame.id;
                ev.target.value = "";
                if (file)
                  void run("Importing subtitles…", async () => {
                    if (file.size > 2_000_000)
                      throw Error("Choose an SRT file under 2 MB.");
                    addCues(parseSrt(await file.text()), targetId);
                  });
              }}
            />
            <div className="narration-transcribe">
              <Label className="audio-field">
                <span>Transcription language</span>
                <Input
                  aria-label="Subtitle language"
                  maxLength={3}
                  value={language}
                  placeholder="Auto"
                  onChange={(ev) =>
                    setDraft({ language: ev.target.value.toLowerCase() })
                  }
                />
              </Label>
              <span className="hint">
                Transcription sends audio to ElevenLabs and uses credits.
              </span>
              {tracks
                .filter((track) => !track.loop)
                .map((track) => (
                  <Button
                    key={track.id}
                    disabled={!accountId}
                    onClick={() =>
                      void run("Transcribing audio…", () => transcribe(track))
                    }
                  >
                    Transcribe {track.name}
                  </Button>
                ))}
              {!tracks.some((track) => !track.loop) && (
                <p className="hint">
                  Needs a voice recording with Loop turned off.
                </p>
              )}
            </div>
          </Accordion>
        </fieldset>
        {busy && (
          <p role="status">{busy} Keep this page open until it finishes.</p>
        )}
        {error && (
          <p className="audio-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
      <footer className="narration-foot">
        <Button
          type="button"
          className="primary narration-generate"
          disabled={!canGenerate}
          title={
            !accountId
              ? "Choose a voice account first"
              : !script.trim()
                ? "Write a script first"
                : "Generate narration with ElevenLabs"
          }
          onClick={() => void generate()}
        >
          {busy ? busy : "Generate narration"}
        </Button>
        <p className="narration-credit-note" aria-live="polite">
          Uses ElevenLabs credits
          {accounts.find((account) => account.id === accountId)?.name
            ? ` · billed to ${accounts.find((account) => account.id === accountId)?.name}`
            : ""}
        </p>
      </footer>
    </section>
  );
}
