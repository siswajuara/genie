import {
  buildFrameContext,
  readableFrameText,
} from "../../sidecar/frame-context.mjs";
import {
  applyPreset,
  frames,
  parseDocument,
  type CanvasDocument,
  type Element,
  type Preset,
} from "./model";
import type {
  GeneratedFrame,
  GenerationScene,
} from "../../sidecar/generate.mjs";
import { ensureDocumentFonts } from "../lib/fonts";
import { loadPreset, type PresetSummary } from "./preset-catalog";
import { resolvePresetAssets } from "./resolve-assets";
import { withTemplateAnimation } from "./template-animation";
import { withGenerationSlots } from "./template-slots.mjs";
import { withGenerationMotion } from "./generation-motion";
import { prepareScienceElement } from "./science";
import { fillSceneComposition, type CompositionResources } from "./generation-composition";

export const GENERATION_PRESETS = [
  {
    id: "parent-tips",
    name: "Parent tips series",
    description: "Introduce, explain, explore, practice, recap.",
    frames: ["cover", "content", "image", "question", "list"],
  },
  {
    id: "question-explain",
    name: "Question & explanation",
    description: "Ask a question, reveal the answer, explain why.",
    frames: ["cover", "question", "answer", "explanation"],
  },
  {
    id: "concept",
    name: "Quick concept",
    description: "One idea with an explanation and takeaways.",
    frames: ["cover", "explanation", "list"],
  },
  {
    id: "single",
    name: "Single frame",
    description: "A focused message on one frame.",
    frames: ["content"],
  },
  {
    id: "math-steps",
    name: "Equation walkthrough",
    description: "Ask, calculate, explain the result.",
    frames: ["question", "answer", "explanation"],
  },
  {
    id: "school-lesson",
    name: "SD–SMA lesson",
    description:
      "Visual matematika, fisika, atau Bahasa Indonesia sesuai materi.",
    frames: ["cover", "content", "question", "answer", "explanation"],
  },
  {
    id: "physics-demo",
    name: "Physics demonstration",
    description: "Predict, simulate, explain, check the answer.",
    frames: ["question", "content", "explanation", "answer"],
  },
];
export const TONES = [
  { value: "warm", label: "Warm" },
  { value: "cheerful", label: "Cheerful" },
  { value: "calm", label: "Calm" },
  { value: "curious", label: "Curious" },
];
export const LANGUAGES = [
  { value: "id", label: "Indonesian" },
  { value: "en", label: "English" },
  { value: "ms", label: "Malay" },
];
export type SceneDraft = {
  useCase: string;
  templateId: string;
  tone: string;
  seconds: number;
  narrate: boolean;
  note: string;
  voiceId: string;
};
export const makeScenes = (
  preset: (typeof GENERATION_PRESETS)[number],
): SceneDraft[] =>
  preset.frames.map((useCase) => ({
    useCase,
    templateId: "",
    tone: "",
    seconds: 6,
    narrate: true,
    note:
      preset.id === "school-lesson"
        ? "Pelajaran SD, SMP, atau SMA; sesuaikan kedalaman materi dengan kelas dan tambahkan visual pembelajaran bila diperlukan."
        : preset.id === "math-steps"
          ? "Use editable LaTeX equations for this step."
          : preset.id === "physics-demo"
            ? "Use a supported physics model and matching LaTeX equations."
            : "",
    voiceId: "",
  }));
export const sceneLabel = (value: string) =>
  value[0].toUpperCase() + value.slice(1);

const educationalContext = (context: string) =>
  /\bSD\b|\bSMP\b|\bSMA\b|elementary|middle school|high school|trigonometri|trigonometry|pythagoras|vektor|vector|kuadrat|quadratic|peluang|probability|kalor|pemuaian|tumbukan|matematika|\bmath\b|fisika|physics|bangun|geometri|geometry|kubus|balok|tabung|kerucut|persegi|segitiga|lingkaran|limas|prisma|bola|pecahan|fraction|garis bilangan|koordinat|diagram batang|kalimat|bahasa indonesia|suku kata|sinonim|antonim|ide pokok|urutan cerita|bandul|pendulum|pegas|spring|projectile|parabola|katrol|tuas|apung|massa jenis|gelombang|wave|rangkaian|circuit|cahaya|pemantulan|sudut|nilai tempat|jam analog|jaring|perkalian|perbandingan|imbuhan|tanda baca|sebab|akibat|cerita|hidrolik|tekanan|pembiasan|gesekan|glbb|newton|kelembaman|aksi reaksi|fotosintesis|photosynthesis|biologi|biology/i.test(
    context,
  );
export function rankedSceneTemplates(
  catalog: PresetSummary[],
  useCase: string,
  context = "",
) {
  const terms = [
    ...new Set(context.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []),
  ];
  const score = (entry: PresetSummary) => {
    const text =
      `${entry.name} ${entry.description || ""} ${(entry.tags || []).join(" ")}`.toLowerCase();
    const science =
      (entry.tags?.includes("physics") &&
        /physics|fisika|pendulum|bandul|pegas|spring|projectile|parabola|circular|melingkar/i.test(
          context,
        )) ||
      (entry.tags?.includes("latex") &&
        /latex|equation|persamaan|pecahan|fraction|algebra|aljabar|matrix|matriks|integral/i.test(
          context,
        ));
    return (
      (entry.useCases?.includes(useCase) ? 20 : 0) +
      (science ? 28 : 0) +
      (entry.teachingArea && educationalContext(context) ? 80 : 0) +
      terms.reduce((sum, term) => sum + (text.includes(term) ? 3 : 0), 0)
    );
  };
  return catalog
    .filter((entry) => entry.kind === "template")
    .map((entry, index) => ({ entry, index, score: score(entry) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ entry }) => entry);
}
export function sceneTemplate(
  catalog: PresetSummary[],
  useCase: string,
  context = "",
  templateId = "",
) {
  return (
    catalog.find(
      (entry) => entry.kind === "template" && entry.identifier === templateId,
    ) || rankedSceneTemplates(catalog, useCase, context)[0]
  );
}
export function sequenceTemplates(
  catalog: PresetSummary[],
  scenes: SceneDraft[],
  context = "",
) {
  const used = new Set(scenes.map((scene) => scene.templateId).filter(Boolean));
  const isReference = (entry: PresetSummary) =>
    entry.collection === "Design references" ||
    entry.identifier.startsWith("reference-");
  return scenes.map((scene) => {
    if (scene.templateId)
      return sceneTemplate(catalog, scene.useCase, context, scene.templateId);
    const ranked = rankedSceneTemplates(
      catalog,
      scene.useCase,
      `${context} ${scene.note}`,
    );
    const matching = ranked.filter((entry) =>
      entry.useCases?.includes(scene.useCase),
    );
    const pool = matching.length ? matching : ranked;
    const scienceContext =
      educationalContext(`${context} ${scene.note}`) ||
      /latex|\bmath\b|matematika|equation|persamaan|pecahan|fraction|algebra|aljabar|matrix|matriks|integral|geometry|geometri|physics|fisika|pendulum|bandul|pegas|spring|projectile|proyektil|parabola|circular|melingkar|gravity|gravitasi|kinemat|velocity|kecepatan|percepatan/i.test(
        `${context} ${scene.note}`,
      );
    const general = pool.filter((entry) => !entry.tags?.includes("science"));
    const relevant = !scienceContext && general.length ? general : pool;
    // Reference reconstructions are faithful copies with per-line boxes and
    // external artwork dependencies. Prefer stable generation layouts for
    // auto-pick; references stay available via manual template choice.
    const stable = relevant.filter((entry) => !isReference(entry));
    const candidates = stable.length ? stable : relevant;
    const entry =
      candidates.find((entry) => !used.has(entry.identifier)) || candidates[0];
    if (entry) used.add(entry.identifier);
    return entry;
  });
}
function slotElements(preset: Preset) {
  const groups = new Map<string, Element[]>();
  for (const object of withGenerationSlots(preset).objects) {
    if (
      object.t !== "text" ||
      object.hide ||
      object.generationRole !== "editable"
    )
      continue;
    const key = object.generationGroup || object.id;
    groups.set(key, [...(groups.get(key) || []), object]);
  }
  const headline = [...groups.values()].filter((group) =>
    group[0].generationGroup?.startsWith("headline-"),
  );
  const singletons = [...groups.values()].filter(
    (group) => group.length === 1 && !group[0].generationGroup,
  );
  const merged = new Set<string>();
  const paragraphs: Element[][] = [];
  // Reference reconstructions split one paragraph across per-line boxes. Merge
  // narrow short fragments that stack in the same column into one paragraph
  // slot, so the model writes one cohesive text instead of ~10-char shards.
  // Wide/tall boxes, numbered list items, and overlapping callouts stay apart.
  const terminal = /[.!?…]["'”’)]?\s*$/;
  const small = singletons
    .filter((group) => {
      const o = group[0];
      return (o.w || 0) < (preset.W || 1122) * 0.62 && (o.h || 0) < 75;
    })
    .sort((a, b) => a[0].x - b[0].x || a[0].y - b[0].y);
  const columns: Element[][] = [];
  for (const group of small) {
    const o = group[0];
    const column = columns.find(
      (col) => Math.abs(col[col.length - 1].x - o.x) <= 120,
    );
    if (column) column.push(o);
    else columns.push([o]);
  }
  for (const column of columns) {
    column.sort((a, b) => a.y - b.y);
    let current: Element[] = [];
    for (const o of column) {
      const previous = current[current.length - 1];
      const gap = previous ? o.y - (previous.y + previous.h) : 0;
      const continues =
        previous &&
        gap >= -12 &&
        gap <= 120 &&
        !terminal.test((previous.text || "").trim());
      if (!previous || !continues) {
        if (current.length > 1) {
          paragraphs.push(current);
          for (const item of current) merged.add(item.id);
        } else if (current.length === 1) {
          // Single-line column: keep as its own slot unless a continuation follows.
        }
        current = [o];
      } else {
        current.push(o);
      }
    }
    if (current.length > 1) {
      paragraphs.push(current);
      for (const item of current) merged.add(item.id);
    }
  }
  const rest = [...groups.values()].filter(
    (group) => !(group.length === 1 && merged.has(group[0].id)),
  );
  const mergedGroups = paragraphs.map((group) =>
    group.sort((a, b) => a.y - b.y || a.x - b.x),
  );
  return [
    ...headline,
    ...rest.filter(
      (group) => !group[0].generationGroup?.startsWith("headline-"),
    ),
    ...mergedGroups,
  ].map((group) => group.sort((a, b) => a.y - b.y || a.x - b.x));
}
function capacity(o: Element) {
  // fitText() shrinks text to 55% before giving up, so measure what fits at
  // that minimum size. Measuring at the original size understates real
  // capacity ~3x and makes the model fail validation on normal headlines.
  const size = (o.size || 32) * 0.55;
  return Math.max(
    1,
    Math.min(
      1200,
      Math.floor(
        (o.w / (size * 0.58)) *
          Math.max(1, Math.floor(o.h / (size * (o.lh || 1.15)))) *
          0.85,
      ),
    ),
  );
}
export function textSlots(preset: Preset): GenerationScene["slots"] {
  const slots: GenerationScene["slots"] = slotElements(preset).map((group) => ({
    id: group[0].id,
    label: group[0].generationGroup?.startsWith("headline-")
      ? "Headline"
      : group[0].n,
    role: group[0].generationGroup?.startsWith("headline-")
      ? "headline"
      : "content",
    example: group.map((o) => o.text || "").join(" "),
    maxChars: Math.min(
      2000,
      group.reduce((sum, o) => sum + capacity(o), 0),
    ),
  }));
  return [
    ...slots,
    ...preset.objects
      .filter((o) => o.latex && !o.hide && o.generationRole !== "fixed")
      .map((o) => ({
        id: o.id,
        label: o.n,
        role: "latex" as const,
        example: o.latex!.source,
        maxChars: 1200,
      })),
  ];
}
export function physicsSlots(
  preset: Preset,
): NonNullable<GenerationScene["diagrams"]> {
  return preset.objects
    .filter((o) => o.physics && !o.hide && o.generationRole !== "fixed")
    .map((o) => ({ id: o.id, example: o.physics! }));
}
export function learningSlots(
  preset: Preset,
): NonNullable<GenerationScene["learning"]> {
  return preset.objects
    .filter((o) => o.learning && !o.hide && o.generationRole !== "fixed")
    .map((o) => ({ id: o.id, example: o.learning! }));
}
export function listItemCount(preset: Preset) {
  const labels = preset.objects.filter(
    (o) =>
      o.t === "text" &&
      !o.hide &&
      /^\d{1,2}[.)]?$/.test((o.text || "").trim()) &&
      o.w < (preset.W || 1122) * 0.2,
  );
  if (labels.length) return labels.length;
  const lines = textSlots(preset)
    .flatMap((slot) => slot.example.split("\n"))
    .filter((line) => /^\s*\d{1,2}[.)\s]/.test(line));
  return lines.length || undefined;
}
// Readable copy already on the page, for prefilling the Generate context.
// Prefers selected frames (or selected elements' parent frames); otherwise all
// frames in visual order. Skips chrome (branding, page numbers, use-case
// labels, generic calls to action, isolated bullets) so the model receives the
// story, not the furniture.
export function canvasContextText(
  doc: CanvasDocument,
  selectedIds: string[] = [],
): string {
  // This is only the editable prompt seed. Full, untruncated context travels
  // separately in both AI generation and narration requests.
  return readableFrameText(buildFrameContext(doc, selectedIds)).slice(0, 12000);
}
export async function prepareGenerationTemplates(entries: PresetSummary[]) {
  const loaded = new Map<string, Promise<Preset>>();
  return Promise.all(
    entries.map((entry) => {
      if (!loaded.has(entry.identifier))
        loaded.set(
          entry.identifier,
          loadPreset(entry)
            .then(resolvePresetAssets)
            .then((preset) =>
              withGenerationSlots(
                preset.objects.some((o) => o.animation)
                  ? preset
                  : withTemplateAnimation({ ...preset, motion: "auto" }),
              ),
            ),
        );
      return loaded.get(entry.identifier)!;
    }),
  );
}

// The canvas renderer draws explicit lines. Wrap and fit to each existing text box.
function fitText(element: Element, text: string): Element {
  const ctx = document.createElement("canvas").getContext("2d")!;
  const original = element.size || 32;
  for (let size = original; size >= original * 0.55; size -= 1) {
    ctx.font = `${element.weight || 800} ${size}px ${JSON.stringify(element.font || "Nunito")}`;
    const width = (line: string) =>
      ctx.measureText(line).width + [...line].length * (element.ls || 0);
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && width(next) > element.w) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    if (
      lines.every((line) => width(line) <= element.w) &&
      lines.length * size * (element.lh || 1.15) <= element.h
    )
      return { ...element, text: lines.join("\n"), size };
  }
  throw Error(
    `The generated text for “${element.n}” is too long. Shorten it before adding frames.`,
  );
}
// Limit a text box to the next text layer when legacy geometry overlaps it.
function safeTextBox(element: Element, objects: Element[]): Element {
  const next = objects
    .filter(
      (o) =>
        o.t === "text" &&
        !o.hide &&
        o.id !== element.id &&
        o.y > element.y &&
        o.y < element.y + element.h &&
        o.x < element.x + element.w &&
        o.x + o.w > element.x,
    )
    .sort((a, b) => a.y - b.y)[0];
  return next ? { ...element, h: Math.max(1, next.y - element.y) } : element;
}
function fillSlot(group: Element[], text: string): Element[] {
  if (group.length === 1) return [fitText(group[0], text)];
  const words = text.trim().split(/\s+/);
  const totalCapacity = group.reduce((sum, o) => sum + capacity(o), 0);
  // Choose word boundaries that keep the original font sizes as closely as possible.
  const memo = new Map<string, { objects: Element[]; cost: number } | null>();
  function split(
    at: number,
    start: number,
  ): { objects: Element[]; cost: number } | null {
    if (at === group.length)
      return start === words.length ? { objects: [], cost: 0 } : null;
    const key = `${at}:${start}`;
    if (memo.has(key)) return memo.get(key)!;
    let best: { objects: Element[]; cost: number } | null = null;
    for (
      let end = start + 1;
      end <= words.length - (group.length - at - 1);
      end++
    ) {
      let fitted: Element;
      try {
        fitted = fitText(group[at], words.slice(start, end).join(" "));
      } catch {
        continue;
      }
      const rest = split(at + 1, end);
      if (!rest) continue;
      const target = (text.length * capacity(group[at])) / totalCapacity;
      const cost =
        rest.cost +
        (1 - fitted.size! / (group[at].size || 32)) ** 2 +
        0.01 *
          ((words.slice(start, end).join(" ").length - target) /
            Math.max(1, target)) **
            2;
      if (!best || cost < best.cost)
        best = { objects: [fitted, ...rest.objects], cost };
    }
    memo.set(key, best);
    return best;
  }
  const result = split(0, 0);
  if (result) return result.objects;
  // A very short headline needs only the first box; clear the unused fragments.
  if (words.length < group.length)
    return group.map((o, index) =>
      index ? { ...o, text: "" } : fitText(o, text),
    );
  throw Error(
    "The generated headline does not fit. Shorten it before adding frames.",
  );
}
export async function fillGenerationTemplate(
  template: Preset,
  content: GeneratedFrame,
  scene: SceneDraft,
  index: number,
  total: number,
  resources?: CompositionResources,
): Promise<Preset> {
  if (content.composition) {
    if (!resources) throw Error("The scene asset catalog is missing. Generate again.");
    return fillSceneComposition(template, content, scene.seconds, resources, fitText);
  }
  template = withGenerationSlots(template);
  const filled = new Map<string, Element>();
  for (const group of slotElements(template)) {
    const entry = content.texts.find((t) => t.id === group[0].id);
    if (!entry) continue;
    for (const object of fillSlot(
      group.map((o) => safeTextBox(o, template.objects)),
      entry.text,
    ))
      filled.set(object.id, object);
  }
  const additions: Element[] = [];
  if (content.visual) {
    if (!template.teachingArea)
      throw Error(
        "Choose a template with a teaching visual area before adding a new diagram.",
      );
    const { x, y, w, h } = template.teachingArea,
      v = content.visual;
    additions.push(
      await prepareScienceElement({
        id: "ai-teaching-visual",
        identifier: "ai-teaching-visual",
        t: "img",
        n:
          v.type === "latex"
            ? "Generated equation"
            : v.type === "physics"
              ? "Generated physics diagram"
              : "Generated learning diagram",
        x,
        y,
        w,
        h,
        color: "#0757ec",
        fit: "contain",
        generationRole: "editable",
        animation: {
          start: 0.2,
          end: scene.seconds,
          enter: {
            preset: "fade",
            duration: 0.4,
            easing: "ease-out",
            amount: 0,
          },
        },
        ...(v.type === "learning"
          ? { learning: v.settings }
          : v.type === "physics"
            ? { physics: v.settings }
            : { latex: { source: v.source, displayMode: true } }),
      }),
    );
  }
  return withGenerationMotion({
    ...template,
    name: content.title,
    scene: {
      duration: scene.seconds,
      transition: { type: "cut", duration: 0.4 },
    },
    objects: [
      ...(await Promise.all(
        template.objects
          .filter(
            (o) =>
              !content.visual || o.identifier !== "teaching-visual-placeholder",
          )
          .map(async (o) => {
            let object = filled.get(o.id) || { ...o };
            const equation = content.texts.find((entry) => entry.id === o.id);
            if (o.latex && equation && o.generationRole !== "fixed")
              object = await prepareScienceElement({
                ...object,
                latex: { ...o.latex, source: equation.text },
              });
            const diagram = content.physics?.find((entry) => entry.id === o.id);
            if (o.physics && diagram && o.generationRole !== "fixed")
              object = await prepareScienceElement({
                ...object,
                physics: diagram.settings,
              });
            const teaching = content.learning?.find(
              (entry) => entry.id === o.id,
            );
            if (o.learning && teaching && o.generationRole !== "fixed")
              object = await prepareScienceElement({
                ...object,
                learning: teaching.settings,
              });
            if (o.generationRole === "page-number")
              object = fitText(o, `${index + 1}/${total}`);
            return object.animation
              ? {
                  ...object,
                  animation: { ...object.animation, end: scene.seconds },
                }
              : object;
          }),
      )),
      ...additions,
    ],
  }, content.motionPlan, scene.seconds);
}
export async function fillGenerationTemplates(
  templates: Preset[],
  content: GeneratedFrame[],
  scenes: SceneDraft[],
  resources?: CompositionResources,
) {
  await ensureDocumentFonts(templates.flatMap((p) => p.objects));
  return Promise.all(
    templates.map((template, index) =>
      fillGenerationTemplate(
        template,
        content[index],
        scenes[index],
        index,
        scenes.length,
        resources,
      ),
    ),
  );
}
export function appendGeneratedFrames(
  doc: CanvasDocument,
  templates: Preset[],
  frameData: Partial<Element>[],
  post?: { name: string; caption: string },
  frameId?: string,
) {
  let next = doc;
  const ids: string[] = [];
  templates.forEach((template, index) => {
    next = applyPreset(next, template, frameId);
    const frame = frames(next).at(-1)!;
    Object.assign(frame, frameData[index]);
    ids.push(frame.id);
  });
  if (post)
    next = {
      ...next,
      metadata: { ...next.metadata, post: { ...post, frameIds: ids } },
    };
  return { document: parseDocument(next), ids };
}
