import { motionPlanOptions } from "./generation-motion";
import {
  GenerationMotionPreview,
  renderGenerationStill,
} from "./generation-motion-preview";
import type { TaskGeneration } from "../content/canvas-bridge";
import { buildFrameContext } from "../../sidecar/frame-context.mjs";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { type Element, type Preset, initialDocument, uid } from "./model";
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
  canvasContextText,
  fillGenerationTemplate,
  fillGenerationTemplates,
  appendGeneratedFrames,
  type SceneDraft,
} from "./generation";
import {
  blankGenerationFrame,
  compositionResources,
  type CompositionResources,
} from "./generation-composition";
import { CompositionReview } from "./generation-composition-review";
import { StoryReview } from "./generation-story-review";
import type { Editor } from "./use-editor";
import type { Projects } from "./projects";

type Speech = {
  src: string;
  alignment: Parameters<typeof alignmentToWords>[0];
  characterCost: number | null;
};
type Voice = { id: string; name: string };
type Review = {
  request: GenerationRequest;
  templates: Preset[];
  resources: CompositionResources;
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
  "Resolve the opening idea, recap the lesson, and invite the viewer to continue at siswajuara.com. Match the topic and audience.";
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
  resources,
  allowMotion = false,
}: {
  allowMotion?: boolean;
  resources: CompositionResources;
  template: Preset;
  content: GeneratedFrame;
  scene: SceneDraft;
  index: number;
  total: number;
}) {
  const [preview, setPreview] = useState({ src: "", error: "" });
  const [prepared, setPrepared] = useState<Preset>();
  const [playing, setPlaying] = useState(false);
  const stopMotion = useCallback(() => setPlaying(false), []);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setPreview({ src: "", error: "" });
    setPrepared(undefined);
    setPlaying(false);
    const timer = window.setTimeout(() => {
      void fillGenerationTemplate(
        template,
        content,
        scene,
        index,
        total,
        resources,
      )
        .then((preset) => {
          if (live) setPrepared(preset);
          return renderGenerationStill(preset, controller.signal);
        })
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
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [template, content, scene, index, total, resources]);
  return (
    <figure
      className="generate-result-preview"
      aria-label="Generated scene preview"
    >
      <div className="template-thumbnail">
        {playing && prepared ? (
          <GenerationMotionPreview preset={prepared} onStop={stopMotion} />
        ) : preview.src ? (
          <img src={preview.src} alt={`Generated scene ${index + 1} preview`} />
        ) : (
          <p className="generate-hint">
            {preview.error || "Preparing preview…"}
          </p>
        )}
      </div>
      {allowMotion && (
        <Button
          size="sm"
          disabled={!prepared || !preview.src}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Stop scene motion" : "Play scene motion"}
        </Button>
      )}
    </figure>
  );
}

function GeneratedThumbnail({
  review,
  scene,
  index,
  total,
}: {
  review: Review;
  scene: SceneDraft;
  index: number;
  total: number;
}) {
  const [src, setSrc] = useState("");
  const content = review.result.frames[index],
    template = review.templates[index];
  useEffect(() => {
    const controller = new AbortController();
    setSrc("");
    void fillGenerationTemplate(
      template,
      content,
      scene,
      index,
      total,
      review.resources,
    )
      .then((preset) => renderGenerationStill(preset, controller.signal))
      .then((value) => {
        if (!controller.signal.aborted) setSrc(value);
      })
      .catch(() => {
        /* The selected scene and approval checks show actionable errors. */
      });
    return () => controller.abort();
  }, [content, template, scene, index, total, review.resources]);
  return src ? (
    <img src={src} alt={`Scene ${index + 1} storyboard`} />
  ) : (
    <Icon name="layers" size={24} />
  );
}

export function GenerateDialog({
  editor,
  onClose,
  taskGeneration,
  onAdded,
  projects,
}: {
  editor: Editor;
  onClose: () => void;
  taskGeneration?: TaskGeneration;
  onAdded?: (
    ids: string[],
    target?: { projectId: string; pageId: string },
  ) => Promise<void>;
  projects?: Projects;
}) {
  const social = useSocial();
  const { revision } = useAssetLibrary();
  const [canvasSeed] = useState(() =>
    canvasContextText(editor.getDocument(), editor.selection),
  );
  const [content, setContent] = useState(taskGeneration?.content || canvasSeed);
  const [scenes, setScenes] = useState(
    () =>
      taskGeneration?.scenes || [
        ...makeScenes(GENERATION_PRESETS[0]),
        makeClosingScene(),
      ],
  );
  const [selected, setSelected] = useState(0);
  const [destination, setDestination] = useState<
    "current" | "new-page" | "new-canvas"
  >("current");
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
  const [reviewStep, setReviewStep] = useState<
    "story" | "look" | "storyboard" | "animate"
  >("story");
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
  const scenePanel = useRef<HTMLDivElement>(null);
  latestEditor.current = editor;
  useEffect(() => {
    scenePanel.current
      ?.querySelector(".ui-scroll-viewport")
      ?.scrollTo({ top: 0 });
  }, [reviewStep, selected]);
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
    content.length > 12000
      ? "Keep the task context within 12,000 characters. Remove unrelated material before generating."
      : content.trim().length < 20
        ? "Add at least 20 characters of context."
        : catalogLoading
          ? "Loading available elements…"
          : "";
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
    if (reviewStep === "animate") setReviewStep("storyboard");
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
    setBusy("Preparing blank scenes and available assets…");
    setError("");
    setNotice("");
    try {
      const doc = latestEditor.current.getDocument();
      const selection = latestEditor.current.selection;
      const blank = await blankGenerationFrame(doc, selection);
      const templates = scenes.map(() => blank);
      const resources = compositionResources(
        doc,
        selection,
        catalog,
        `${content} ${scenes.map((s) => s.note).join(" ")}`,
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
        scenes: scenes.map((scene) => ({
          useCase: scene.useCase,
          seconds: scene.seconds,
          note: scene.note,
          tone: scene.tone || tone,
          narrate: narration && scene.narrate,
          slots: [],
          composition: {
            width: blank.W!,
            height: blank.H!,
            assets: resources.catalog,
          },
        })),
      };
      setBusy("Composing scenes, motion, and narration…");
      const result = await socialRequest<GenerationResult>(
        "ai.generate",
        request,
      );
      const parsed = parseGenerationResult(result, request);
      if (!mounted.current) return;
      setReviewStep("story");
      setReview({
        request,
        templates,
        resources,
        result: { ...result, ...parsed },
      });
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
  async function approveReview() {
    if (!review || running.current) return;
    setError("");
    try {
      parseGenerationResult(review.result, review.request);
      if (reviewStep === "story") {
        setReviewStep("look");
        return;
      }
      running.current = true;
      setBusy("Checking scene layouts and media…");
      const filled = await fillGenerationTemplates(
        review.templates,
        review.result.frames,
        scenes,
        review.resources,
      );
      // Decode placed media and render every scene before approval or speech.
      for (const preset of filled) await renderGenerationStill(preset);
      if (!mounted.current) return;
      setReviewStep(reviewStep === "look" ? "storyboard" : "animate");
      setNotice(
        `${filled.length} scenes checked: text fits, media loads, content stays inside the safe area.`,
      );
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      running.current = false;
      if (mounted.current) setBusy("");
    }
  }
  async function addFrames(withVoice = true) {
    if (
      !review ||
      reviewStep !== "animate" ||
      running.current ||
      (withVoice && voicedScenes && !accountId)
    )
      return;
    running.current = true;
    setBusy("Preparing your editable scenes…");
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
        review.resources,
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
          scene: { ...templates[index].scene, duration },
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
      const billed = costs.length
        ? ` ElevenLabs reported ${costs.reduce((a, b) => a + b, 0).toLocaleString()} characters billed.`
        : "";
      if (destination !== "current" && !projects)
        throw Error("Buka kanvas untuk membuat halaman atau kanvas baru.");
      if (destination === "current") {
        const appended = appendGeneratedFrames(
          live.getDocument(),
          templates,
          frameData,
          review.result.post,
          live.frame?.id,
        );
        await onAdded?.(appended.ids, undefined);
        if (!mounted.current) return;
        live.change(appended.document);
        live.select([appended.ids[0]]);
        live.notify(
          `${templates.length} generated frames added to this page.${billed}`,
        );
        onClose();
        return;
      }
      const canvasName =
        review.result.post.name?.trim() ||
        taskGeneration?.taskId ||
        "Generated frames";
      if (destination === "new-canvas") {
        const created = projects!.createProject(canvasName);
        const target = {
          projectId: created.id,
          pageId: created.pages[0].id,
        };
        const appended = appendGeneratedFrames(
          created.pages[0].canvas,
          templates,
          frameData,
          review.result.post,
          undefined,
        );
        projects!.updatePage(target.pageId, appended.document);
        projects!.openPage(target.projectId, target.pageId);
        await onAdded?.(appended.ids, target);
        onClose();
        return;
      }
      const base = initialDocument();
      const appended = appendGeneratedFrames(
        { ...base, metadata: { ...base.metadata, name: canvasName } },
        templates,
        frameData,
        review.result.post,
        undefined,
      );
      const targetPageId = projects!.createPage();
      const target = {
        projectId: projects!.project.id,
        pageId: targetPageId,
      };
      projects!.updatePage(targetPageId, appended.document);
      projects!.selectPage(targetPageId);
      await onAdded?.(appended.ids, target);
      live.notify(
        `${templates.length} generated frames added to a new page.${billed}`,
      );
      onClose();
      return;
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
            if (review) {
              if (reviewStep === "animate") void addFrames();
              else void approveReview();
            } else void generate();
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
                : "Your idea. Original scenes. Ready to animate."}
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
                  <h3>Creative brief</h3>
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
                  <h3>Voice & captions</h3>
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
            ref={scenePanel}
            className="generate-scenes"
            aria-label="Scene settings and content"
          >
            <div className="generate-column">
              <div className="generate-scene-heading">
                <div>
                  <span className="generate-eyebrow">YOUR SEQUENCE</span>
                  <h3>{review ? "Review your scenes" : "Direct the story"}</h3>
                </div>
                <span className="generate-count">
                  {scenes.length} of 10 scenes · ~{totalSeconds}s
                </span>
              </div>
              {review && (
                <nav
                  className="generate-review-steps"
                  aria-label="Generation review steps"
                >
                  {(
                    [
                      ["story", "1. Story"],
                      ["look", "2. Look"],
                      ["storyboard", "3. Storyboard"],
                      ["animate", "4. Animate"],
                    ] as const
                  ).map(([step, label]) => (
                    <button
                      type="button"
                      key={step}
                      disabled={
                        !!busy ||
                        (step === "animate" && reviewStep !== "animate") ||
                        ["story", "look", "storyboard", "animate"].indexOf(
                          step,
                        ) >
                          ["story", "look", "storyboard", "animate"].indexOf(
                            reviewStep,
                          )
                      }
                      aria-current={reviewStep === step ? "step" : undefined}
                      onClick={() => setReviewStep(step)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              )}
              {review && reviewStep === "story" && review.result.story && (
                <StoryReview
                  story={review.result.story}
                  frames={review.result.frames}
                  seconds={scenes.map((s) => s.seconds)}
                />
              )}
              {review && reviewStep === "look" && (
                <section
                  className="generate-look-review"
                  aria-label="Look review"
                >
                  <h3>Check the visual language</h3>
                  <p className="generate-hint">
                    Compare the opening, middle, and ending. Look for a
                    recurring subject, consistent colour meanings, and varied
                    staging.
                  </p>
                  {[
                    ...new Set([
                      0,
                      Math.floor((scenes.length - 1) / 2),
                      scenes.length - 1,
                    ]),
                  ].map((index) => (
                    <div key={index}>
                      <strong>
                        {index + 1}. {review.result.frames[index].title}
                      </strong>
                      <GeneratedPreview
                        template={review.templates[index]}
                        content={review.result.frames[index]}
                        scene={scenes[index]}
                        index={index}
                        total={scenes.length}
                        resources={review.resources}
                      />
                    </div>
                  ))}
                </section>
              )}
              {(!review || reviewStep !== "story") && (
                <>
                  <ScrollArea
                    className="generate-filmstrip"
                    orientation="horizontal"
                    type="always"
                    aria-label="Scene sequence"
                  >
                    <div className="generate-scene-list">
                      {scenes.map((scene, index) => {
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
                              {review ? (
                                <GeneratedThumbnail
                                  review={review}
                                  scene={scene}
                                  index={index}
                                  total={scenes.length}
                                />
                              ) : (
                                <Icon
                                  name={
                                    scene.useCase === "closing"
                                      ? "link"
                                      : "layers"
                                  }
                                  size={24}
                                />
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
                        </div>
                        <div className="generate-fields mt-2">
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
                                  onChange={(voiceId) =>
                                    patchScene({ voiceId })
                                  }
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
                            Scene direction <small>Optional</small>
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
                            placeholder="Describe what happens: a comparison, a visual reveal, a worked example, a mood…"
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
                            resources={review.resources}
                            allowMotion={reviewStep === "animate"}
                          />
                          {activeContent.direction && (
                            <div className="generate-beat-caption">
                              <strong>
                                {activeContent.direction.framing} shot
                              </strong>
                              <p>{activeContent.direction.action}</p>
                              <small>
                                Bridge: {activeContent.direction.bridge}
                              </small>
                            </div>
                          )}
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
                            <div className="generate-field">
                              <Label>Default scene motion</Label>
                              <SelectField
                                label="Scene motion"
                                value={activeContent.motionPlan || ""}
                                disabled={!!busy}
                                options={motionPlanOptions.filter(
                                  (option) => option.value,
                                )}
                                onChange={(value) =>
                                  patchContent({
                                    motionPlan: (value ||
                                      undefined) as GeneratedFrame["motionPlan"],
                                  })
                                }
                              />
                            </div>
                            {activeContent.composition && (
                              <CompositionReview
                                key={selected}
                                value={activeContent.composition}
                                assets={review.resources.catalog}
                                seconds={scene.seconds}
                                disabled={!!busy}
                                onChange={(composition) =>
                                  patchContent({ composition })
                                }
                              />
                            )}
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
                                    patchContent({
                                      narration: event.target.value,
                                    })
                                  }
                                />
                                <small className="generate-hint">
                                  Audio tags stay in the script; captions use
                                  the spoken words.
                                </small>
                              </div>
                            )}
                          </div>
                        </>
                      )
                    )}
                  </section>
                </>
              )}
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
          {!busy && !error && !notice && catalogError && (
            <p role="status">
              Assets could not be loaded. Text, shapes, and teaching diagrams
              are still available.
            </p>
          )}
        </div>
        <footer className="generate-foot">
          <div>
            <p>
              {review
                ? reviewStep !== "animate"
                  ? "Approve the story, look, and storyboard before motion and speech. No canvas changes yet."
                  : voicedScenes
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
                <div className="generate-destination">
                  <span id="generate-destination-label">Add frames to</span>
                  <SelectField
                    label="Add frames to"
                    value={destination}
                    disabled={!!busy || !projects}
                    onChange={(value) =>
                      setDestination(
                        value as "current" | "new-page" | "new-canvas",
                      )
                    }
                    options={[
                      { value: "current", label: "Current page" },
                      { value: "new-page", label: "New page in this canvas" },
                      { value: "new-canvas", label: "New canvas" },
                    ]}
                  />
                </div>
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
                {reviewStep === "animate" &&
                  (audioFailed || (!!voicedScenes && !accountId)) && (
                    <Button
                      disabled={!!busy}
                      onClick={() => void addFrames(false)}
                    >
                      Add without audio
                    </Button>
                  )}
                {reviewStep !== "animate" ? (
                  <Button
                    variant="primary"
                    disabled={!!busy}
                    onClick={() => void approveReview()}
                  >
                    {reviewStep === "story"
                      ? "Approve story & check look"
                      : reviewStep === "look"
                        ? "Approve look & review storyboard"
                        : "Approve storyboard & preview motion"}
                  </Button>
                ) : (
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
                )}
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
