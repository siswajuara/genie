import {
  applyPreset,
  frames,
  parseDocument,
  parsePresets,
  uid,
  type CanvasDocument,
  type Element,
  type Preset,
} from "../editor/model";
import { resolvePresetAssets } from "../editor/resolveAssets";
import { ensureFont } from "../lib/fonts";
import { libraryAssets, loadAsset } from "../editor/assets";
import { defaultChromaKey } from "../editor/video";
import { PROTOTYPE_VOICE_ID } from "../../sidecar/voice-prototype.mjs";
import {
  audioIsCurrent,
  canvasMeasure,
  fitText,
  type Measure,
  type StoryDraft,
} from "./storyPipeline";

type SceneLayout = "text-top" | "image-top";
export type ScenePreset = {
  id: string;
  name: string;
  hint: string;
  /** Three dots shown in the picker: background, text, accent. */
  swatch: [string, string, string];
  background: (index: number) => string;
  text: string;
  sub: string;
  accent: string;
  layout: SceneLayout;
};
export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "cerah",
    name: "Cerah",
    hint: "Terang, teks di atas",
    swatch: ["#eff3ff", "#14226e", "#f7c600"],
    background: (i) => (i % 2 === 0 ? "#eff3ff" : "#fff8de"),
    text: "#14226e",
    sub: "#33407a",
    accent: "#f7c600",
    layout: "text-top",
  },
  {
    id: "senja",
    name: "Senja",
    hint: "Hangat, teks di atas",
    swatch: ["#ffe9d2", "#5b2d0e", "#e2701d"],
    background: (i) => (i % 2 === 0 ? "#ffe9d2" : "#ffd9b8"),
    text: "#5b2d0e",
    sub: "#8a4d22",
    accent: "#e2701d",
    layout: "text-top",
  },
  {
    id: "malam",
    name: "Malam",
    hint: "Gelap, teks di atas",
    swatch: ["#1b2350", "#ffffff", "#f7c600"],
    background: () => "#1b2350",
    text: "#ffffff",
    sub: "#c6cdf5",
    accent: "#f7c600",
    layout: "text-top",
  },
  {
    id: "sorot",
    name: "Sorot gambar",
    hint: "Gambar besar di atas",
    swatch: ["#f2f7ec", "#1e4620", "#57a05a"],
    background: (i) => (i % 2 === 0 ? "#f2f7ec" : "#e4f0da"),
    text: "#1e4620",
    sub: "#3c6b3e",
    accent: "#57a05a",
    layout: "image-top",
  },
];
export function scenePresetOf(scene: { preset?: string }): ScenePreset {
  return SCENE_PRESETS.find((p) => p.id === scene.preset) ?? SCENE_PRESETS[0];
}
/** Never let an overlong AI line block canvas creation; fall back to small text. */
function safeFit(
  value: string,
  box: { w: number; h: number },
  start: number,
  weight: number,
  lineHeight: number,
  measure: Measure,
) {
  try {
    return fitText(value, box, start, weight, lineHeight, measure);
  } catch {
    return { text: value.split("\n").slice(0, 8).join("\n"), size: 24 };
  }
}

export function buildScenePresets(
  story: StoryDraft,
  measure: Measure,
): Preset[] {
  const W = 1080,
    H = story.brief.format === "video" ? 1920 : 1350,
    font = "Nunito";
  return story.scenes.map((scene, i) => {
    const preset = scenePresetOf({ preset: scene.preset || story.preset });
    const imageTop = preset.layout === "image-top";
    const titleBox = { w: W - 144, h: H * (imageTop ? 0.18 : 0.2) },
      bodyBox = { w: W - 144, h: H * (imageTop ? 0.12 : 0.13) };
    const headline = scene.onScreenText?.trim() || scene.goal;
    const title = safeFit(headline, titleBox, 88, 800, 1.15, measure);
    const supporting = safeFit(
      scene.caption || scene.goal,
      bodyBox,
      40,
      600,
      1.25,
      measure,
    );
    const background = preset.background(i);
    const artY = imageTop ? H * 0.11 : H * 0.47,
      artH = H * (imageTop ? 0.34 : 0.31),
      headY = imageTop ? H * 0.47 : H * 0.105,
      bodyY = imageTop ? H * 0.67 : H * 0.315;
    const text = (
      n: string,
      content: string,
      x: number,
      y: number,
      w: number,
      h: number,
      size: number,
      weight = 800,
      color = preset.text,
    ): Element => ({
      id: uid(),
      t: "text",
      n,
      text: content,
      x,
      y,
      w,
      h,
      size,
      weight,
      font,
      color,
      align: "left",
      lh: 1.15,
      animation: {
        start: 0,
        enter: {
          preset: "fade",
          duration: 0.35,
          easing: "ease-out",
          amount: 20,
        },
      },
    });
    const objects: Element[] = [
      {
        id: uid(),
        t: "rect",
        n: "Background",
        x: 0,
        y: 0,
        w: W,
        h: H,
        fill: background,
        animation: {},
      },
      {
        id: uid(),
        t: "rect",
        n: "Accent",
        x: 72,
        y: 145,
        w: 100,
        h: 10,
        fill: preset.accent,
        r: 5,
        animation: {},
      },
      text(
        "Scene number",
        `${String(i + 1).padStart(2, "0")} / ${String(story.scenes.length).padStart(2, "0")}`,
        72,
        65,
        220,
        50,
        30,
      ),
      {
        ...text(
          "Headline",
          title.text,
          72,
          headY,
          titleBox.w,
          titleBox.h,
          title.size,
        ),
        animation: {
          start: 0,
          text: {
            preset: "character-rise",
            duration: 0.65,
            delay: 0,
            easing: "ease-out",
          },
        },
      },
      {
        ...text(
          "Supporting text",
          supporting.text,
          72,
          bodyY,
          bodyBox.w,
          bodyBox.h,
          supporting.size,
          600,
          preset.sub,
        ),
        lh: 1.25,
      },
      {
        id: uid(),
        t: "img",
        n: "Scene artwork",
        identifier: scene.identifier || undefined,
        label: scene.visual || "Add an illustration or video for this scene",
        x: 170,
        y: artY,
        w: W - 340,
        h: artH,
        fit: "contain",
        animation: {
          start: 0,
          enter: {
            preset: "zoom",
            duration: 0.45,
            easing: "ease-out",
            amount: 25,
          },
        },
      },
      {
        id: uid(),
        t: "img",
        n: "Siswa Juara logo",
        identifier: "siswa-juara-logo-blue-front",
        x: W - 170,
        y: 55,
        w: 95,
        h: 95,
        fit: "contain",
        animation: {},
      },
    ];
    const url = i >= story.scenes.length - 2 ? story.brief.url : "";
    if (url) {
      const fitted = safeFit(url, { w: W - 144, h: 70 }, 32, 600, 1.1, measure);
      objects.push(
        text(
          "Website",
          fitted.text,
          72,
          H * 0.94,
          W - 144,
          70,
          fitted.size,
          600,
        ),
      );
    }
    return {
      kind: "template",
      name: `${i + 1}. ${scene.goal}`.slice(0, 150),
      W,
      H,
      scene: {
        duration: Math.min(
          600,
          Math.max(
            scene.seconds,
            audioIsCurrent(scene) ? scene.audio!.duration : 0,
          ),
        ),
        transition: { type: "cut", duration: 0.3 },
      },
      objects,
    };
  });
}
export async function assembleStory(story: StoryDraft, base?: CanvasDocument) {
  if (!story.spine || !story.scenes.length)
    throw Error("Build and review your scenes first.");
  await Promise.all([ensureFont("Nunito", 800), ensureFont("Nunito", 600)]);
  const presets = parsePresets(
    buildScenePresets(story, canvasMeasure("Nunito")),
  );
  let document: CanvasDocument = base ?? {
    version: 1,
    metadata: { name: story.spine.title, updatedAt: new Date().toISOString() },
    elements: [],
  };
  const frameIds: string[] = [],
    missing: number[] = [];
  for (let i = 0; i < presets.length; i++) {
    let preset = await resolvePresetAssets(presets[i]);
    const selected = libraryAssets.find(
      (asset) =>
        asset.identifier === story.scenes[i].identifier &&
        asset.type === "video",
    );
    if (selected) {
      try {
        const src = await loadAsset(selected);
        preset = {
          ...preset,
          objects: preset.objects.map((o) =>
            o.n === "Scene artwork"
              ? {
                  ...o,
                  t: "video",
                  src,
                  chromaKey: selected.chromaKey ?? { ...defaultChromaKey },
                  videoStart: 0,
                  videoLoop: true,
                }
              : o,
          ),
        };
      } catch {
        /* Leave a visible, editable slot when the pack cannot be read. */
      }
    }
    if (!preset.objects.find((o) => o.n === "Scene artwork")?.src)
      missing.push(i + 1);
    document = applyPreset(document, preset);
    const frame = frames(document).at(-1)!;
    frameIds.push(frame.id);
    const scene = story.scenes[i],
      audio = audioIsCurrent(scene) ? scene.audio : undefined;
    frame.voiceoverDraft = {
      script: scene.narration,
      voiceId: PROTOTYPE_VOICE_ID,
      accountId: story.accountId,
      language: story.brief.language === "Bahasa Indonesia" ? "id" : "",
      subtitles: true,
    };
    if (audio) {
      frame.audioTracks = [
        {
          id: uid(),
          name: `Scene ${i + 1} voiceover`,
          src: audio.src,
          role: "voiceover",
          start: 0,
          end: audio.duration,
          trimStart: 0,
          sourceDuration: audio.duration,
          volume: 1,
          loop: false,
          muted: false,
          fadeIn: 0,
          fadeOut: 0,
        },
      ];
      frame.subtitles = audio.cues.map((cue) => ({ ...cue, id: uid() }));
    }
  }
  return { document: parseDocument(document), frameIds, missing };
}
