import type { GeneratedFrame } from "../../sidecar/generate.mjs";
import type {
  CompositionAsset,
  CompositionLayer,
} from "../../sidecar/scene-composition.mjs";
import { libraryAssets, loadAsset, type LibraryAsset } from "./assets";
import {
  copy,
  frames,
  type CanvasDocument,
  type Element,
  type Preset,
} from "./model";
import { loadPreset, type PresetSummary } from "./preset-catalog";
import { resolvePresetAssets } from "./resolve-assets";
import { withStandardBranding } from "./standard-branding";
import { brandingRole, sceneSafeArea } from "./scene-safe-layout.mjs";
import { projectLogo } from "../lib/brand";
import { prepareScienceElement } from "./science";
import { ensureDocumentFonts } from "../lib/fonts";
import { withGenerationMotion } from "./generation-motion";
import { bounds } from "./scene";
import {
  illustration3DModels,
  normalizeIllustration3D,
} from "./illustration3d.mjs";

type Source =
  { asset: LibraryAsset } | { preset: PresetSummary } | { element: Element };
export type CompositionResources = {
  catalog: CompositionAsset[];
  sources: Map<string, Source>;
  loaded: Map<string, Promise<Element[]>>;
};

// Metadata only. No media reads, paths, source URLs or binary data enter a prompt.
export function compositionResources(
  doc: CanvasDocument,
  selectedIds: string[],
  presets: PresetSummary[],
  context: string,
): CompositionResources {
  const selected = new Set(selectedIds);
  const selectedFrames = new Set(
    doc.elements.filter((o) => selected.has(o.id)).map((o) => o.fid || o.id),
  );
  const candidates: {
    descriptor: Omit<CompositionAsset, "ref">;
    source: Source;
    priority: number;
  }[] = [];
  for (const o of doc.elements) {
    if (
      o.t === "frame" ||
      o.hide ||
      brandingRole(o) ||
      (selectedFrames.size && !selectedFrames.has(o.fid || ""))
    )
      continue;
    if (!["img", "video", "rect", "ellipse", "line"].includes(o.t)) continue;
    if (
      (o.t === "img" || o.t === "video") &&
      !o.src &&
      !o.latex &&
      !o.physics &&
      !o.learning &&
      !o.illustration3d
    )
      continue;
    const {
      fid,
      gid,
      audioTracks,
      voiceoverDraft,
      subtitles,
      subtitleStyle,
      scene,
      responsiveLayout,
      ...element
    } = copy(o);
    candidates.push({
      descriptor: {
        name: o.n,
        kind: "element",
        description:
          o.aiDescription ||
          (o.learning
            ? `Editable learning diagram: ${o.learning.kind}`
            : o.physics
              ? `Editable physics diagram: ${o.physics.kind}`
              : o.latex
                ? `Equation: ${o.latex.source}`
                : o.illustration3d
                  ? `Editable 3D diagram: ${o.illustration3d.scene}`
                  : `Existing ${o.t} layer; visual contents have not been inspected.`),
      },
      source: { element },
      priority: 20,
    });
  }
  for (const [scene, model] of Object.entries(illustration3DModels)) {
    const illustration3d = normalizeIllustration3D({ scene });
    candidates.push({
      descriptor: {
        name: `${model.label} · 3D`,
        kind: "element",
        description: `${model.description} ${model.formula}. Default parameters: ${JSON.stringify(illustration3d.parameters)}. ${model.keywords}`,
      },
      source: {
        element: {
          id: `builtin-3d-${scene}`,
          t: "img",
          n: `${model.label} · 3D`,
          x: 0,
          y: 0,
          w: 900,
          h: 620,
          illustration3d,
          fit: "contain",
        },
      },
      priority: 1,
    });
  }
  for (const asset of libraryAssets)
    candidates.push({
      descriptor: {
        name: asset.name,
        kind: asset.type === "video" ? "video" : "image",
        description: `${asset.category}. ${asset.keywords}`,
      },
      source: { asset },
      priority: 0,
    });
  for (const preset of presets.filter((p) => p.kind === "object"))
    candidates.push({
      descriptor: {
        name: preset.name,
        kind: "element",
        description: `${preset.description || ""} ${(preset.tags || []).join(" ")}`,
      },
      source: { preset },
      priority: 1,
    });
  const terms = [
    ...new Set(context.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []),
  ];
  const score = (c: (typeof candidates)[number]) =>
    c.priority +
    terms.reduce(
      (n, term) =>
        n +
        (`${c.descriptor.name} ${c.descriptor.description}`
          .toLowerCase()
          .includes(term)
          ? 3
          : 0),
      0,
    );
  const chosen = candidates
    .map((c, i) => ({ ...c, index: i, score: score(c) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 240);
  const sources = new Map<string, Source>();
  const catalog = chosen.map(({ descriptor, source }, i) => {
    const ref = `asset-${i + 1}`;
    sources.set(ref, source);
    return {
      ...descriptor,
      ref,
      name: descriptor.name.slice(0, 200),
      description: descriptor.description.slice(0, 600),
    };
  });
  return { catalog, sources, loaded: new Map() };
}

export async function blankGenerationFrame(
  doc: CanvasDocument,
  selectedIds: string[],
): Promise<Preset> {
  const selected = doc.elements.find((o) => selectedIds.includes(o.id));
  const frame =
    frames(doc).find((o) => o.id === (selected?.fid || selected?.id)) ||
    frames(doc)[0];
  const W = frame?.w || 1080,
    H = frame?.h || 1920;
  return withStandardBranding({
    kind: "template",
    name: "AI scene",
    identifier: "ai-scene",
    W,
    H,
    background: "#ffffff",
    branding: "siswa-juara",
    objects: [
      {
        id: "brand-logo",
        t: "img",
        n: "Siswa Juara logo",
        brandRole: "logo",
        generationRole: "fixed",
        src: projectLogo,
        x: 0,
        y: 0,
        w: 200,
        h: 200,
        fit: "contain",
      },
      {
        id: "brand-handle",
        identifier: "handle",
        t: "text",
        n: "Handle",
        brandRole: "handle",
        generationRole: "fixed",
        text: "@siswajuaraofficial",
        x: 0,
        y: 0,
        w: 400,
        h: 60,
        size: 36,
      },
    ],
  });
}

async function sourceElements(
  ref: string,
  resources: CompositionResources,
): Promise<Element[]> {
  const source = resources.sources.get(ref);
  if (!source)
    throw Error(
      "This generated scene references an unavailable asset. Generate again with the current library.",
    );
  if (!resources.loaded.has(ref)) {
    const request = (async () => {
      if ("element" in source)
        return [await prepareScienceElement(copy(source.element))];
      if ("preset" in source) {
        const preset = await resolvePresetAssets(
          await loadPreset(source.preset),
        );
        const objects = preset.objects.filter(
          (o) => !brandingRole(o) && !o.hide,
        );
        if (
          !objects.length ||
          objects.some((o) => (o.t === "img" || o.t === "video") && !o.src)
        )
          throw Error(
            `The element “${source.preset.name}” needs media. Connect its asset pack and try again.`,
          );
        return objects;
      }
      const a = source.asset;
      return [
        {
          id: ref,
          t: a.type === "video" ? ("video" as const) : ("img" as const),
          n: a.name,
          x: 0,
          y: 0,
          w: a.width,
          h: a.height,
          src: await loadAsset(a),
          fit: "contain",
          chromaKey: a.chromaKey,
          videoLoop: a.type === "video",
        },
      ];
    })().catch((error) => {
      resources.loaded.delete(ref);
      throw error;
    });
    resources.loaded.set(ref, request);
  }
  return resources.loaded.get(ref)!;
}

function placedAsset(
  objects: Element[],
  box: Pick<Element, "x" | "y" | "w" | "h">,
  prefix: string,
): Element[] {
  const boxes = objects.map((o) => {
    const b = bounds(o),
      pad = Math.max(
        o.lw || 0,
        o.tsw || 0,
        (o.sh || 0) + Math.max(Math.abs(o.shx || 0), Math.abs(o.shy || 0)),
      );
    return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  });
  const left = Math.min(...boxes.map((o) => o.x)),
    top = Math.min(...boxes.map((o) => o.y));
  const width = Math.max(...boxes.map((o) => o.x + o.w)) - left,
    height = Math.max(...boxes.map((o) => o.y + o.h)) - top;
  const k = Math.min(box.w / Math.max(1, width), box.h / Math.max(1, height));
  return objects.map((o, i) => {
    const { fid, gid, animation, ...rest } = copy(o);
    const next: Element = {
      ...rest,
      id: `${prefix}-${i}`,
      gid: prefix,
      brandRole: "content",
      generationRole: "editable",
      lock: false,
      x: box.x + (box.w - width * k) / 2 + (o.x - left) * k,
      y: box.y + (box.h - height * k) / 2 + (o.y - top) * k,
      w: o.w * k,
      h: o.h * k,
    };
    for (const key of [
      "size",
      "lw",
      "r",
      "tsw",
      "sh",
      "shx",
      "shy",
      "ls",
    ] as const)
      if (o[key] !== undefined) next[key] = o[key]! * k;
    return next;
  });
}

export async function fillSceneComposition(
  blank: Preset,
  frame: GeneratedFrame,
  seconds: number,
  resources: CompositionResources,
  fitText: (element: Element, text: string) => Element,
): Promise<Preset> {
  const composition = frame.composition;
  if (!composition)
    throw Error("The generated scene has no composition. Generate again.");
  const W = blank.W || 1080,
    H = blank.H || 1920;
  const area = sceneSafeArea(W, H);
  // Extra breathing room contains small idle motion, strokes and pop/zoom entrances.
  const margin = Math.min(area.w, area.h) * 0.035;
  const safe = {
    x: area.x + margin,
    y: area.y + margin,
    w: area.w - margin * 2,
    h: area.h - margin * 2,
  };
  const result: Element[] = [],
    animations = new Map<
      string,
      {
        animation: NonNullable<CompositionLayer["animation"]>;
        cx: number;
        cy: number;
      }
    >();
  for (const [index, l] of composition.layers.entries()) {
    const id = `composed-${index + 1}`;
    const box = {
      x: safe.x + (safe.w * l.x) / 100,
      y: safe.y + (safe.h * l.y) / 100,
      w: (safe.w * l.w) / 100,
      h: (safe.h * l.h) / 100,
    };
    let objects: Element[];
    if (l.type === "asset")
      objects = placedAsset(
        await sourceElements(l.assetRef, resources),
        box,
        id,
      );
    else {
      let object: Element = {
        id,
        t:
          l.type === "text"
            ? "text"
            : ["rect", "ellipse", "line"].includes(l.type)
              ? (l.type as "rect" | "ellipse" | "line")
              : "img",
        n: l.name,
        ...box,
        generationRole: "editable",
        brandRole: "content",
      };
      if (l.type === "text")
        Object.assign(object, {
          text: l.text,
          size: (W * l.fontSize) / 100,
          font: "Nunito",
          weight: l.weight,
          align: l.align,
          color: l.color || "#1b2a7a",
          lh: 1.15,
          ...(l.role === "headline"
            ? { generationGroup: `headline-${index}` }
            : {}),
        });
      if (l.type === "rect" || l.type === "ellipse" || l.type === "line")
        Object.assign(object, {
          fill: l.fill || (l.type === "line" ? "none" : "#eaf1ff"),
          stroke: l.stroke || (l.type === "line" ? "#0757ec" : undefined),
          lw: (W * (l.strokeWidth ?? (l.type === "line" ? 0.3 : 0))) / 100,
          r: (W * (l.radius || 0)) / 100,
        });
      if (l.type === "learning" || l.type === "physics" || l.type === "latex")
        object = await prepareScienceElement({
          ...object,
          color: l.color || "#0757ec",
          fit: "contain",
          ...(l.type === "learning"
            ? { learning: l.settings }
            : l.type === "physics"
              ? { physics: l.settings }
              : { latex: { source: l.source, displayMode: true } }),
        });
      objects = [object];
    }
    for (const object of objects) {
      result.push(object);
      if (l.animation)
        animations.set(object.id, {
          animation: l.animation,
          cx: box.x + box.w / 2,
          cy: box.y + box.h / 2,
        });
    }
  }
  await ensureDocumentFonts(result);
  const fitted = result.map((o) =>
    o.t === "text" ? fitText(o, o.text || "") : o,
  );
  for (const o of fitted)
    if (o.t === "text" && !o.gid && (o.size || 0) < W * 0.045 - 0.1)
      throw Error(
        `“${o.n}” needs smaller copy or a larger text box to stay readable on a phone.`,
      );
  const texts = fitted.filter((o) => o.t === "text");
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i],
        b = texts[j];
      if (
        a.x < b.x + b.w - 1 &&
        a.x + a.w > b.x + 1 &&
        a.y < b.y + b.h - 1 &&
        a.y + a.h > b.y + 1
      )
        throw Error(
          `Text layers “${a.n}” and “${b.n}” overlap. Adjust their placement before approving this scene.`,
        );
    }
  const directed = withGenerationMotion(
    {
      ...blank,
      name: frame.title,
      background: composition.background,
      objects: [...fitted, ...copy(blank.objects)],
      scene: {
        duration: seconds,
        transition: composition.transition || { type: "cut", duration: 0.4 },
      },
    },
    frame.motionPlan || "build",
    seconds,
  );
  return {
    ...directed,
    objects: directed.objects.map((o) => {
      const entry = animations.get(o.id),
        a = entry?.animation;
      return a
        ? {
            ...o,
            animation: {
              start: a.start,
              end: seconds,
              enter: {
                preset: a.enter,
                duration: a.duration,
                easing: "ease-out",
                amount: a.enter === "zoom" || a.enter === "pop" ? a.amount : 0,
              },
              ...(a.keyframes
                ? {
                    keyframes: a.keyframes.map((k) => ({
                      time: k.time,
                      x:
                        (safe.w * k.dx) / 100 +
                        (o.x + o.w / 2 - entry!.cx) * (k.scale - 1),
                      y:
                        (safe.h * k.dy) / 100 +
                        (o.y + o.h / 2 - entry!.cy) * (k.scale - 1),
                      scale: k.scale,
                      rotation: 0,
                      opacity: k.opacity,
                      rotateY: 0,
                      z: 0,
                      easing: "ease-in-out" as const,
                    })),
                  }
                : {}),
              ...(a.motion !== "none"
                ? {
                    motion: {
                      preset: a.motion,
                      amount: a.amount,
                      easing: "sine-in-out",
                    },
                  }
                : {}),
            },
          }
        : o;
    }),
  };
}
