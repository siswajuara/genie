import type { Element, Preset } from "./model";
import { defaultEffect, type Effect, type SceneSettings } from "./animation";

type Choreography = {
  title: Effect["preset"];
  artwork: Effect["preset"];
  bodyDelay: number;
};
const choreography: Record<string, Choreography> = {
  "Gawai dan Pemahaman": {
    title: "slide-down",
    artwork: "zoom",
    bodyDelay: 0.65,
  },
  "Ajak Baca Lagi": {
    title: "slide-down",
    artwork: "slide-right",
    bodyDelay: 0.7,
  },
  "Jawaban Belum Tepat": {
    title: "slide-left",
    artwork: "zoom",
    bodyDelay: 0.65,
  },
  "Belajar TKA": {
    title: "slide-down",
    artwork: "slide-right",
    bodyDelay: 0.75,
  },
  "Baca Cerita Bersama": {
    title: "slide-down",
    artwork: "zoom",
    bodyDelay: 0.65,
  },
  "Membaca dan Memahami": {
    title: "slide-down",
    artwork: "slide-left",
    bodyDelay: 0.7,
  },
  "Kenali Tiga Hal": { title: "slide-down", artwork: "zoom", bodyDelay: 0.7 },
  "Memilih Jawaban": { title: "slide-left", artwork: "zoom", bodyDelay: 0.65 },
  "Mulai dari Satu Bacaan": {
    title: "slide-down",
    artwork: "slide-right",
    bodyDelay: 0.75,
  },
  "Siapkan Perangkat": {
    title: "slide-down",
    artwork: "zoom",
    bodyDelay: 0.65,
  },
  "Tiga Pertanyaan saat Latihan": {
    title: "slide-left",
    artwork: "zoom",
    bodyDelay: 0.7,
  },
  "Tiga Pertanyaan untuk Anak": {
    title: "slide-down",
    artwork: "slide-right",
    bodyDelay: 0.7,
  },
  "Simulasi di Sekolah": {
    title: "slide-down",
    artwork: "zoom",
    bodyDelay: 0.65,
  },
};

const TEMPLATE_DURATION = 6;
const templateScene = (): SceneSettings => ({
  duration: TEMPLATE_DURATION,
  transition: { type: "cut", duration: 0.4 },
});

/** Cards and their contents share a cue, so text never drifts away from its background. */
export function withTemplateAnimation(preset: Preset): Preset {
  if (preset.kind !== "template") return preset;
  const width = preset.W ?? 1122,
    height = preset.H ?? 1402;
  const duration = preset.scene?.duration ?? TEMPLATE_DURATION;
  const profile = choreography[preset.name] ?? {
    title: "slide-down",
    artwork: "zoom",
    bodyDelay: 0.7,
  };
  const shapes = preset.objects.filter(
    (o) => o.t === "rect" || o.t === "ellipse",
  );
  function container(element: Element) {
    const cx = element.x + element.w / 2,
      cy = element.y + element.h / 2;
    return shapes
      .filter(
        (box) =>
          box !== element &&
          box.w * box.h > Math.abs(element.w * element.h) * 1.05 &&
          cx >= box.x &&
          cx <= box.x + box.w &&
          cy >= box.y &&
          cy <= box.y + box.h,
      )
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
  }
  const objects = preset.objects.map((element): Element => {
    if (element.animation || element.t === "frame") return element;
    const parent = container(element),
      anchor = parent ?? element;
    const footer = anchor.y >= height * 0.88;
    const header = anchor.y < height * 0.08 && anchor.h < height * 0.1;
    const headline =
      !footer &&
      ((element.t === "text" &&
        (element.size ?? 0) >= 60 &&
        element.y < height * 0.4) ||
        (anchor.y > height * 0.08 && anchor.y < height * 0.28));
    const mascot = element.t === "img" && /owl/i.test(element.n);
    const artwork =
      element.t === "img" && element.w * element.h > width * height * 0.035;
    const background =
      (element.t === "rect" || element.t === "ellipse") &&
      element.w * element.h > width * height * 0.75;
    let start = 0,
      enter = { ...defaultEffect("fade"), duration: 0.25, amount: 24 };
    if (headline) {
      start = 0.12 + Math.round((anchor.y / height) * 10) * 0.1;
      enter = { ...defaultEffect(profile.title), duration: 0.45, amount: 24 };
    } else if (mascot || artwork) {
      start = 0.5 + (element.x > width / 2 ? 0.12 : 0);
      enter = {
        ...defaultEffect(profile.artwork),
        duration: 0.65,
        amount: profile.artwork === "zoom" ? 22 : 28,
      };
    } else if (!footer && !header && !background) {
      start = Math.min(
        1.25,
        profile.bodyDelay + Math.round((anchor.y / height) * 5) * 0.12,
      );
      enter = { ...defaultEffect("fade"), duration: 0.4, amount: 24 };
    }
    return {
      ...element,
      animation: {
        start: Math.min(Math.round(start * 100) / 100, duration - 0.05),
        end: duration,
        ...(element.t === "text" &&
        !footer &&
        !header &&
        (headline || (element.text ?? "").split(/\s+/).length >= 4)
          ? {
              text: {
                preset: headline
                  ? ("character-rise" as const)
                  : ("word-by-word" as const),
                duration: Math.min(0.65, Math.max(0.05, 1.8 - start)),
                delay: 0,
                easing: "ease-out" as const,
              },
            }
          : {}),
        ...(background ? {} : { enter }),
        ...(mascot
          ? {
              depth: 35,
              motion: { preset: "float", amount: 8, easing: "linear" },
            }
          : {}),
      },
    };
  });
  return { ...preset, scene: preset.scene ?? templateScene(), objects };
}
