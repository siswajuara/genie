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
  readAudio,
  validateAudio,
  type AudioTrack,
} from "./sound";
import {
  alignmentToWords,
  defaultSubtitleStyle,
  validateSubtitles,
  wordsToCues,
  type SubtitleStyle,
} from "./subtitles";
import { socialRequest, useSocial } from "../social/client";
import { canvasContextText } from "./generation";
import { Icon } from "../components/ui/icon";
import {
  PROTOTYPE_VOICE_ID,
  PROTOTYPE_VOICE_NAME,
  ELEVENLABS_VOICES,
  DEFAULT_VOICE_ID,
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
  {
    name: "TikTok",
    patch: {
      color: "#ffffff",
      background: "#00000000",
      outline: "#000000",
      outlineWidth: 0.14,
      highlight: "#ffe14d",
      animation: "karaoke",
      size: 6,
      position: "center",
    },
  },
  {
    name: "Karaoke pop",
    patch: {
      color: "#ffffff",
      background: "#000000cc",
      outline: "#000000",
      outlineWidth: 0.08,
      highlight: "#25f4ee",
      animation: "pop",
      size: 5,
      position: "bottom",
    },
  },
];

function sizeLabel(size: number) {
  if (size < 3.75) return "Small";
  if (size > 5.25) return "Large";
  return "Medium";
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
    voiceId: DEFAULT_VOICE_ID,
    accountId: accounts[0]?.id ?? "",
    language: "id",
    subtitles: true,
  };
  const { script, language, subtitles: showCaptions } = draft;
  const voiceId = draft.voiceId || PROTOTYPE_VOICE_ID;
  const accountId = draft.accountId || accounts[0]?.id || "";
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
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
  function setDraft(patch: Partial<typeof draft>) {
    p.edit();
    update({
      voiceoverDraft: {
        ...draft,
        accountId,
        voiceId,
        ...patch,
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
  function seek(time: number) {
    e.select([frame!.id]);
    p.setOpen(true);
    p.seek(time);
  }
  const pageFrameIds = e
    .getDocument()
    .elements.filter((o) => o.t === "frame")
    .map((o) => o.id);
  const activePreset =
    CAPTION_PRESETS.find((preset) =>
      Object.entries(preset.patch).every(
        ([key, value]) => style[key as keyof SubtitleStyle] === value,
      ),
    )?.name ?? "Custom";
  async function applyStyleToAllFrames() {
    const target = { subtitleStyle: { ...style } };
    await run("Applying caption style…", async () => {
      for (const id of live.current.e
        .getDocument()
        .elements.filter((o) => o.t === "frame")
        .map((o) => o.id)) {
        update(target, id);
      }
    });
  }
  async function generate() {
    const targetId = frame!.id;
    await run("Generating narration…", async () => {
      const result = await socialRequest<Speech>("elevenlabs.speech", {
        accountId,
        voiceId,
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
                rows={4}
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
            <div className="narration-voice-grid">
              <Label className="audio-field">
                <span className="narration-mini-label" aria-hidden="true">
                  Voice
                </span>
                <SelectField
                  label="Narration voice"
                  value={voiceId}
                  onChange={(voiceId) => setDraft({ voiceId })}
                  options={[
                    ...ELEVENLABS_VOICES.map((voice) => ({
                      value: voice.id,
                      label: voice.name,
                    })),
                    {
                      value: PROTOTYPE_VOICE_ID,
                      label: PROTOTYPE_VOICE_NAME,
                    },
                  ]}
                />
              </Label>
              <Label className="audio-field">
                <span className="narration-mini-label" aria-hidden="true">
                  Account
                </span>
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
            </div>
          </section>
          <section
            className="narration-step narration-group"
            aria-label="Captions"
          >
            <div className="narration-label-row">
              <span className="narration-label">Caption style</span>
              <small className="narration-step-hint">{activePreset}</small>
            </div>
            <Label className="audio-check narration-toggle">
              <Checkbox
                checked={showCaptions}
                onCheckedChange={(checked) =>
                  setDraft({ subtitles: checked === true })
                }
              />
              Matching captions
            </Label>
            <div className="narration-style">
              <div className="narration-style-field">
                <span className="narration-mini-label" aria-hidden="true">
                  Preset
                </span>
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
                        background:
                          preset.patch.background &&
                          !/^#00000000$/i.test(preset.patch.background)
                            ? preset.patch.background
                            : "#3a4669",
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
              </div>
              <div className="narration-style-field">
                <span className="narration-mini-label" aria-hidden="true">
                  Position
                </span>
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
              </div>
              <div className="narration-style-field">
                <span className="narration-mini-label" aria-hidden="true">
                  Animation
                </span>
                <div
                  className="narration-segment"
                  role="group"
                  aria-label="Caption animation"
                >
                  {(
                    [
                      ["none", "Static"],
                      ["karaoke", "Karaoke"],
                      ["pop", "Pop"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      aria-pressed={
                        (style.animation ?? "none") === value
                      }
                      title={
                        value === "none"
                          ? "Plain captions without word highlighting"
                          : value === "karaoke"
                            ? "Highlight each word as it is spoken"
                            : "Pop each word as it is spoken"
                      }
                      onClick={() =>
                        update({
                          subtitleStyle: { ...style, animation: value },
                        })
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
                <Label className="audio-field">
                  <span>
                    Outline width ·{" "}
                    {(style.outlineWidth ?? 0) === 0
                      ? "Off"
                      : `${Math.round((style.outlineWidth ?? 0) * 100)}%`}
                  </span>
                  <Slider
                    aria-label="Caption outline width"
                    min={0}
                    max={0.3}
                    step={0.01}
                    value={[style.outlineWidth ?? 0]}
                    onValueChange={([value]) =>
                      update({
                        subtitleStyle: {
                          ...style,
                          outlineWidth: value,
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
                  <Label className="audio-field">
                    <span>Highlight</span>
                    <Input
                      type="color"
                      aria-label="Caption highlight color"
                      value={(style.highlight ?? "#ffe14d").slice(0, 7)}
                      onChange={(ev) =>
                        update({
                          subtitleStyle: {
                            ...style,
                            highlight: ev.target.value,
                          },
                        })
                      }
                    />
                  </Label>
                  <Label className="audio-field">
                    <span>Outline</span>
                    <Input
                      type="color"
                      aria-label="Caption outline color"
                      value={(style.outline ?? "#000000").slice(0, 7)}
                      onChange={(ev) =>
                        update({
                          subtitleStyle: {
                            ...style,
                            outline: ev.target.value,
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
                        WebkitTextStroke: `${
                          (style.outlineWidth ?? 0) > 0 ? 1 : 0
                        }px ${style.outline ?? "#000000"}`,
                      }}
                    >
                      Captions look like this
                    </span>
                  </p>
                </div>
              </div>
              <div className="narration-style-field">
                <span className="narration-mini-label" aria-hidden="true">
                  All frames
                </span>
                <Button
                  type="button"
                  className="narration-apply-all"
                  disabled={pageFrameIds.length < 2}
                  title="Copy this frame's caption style to every frame on this page"
                  onClick={() => void applyStyleToAllFrames()}
                >
                  <Icon name="copy" size={14} />
                  Apply style to all {pageFrameIds.length} frames
                </Button>
                <p className="hint">
                  Copies the preset, position, animation, sizes, and colors
                  above to every frame on this page.
                </p>
              </div>
            </div>
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
