import type { Element, Preset } from "./model";
import type { GeneratedFrame } from "../../sidecar/generate.mjs";
import { brandingRole, isSceneSurface } from "./scene-safe-layout.mjs";

export const motionPlanOptions = [
  { value: "", label: "Template motion" },
  { value: "hold", label: "Reading pause" },
  { value: "build", label: "Build step by step" },
  { value: "focus", label: "Focus on one idea" },
  { value: "compare", label: "Compare two sides" },
  { value: "resolve", label: "Answer and recap" },
];

// Plans change only ordinary animation settings. The same settings are used by
// review previews, canvas playback and image/video export, and remain editable.
export function withGenerationMotion(
  preset: Preset,
  plan: GeneratedFrame["motionPlan"],
  seconds: number,
): Preset {
  if (!plan) return preset;
  const w = preset.W || 1122,
    h = preset.H || 1402;
  const content = preset.objects.filter(
    (o) => !brandingRole(o) && !isSceneSurface(o, w, h),
  );
  const cards = content.filter((o) => o.t === "rect" || o.t === "ellipse");
  const groups = new Map<string, Element[]>();
  for (const o of content)
    if (o.gid) groups.set(o.gid, [...(groups.get(o.gid) || []), o]);
  const headline = (o: Element) => o.generationGroup?.startsWith("headline-");
  const cue = (o: Element) => {
    if (plan === "hold") return 0;
    // A card and everything inside it enter together. Choose the outermost
    // card so nested panels cannot disappear underneath a visible label.
    const parent = cards
      .filter(
        (b) =>
          b !== o &&
          b.w * b.h > o.w * o.h &&
          o.x >= b.x &&
          o.y >= b.y &&
          o.x + o.w <= b.x + b.w + 1 &&
          o.y + o.h <= b.y + b.h + 1,
      )
      .sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const members = o.gid ? groups.get(o.gid) : undefined;
    const group = members?.length
      ? {
          x: Math.min(...members.map((m) => m.x)),
          y: Math.min(...members.map((m) => m.y)),
          w:
            Math.max(...members.map((m) => m.x + m.w)) -
            Math.min(...members.map((m) => m.x)),
        }
      : undefined;
    const anchor = group || parent || o;
    if (headline(o) && !parent) return 0;
    if (plan === "build")
      return 0.25 + Math.max(0, Math.min(1, anchor.y / h)) * 1.2;
    if (plan === "compare") return anchor.x + anchor.w / 2 > w / 2 ? 0.9 : 0.2;
    return plan === "resolve" ? 0.35 : 0.15;
  };
  return {
    ...preset,
    objects: preset.objects.map((o) => {
      if (brandingRole(o) || isSceneSurface(o, w, h)) return o;
      // Reveal effects preserve the safe resting geometry throughout playback.
      const start = Math.min(cue(o), Math.max(0, seconds - 2));
      const visual = o.t === "img" || o.t === "video";
      const effect =
        plan === "build"
          ? "reveal-up"
          : plan === "compare"
            ? "reveal-left"
            : plan === "focus" && visual
              ? "zoom"
              : "fade";
      return {
        ...o,
        animation: {
          start,
          end: seconds,
          ...(plan === "hold"
            ? {}
            : {
                enter: {
                  preset: effect,
                  duration: plan === "resolve" ? 0.45 : 0.35,
                  easing: "ease-out" as const,
                  amount: effect === "zoom" ? 6 : 0,
                },
              }),
        },
      };
    }),
  };
}
