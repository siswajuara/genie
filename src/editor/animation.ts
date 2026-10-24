import type { Element } from "./model";
import { textEffects, type TextAnimation } from "./textAnimation";

export const effects = [
  "none",
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom",
  "zoom-3d",
  "flip",
  "spin",
  "pop",
  "bounce",
  "elastic",
  "rise",
  "drop",
  "swing",
  "rotate-in",
  "zoom-out",
  "reveal-left",
  "reveal-right",
  "reveal-up",
  "reveal-down",
] as const;
export const motions = [
  "none",
  "float",
  "pulse",
  "pan-left",
  "pan-right",
  "zoom-in",
  "zoom-out",
  "dolly-in",
  "dolly-out",
  "sway",
  "rock",
  "orbit",
  "breathe",
  "pan-up",
  "pan-down",
  "rotate-clockwise",
  "rotate-counterclockwise",
] as const;
export const easings = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "back-out",
  "sine-in-out",
  "bounce-out",
  "elastic-out",
] as const;
export const transitions = [
  "cut",
  "crossfade",
  "slide-left",
  "slide-right",
  "slide-up",
  "wipe",
  "zoom",
  "slide-down",
  "push-left",
  "push-right",
  "push-up",
  "push-down",
  "wipe-right",
  "wipe-up",
  "wipe-down",
  "circle-in",
  "circle-out",
  "diamond",
  "blinds",
  "fade-through-black",
  "fade-through-white",
  "zoom-out",
  "spin",
] as const;
export type Easing = (typeof easings)[number];
export type Effect = {
  preset: (typeof effects)[number];
  duration: number;
  easing: Easing;
  amount: number;
};
export type Motion = {
  preset: (typeof motions)[number];
  amount: number;
  easing: Easing;
};
export type Pose = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  rotateY: number;
  z: number;
};
export type Keyframe = Pose & { time: number; easing: Easing };
export type Animation = {
  start?: number;
  end?: number;
  enter?: Effect;
  exit?: Effect;
  motion?: Motion;
  depth?: number;
  keyframes?: Keyframe[];
  text?: TextAnimation;
};
export type SceneSettings = {
  duration: number;
  transition?: {
    type: (typeof transitions)[number];
    duration: number;
    easing?: Easing;
  };
  camera?: Motion;
};
export const DEFAULT_DURATION = 5;
export const identity: Pose = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  rotateY: 0,
  z: 0,
};
export const clamp = (n: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, n));
export const sceneDuration = (frame: Element) =>
  frame.scene?.duration ?? DEFAULT_DURATION;
export const effectLabel = (value: string) =>
  value
    .split("-")
    .map((part) =>
      part === "3d" ? "3D" : part[0].toUpperCase() + part.slice(1),
    )
    .join(" ");
export const defaultEffect = (preset: Effect["preset"] = "fade"): Effect => ({
  preset,
  duration: 0.6,
  easing: "ease-out",
  amount: 80,
});
export function timing(element: Element, duration: number) {
  const start = clamp(element.animation?.start ?? 0, 0, duration - 0.05);
  return {
    start,
    end: clamp(element.animation?.end ?? duration, start + 0.05, duration),
  };
}
export function ease(value: number, easing: Easing = "linear") {
  const t = clamp(value);
  if (easing === "ease-in") return t * t * t;
  if (easing === "ease-out") return 1 - (1 - t) ** 3;
  if (easing === "ease-in-out")
    return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  if (easing === "back-out")
    return 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
  if (easing === "sine-in-out") return -(Math.cos(Math.PI * t) - 1) / 2;
  if (easing === "bounce-out") {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t - 1.5 / 2.75) ** 2 + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t - 2.25 / 2.75) ** 2 + 0.9375;
    return 7.5625 * (t - 2.625 / 2.75) ** 2 + 0.984375;
  }
  if (easing === "elastic-out")
    return t === 0 || t === 1
      ? t
      : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
  return t;
}
function applyEffect(pose: Pose, effect: Effect | undefined, progress: number) {
  if (!effect || effect.preset === "none") return;
  const hidden = 1 - ease(progress, effect.easing),
    amount = effect.amount;
  pose.opacity *= clamp(1 - hidden);
  if (effect.preset === "slide-left") pose.x -= amount * hidden;
  if (effect.preset === "slide-right") pose.x += amount * hidden;
  if (effect.preset === "slide-up") pose.y -= amount * hidden;
  if (effect.preset === "slide-down") pose.y += amount * hidden;
  if (effect.preset === "zoom")
    pose.scale *= Math.max(0.01, 1 - (amount / 200) * hidden);
  if (effect.preset === "zoom-3d") {
    pose.z -= amount * 4 * hidden;
    pose.rotateY += 45 * hidden;
  }
  if (effect.preset === "flip") pose.rotateY += 85 * hidden;
  if (effect.preset === "spin") pose.rotation -= amount * hidden;
  const p = clamp(progress);
  if (effect.preset === "pop") pose.scale *= 0.6 + ease(p, "back-out") * 0.4;
  if (effect.preset === "bounce")
    pose.y -= amount * (1 - ease(p, "bounce-out"));
  if (effect.preset === "elastic")
    pose.scale *= Math.max(0.01, 0.5 + ease(p, "elastic-out") * 0.5);
  if (effect.preset === "rise") {
    pose.y += amount * hidden;
    pose.scale *= Math.max(0.01, 1 - hidden * 0.12);
  }
  if (effect.preset === "drop") {
    pose.y -= amount * hidden;
    pose.rotation -= 8 * hidden;
  }
  if (effect.preset === "swing")
    pose.rotation += (Math.sin(p * Math.PI * 3) * (1 - p) * amount) / 3;
  if (effect.preset === "rotate-in") {
    pose.rotation -= amount * hidden;
    pose.scale *= Math.max(0.01, 1 - hidden * 0.2);
  }
  if (effect.preset === "zoom-out")
    pose.scale *= Math.max(0.01, 1 + (amount / 200) * hidden);
}
export function motionPose(
  motion: Motion | undefined,
  progress: number,
  localTime: number,
): Pose {
  const pose = { ...identity };
  if (!motion) return pose;
  const amount = motion.amount,
    p = ease(progress, motion.easing);
  if (motion.preset === "float")
    pose.y = (-Math.sin(localTime * Math.PI) * amount) / 4;
  if (motion.preset === "pulse")
    pose.scale = 1 + (Math.sin(localTime * Math.PI) * amount) / 500;
  if (motion.preset === "pan-left") pose.x = -p * amount;
  if (motion.preset === "pan-right") pose.x = p * amount;
  if (motion.preset === "zoom-in") pose.scale = 1 + (p * amount) / 200;
  if (motion.preset === "zoom-out") pose.scale = 1 + ((1 - p) * amount) / 200;
  if (motion.preset === "dolly-in") pose.z = p * amount * 4;
  if (motion.preset === "dolly-out") pose.z = (1 - p) * amount * 4;
  if (motion.preset === "sway")
    pose.x = (Math.sin(localTime * Math.PI) * amount) / 4;
  if (motion.preset === "rock")
    pose.rotation = (Math.sin(localTime * Math.PI) * amount) / 10;
  if (motion.preset === "orbit") {
    pose.x = (Math.sin(localTime * Math.PI) * amount) / 4;
    pose.y = ((1 - Math.cos(localTime * Math.PI)) * amount) / 8;
  }
  if (motion.preset === "breathe")
    pose.scale = 1 + ((1 - Math.cos(localTime * Math.PI)) * amount) / 1000;
  if (motion.preset === "pan-up") pose.y = -p * amount;
  if (motion.preset === "pan-down") pose.y = p * amount;
  if (motion.preset === "rotate-clockwise") pose.rotation = p * amount;
  if (motion.preset === "rotate-counterclockwise") pose.rotation = -p * amount;
  return pose;
}
export function keyframePose(keys: Keyframe[] | undefined, time: number): Pose {
  if (!keys?.length) return { ...identity };
  if (time <= keys[0].time) return { ...keys[0] };
  const b = keys.findIndex((key) => key.time > time);
  if (b < 0) return { ...keys[keys.length - 1] };
  const left = keys[b - 1],
    right = keys[b],
    p = ease((time - left.time) / (right.time - left.time), right.easing);
  return Object.fromEntries(
    Object.keys(identity).map((key) => {
      const k = key as keyof Pose;
      return [key, left[k] + (right[k] - left[k]) * p];
    }),
  ) as Pose;
}
export function evaluateAnimation(
  element: Element,
  time: number,
  duration: number,
  reduced = false,
): Pose {
  const { start, end } = timing(element, duration),
    a = element.animation;
  const pose = { ...identity };
  if (time < start || time > end) return { ...pose, opacity: 0 };
  if (reduced || !a) return pose;
  const lifetime = end - start,
    local = time - start;
  const motion = motionPose(a.motion, local / lifetime, local);
  Object.assign(pose, motion);
  const enterDuration = Math.min(
    a.enter?.duration ?? 0,
    lifetime / (a.exit && a.exit.preset !== "none" ? 2 : 1),
  );
  const exitDuration = Math.min(
    a.exit?.duration ?? 0,
    lifetime / (a.enter && a.enter.preset !== "none" ? 2 : 1),
  );
  applyEffect(pose, a.enter, enterDuration ? local / enterDuration : 1);
  applyEffect(pose, a.exit, exitDuration ? (end - time) / exitDuration : 1);
  const key = keyframePose(a.keyframes, local);
  pose.x += key.x;
  pose.y += key.y;
  pose.scale *= key.scale;
  pose.opacity *= key.opacity;
  pose.rotation += key.rotation;
  pose.rotateY += key.rotateY;
  pose.z += key.z;
  pose.opacity = clamp(pose.opacity);
  pose.scale = Math.max(0.01, pose.scale);
  return pose;
}
export type SequenceEntry = {
  frame: Element;
  start: number;
  end: number;
  overlap: number;
};
export function buildSequence(frames: Element[]): SequenceEntry[] {
  let end = 0;
  return frames.map((frame, i) => {
    const duration = sceneDuration(frame),
      previous = frames[i - 1];
    const transition = previous?.scene?.transition;
    const overlap =
      transition && transition.type !== "cut"
        ? Math.min(
            transition.duration,
            sceneDuration(previous) / 2,
            duration / 2,
          )
        : 0;
    const start = end - overlap;
    end = start + duration;
    return { frame, start, end, overlap };
  });
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function number(value: unknown, lo: number, hi: number, label: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < lo ||
    value > hi
  )
    throw new Error(`${label} must be between ${lo} and ${hi}.`);
}
function choice(value: unknown, options: readonly string[], label: string) {
  if (typeof value !== "string" || !options.includes(value))
    throw new Error(`Invalid ${label}.`);
}
function validateMotion(value: unknown, effect: boolean) {
  const v = object(value, "Animation effect");
  choice(v.preset, effect ? effects : motions, "animation preset");
  choice(v.easing, easings, "animation easing");
  number(v.amount, 0, 500, "Animation amount");
  if (effect) number(v.duration, 0.05, 600, "Animation duration");
}
export function validateAnimationData(element: Element) {
  if (element.scene !== undefined) {
    if (element.t !== "frame")
      throw new Error("Only frames can have scene settings.");
    const s = object(element.scene, "Scene");
    number(s.duration, 0.1, 600, "Scene duration");
    if (s.transition !== undefined) {
      const t = object(s.transition, "Transition");
      choice(t.type, transitions, "scene transition");
      number(t.duration, 0.05, 10, "Transition duration");
      if (t.easing !== undefined)
        choice(t.easing, easings, "transition easing");
    }
    if (s.camera !== undefined) validateMotion(s.camera, false);
  }
  if (element.animation === undefined) return;
  if (element.t === "frame")
    throw new Error("Use scene.camera to animate a frame.");
  const a = object(element.animation, "Animation");
  if (a.start !== undefined) number(a.start, 0, 600, "Element start");
  if (a.end !== undefined) {
    number(a.end, 0.05, 600, "Element end");
    if ((a.end as number) <= ((a.start as number) ?? 0))
      throw new Error("Element end must be after its start.");
  }
  if (a.depth !== undefined) number(a.depth, -500, 500, "Layer depth");
  if (a.enter !== undefined) validateMotion(a.enter, true);
  if (a.exit !== undefined) validateMotion(a.exit, true);
  if (a.motion !== undefined) validateMotion(a.motion, false);
  if (a.text !== undefined) {
    if (element.t !== "text")
      throw new Error("Text reveals require a text element.");
    const text = object(a.text, "Text animation");
    choice(text.preset, textEffects, "text animation preset");
    choice(text.easing, easings, "text animation easing");
    number(text.duration, 0.05, 600, "Text reveal duration");
    number(text.delay, 0, 600, "Text reveal delay");
    if (text.reverse !== undefined && typeof text.reverse !== "boolean")
      throw new Error("Text reveal reverse must be a boolean.");
  }
  if (a.keyframes !== undefined) {
    if (!Array.isArray(a.keyframes) || a.keyframes.length > 100)
      throw new Error("Use at most 100 keyframes per element.");
    let previous = -1;
    for (const raw of a.keyframes) {
      const key = object(raw, "Keyframe");
      number(key.time, 0, 600, "Keyframe time");
      if ((key.time as number) <= previous)
        throw new Error("Keyframes must have unique times in ascending order.");
      previous = key.time as number;
      choice(key.easing, easings, "keyframe easing");
      for (const name of Object.keys(identity))
        number(
          key[name],
          name === "opacity" ? 0 : name === "scale" ? 0.01 : -10000,
          name === "opacity" ? 1 : name === "scale" ? 20 : 10000,
          `Keyframe ${name}`,
        );
    }
  }
}
