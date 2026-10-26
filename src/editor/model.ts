import type { ChromaKey } from "./video";
import { validateAudio, type AudioTrack, type VoiceoverDraft } from "./sound";
import {
  validateSubtitles,
  type SubtitleCue,
  type SubtitleStyle,
} from "./subtitles";
import builtins from "./presets.json";
import { slugify } from "./identifiers";
import {
  validateAnimationData,
  type Animation,
  type SceneSettings,
} from "./animation";
import { withTemplateAnimation } from "./templateAnimation";

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
  hide?: boolean;
  lock?: boolean;
  text?: string;
  src?: string;
  chromaKey?: ChromaKey;
  videoStart?: number;
  videoLoop?: boolean;
  label?: string;
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
};
export type Preset = {
  name: string;
  identifier?: string;
  kind: "template" | "object";
  W?: number;
  H?: number;
  objects: Element[];
  b?: number;
  scene?: SceneSettings;
};
export type CanvasDocument = {
  version: 1;
  metadata: {
    name: string;
    updatedAt: string;
    date?: string;
    dateRange?: { from: string; to?: string };
  };
  elements: Element[];
};
export const uid = () => crypto.randomUUID();
export const presets = (builtins as unknown as Preset[]).map(
  withTemplateAnimation,
);
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
  if (preset.kind === "template") {
    if (replace && frame) {
      next.elements = next.elements.filter((o) => o.fid !== frame!.id);
      Object.assign(frame, {
        w: preset.W || 1122,
        h: preset.H || 1402,
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
        fill: "#ffffff",
        scene: preset.scene ? copy(preset.scene) : undefined,
      };
      next.elements.push(frame);
    }
  }
  if (!frame) throw new Error("Add or select a frame first.");
  next.elements.push(
    ...preset.objects.map((o) => ({
      ...copy(o),
      identifier: o.identifier || slugify(o.n) || undefined,
      id: uid(),
      x: o.x + frame.x,
      y: o.y + frame.y,
      fid: frame.id,
    })),
  );
  return stamp(next);
}
export const initialDocument = () =>
  applyPreset(
    {
      version: 1,
      metadata: {
        name: "Siswa Juara design",
        updatedAt: new Date().toISOString(),
      },
      elements: [],
    },
    presets[0],
  );

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
      "text",
    ]) {
      const v = (o as unknown as Record<string, unknown>)[key];
      if (v !== undefined && typeof v !== "string")
        throw new Error(`Invalid ${key} on ${o.n}.`);
    }
    if (o.identifier !== undefined) {
      o.identifier = slugify(o.identifier);
      if (!o.identifier)
        throw new Error(
          `Identifier on ${o.n} must contain letters or numbers.`,
        );
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
  return stamp({
    version: 1,
    metadata: v.metadata,
    elements: validateElements(v.elements),
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
    return withTemplateAnimation({
      ...p,
      identifier: p.identifier ? slugify(p.identifier) : slugify(p.name),
      b: undefined,
      objects: validateElements(p.objects),
    });
  });
}
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
  if (kind === "Line" || kind === "Curve")
    return { ...base, t: "line", h: 0, lw: 8, bend: kind === "Curve" ? 70 : 0 };
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
