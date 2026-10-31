import type { ChromaKey } from "./video";
import { validateAudio, type AudioTrack, type VoiceoverDraft } from "./sound";
import {
  validateSubtitles,
  type SubtitleCue,
  type SubtitleStyle,
} from "./subtitles";
import { slugify } from "./identifiers";
import {
  validateAnimationData,
  syncNarrationTiming,
  type Animation,
  type SceneSettings,
} from "./animation";
import { withTemplateAnimation } from "./template-animation";
import {
  normalizeLatex,
  normalizePhysics,
  type LatexSpec,
  type PhysicsSpec,
} from "../../sidecar/science.mjs";
import {
  normalizeLearning,
  type LearningSpec,
} from "../../sidecar/learning.mjs";
import { learningSvg } from "./learning-drawing.mjs";
import { physicsSvg } from "./physics-drawing.mjs";
import {
  normalizeIllustration3D,
  illustration3DSvg,
  type Illustration3DSpec,
} from "./illustration3d.mjs";
import {
  fitPresetToFrame,
  resizeFrameLayout,
  validateFrameLayout,
  type FrameLayout,
} from "./preset-layout";

export type Element = {
  id: string;
  identifier?: string;
  t: "frame" | "text" | "rect" | "ellipse" | "line" | "img" | "video";
  n: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fid?: string;
  gid?: string;
  brandRole?: "logo" | "handle" | "footer" | "content";
  generationRole?: "editable" | "fixed" | "page-number";
  generationGroup?: string;
  hide?: boolean;
  lock?: boolean;
  text?: string;
  src?: string;
  latex?: LatexSpec;
  physics?: PhysicsSpec;
  learning?: LearningSpec;
  illustration3d?: Illustration3DSpec;
  chromaKey?: ChromaKey;
  videoStart?: number;
  videoLoop?: boolean;
  label?: string;
  aiDescription?: string;
  font?: string;
  align?: string;
  fit?: string;
  fill?: string;
  fill2?: string;
  stroke?: string;
  color?: string;
  tstroke?: string;
  shc?: string;
  size?: number;
  weight?: number;
  rot?: number;
  op?: number;
  lw?: number;
  r?: number;
  curve?: number;
  ls?: number;
  lh?: number;
  tsw?: number;
  sh?: number;
  shx?: number;
  shy?: number;
  bend?: number;
  dash?: number;
  animation?: Animation;
  scene?: SceneSettings;
  audioTracks?: AudioTrack[];
  voiceoverDraft?: VoiceoverDraft;
  subtitles?: SubtitleCue[];
  subtitleStyle?: SubtitleStyle;
  responsiveLayout?: FrameLayout;
};
export type Preset = {
  schemaVersion?: 2;
  name: string;
  identifier?: string;
  kind: "template" | "object";
  W?: number;
  H?: number;
  background?: string;
  objects: Element[];
  b?: number;
  scene?: SceneSettings;
  description?: string;
  useCases?: string[];
  tags?: string[];
  collection?: string;
  motion?: "none" | "auto";
  requiredAssets?: string[];
  reference?: { file: string; assetIdentifier: string };
  branding?: "siswa-juara";
  teachingArea?: { x: number; y: number; w: number; h: number };
};
export type CanvasDocument = {
  version: 1;
  metadata: {
    name: string;
    updatedAt: string;
    date?: string;
    dateRange?: { from: string; to?: string };
    post?: { name: string; caption: string; frameIds: string[] };
  };
  elements: Element[];
};
export const uid = () => crypto.randomUUID();
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const frames = (doc: CanvasDocument) =>
  doc.elements.filter((o) => o.t === "frame");
export const stamp = (doc: CanvasDocument): CanvasDocument => ({
  ...doc,
  metadata: { ...doc.metadata, updatedAt: new Date().toISOString() },
});
export function applyPreset(
  doc: CanvasDocument,
  preset: Preset,
  frameId?: string,
  replace = false,
): CanvasDocument {
  const next = copy(doc);
  let frame = next.elements.find((o) => o.id === frameId && o.t === "frame");
  const targetSize = frame ? { w: frame.w, h: frame.h } : undefined;
  if (preset.kind === "template") {
    if (replace && frame) {
      next.elements = next.elements.filter((o) => o.fid !== frame!.id);
      delete frame.responsiveLayout;
      Object.assign(frame, {
        w: preset.W || 1122,
        h: preset.H || 1402,
        fill: preset.background || "#ffffff",
        n: preset.name,
        identifier: preset.identifier || slugify(preset.name) || undefined,
        ...(preset.scene ? { scene: copy(preset.scene) } : {}),
      });
    } else {
      frame = {
        id: uid(),
        t: "frame",
        n: preset.name,
        identifier: preset.identifier || slugify(preset.name) || undefined,
        x: Math.max(20, ...frames(next).map((f) => f.x + f.w + 100)),
        y: 80,
        w: preset.W || 1122,
        h: preset.H || 1402,
        fill: preset.background || "#ffffff",
        scene: preset.scene ? copy(preset.scene) : undefined,
      };
      next.elements.push(frame);
    }
  }
  if (!frame) throw new Error("Add or select a frame first.");
  if (preset.kind === "object") preset = fitPresetToFrame(preset, frame);
  const groups = new Map<string, string>();
  for (const o of preset.objects)
    if (o.gid && !groups.has(o.gid)) groups.set(o.gid, uid());
  next.elements.push(
    ...preset.objects.map((o) => ({
      ...copy(o),
      identifier: o.identifier || slugify(o.n) || undefined,
      id: uid(),
      gid: o.gid ? groups.get(o.gid) : undefined,
      x: o.x + frame.x,
      y: o.y + frame.y,
      fid: frame.id,
    })),
  );
  if (preset.kind === "template" && targetSize)
    next.elements = resizeFrameLayout(next.elements, frame, {
      ...frame,
      ...targetSize,
    });
  return stamp(next);
}
export const initialDocument = (): CanvasDocument => ({
  version: 1,
  metadata: {
    name: "Siswa Juara design",
    updatedAt: new Date().toISOString(),
  },
  elements: [],
});

const types = new Set([
  "frame",
  "text",
  "rect",
  "ellipse",
  "line",
  "img",
  "video",
]);
const numbers = [
  "x",
  "y",
  "w",
  "h",
  "size",
  "weight",
  "rot",
  "op",
  "lw",
  "r",
  "curve",
  "ls",
  "lh",
  "tsw",
  "sh",
  "shx",
  "shy",
  "bend",
  "dash",
];
export function validateElements(value: unknown): Element[] {
  if (!Array.isArray(value) || value.length > 10000)
    throw new Error("elements must be an array with at most 10,000 items.");
  const ids = new Set<string>();
  const result = value.map((raw, i) => {
    if (!raw || typeof raw !== "object")
      throw new Error(`Element ${i + 1} must be an object.`);
    const o = { ...raw } as Element;
    if (!types.has(o.t) || typeof o.n !== "string")
      throw new Error(`Element ${i + 1} needs a valid type and name.`);
    for (const key of [
      "id",
      "identifier",
      "fid",
      "gid",
      "src",
      "font",
      "label",
      "aiDescription",
      "text",
      "generationGroup",
    ]) {
      const v = (o as unknown as Record<string, unknown>)[key];
      if (v !== undefined && typeof v !== "string")
        throw new Error(`Invalid ${key} on ${o.n}.`);
    }
    if (o.aiDescription !== undefined && o.aiDescription.length > 4000)
      throw Error("Use an AI description of at most 4,000 characters.");
    if (o.identifier !== undefined) {
      o.identifier = slugify(o.identifier);
      if (!o.identifier)
        throw new Error(
          `Identifier on ${o.n} must contain letters or numbers.`,
        );
    }
    if (
      o.brandRole !== undefined &&
      !["logo", "handle", "footer", "content"].includes(o.brandRole)
    )
      throw new Error("Invalid branding role.");
    if (
      o.generationRole !== undefined &&
      !["editable", "fixed", "page-number"].includes(o.generationRole)
    )
      throw new Error("Invalid generation role.");
    if (o.latex !== undefined) {
      if (o.t !== "img" || o.physics || o.learning || o.illustration3d)
        throw Error("LaTeX requires an equation image layer.");
      o.latex = normalizeLatex(o.latex);
    }
    if (o.physics !== undefined) {
      if (o.t !== "img" || o.latex || o.learning || o.illustration3d)
        throw Error("Physics requires a diagram image layer.");
      o.physics = normalizePhysics(o.physics);
    }
    if (o.learning !== undefined) {
      if (o.t !== "img" || o.latex || o.physics || o.illustration3d)
        throw Error("Learning requires a teaching diagram image layer.");
      o.learning = normalizeLearning(o.learning);
    }
    if (o.illustration3d !== undefined) {
      if (o.t !== "img" || o.latex || o.physics || o.learning)
        throw Error("3D illustrations require their own image layer.");
      o.illustration3d = normalizeIllustration3D(o.illustration3d);
    }
    for (const key of numbers) {
      const v = (o as unknown as Record<string, unknown>)[key];
      if (
        (["x", "y", "w", "h"].includes(key) || v !== undefined) &&
        (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 100000)
      )
        throw new Error(`Invalid ${key} on ${o.n}.`);
    }
    if (o.t !== "line" && (o.w <= 0 || o.h <= 0))
      throw new Error(`${o.n} must have positive dimensions.`);
    if (o.t === "frame" && (o.w > 16000 || o.h > 16000))
      throw new Error("Frame dimensions cannot exceed 16,000.");
    for (const key of ["r", "lw", "sh", "tsw"])
      if (((o as unknown as Record<string, number>)[key] || 0) < 0)
        throw new Error(`${key} cannot be negative.`);
    if (o.op !== undefined && (o.op < 0 || o.op > 1))
      throw new Error("Opacity must be between 0 and 1.");
    for (const key of ["fill", "fill2", "stroke", "color", "tstroke", "shc"]) {
      const color = (o as unknown as Record<string, unknown>)[key];
      if (
        color !== undefined &&
        (typeof color !== "string" ||
          !/^(#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i.test(
            color,
          ))
      )
        throw new Error(`${key} must be a hex color or transparent.`);
    }
    if (o.fit && !["contain", "cover"].includes(o.fit))
      throw new Error("Image fit must be contain or cover.");
    if (o.align && !["left", "center", "right"].includes(o.align))
      throw new Error("Text alignment must be left, center, or right.");
    if (
      o.t === "text" &&
      (typeof o.text !== "string" || typeof o.size !== "number" || o.size <= 0)
    )
      throw new Error(`${o.n} needs text and a positive font size.`);
    if (
      o.src &&
      !(
        o.t === "video"
          ? /^(data:video\/(mp4|webm|quicktime|x-m4v);|https?:\/\/|asset:|\/assets\/)/i
          : /^(data:image\/(png|jpeg|webp|gif|svg\+xml);|https?:\/\/|asset:)/i
      ).test(o.src)
    )
      throw new Error(
        "Media must use a supported data URL, HTTP(S), or Tauri asset URL.",
      );
    if (
      o.videoStart !== undefined &&
      (!Number.isFinite(o.videoStart) ||
        o.videoStart < 0 ||
        o.videoStart > 100000)
    )
      throw new Error("Video start must be between 0 and 100,000 seconds.");
    if (o.videoLoop !== undefined && typeof o.videoLoop !== "boolean")
      throw new Error("Video loop must be boolean.");
    if (o.chromaKey !== undefined) {
      const k = o.chromaKey;
      if (
        o.t !== "video" ||
        !k ||
        typeof k.enabled !== "boolean" ||
        !/^#[0-9a-f]{6}$/i.test(k.color) ||
        ![k.tolerance, k.softness, k.spill].every(
          (v) =>
            typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
        )
      )
        throw new Error("Invalid video chroma key settings.");
    }
    validateAnimationData(o);
    validateAudio(o);
    validateSubtitles(o);
    if (o.responsiveLayout !== undefined && o.t !== "frame")
      throw Error("Responsive layout requires a frame.");
    validateFrameLayout(o.responsiveLayout);
    o.id ||= uid();
    if (ids.has(o.id)) throw new Error(`Duplicate element id: ${o.id}`);
    ids.add(o.id);
    return o;
  });
  for (const o of result)
    if (o.fid && !result.some((f) => f.t === "frame" && f.id === o.fid))
      throw new Error(`Missing frame ${o.fid} for ${o.n}.`);
  return result;
}
export function parseDocument(value: unknown): CanvasDocument {
  const v = value as CanvasDocument;
  if (!v || v.version !== 1 || typeof v.metadata?.name !== "string")
    throw new Error("Expected version: 1 and metadata.name.");
  const post = v.metadata.post;
  if (
    post !== undefined &&
    (!post ||
      typeof post.name !== "string" ||
      post.name.length > 100 ||
      typeof post.caption !== "string" ||
      post.caption.length > 5000 ||
      !Array.isArray(post.frameIds) ||
      post.frameIds.length > 10 ||
      !post.frameIds.every((id) => typeof id === "string"))
  )
    throw Error("Invalid generated post metadata.");
  return stamp({
    version: 1,
    metadata: v.metadata,
    elements: syncNarrationTiming(validateElements(v.elements)),
  });
}
export function parsePresets(value: unknown): Preset[] {
  const raw = value as { presets?: unknown[] };
  return (Array.isArray(value) ? value : raw?.presets || [value]).map((v) => {
    const p = v as Preset;
    if (
      !p ||
      typeof p.name !== "string" ||
      !["object", "template"].includes(p.kind)
    )
      throw new Error("A preset needs name, kind, and objects.");
    if (
      p.identifier !== undefined &&
      (typeof p.identifier !== "string" || !slugify(p.identifier))
    )
      throw new Error("A preset identifier must contain letters or numbers.");
    if (
      p.kind === "template" &&
      (!(p.W! > 0) || !(p.H! > 0) || p.W! > 16000 || p.H! > 16000)
    )
      throw new Error("Template dimensions must be between 1 and 16,000.");
    if (p.teachingArea !== undefined) {
      const a = p.teachingArea;
      if (
        !a ||
        typeof a !== "object" ||
        ![a.x, a.y, a.w, a.h].every(Number.isFinite) ||
        a.x < 0 ||
        a.y < 0 ||
        a.w < 100 ||
        a.h < 100 ||
        a.x + a.w > (p.W || 0) ||
        a.y + a.h > (p.H || 0)
      )
        throw Error("Teaching visual area must fit inside the template.");
    }
    if (p.scene !== undefined)
      validateAnimationData({
        id: "preset",
        t: "frame",
        n: p.name,
        x: 0,
        y: 0,
        w: p.W || 1,
        h: p.H || 1,
        scene: p.scene,
      });
    if (p.schemaVersion !== undefined && p.schemaVersion !== 2)
      throw new Error("Unsupported preset schema version.");
    if (
      p.background !== undefined &&
      (typeof p.background !== "string" ||
        !/^(#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|transparent)$/i.test(
          p.background,
        ))
    )
      throw new Error("Invalid preset background.");
    for (const key of ["useCases", "tags", "requiredAssets"] as const)
      if (
        p[key] !== undefined &&
        (!Array.isArray(p[key]) || !p[key]!.every((v) => typeof v === "string"))
      )
        throw new Error(`Invalid preset ${key}.`);
    for (const key of ["description", "collection"] as const)
      if (p[key] !== undefined && typeof p[key] !== "string")
        throw new Error(`Invalid preset ${key}.`);
    if (p.motion !== undefined && !["none", "auto"].includes(p.motion))
      throw new Error("Invalid preset motion.");
    if (p.branding !== undefined && p.branding !== "siswa-juara")
      throw new Error("Invalid preset branding.");
    if (
      p.reference !== undefined &&
      (!p.reference ||
        typeof p.reference.file !== "string" ||
        typeof p.reference.assetIdentifier !== "string")
    )
      throw new Error("Invalid preset reference.");
    return withTemplateAnimation({
      ...p,
      identifier: p.identifier ? slugify(p.identifier) : slugify(p.name),
      b: undefined,
      objects: validateElements(p.objects),
    });
  });
}
export const equationKinds = [
  "LaTeX equation",
  "Physics diagram",
  "Learning diagram",
  "3D illustration",
] as const;
export const elementKinds = [
  "Text",
  "Heading",
  "Paragraph",
  "Curved text",
  "Box",
  "Rounded box",
  "Circle",
  "Line",
  "Curve",
  "Image slot",
  "Pen",
  "Pencil",
  "Brush",
] as const;
export function makeElement(kind: string): Element {
  const base: Element = {
    id: uid(),
    identifier: slugify(kind) || undefined,
    t: "rect",
    n: kind,
    x: 0,
    y: 0,
    w: 300,
    h: 180,
    fill: "#f7c600",
    stroke: "#14226e",
    lw: 0,
    rot: 0,
    op: 1,
  };
  if (["Text", "Heading", "Paragraph", "Curved text"].includes(kind))
    return {
      ...base,
      t: "text",
      w: kind === "Heading" ? 720 : 620,
      h: kind === "Paragraph" ? 200 : 130,
      text:
        kind === "Paragraph"
          ? "Write a paragraph\nover several lines."
          : kind === "Curved text"
            ? "Curved [c=#f7c600]text[/c]"
            : kind === "Heading"
              ? "Heading"
              : "Your text",
      size: kind === "Heading" ? 100 : 44,
      font: kind === "Heading" || kind === "Curved text" ? "Baloo 2" : "Nunito",
      weight: kind === "Paragraph" ? 400 : 800,
      align: "center",
      color: "#14226e",
      curve: kind === "Curved text" ? 120 : 0,
      tstroke: "#ffffff",
      tsw: 0,
    };
  if (kind === "Circle")
    return { ...base, t: "ellipse", w: 200, h: 200, fill: "#2f4bd8" };
  if (kind === "LaTeX equation")
    return {
      ...base,
      t: "img",
      w: 800,
      h: 240,
      color: "#112866",
      latex: {
        source: "\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}",
        displayMode: true,
      },
      fit: "contain",
      animation: {
        start: 0,
        enter: {
          preset: "reveal-left",
          duration: 1.4,
          easing: "ease-in-out",
          amount: 0,
        },
      },
    };
  if (kind === "3D illustration") {
    const illustration3d = normalizeIllustration3D();
    return {
      ...base,
      t: "img",
      w: 900,
      h: 620,
      illustration3d,
      src: illustration3DSvg(illustration3d),
      fit: "contain",
      animation: { start: 0 },
    };
  }
  if (kind === "Learning diagram") {
    const learning = normalizeLearning({ kind: "cube" });
    return {
      ...base,
      t: "img",
      w: 900,
      h: 500,
      color: "#0757ec",
      learning,
      src: learningSvg(learning),
      fit: "contain",
      animation: { start: 0 },
    };
  }
  if (kind === "Physics diagram") {
    const physics = normalizePhysics({ kind: "pendulum" });
    return {
      ...base,
      t: "img",
      w: 900,
      h: 500,
      color: "#0757ec",
      physics,
      src: physicsSvg(physics),
      fit: "contain",
      animation: { start: 0 },
    };
  }
  if (kind === "Line" || kind === "Curve")
    return {
      ...base,
      t: "line",
      h: 0,
      lw: 8,
      stroke: "#14226e",
      bend: kind === "Curve" ? 70 : 0,
    };
  if (kind === "Pen")
    return {
      ...base,
      t: "line",
      w: 260,
      h: 60,
      lw: 4,
      stroke: "#14226e",
      bend: 30,
      dash: 0,
    };
  if (kind === "Pencil")
    return {
      ...base,
      t: "line",
      w: 260,
      h: 60,
      lw: 3,
      stroke: "#14226e",
      bend: 30,
      dash: 1,
    };
  if (kind === "Brush")
    return {
      ...base,
      t: "line",
      w: 280,
      h: 80,
      lw: 14,
      stroke: "#2f4bd8",
      bend: 40,
      dash: 0,
    };
  if (kind === "Image slot")
    return {
      ...base,
      t: "img",
      w: 300,
      h: 300,
      label: "Image slot",
      identifier: "image-slot-original-front",
      fit: "contain",
    };
  return { ...base, r: kind === "Rounded box" ? 40 : 0 };
}
