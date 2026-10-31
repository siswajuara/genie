import type { Element } from "./model";
import { buildSequence } from "./animation";

export type MediaImage = HTMLImageElement | HTMLCanvasElement;
export type MediaImages = Map<string, MediaImage>;
export type ChromaKey = {
  enabled: boolean;
  color: string;
  tolerance: number;
  softness: number;
  spill: number;
};
export const defaultChromaKey: ChromaKey = {
  enabled: true,
  color: "#00ff00",
  tolerance: 0.28,
  softness: 0.12,
  spill: 0.65,
};

// Compare chrominance so shadows and highlights in the backdrop are keyed too.
function applyChromaKey(pixels: Uint8ClampedArray, key: ChromaKey) {
  if (!key.enabled) return;
  const rgb = [1, 3, 5].map((at) => parseInt(key.color.slice(at, at + 2), 16));
  const cb = (r: number, g: number, b: number) =>
    -0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = (r: number, g: number, b: number) =>
    0.5 * r - 0.418688 * g - 0.081312 * b;
  const u = cb(rgb[0], rgb[1], rgb[2]),
    v = cr(rgb[0], rgb[1], rgb[2]);
  const channel = rgb.indexOf(Math.max(...rgb));
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const distance = Math.hypot(cb(r, g, b) - u, cr(r, g, b) - v) / 255;
    const alpha = Math.max(
      0,
      Math.min(1, (distance - key.tolerance) / Math.max(0.0001, key.softness)),
    );
    pixels[i + 3] = Math.round(pixels[i + 3] * alpha);
    if (alpha > 0 && key.spill > 0) {
      const other = Math.max(
        pixels[i + ((channel + 1) % 3)],
        pixels[i + ((channel + 2) % 3)],
      );
      pixels[i + channel] -=
        Math.max(0, pixels[i + channel] - other) *
        key.spill *
        (1 - alpha * 0.5);
    }
  }
}
/** Scrub videos only past a visible threshold. Re-seeking on every animation
 * tick keeps the decoder in a permanent seeking state and starves preview
 * audio on the main thread. 1/30 s is below one frame at common frame rates.
 */
export const VIDEO_SEEK_TOLERANCE = 1 / 30;
function videoTime(element: Element, time: number, duration: number) {
  const local =
    Math.max(0, time - (element.animation?.start ?? 0)) +
    (element.videoStart ?? 0);
  const end = Math.max(0, duration - 0.001);
  return element.videoLoop && duration > 0
    ? local % duration
    : Math.min(local, end);
}
type Clip = {
  src: string;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  time?: number;
  key?: string;
  error?: Error;
};
const libraries = new WeakMap<MediaImages, Map<string, Clip>>();
function library(images: MediaImages) {
  let clips = libraries.get(images);
  if (!clips) {
    clips = new Map();
    libraries.set(images, clips);
  }
  return clips;
}
function release(clip: Clip) {
  clip.video.pause();
  clip.video.removeAttribute("src");
  clip.video.load();
  clip.canvas.width = clip.canvas.height = 1;
}
export function disposeVideos(images: MediaImages) {
  for (const clip of library(images).values()) release(clip);
  library(images).clear();
}
function waitVideo(
  video: HTMLVideoElement,
  event: string,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(
        new Error(
          "Video could not be decoded. Use a supported MP4 or WebM file, or a URL that allows CORS.",
        ),
      );
    };
    const abort = () => {
      cleanup();
      reject(signal?.reason ?? new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Video loading or seeking timed out."));
    }, 20000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
export async function prepareVideos(
  images: MediaImages,
  elements: Element[],
  signal?: AbortSignal,
  changed?: () => void,
) {
  const clips = library(images);
  const wanted = new Map(
    elements.filter((o) => o.t === "video" && o.src).map((o) => [o.id, o]),
  );
  for (const [id, clip] of clips)
    if (wanted.get(id)?.src !== clip.src) {
      release(clip);
      clips.delete(id);
    }
  await Promise.all(
    [...wanted.values()].map(async (element) => {
      if (clips.has(element.id)) return;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const clip: Clip = {
        src: element.src!,
        video,
        canvas: document.createElement("canvas"),
      };
      clips.set(element.id, clip);
      video.onseeked = () => {
        clip.time = undefined;
        changed?.();
      };
      try {
        const ready = waitVideo(video, "loadeddata", signal);
        video.src = element.src!;
        video.load();
        await ready;
        if (!Number.isFinite(video.duration) || !video.videoWidth)
          throw new Error("Choose a video with a finite duration.");
        // Bound pixel processing in the interactive editor and exports.
        const scale = Math.min(
          1,
          Math.sqrt(2_073_600 / (video.videoWidth * video.videoHeight)),
        );
        clip.canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        clip.canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        changed?.();
      } catch (error) {
        clip.error = error instanceof Error ? error : new Error(String(error));
        throw error;
      }
    }),
  );
}
export function imageForElement(
  images: MediaImages,
  element: Element,
  time = 0,
): MediaImage | undefined {
  if (element.t !== "video") {
    const image = element.src ? images.get(element.src) : undefined;
    return image &&
      (!("complete" in image) || (image.complete && image.naturalWidth))
      ? image
      : undefined;
  }
  const clip = library(images).get(element.id);
  if (!clip) return;
  if (clip.error) throw clip.error;
  if (clip.video.readyState < 2) return;
  const { video, canvas } = clip;
  const target = videoTime(element, time, video.duration);
  if (!video.seeking && Math.abs(video.currentTime - target) > VIDEO_SEEK_TOLERANCE)
    video.currentTime = target;
  const key = JSON.stringify(element.chromaKey);
  if (clip.time !== video.currentTime || clip.key !== key) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (element.chromaKey?.enabled) {
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyChromaKey(data.data, element.chromaKey);
        ctx.putImageData(data, 0, 0);
      } catch {
        throw new Error(
          "Green-screen removal requires a local video or a URL that allows CORS.",
        );
      }
    }
    clip.time = video.currentTime;
    clip.key = key;
  }
  return canvas;
}
export async function seekVideos(
  images: MediaImages,
  elements: Element[],
  time: number,
  signal?: AbortSignal,
) {
  await Promise.all(
    elements
      .filter((o) => o.t === "video" && !o.hide)
      .map(async (element) => {
        const clip = library(images).get(element.id);
        if (!clip) return;
        if (clip.error) throw clip.error;
        const target = videoTime(element, time, clip.video.duration);
        if (clip.video.seeking) await waitVideo(clip.video, "seeked", signal);
        if (Math.abs(clip.video.currentTime - target) > VIDEO_SEEK_TOLERANCE) {
          const ready = waitVideo(clip.video, "seeked", signal);
          clip.video.currentTime = target;
          await ready;
        }
      }),
  );
}
export async function seekSequenceVideos(
  images: MediaImages,
  frames: Element[],
  children: Map<string, Element[]>,
  time: number,
  signal?: AbortSignal,
) {
  await Promise.all(
    buildSequence(frames)
      .filter(
        (entry, i, all) =>
          time >= entry.start && (time < entry.end || i === all.length - 1),
      )
      .map((entry) =>
        seekVideos(
          images,
          children.get(entry.frame.id) ?? [],
          time - entry.start,
          signal,
        ),
      ),
  );
}
export async function importVideoFile(file: File): Promise<Element> {
  if (
    !/\.(mp4|webm|mov|m4v)$/i.test(file.name) &&
    !file.type.startsWith("video/")
  )
    throw new Error("Choose an MP4, WebM, or MOV video.");
  if (file.size > 64 * 1024 * 1024)
    throw new Error("Videos must be under 64 MB.");
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Video could not be read."));
    reader.readAsDataURL(file);
  });
  const images: MediaImages = new Map();
  const element: Element = {
    id: crypto.randomUUID(),
    t: "video",
    n: file.name,
    label: file.name,
    src,
    x: 0,
    y: 0,
    w: 640,
    h: 360,
    fit: "contain",
    chromaKey: { ...defaultChromaKey },
  };
  try {
    await prepareVideos(images, [element]);
    const video = library(images).get(element.id)!.video;
    element.w = video.videoWidth;
    element.h = video.videoHeight;
    return element;
  } finally {
    disposeVideos(images);
  }
}
