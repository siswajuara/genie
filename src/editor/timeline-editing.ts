import type { CanvasDocument, Element } from "./model";
import { clamp, identity, keyframePose, timing } from "./animation";

export function snapTimelineTime(
  value: number,
  fps: number,
  enabled: boolean,
  points: number[],
  pixelsPerSecond: number,
) {
  if (!enabled) return Math.round(value * 1000) / 1000;
  const grid = Math.round(value * fps) / fps,
    threshold = 8 / Math.max(1, pixelsPerSecond);
  let snapped = grid,
    distance = threshold;
  for (const point of points) {
    const delta = Math.abs(value - point);
    if (delta < distance) {
      distance = delta;
      snapped = point;
    }
  }
  return Math.round(snapped * 1e6) / 1e6;
}
export function moveTimelineClips(
  doc: CanvasDocument,
  ids: string[],
  delta: number,
  duration: number,
): CanvasDocument {
  const chosen = new Set(ids),
    frames = new Map(
      doc.elements.filter((o) => o.t === "frame").map((o) => [o.id, o]),
    );
  const items = doc.elements.filter(
    (o) =>
      chosen.has(o.id) &&
      o.t !== "frame" &&
      !o.lock &&
      !frames.get(o.fid ?? "")?.lock,
  );
  if (!items.length) return doc;
  const offset = clamp(
    delta,
    -Math.min(...items.map((o) => timing(o, duration).start)),
    duration - Math.max(...items.map((o) => timing(o, duration).end)),
  );
  const movable = new Set(items.map((o) => o.id));
  return {
    ...doc,
    elements: doc.elements.map((o) => {
      if (!movable.has(o.id)) return o;
      const { start, end } = timing(o, duration);
      return {
        ...o,
        animation: {
          ...o.animation,
          start: Math.round((start + offset) * 1e6) / 1e6,
          end: Math.round((end + offset) * 1e6) / 1e6,
        },
      };
    }),
  };
}
export function addTimelineKeyframe(
  element: Element,
  sceneTime: number,
  duration: number,
): Element {
  const { start, end } = timing(element, duration),
    time = Math.round(clamp(sceneTime - start, 0, end - start) * 1e6) / 1e6;
  const keys = element.animation?.keyframes ?? [];
  if (
    keys.length >= 100 ||
    keys.some((key) => Math.abs(key.time - time) < 0.000001)
  )
    return element;
  const keyframes = [...keys];
  if (!keys.length && time > 0)
    keyframes.push({ ...identity, time: 0, easing: "linear" });
  keyframes.push({ ...keyframePose(keys, time), time, easing: "ease-in-out" });
  keyframes.sort((a, b) => a.time - b.time);
  return { ...element, animation: { ...element.animation, keyframes } };
}
