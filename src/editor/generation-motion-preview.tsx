import { useEffect, useRef, useState } from "react";
import { applyPreset, initialDocument, type Preset } from "./model";
import { prepareMedia, videoDimensions } from "./media-export";
import {
  drawAnimationFrame,
  type AnimationTextures,
} from "./animation-renderer";
import { seekVideos } from "./video";

export async function renderGenerationStill(
  preset: Preset,
  signal?: AbortSignal,
): Promise<string> {
  const doc = applyPreset(initialDocument(), preset);
  const frame = doc.elements.find((o) => o.t === "frame")!;
  const media = await prepareMedia(doc, [frame], signal);
  const textures: AnimationTextures = new Map();
  try {
    const children = media.children.get(frame.id) || [];
    const time = Math.max(0, (frame.scene?.duration || 6) - 0.05);
    await seekVideos(media.images, children, time, signal);
    const canvas = document.createElement("canvas"),
      size = videoDimensions(frame, 480);
    canvas.width = size.width;
    canvas.height = size.height;
    drawAnimationFrame(
      canvas.getContext("2d")!,
      frame,
      children,
      time,
      media.images,
      { ...size, textures },
    );
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    media.dispose();
    textures.clear();
  }
}

export function GenerationMotionPreview({
  preset,
  onStop,
}: {
  preset: Preset;
  onStop: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let raf = 0;
    let dispose: (() => void) | undefined;
    const doc = applyPreset(initialDocument(), preset);
    const frame = doc.elements.find((o) => o.t === "frame")!;
    const duration = frame.scene?.duration || 6;
    const textures: AnimationTextures = new Map();
    void prepareMedia(doc, [frame], controller.signal)
      .then((media) => {
        dispose = media.dispose;
        if (controller.signal.aborted) return dispose();
        const canvas = ref.current!;
        const ctx = canvas.getContext("2d")!;
        const size = videoDimensions(frame, 720);
        canvas.width = size.width;
        canvas.height = size.height;
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const started = performance.now();
        const draw = async (now: number) => {
          if (controller.signal.aborted) return;
          const time = Math.min((now - started) / 1000, duration - 0.001);
          try {
            await seekVideos(
              media.images,
              media.children.get(frame.id) || [],
              time,
              controller.signal,
            );
            if (controller.signal.aborted) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawAnimationFrame(
              ctx,
              frame,
              media.children.get(frame.id) || [],
              time,
              media.images,
              { ...size, reducedMotion, textures },
            );
            canvas.dataset.time = time.toFixed(2);
            if (now - started < duration * 1000)
              raf = requestAnimationFrame(draw);
            else onStop();
          } catch (e) {
            if (!controller.signal.aborted)
              setError(e instanceof Error ? e.message : String(e));
          }
        };
        raf = requestAnimationFrame(draw);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      controller.abort();
      cancelAnimationFrame(raf);
      dispose?.();
      textures.clear();
    };
  }, [preset, onStop]);
  return error ? (
    <p className="generate-hint" role="alert">
      {error}
    </p>
  ) : (
    <canvas ref={ref} role="img" aria-label="Scene motion preview" />
  );
}
