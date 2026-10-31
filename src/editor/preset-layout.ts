import type { Element, Preset } from "./model";
import { bounds } from "./scene";
import { withSceneSafeLayout } from "./scene-safe-layout.mjs";

const metrics = [
  "size",
  "lw",
  "r",
  "tsw",
  "sh",
  "shx",
  "shy",
  "ls",
  "bend",
  "dash",
] as const;
const geometry = ["x", "y", "w", "h", ...metrics] as const;
type LayoutLayer = Pick<Element, "id" | "x" | "y" | "w" | "h"> &
  Partial<Pick<Element, (typeof metrics)[number]>>;
export type FrameLayout = { w: number; h: number; layers: LayoutLayer[] };
type Size = { w: number; h: number };

export function remapFrameLayout(
  layout: FrameLayout | undefined,
  ids: Map<string, string>,
) {
  return layout
    ? {
        ...layout,
        layers: layout.layers
          .filter((o) => ids.has(o.id))
          .map((o) => ({ ...o, id: ids.get(o.id)! })),
      }
    : undefined;
}

function restoreGeometry(o: Element, layer?: LayoutLayer): Element {
  if (!layer) return o;
  const next = { ...o };
  for (const key of geometry) {
    if (layer[key] !== undefined) next[key] = layer[key]!;
    else delete next[key];
  }
  return next;
}

function scale(o: Element, k: number, dx: number, dy: number): Element {
  const next = {
    ...o,
    x: o.x * k + dx,
    y: o.y * k + dy,
    w: o.w * k,
    h: o.h * k,
  };
  for (const key of metrics) if (o[key] !== undefined) next[key] = o[key]! * k;
  return next;
}

function area(objects: Element[]) {
  const boxes = objects.map(bounds);
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}

// Keep the authored composition together: text, cards, diagrams, and artwork
// share one transform, so their alignments and proportions remain intact.
export function layoutPresetObjects(
  objects: Element[],
  source: Size,
  target: Size,
  enforceSafeArea = true,
) {
  if (source.w === target.w && source.h === target.h) return objects;
  const sx = target.w / source.w,
    sy = target.h / source.h;
  const k = Math.min(sx, sy);
  const brandOffsets = new Map<string, { x: number; y: number }>();
  for (const role of ["logo", "handle", "footer"] as const) {
    const members = objects.filter((o) => o.brandRole === role);
    if (!members.length) continue;
    const b = area(members);
    const cx = b.x + b.w / 2;
    // Edge logos retain their inset; centered branding remains centered.
    const x =
      cx < source.w / 4
        ? 0
        : cx > source.w * 0.75
          ? target.w - source.w * k
          : (target.w - source.w * k) / 2;
    brandOffsets.set(role, {
      x,
      y: role === "footer" ? target.h - source.h * k : 0,
    });
  }
  const result = objects.map((o) => {
    const brand = brandOffsets.get(o.brandRole || "");
    if (brand) return scale(o, k, brand.x, brand.y);
    // Full-bleed surfaces and edge rules fill the chosen frame. Interior cards
    // stay with their content instead of stretching away from the text.
    const surface = ["rect", "img", "video"].includes(o.t) && !o.rot;
    const fullX = o.x <= 1 && o.x + o.w >= source.w - 1;
    const fullY = o.y <= 1 && o.y + o.h >= source.h - 1;
    const edgeX = o.x <= 1 || o.x + o.w >= source.w - 1;
    const edgeY = o.y <= 1 || o.y + o.h >= source.h - 1;
    if (
      surface &&
      ((fullX && fullY) ||
        (o.t === "rect" && ((fullY && edgeX) || (fullX && edgeY))))
    ) {
      const next = scale(o, k, 0, 0);
      if (fullX) {
        next.x = o.x * sx;
        next.w = o.w * sx;
      } else if (o.x + o.w >= source.w - 1) next.x += target.w - source.w * k;
      if (fullY) {
        next.y = o.y * sy;
        next.h = o.h * sy;
      } else if (o.y + o.h >= source.h - 1) next.y += target.h - source.h * k;
      return next;
    }
    return scale(
      o,
      k,
      (target.w - source.w * k) / 2,
      (target.h - source.h * k) / 2,
    );
  });
  return enforceSafeArea && objects.some((o) => o.brandRole === "handle")
    ? withSceneSafeLayout({ name: "Layout", kind: "template", branding: "siswa-juara",
        W: target.w, H: target.h, objects: result }).objects
    : result;
}

export function fitPresetToFrame(preset: Preset, target: Size): Preset {
  if (preset.kind === "object") {
    if (!preset.objects.length) return preset;
    const b = area(preset.objects);
    const k = Math.min(
      1,
      (target.w * 0.92) / Math.max(1, b.w),
      (target.h * 0.92) / Math.max(1, b.h),
    );
    return {
      ...preset,
      objects: preset.objects.map((o) =>
        scale(
          o,
          k,
          (target.w - b.w * k) / 2 - b.x * k,
          (target.h - b.h * k) / 2 - b.y * k,
        ),
      ),
    };
  }
  const source = { w: preset.W || 1122, h: preset.H || 1402 };
  const k = Math.min(target.w / source.w, target.h / source.h);
  return withSceneSafeLayout({
    ...preset,
    W: target.w,
    H: target.h,
    objects: layoutPresetObjects(preset.objects, source, target, false),
    ...(preset.teachingArea
      ? {
          teachingArea: {
            x: preset.teachingArea.x * k + (target.w - source.w * k) / 2,
            y: preset.teachingArea.y * k + (target.h - source.h * k) / 2,
            w: preset.teachingArea.w * k,
            h: preset.teachingArea.h * k,
          },
        }
      : {}),
  });
}

// Store geometry only, never a second copy of text or embedded media. This
// prevents repeated aspect-ratio changes from progressively shrinking layers.
export function resizeFrameLayout(
  elements: Element[],
  before: Element,
  after: Element,
): Element[] {
  if (before.w === after.w && before.h === after.h) return elements;
  const children = elements.filter((o) => o.fid === before.id);
  const local = children.map((o) => ({
    ...o,
    x: o.x - before.x,
    y: o.y - before.y,
  }));
  let layout = before.responsiveLayout;
  if (layout) {
    const stored = new Map(layout.layers.map((o) => [o.id, o]));
    const basis = local.map((o) => restoreGeometry(o, stored.get(o.id)));
    const expected = layoutPresetObjects(basis, layout, before);
    // A manual geometry edit establishes a fresh basis, preserving local edits.
    if (
      stored.size !== local.length ||
      local.some(
        (o, i) =>
          !stored.has(o.id) ||
          geometry.some(
            (key) => Math.abs((o[key] || 0) - (expected[i][key] || 0)) > 0.001,
          ),
      )
    )
      layout = undefined;
  }
  if (!layout)
    layout = {
      w: before.w,
      h: before.h,
      layers: local.map((o) => {
        const layer: LayoutLayer = { id: o.id, x: o.x, y: o.y, w: o.w, h: o.h };
        for (const key of metrics)
          if (o[key] !== undefined) layer[key] = o[key];
        return layer;
      }),
    };
  const stored = new Map(layout.layers.map((o) => [o.id, o]));
  const resized = new Map(
    layoutPresetObjects(
      local.map((o) => restoreGeometry(o, stored.get(o.id))),
      layout,
      after,
    ).map((o) => [o.id, { ...o, x: o.x + after.x, y: o.y + after.y }]),
  );
  return elements.map((o) =>
    o.id === after.id
      ? { ...after, responsiveLayout: layout }
      : resized.get(o.id) || o,
  );
}

export function validateFrameLayout(value: FrameLayout | undefined) {
  if (value === undefined) return;
  if (
    !value ||
    ![value.w, value.h].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 16000,
    ) ||
    !Array.isArray(value.layers) ||
    value.layers.length > 10000
  )
    throw Error("Invalid responsive frame layout.");
  const ids = new Set<string>();
  for (const layer of value.layers) {
    if (
      !layer ||
      typeof layer.id !== "string" ||
      ids.has(layer.id) ||
      geometry.some(
        (key) =>
          (["x", "y", "w", "h"].includes(key) || layer[key] !== undefined) &&
          (typeof layer[key] !== "number" ||
            !Number.isFinite(layer[key]) ||
            Math.abs(layer[key]!) > 100000),
      )
    )
      throw Error("Invalid responsive layer geometry.");
    ids.add(layer.id);
  }
}
