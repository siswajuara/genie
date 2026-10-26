import {
  prepareVideos,
  disposeVideos,
  seekVideos,
  seekSequenceVideos,
  type MediaImages,
} from "./video";
import type { CanvasDocument, Element } from "./model";
import { buildScene } from "./scene";
import { ensureDocumentFonts } from "../lib/fonts";
import {
  createSequenceRenderer,
  drawAnimationFrame,
} from "./animation-renderer";
import { buildSequence, sceneDuration } from "./animation";
import { exportFilename } from "../lib/export";
import { mixAudio } from "./sound";

export type ExportProgress = (fraction: number, message: string) => void;
function checkAbort(signal?: AbortSignal) {
  signal?.throwIfAborted();
}
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
export function videoDimensions(frame: Element, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(frame.w, frame.h));
  return {
    width: Math.max(2, Math.round((frame.w * scale) / 2) * 2),
    height: Math.max(2, Math.round((frame.h * scale) / 2) * 2),
  };
}
export function videoBitrate(
  width: number,
  height: number,
  fps: number,
  quality: "standard" | "high",
) {
  return Math.round(
    Math.max(
      1_000_000,
      Math.min(
        24_000_000,
        width * height * fps * (quality === "high" ? 0.24 : 0.12),
      ),
    ),
  );
}
export async function prepareMedia(
  doc: CanvasDocument,
  frames: Element[],
  signal?: AbortSignal,
) {
  checkAbort(signal);
  const scene = buildScene(doc.elements),
    objects = frames
      .flatMap((f) => scene.frameChildren.get(f.id) ?? [])
      .filter((o) => !o.hide);
  await abortable(ensureDocumentFonts(objects), signal);
  checkAbort(signal);
  const images: MediaImages = new Map();
  const sources = [
    ...new Set(
      objects.flatMap((o) => (o.t !== "video" && o.src ? [o.src] : [])),
    ),
  ];
  for (let index = 0; index < sources.length; index += 6) {
    await Promise.all(
      sources.slice(index, index + 6).map(async (src) => {
        checkAbort(signal);
        const image = new Image();
        image.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            image.onload = image.onerror = null;
          };
          const abort = () => {
            cleanup();
            image.src = "";
            reject(
              signal?.reason ?? new DOMException("Cancelled", "AbortError"),
            );
          };
          const timer = window.setTimeout(() => {
            cleanup();
            image.src = "";
            reject(
              new Error(
                "Image loading timed out. Check the image URL or upload it again.",
              ),
            );
          }, 20000);
          image.onload = () => {
            cleanup();
            resolve();
          };
          image.onerror = () => {
            cleanup();
            reject(
              new Error(
                `Image “${objects.find((o) => o.src === src)?.n ?? "image"}” could not be loaded. Upload it again or use a URL that allows CORS.`,
              ),
            );
          };
          signal?.addEventListener("abort", abort, { once: true });
          image.src = src;
        });
        images.set(src, image);
      }),
    );
    checkAbort(signal);
  }
  try {
    await prepareVideos(images, objects, signal);
    checkAbort(signal);
  } catch (error) {
    disposeVideos(images);
    throw error;
  }
  return {
    images,
    children: scene.frameChildren,
    dispose: () => {
      disposeVideos(images);
      images.clear();
    },
  };
}
export async function exportImages(
  doc: CanvasDocument,
  frames: Element[],
  options: {
    format: "png" | "jpeg";
    scale: number;
    transparent: boolean;
    quality: number;
    time?: number;
    name: string;
  },
  signal: AbortSignal,
  progress: ExportProgress,
): Promise<{ blob: Blob; name: string }> {
  if (!frames.length) throw new Error("Select at least one frame.");
  progress(0, "Loading fonts and images…");
  const { images, children } = await prepareMedia(doc, frames, signal);
  const files: Record<string, Uint8Array> = {};
  const extension = options.format === "png" ? "png" : "jpg";
  const base = exportFilename(
    options.name.replace(/\.(png|jpe?g|mp4|zip)$/i, "") || "canvas",
  );
  const canvas = document.createElement("canvas");
  let total = 0;
  try {
    for (const [index, frame] of frames.entries()) {
      checkAbort(signal);
      const width = Math.round(frame.w * options.scale),
        height = Math.round(frame.h * options.scale);
      if (width > 16384 || height > 16384 || width * height > 64_000_000)
        throw new Error(
          `“${frame.n}” is too large. Reduce export scale or frame dimensions (maximum 64 megapixels).`,
        );
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create an export canvas.");
      if (options.format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      await seekVideos(
        images,
        children.get(frame.id) ?? [],
        options.time ?? 0,
        signal,
      );
      drawAnimationFrame(
        ctx,
        frame,
        children.get(frame.id) ?? [],
        options.time === undefined
          ? undefined
          : Math.min(options.time, sceneDuration(frame)),
        images,
        {
          width,
          height,
          transparent: options.format === "png" && options.transparent,
        },
      );
      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Image encoding failed.")),
            options.format === "png" ? "image/png" : "image/jpeg",
            options.quality,
          );
        } catch {
          reject(
            new Error(
              "This canvas contains an image that prevents export. Upload the image locally or use a URL that allows CORS.",
            ),
          );
        }
      });
      checkAbort(signal);
      if (frames.length === 1) return { blob, name: `${base}.${extension}` };
      total += blob.size;
      if (total > 256_000_000)
        throw new Error(
          "The image archive exceeds 256 MB. Export fewer frames or use a smaller scale.",
        );
      files[
        `${String(index + 1).padStart(2, "0")}-${exportFilename(frame.n || "frame")}.${extension}`
      ] = new Uint8Array(await blob.arrayBuffer());
      progress(
        ((index + 1) / frames.length) * 0.9,
        `Rendered ${index + 1} of ${frames.length} frames`,
      );
    }
    const { zip } = await import("fflate");
    const bytes = await new Promise<Uint8Array<ArrayBuffer>>(
      (resolve, reject) => {
        const stop = zip(files, { level: 0 }, (err, data) => {
          signal.removeEventListener("abort", abort);
          if (err) reject(err);
          else resolve(data as Uint8Array<ArrayBuffer>);
        });
        const abort = () => {
          stop();
          reject(signal.reason);
        };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      },
    );
    checkAbort(signal);
    return {
      blob: new Blob([bytes], { type: "application/zip" }),
      name: `${base}.zip`,
    };
  } finally {
    canvas.width = canvas.height = 1;
    disposeVideos(images);
    images.clear();
  }
}

export async function mp4Support(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
) {
  if (!("VideoEncoder" in globalThis)) return false;
  const { canEncodeVideo } = await import("mediabunny");
  return canEncodeVideo("avc", { width, height, bitrate, frameRate: fps });
}
export async function exportVideo(
  doc: CanvasDocument,
  frames: Element[],
  options: { width: number; height: number; fps: number; bitrate: number },
  signal: AbortSignal,
  progress: ExportProgress,
) {
  const { width, height, fps, bitrate } = options;
  if (!frames.length) throw new Error("Select at least one frame.");
  const duration = buildSequence(frames).at(-1)!.end;
  if (duration > 600)
    throw new Error("Export up to 10 minutes at a time. Select fewer scenes.");
  if ((duration * bitrate) / 8 > 256_000_000)
    throw new Error(
      "Estimated video size exceeds 256 MB. Reduce resolution, quality, or the number of scenes.",
    );
  if (!(await mp4Support(width, height, fps, bitrate)))
    throw new Error(
      "H.264 encoding is unavailable at these settings. Try a lower resolution or use a current Chrome, Edge, or Safari browser.",
    );
  progress(0, "Loading fonts and images…");
  const media = await prepareMedia(doc, frames, signal);
  checkAbort(signal);
  const {
    Output,
    Mp4OutputFormat,
    BufferTarget,
    CanvasSource,
    AudioBufferSource,
    canEncodeAudio,
  } = await import("mediabunny");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a video canvas.");
  const renderer = createSequenceRenderer(
    frames,
    media.children,
    media.images,
    width,
    height,
  );
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const source = new CanvasSource(canvas, {
    codec: "avc",
    bitrate,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(source, { frameRate: fps });
  let audioSource: InstanceType<typeof AudioBufferSource> | undefined;
  const abort = () => {
    void output.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    checkAbort(signal);
    if (
      frames.some((f) =>
        f.audioTracks?.some(
          (t) => !t.muted && t.volume > 0 && t.start < sceneDuration(f),
        ),
      )
    ) {
      if (
        !(await canEncodeAudio("aac", {
          numberOfChannels: 2,
          sampleRate: 44100,
        }))
      )
        throw Error(
          "AAC audio encoding is unavailable. Use a current Chrome, Edge, or Safari browser to export video with sound.",
        );
      progress(0, "Mixing audio tracks…");
      audioSource = new AudioBufferSource({ codec: "aac", bitrate: 192000 });
      output.addAudioTrack(audioSource);
    }
    const audio = audioSource ? await mixAudio(frames, signal) : undefined;
    checkAbort(signal);
    await output.start();
    if (audio && audioSource) await audioSource.add(audio);
    audioSource?.close();
    const count = Math.ceil(duration * fps);
    for (let i = 0; i < count; i++) {
      checkAbort(signal);
      await seekSequenceVideos(
        media.images,
        frames,
        media.children,
        i / fps,
        signal,
      );
      renderer.draw(ctx, i / fps);
      await source.add(i / fps, Math.min(1 / fps, duration - i / fps));
      if (i % 5 === 0) {
        progress(
          (i / count) * 0.96,
          `Encoding ${i + 1} of ${count} video frames`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    checkAbort(signal);
    source.close();
    progress(0.97, "Finalizing MP4…");
    await output.finalize();
    checkAbort(signal);
    if (!target.buffer) throw new Error("The encoder produced an empty file.");
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    if (output.state !== "canceled" && output.state !== "finalized")
      await output.cancel().catch(() => {});
    checkAbort(signal);
    throw error;
  } finally {
    signal.removeEventListener("abort", abort);
    renderer.dispose();
    canvas.width = canvas.height = 1;
    media.dispose();
  }
}
