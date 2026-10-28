import { buildFrameContext } from "../../sidecar/frame-context.mjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Mic, VolumeX, ArrowLeft, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSocial, socialRequest } from "../social/client";
import { AIConnection } from "../social/ai-connection";
import {
  parseGenerationResult,
  sceneRoles,
  type GeneratedFrame,
  type GenerationRequest,
  type GenerationResult,
} from "../../sidecar/generate.mjs";
import {
  PROTOTYPE_VOICE_ID,
  PROTOTYPE_VOICE_NAME,
  ELEVENLABS_VOICES,
  DEFAULT_VOICE_ID,
} from "../../sidecar/voice-prototype.mjs";
import { useAssetLibrary } from "./assets";
import { loadPresetCatalog, type PresetSummary } from "./preset-catalog";
import { PresetPreviewImage } from "./preset-preview-image";
import { GenerateTemplatePicker } from "./generate-template-picker";
import { type Element, type Preset, uid } from "./model";
import { readAudio } from "./sound";
import {
  alignmentToWords,
  wordsToCues,
  defaultSubtitleStyle,
} from "./subtitles";
import {
  GENERATION_PRESETS,
  TONES,
  LANGUAGES,
  makeScenes,
  sceneLabel,
  sequenceTemplates,
  textSlots,
  physicsSlots,
  learningSlots,
  listItemCount,
  canvasContextText,
  prepareGenerationTemplates,
  fillGenerationTemplate,
  fillGenerationTemplates,
  appendGeneratedFrames,
  type SceneDraft,
} from "./generation";
import { LearningFields } from "./learning-inspector";
import { PhysicsFields } from "./science-inspector";
import { renderTemplatePreview } from "./template-thumbnail";
import { ensureDocumentFonts } from "../lib/fonts";
import type { Editor } from "./use-editor";

type Speech = {
  src: string;
  alignment: Parameters<typeof alignmentToWords>[0];
  characterCost: number | null;
};
type Voice = { id: string; name: string };
type Review = {
  request: GenerationRequest;
  templates: Preset[];
  result: GenerationResult;
};
const durationOptions = [4, 5, 6, 8, 10, 12].map((n) => ({
  value: String(n),
  label: `${n} seconds`,
}));
const examples = [
  {
    label: "Mouse & keyboard",
    text: "Anak lancar main HP tapi bingung memakai mouse dan keyboard. Orang tua perlu mengenalkan cara menggerakkan mouse, mengklik jawaban, dan menggulir layar sebelum latihan di komputer.",
  },
  {
    label: "Reading comprehension",
    text: "Anak bisa membaca lancar tetapi belum tentu paham isinya. Ajak anak menceritakan kembali: siapa tokohnya, di mana kejadiannya, apa yang terjadi di akhir cerita.",
  },
];

function ToggleRow({
  id,
  title,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="generate-toggle">
      <Label htmlFor={id}>
        <strong>{title}</strong>
        <small id={`${id}-hint`}>{hint}</small>
      </Label>
      <Switch
        id={id}
        aria-label={title}
        aria-describedby={`${id}-hint`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

const CLOSING_NOTE =
  "Tutup dengan ajakan yang jelas: pelajari lebih lanjut tentang Tes Kemampuan Akademik sekarang di siswajuara.com.";
function makeClosingScene(): SceneDraft {
  return {
    useCase: "closing",
    templateId: "",
    tone: "",
    seconds: 6,
    narrate: true,
    note: CLOSING_NOTE,
    voiceId: "",
  };
}

function GeneratedPreview({
  template,
  content,
  scene,
  index,
  total,
}: {
  template: Preset;
  content: GeneratedFrame;
  scene: SceneDraft;
  index: number;
  total: number;
}) {
  const [preview, setPreview] = useState({ src: "", error: "" });
  useEffect(() => {
    let live = true;
    setPreview({ src: "", error: "" });
    const timer = window.setTimeout(() => {
      void ensureDocumentFonts(template.objects)
        .then(() =>
          fillGenerationTemplate(template, content, scene, index, total),
        )
        .then(renderTemplatePreview)
        .then((src) => {
          if (live) setPreview({ src, error: "" });
        })
        .catch((error) => {
          if (live)
            setPreview({
              src: "",
              error: error instanceof Error ? error.message : String(error),
            });
        });
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [template, content, scene, index, total]);
  const missing = template.objects.filter(
    (o) =>
      o.t === "img" &&
      !o.hide &&
      !o.src &&
      !o.latex &&
      !o.physics &&
      !o.learning,
  );
  return (
    <figure
      className="generate-result-preview"
      aria-label="Generated scene preview"
    >
      <div className="template-thumbnail">
        {preview.src ? (
          <img src={preview.src} alt={`Generated scene ${index + 1} preview`} />
        ) : (
          <p className="generate-hint">
            {preview.error || "Preparing preview…"}
          </p>
        )}
      </div>
      {missing.length > 0 && (
        <figcaption className="generate-hint">
          Add images on the canvas:{" "}
          {missing.map((o) => o.label || o.n).join(", ")}. These slots need your
          images.
        </figcaption>
      )}
    </figure>
  );
}

export function GenerateDialog({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const social = useSocial();
  const { revision } = useAssetLibrary();
  const [canvasSeed] = useState(() =>
    canvasContextText(editor.getDocument(), editor.selection),
  );
  const [content, setContent] = useState(canvasSeed);
  const [scenes, setScenes] = useState(() => [
    ...makeScenes(GENERATION_PRESETS[0]),
    makeClosingScene(),
  ]);
  const [selected, setSelected] = useState(0);
  const [language, setLanguage] = useState("id");
  const [tone, setTone] = useState("warm");
  const [narration, setNarration] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [chosenAccount, setChosenAccount] = useState("");
  const [voiceId, setVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [voices, setVoices] = useState<Voice[]>([
    ...ELEVENLABS_VOICES,
    { id: PROTOTYPE_VOICE_ID, name: PROTOTYPE_VOICE_NAME },
  ]);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [catalog, setCatalog] = useState<PresetSummary[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState<Review>();
  const [audioFailed, setAudioFailed] = useState(false);
  const speechCache = useRef(
    new Map<string, { speech: Speech; duration?: number }>(),
  );
  const running = useRef(false);
  const mounted = useRef(true);
  const latestEditor = useRef(editor);
  latestEditor.current = editor;
  const accounts = social.config.elevenlabs.accounts.filter(
    (account) => account.configured && account.enabled,
  );
  const accountId = accounts.some((account) => account.id === chosenAccount)
    ? chosenAccount
    : accounts[0]?.id || "";
  const scene = scenes[selected];
  const activeContent = review?.result.frames[selected];
  const writingModel = review?.result.model
    ? `${review.result.model.providerID}/${review.result.model.id}`
    : social.config.opencode?.model || "Beam Free";
  const totalSeconds = scenes.reduce((sum, s) => sum + s.seconds, 0);
  const voicedScenes = narration && scenes.some((scene) => scene.narrate);
  const voiceOptions = voices.map((voice) => ({
    value: voice.id,
    label: voice.name,
  }));
  const selectedTemplates = useMemo(
    () => sequenceTemplates(catalog, scenes, content),
    [catalog, scenes, content],
  );
  const templateFor = (scene: SceneDraft) =>
    selectedTemplates[scenes.indexOf(scene)];

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    setCatalogLoading(true);
    setCatalogError("");
    void loadPresetCatalog()
      .then((value) => {
        if (live) setCatalog(value.presets);
      })
      .catch((error) => {
        if (live) setCatalogError(String(error));
      })
      .finally(() => {
        if (live) setCatalogLoading(false);
      });
    return () => {
      live = false;
    };
  }, [revision]);

  const problem =
    content.trim().length < 20
      ? "Add at least 20 characters of context."
      : catalogLoading
        ? "Loading your template library…"
        : catalogError ||
          (scenes.some((scene) => !templateFor(scene))
            ? "Connect a template pack in Setting → Assets."
            : "");
  function patchScene(change: Partial<SceneDraft>) {
    setScenes((all) =>
      all.map((scene, index) =>
        index === selected ? { ...scene, ...change } : scene,
      ),
    );
  }
  const sceneTypes = [
    "cover",
    "content",
    "image",
    "question",
    "answer",
    "explanation",
    "list",
    "closing",
  ];
  const hasClosing = scenes.some((scene) => scene.useCase === "closing");
  function addScene() {
    if (scenes.length >= 10) return;
    setScenes((all) => [
      ...all,
      {
        useCase: "content",
        templateId: "",
        tone: "",
        seconds: 6,
        narrate: true,
        note: "",
        voiceId: "",
      },
    ]);
    setSelected(scenes.length);
  }
  function addClosing() {
    if (scenes.length >= 10 || hasClosing) return;
    setScenes((all) => [...all, makeClosingScene()]);
    setSelected(scenes.length);
  }
  function patchContent(change: Partial<GeneratedFrame>) {
    setReview((review) =>
      review
        ? {
            ...review,
            result: {
              ...review.result,
              frames: review.result.frames.map((frame, index) =>
                index === selected ? { ...frame, ...change } : frame,
              ),
            },
          }
        : review,
    );
  }
  async function loadVoices() {
    if (!accountId) return;
    setVoiceBusy(true);
    setError("");
    try {
      const result = await socialRequest<{ voices: Voice[]; hasMore: boolean }>(
        "elevenlabs.voices",
        { accountId },
      );
      if (!mounted.current) return;
      setVoices((previous) => [
        ...new Map(
          [...previous, ...result.voices].map((voice) => [voice.id, voice]),
        ).values(),
      ]);
      if (result.hasMore)
        setError("Showing the first 100 voices from this account.");
    } catch (error) {
      if (mounted.current) setError(String(error));
    } finally {
      if (mounted.current) setVoiceBusy(false);
    }
  }
  async function generate() {
    if (problem || running.current || review) return;
    running.current = true;
    setBusy("Preparing scene layouts…");
    setError("");
    setNotice("");
    try {
      const templates = await prepareGenerationTemplates(
        scenes.map((scene) => templateFor(scene)!),
      );
      if (!mounted.current) return;
      const request: GenerationRequest = {
        content: content.trim(),
        language,
        narration,
        confirmed: true,
        frameContext: buildFrameContext(
          latestEditor.current.getDocument(),
          latestEditor.current.selection,
        ),
        scenes: scenes.map((scene, index) => ({
          ...scene,
          tone: scene.tone || tone,
          narrate: narration && scene.narrate,
          slots: textSlots(templates[index]),
          diagrams: physicsSlots(templates[index]),
          learning: learningSlots(templates[index]),
          allowVisual: !!templates[index].teachingArea,
          listItemCount: listItemCount(templates[index]),
        })),
      };
      setBusy("Writing scene content and narration…");
      const result = await socialRequest<GenerationResult>(
        "ai.generate",
        request,
      );
      const parsed = parseGenerationResult(result, request);
      if (!mounted.current) return;
      setReview({ request, templates, result: { ...result, ...parsed } });
      setNotice((parsed.repaired ?? []).join(" "));
      setSelected(0);
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      running.current = false;
      if (mounted.current) setBusy("");
    }
  }
  async function addFrames(withVoice = true) {
    if (!review || running.current || (withVoice && voicedScenes && !accountId))
      return;
    running.current = true;
    setBusy("Fitting text to your layouts…");
    setError("");
    setAudioFailed(false);
    let audioStarted = false;
    try {
      // Validate edited content before any speech requests or canvas mutation.
      parseGenerationResult(review.result, review.request);
      const templates = await fillGenerationTemplates(
        review.templates,
        review.result.frames,
        scenes,
      );
      const frameData: Partial<Element>[] = [];
      const costs: number[] = [];
      for (const [index, generated] of review.result.frames.entries()) {
        if (!mounted.current) return;
        const scene = scenes[index],
          voice = scene.voiceId || voiceId;
        const data: Partial<Element> = {
          voiceoverDraft: {
            script: generated.narration,
            language,
            accountId,
            voiceId: voice,
            subtitles: narration && captions,
          },
        };
        frameData.push(data);
        if (!withVoice || !narration || !scene.narrate) continue;
        audioStarted = true;
        setBusy(`Generating voice · scene ${index + 1} of ${scenes.length}…`);
        const cacheKey = JSON.stringify([
          index,
          accountId,
          voice,
          generated.narration,
        ]);
        let cached = speechCache.current.get(cacheKey);
        if (!cached) {
          const speech = await socialRequest<Speech>("elevenlabs.speech", {
            accountId,
            voiceId: voice,
            text: generated.narration,
            confirmed: true,
          });
          cached = { speech };
          speechCache.current.set(cacheKey, cached);
        }
        if (!mounted.current) return;
        if (!cached.duration) {
          const blob = await (await fetch(cached.speech.src)).blob();
          cached.duration = (
            await readAudio(
              new File([blob], "Narration.mp3", { type: "audio/mpeg" }),
            )
          ).duration;
        }
        const duration = Math.max(scene.seconds, cached.duration);
        if (duration > 600)
          throw Error("Generated narration exceeds the scene duration limit.");
        templates[index] = {
          ...templates[index],
          scene: { duration, transition: { type: "cut", duration: 0.4 } },
          objects: templates[index].objects.map((o) =>
            o.animation
              ? { ...o, animation: { ...o.animation, end: duration } }
              : o,
          ),
        };
        data.audioTracks = [
          {
            id: uid(),
            name: "Narration",
            role: "voiceover",
            src: cached.speech.src,
            start: 0,
            end: cached.duration,
            sourceDuration: cached.duration,
            trimStart: 0,
            volume: 1,
            loop: false,
            muted: false,
            fadeIn: 0,
            fadeOut: 0,
          },
        ];
        if (captions) {
          data.subtitles = wordsToCues(
            alignmentToWords(cached.speech.alignment, true),
          );
          data.subtitleStyle = { ...defaultSubtitleStyle };
        }
        if (cached.speech.characterCost !== null)
          costs.push(cached.speech.characterCost);
      }
      if (!mounted.current) return;
      const live = latestEditor.current;
      const appended = appendGeneratedFrames(
        live.getDocument(),
        templates,
        frameData,
        review.result.post,
        live.frame?.id,
      );
      live.change(appended.document);
      live.select([appended.ids[0]]);
      live.notify(
        `${templates.length} generated frames added.${costs.length ? ` ElevenLabs reported ${costs.reduce((a, b) => a + b, 0).toLocaleString()} characters billed.` : ""}`,
      );
      onClose();
    } catch (error) {
      if (mounted.current) {
        setError(error instanceof Error ? error.message : String(error));
        setAudioFailed(audioStarted);
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy("");
    }
  }
  const locked = !!busy || !!review;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !running.current) onClose();
      }}
    >
      <DialogContent
        className="generate-dialog"
        onEscapeKeyDown={(event) => {
          if (running.current) event.preventDefault();
        }}
        onInteractOutside={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            if (review) void addFrames();
            else void generate();
          }
        }}
      >
        <header className="generate-head">
          <span className="generate-mark">
            <Sparkles size={23} />
          </span>
          <div>
            <DialogTitle asChild>
              <h2>Generate frames</h2>
            </DialogTitle>
            <DialogDescription>
              {review
                ? "Review & add to canvas"
                : "Context, content, narration."}
            </DialogDescription>
          </div>
          <Button
            className="icon-btn"
            aria-label="Close Generate dialog"
            disabled={!!busy}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </Button>
        </header>
        <div className="generate-layout" aria-busy={!!busy}>
          <ScrollArea
            className="generate-inputs"
            aria-label="Generation settings"
          >
            <div className="generate-column">
              {review && (
                <section className="generate-section generate-post-details">
                  <div className="generate-section-heading">
                    <h3>Post details</h3>
                  </div>
                  <div className="generate-field">
                    <Label htmlFor="generated-post-name">Post name</Label>
                    <Input
                      id="generated-post-name"
                      maxLength={100}
                      disabled={!!busy}
                      value={review.result.post.name}
                      onChange={(event) =>
                        setReview({
                          ...review,
                          result: {
                            ...review.result,
                            post: {
                              ...review.result.post,
                              name: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="generate-field">
                    <Label htmlFor="generated-post-caption">Post caption</Label>
                    <Textarea
                      id="generated-post-caption"
                      rows={4}
                      maxLength={2200}
                      disabled={!!busy}
                      value={review.result.post.caption}
                      onChange={(event) =>
                        setReview({
                          ...review,
                          result: {
                            ...review.result,
                            post: {
                              ...review.result.post,
                              caption: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </section>
              )}
              <section className="generate-section">
                <div className="generate-section-heading">
                  <span>1</span>
                  <h3>Your context</h3>
                  <small>What should we create?</small>
                </div>
                <Label className="sr-only" htmlFor="generate-context">
                  Learning content and context
                </Label>
                <Textarea
                  id="generate-context"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  disabled={locked}
                  rows={5}
                  maxLength={12000}
                  placeholder="Describe your topic, audience, key points, and what you want them to learn…"
                />
                <div className="generate-meta">
                  <span>Try an example</span>
                  <span>{content.trim().length.toLocaleString()} / 12,000</span>
                </div>
                <div className="generate-examples">
                  {canvasSeed ? (
                    <Button
                      key="canvas-text"
                      size="sm"
                      disabled={locked}
                      title="Fill from the text already on this page"
                      onClick={() => setContent(canvasSeed)}
                    >
                      Use canvas text
                    </Button>
                  ) : null}
                  {examples.map((example) => (
                    <Button
                      key={example.label}
                      size="sm"
                      disabled={locked}
                      onClick={() => setContent(example.text)}
                    >
                      {example.label}
                    </Button>
                  ))}
                </div>
              </section>
              <section className="generate-section">
                <div className="generate-section-heading">
                  <span>2</span>
                  <h3>Language & voice</h3>
                </div>
                <div className="generate-fields">
                  <div className="generate-field">
                    <Label>Output language</Label>
                    <SelectField
                      label="Output language"
                      value={language}
                      onChange={setLanguage}
                      options={LANGUAGES}
                      disabled={locked}
                    />
                  </div>
                  <div className="generate-field">
                    <Label>Default tone</Label>
                    <SelectField
                      label="Default tone"
                      value={tone}
                      onChange={setTone}
                      options={TONES}
                      disabled={locked}
                    />
                  </div>
                </div>
                <ToggleRow
                  id="generate-narration"
                  title="Narration"
                  hint="Write a script and generate ElevenLabs audio."
                  checked={narration}
                  disabled={locked}
                  onChange={setNarration}
                />
                {narration && (
                  <div className="generate-voice-options">
                    <div className="generate-field">
                      <Label>ElevenLabs account</Label>
                      <SelectField
                        label="ElevenLabs account"
                        value={accountId}
                        onChange={setChosenAccount}
                        disabled={locked || !accounts.length}
                        options={
                          accounts.length
                            ? accounts.map((account) => ({
                                value: account.id,
                                label: account.name,
                              }))
                            : [{ value: "", label: "No connected account" }]
                        }
                      />
                    </div>
                    <div className="generate-fields">
                      <div className="generate-field">
                        <Label>Default voice</Label>
                        <SelectField
                          label="Default voice"
                          value={voiceId}
                          onChange={setVoiceId}
                          options={voiceOptions}
                          disabled={locked}
                        />
                      </div>
                      <Button
                        disabled={locked || voiceBusy || !accountId}
                        onClick={() => void loadVoices()}
                      >
                        {voiceBusy ? "Loading…" : "Load voices"}
                      </Button>
                    </div>
                    {!accountId && (
                      <p className="generate-hint">
                        Add an enabled ElevenLabs account in Setting → Audio to
                        create voice audio. You can still write and review the
                        script.
                      </p>
                    )}
                  </div>
                )}
                <ToggleRow
                  id="generate-captions"
                  title="Matching captions"
                  hint="Editable captions from the generated voice timing."
                  checked={narration && captions}
                  disabled={locked || !narration}
                  onChange={setCaptions}
                />
              </section>
              <div className="generate-provider">
                <Sparkles size={15} />
                <span>
                  Writing with <strong>{writingModel}</strong> via OpenCode
                </span>
                <Button
                  size="sm"
                  disabled={!!busy}
                  aria-expanded={setup}
                  onClick={() => setSetup(!setup)}
                >
                  Settings
                </Button>
              </div>
              {setup && <AIConnection />}
            </div>
          </ScrollArea>
          <ScrollArea
            className="generate-scenes"
            aria-label="Scene settings and content"
          >
            <div className="generate-column">
              <div className="generate-scene-heading">
                <div>
                  <span className="generate-eyebrow">YOUR SEQUENCE</span>
                  <h3>
                    {review ? "Review your scenes" : "Make it your story"}
                  </h3>
                </div>
                <span className="generate-count">
                  {scenes.length} of 10 scenes · ~{totalSeconds}s
                </span>
              </div>
              <ScrollArea
                className="generate-filmstrip"
                orientation="horizontal"
                type="always"
                aria-label="Scene sequence"
              >
                <div className="generate-scene-list">
                  {scenes.map((scene, index) => {
                    const entry = templateFor(scene);
                    return (
                      <button
                        type="button"
                        key={index}
                        className={`generate-scene-card ${selected === index ? "is-selected" : ""}`}
                        aria-pressed={selected === index}
                        aria-label={`Scene ${index + 1}: ${sceneLabel(scene.useCase)}`}
                        onClick={() => setSelected(index)}
                      >
                        <div className="generate-scene-image">
                          {entry ? (
                            <PresetPreviewImage entry={entry} alt="" />
                          ) : (
                            <Icon name="layers" size={24} />
                          )}
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>
                        <strong>{sceneLabel(scene.useCase)}</strong>
                        <small>
                          {scene.seconds}s{" "}
                          {narration && scene.narrate ? (
                            <Mic size={11} />
                          ) : (
                            <VolumeX size={11} />
                          )}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              {!review && (
                <div className="generate-add-scene">
                  <Button
                    size="sm"
                    disabled={!!busy || scenes.length >= 10}
                    title={
                      scenes.length >= 10
                        ? "Maximum 10 scenes"
                        : "Add another scene"
                    }
                    onClick={addScene}
                  >
                    <Icon name="add" size={14} /> Add scene
                  </Button>
                  <Button
                    size="sm"
                    disabled={!!busy || scenes.length >= 10 || hasClosing}
                    title={
                      hasClosing
                        ? "A closing scene is already in the sequence"
                        : scenes.length >= 10
                          ? "Maximum 10 scenes"
                          : "Add a closing scene with the siswajuara.com call to action"
                    }
                    onClick={addClosing}
                  >
                    <Icon name="add" size={14} /> Add closing
                  </Button>
                  <small className="generate-hint">
                    {scenes.length >= 10
                      ? "Maximum 10 scenes."
                      : "Add up to 10 scenes."}
                  </small>
                </div>
              )}
              <section
                className="generate-scene-editor"
                aria-label={`Scene ${selected + 1} editor`}
              >
                <div className="generate-editor-heading">
                  <h3>
                    {String(selected + 1).padStart(2, "0")} ·{" "}
                    {sceneLabel(scene.useCase)}
                  </h3>
                  {!review && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!busy || scenes.length === 1}
                      aria-label="Remove this scene"
                      onClick={() => {
                        setScenes((all) =>
                          all.filter((_, index) => index !== selected),
                        );
                        setSelected(Math.max(0, selected - 1));
                      }}
                    >
                      <Icon name="delete" size={14} /> Remove
                    </Button>
                  )}
                </div>
                {!review ? (
                  <>
                    <div className="generate-field">
                      <Label>Scene type</Label>
                      <SelectField
                        label="Scene type"
                        value={scene.useCase}
                        onChange={(useCase) =>
                          patchScene({ useCase, templateId: "" })
                        }
                        disabled={!!busy}
                        options={sceneTypes.map((value) => ({
                          value,
                          label: sceneLabel(value),
                        }))}
                      />
                      <small className="generate-hint">
                        {sceneRoles[scene.useCase as keyof typeof sceneRoles]}
                      </small>
                    </div>
                    <div className="generate-field generate-template-field">
                      <Label>Template</Label>
                      <GenerateTemplatePicker
                        catalog={catalog}
                        useCase={scene.useCase}
                        context={`${content} ${scene.note}`}
                        value={scene.templateId}
                        recommended={selectedTemplates[selected]}
                        onChange={(templateId) => patchScene({ templateId })}
                        disabled={!!busy}
                      />
                      {selectedTemplates[selected]?.teachingArea && (
                        <small className="generate-hint">
                          AI dapat menambahkan diagram pembelajaran yang sesuai
                          di layout ini.
                        </small>
                      )}
                    </div>
                    <div className="generate-fields">
                      <div className="generate-field">
                        <Label>Scene tone</Label>
                        <SelectField
                          label="Scene tone"
                          value={scene.tone}
                          onChange={(tone) => patchScene({ tone })}
                          disabled={!!busy}
                          options={[
                            { value: "", label: "Use default" },
                            ...TONES,
                          ]}
                        />
                      </div>
                      <div className="generate-field">
                        <Label>Scene length</Label>
                        <SelectField
                          label="Scene length"
                          value={String(scene.seconds)}
                          onChange={(value) =>
                            patchScene({ seconds: Number(value) })
                          }
                          disabled={!!busy}
                          options={durationOptions}
                        />
                      </div>
                    </div>
                    {narration && (
                      <>
                        <ToggleRow
                          id="generate-scene-narration"
                          title="Narrate this scene"
                          hint="Use a spoken script for this frame."
                          checked={scene.narrate}
                          onChange={(narrate) => patchScene({ narrate })}
                          disabled={!!busy}
                        />
                        {scene.narrate && (
                          <div className="generate-field">
                            <Label>Scene voice</Label>
                            <SelectField
                              label="Scene voice"
                              value={scene.voiceId}
                              onChange={(voiceId) => patchScene({ voiceId })}
                              disabled={!!busy}
                              options={[
                                { value: "", label: "Use default voice" },
                                ...voiceOptions,
                              ]}
                            />
                          </div>
                        )}
                      </>
                    )}
                    <div className="generate-field">
                      <Label htmlFor="generate-scene-note">
                        What should this scene cover? <small>Optional</small>
                      </Label>
                      <Textarea
                        id="generate-scene-note"
                        rows={3}
                        maxLength={1000}
                        disabled={!!busy}
                        value={scene.note}
                        onChange={(event) =>
                          patchScene({ note: event.target.value })
                        }
                        placeholder="A key point, example, or question to focus on…"
                      />
                    </div>
                  </>
                ) : (
                  activeContent && (
                    <>
                      <GeneratedPreview
                        template={review.templates[selected]}
                        content={activeContent}
                        scene={scene}
                        index={selected}
                        total={scenes.length}
                      />
                      <div className="generate-review-fields">
                        <div className="generate-field">
                          <Label htmlFor="generate-frame-name">
                            Frame name
                          </Label>
                          <Input
                            id="generate-frame-name"
                            value={activeContent.title}
                            maxLength={100}
                            disabled={!!busy}
                            onChange={(event) =>
                              patchContent({ title: event.target.value })
                            }
                          />
                        </div>
                        {activeContent.texts.map((text, index) => {
                          const slot = review.request.scenes[
                            selected
                          ].slots.find((slot) => slot.id === text.id)!;
                          return (
                            <div className="generate-field" key={text.id}>
                              <Label htmlFor={`generate-text-${index}`}>
                                {slot.label}
                                <small>
                                  {text.text.length} / {slot.maxChars}
                                </small>
                              </Label>
                              <Textarea
                                id={`generate-text-${index}`}
                                rows={slot.maxChars > 100 ? 3 : 2}
                                value={text.text}
                                maxLength={slot.maxChars}
                                disabled={!!busy}
                                onChange={(event) =>
                                  patchContent({
                                    texts: activeContent.texts.map((entry) =>
                                      entry.id === text.id
                                        ? { ...entry, text: event.target.value }
                                        : entry,
                                    ),
                                  })
                                }
                              />
                            </div>
                          );
                        })}
                        {review.templates[selected].teachingArea && (
                          <p className="generate-hint">
                            Template menyediakan ruang untuk visual matematika,
                            fisika, atau Bahasa Indonesia yang ditambahkan AI
                            bila diperlukan.
                          </p>
                        )}
                        {activeContent.visual && (
                          <div className="generate-field">
                            <Label>Added teaching visual</Label>
                            {activeContent.visual.type === "learning" ? (
                              <LearningFields
                                value={activeContent.visual.settings}
                                disabled={!!busy}
                                onChange={(settings) =>
                                  patchContent({
                                    visual: { type: "learning", settings },
                                  })
                                }
                              />
                            ) : activeContent.visual.type === "physics" ? (
                              <PhysicsFields
                                value={activeContent.visual.settings}
                                disabled={!!busy}
                                onChange={(settings) =>
                                  patchContent({
                                    visual: { type: "physics", settings },
                                  })
                                }
                              />
                            ) : (
                              <Textarea
                                aria-label="Added LaTeX source"
                                value={activeContent.visual.source}
                                disabled={!!busy}
                                onChange={(event) =>
                                  patchContent({
                                    visual: {
                                      type: "latex",
                                      source: event.target.value,
                                    },
                                  })
                                }
                              />
                            )}
                            <Button
                              size="sm"
                              disabled={!!busy}
                              onClick={() =>
                                patchContent({ visual: undefined })
                              }
                            >
                              Remove teaching visual
                            </Button>
                          </div>
                        )}
                        {activeContent.learning?.map((diagram) => (
                          <div className="generate-field" key={diagram.id}>
                            <Label>Learning parameters</Label>
                            <LearningFields
                              value={diagram.settings}
                              disabled={!!busy}
                              allowModelChange={false}
                              onChange={(settings) =>
                                patchContent({
                                  learning: activeContent.learning!.map(
                                    (item) =>
                                      item.id === diagram.id
                                        ? { ...item, settings }
                                        : item,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                        {activeContent.physics?.map((diagram) => (
                          <div className="generate-field" key={diagram.id}>
                            <Label>Physics parameters</Label>
                            <PhysicsFields
                              value={diagram.settings}
                              disabled={!!busy}
                              allowModelChange={false}
                              onChange={(settings) =>
                                patchContent({
                                  physics: activeContent.physics!.map((item) =>
                                    item.id === diagram.id
                                      ? { ...item, settings }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                        {narration && scene.narrate && (
                          <div className="generate-field">
                            <Label htmlFor="generate-script">
                              Narration script
                            </Label>
                            <Textarea
                              id="generate-script"
                              rows={4}
                              maxLength={1500}
                              disabled={!!busy}
                              value={activeContent.narration}
                              onChange={(event) =>
                                patchContent({ narration: event.target.value })
                              }
                            />
                            <small className="generate-hint">
                              Audio tags stay in the script; captions use the
                              spoken words.
                            </small>
                          </div>
                        )}
                      </div>
                    </>
                  )
                )}
              </section>
              {review?.result.usage && (
                <p className="generate-hint">
                  OpenCode reported{" "}
                  {review.result.usage.totalTokens.toLocaleString()} tokens for
                  this generation.
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="generate-status" aria-live="polite">
          {busy && (
            <p role="status">
              <LoaderCircle className="generate-spinner" size={16} />
              {busy}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!busy && !error && notice && <p role="status">{notice}</p>}
        </div>
        <footer className="generate-foot">
          <div>
            <p>
              {review
                ? voicedScenes
                  ? accountId
                    ? "Uses ElevenLabs credits. Timing follows narration."
                    : "Connect an ElevenLabs account to generate voice, or add without audio and keep the scripts."
                  : "No narration is enabled for these scenes. Frames will be added without audio."
                : problem ||
                  `${scenes.length} scenes · ~${totalSeconds}s · OpenCode · ${voicedScenes ? "Narration on" : "Narration off"}`}
            </p>
          </div>
          <div className="generate-actions">
            {review ? (
              <>
                <Button
                  disabled={!!busy}
                  onClick={() => {
                    setReview(undefined);
                    setError("");
                    setNotice("");
                    setAudioFailed(false);
                    speechCache.current.clear();
                  }}
                >
                  <ArrowLeft size={14} /> Edit setup
                </Button>
                {(audioFailed || (!!voicedScenes && !accountId)) && (
                  <Button
                    disabled={!!busy}
                    onClick={() => void addFrames(false)}
                  >
                    Add without audio
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={!!busy || (!!voicedScenes && !accountId)}
                  onClick={() => void addFrames()}
                >
                  {busy
                    ? "Adding…"
                    : voicedScenes
                      ? "Add frames & generate voice"
                      : `Add ${scenes.length} ${scenes.length === 1 ? "frame" : "frames"} without audio`}
                </Button>
              </>
            ) : (
              <>
                <Button disabled={!!busy} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={!!problem || !!busy}
                  onClick={() => void generate()}
                >
                  <Sparkles size={15} />
                  {busy ? "Writing…" : "Generate frames"}
                </Button>
              </>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
