import { imageForElement, type MediaImage, type MediaImages } from "./video";
import type { Element } from "./model";
import {
  buildSequence,
  clamp,
  ease,
  evaluateAnimation,
  motionPose,
  receivesCameraMotion,
  sceneDuration,
  type Pose,
  type SequenceEntry,
} from "./animation";
import { drawElement } from "./reference-renderer";
import { createTextAnimation, type GlyphAnimation } from "./text-animation";
import { timing } from "./animation";
import { drawSubtitles } from "./subtitles";
import { shaderEase, shaderTransition } from "./shader-transitions";
import { createShaderTransitionRenderer } from "./shader-transition-renderer";

type Texture = {
  element: Element;
  image?: MediaImage;
  canvas: HTMLCanvasElement;
  pad: number;
  density: number;
  textTime?: number;
};
export type AnimationTextures = Map<string, Texture>;
export type FrameRenderOptions = {
  width: number;
  height: number;
  transparent?: boolean;
  reducedMotion?: boolean;
  textures?: AnimationTextures;
};

function triangle(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  source: number[][],
  dest: number[][],
) {
  const [[u0, v0], [u1, v1], [u2, v2]] = source,
    [[x0, y0], [x1, y1], [x2, y2]] = dest;
  const denominator = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(denominator) < 1e-8) return;
  const coeff = (a: number, b: number, c: number) => [
    (a * (v1 - v2) + b * (v2 - v0) + c * (v0 - v1)) / denominator,
    (a * (u2 - u1) + b * (u0 - u2) + c * (u1 - u0)) / denominator,
    (a * (u1 * v2 - u2 * v1) +
      b * (u2 * v0 - u0 * v2) +
      c * (u0 * v1 - u1 * v0)) /
      denominator,
  ];
  const x = coeff(x0, x1, x2),
    y = coeff(y0, y1, y2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();
  ctx.transform(x[0], y[0], x[1], y[1], x[2], y[2]);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawPerspective(
  ctx: CanvasRenderingContext2D,
  element: Element,
  pose: Pose,
  image: MediaImage | undefined,
  textures: AnimationTextures,
  density: number,
  glyphAnimation?: GlyphAnimation,
  textTime?: number,
) {
  let texture = textures.get(element.id);
  if (
    element.t === "video" ||
    !texture ||
    texture.element !== element ||
    texture.image !== image ||
    texture.density !== density ||
    texture.textTime !== textTime
  ) {
    const pad = Math.min(
      300,
      Math.max(
        4,
        (element.sh ?? 0) * 2 +
          Math.abs(element.shx ?? 0) +
          Math.abs(element.shy ?? 0),
        element.t === "text" ? (element.size ?? 0) : 0,
      ),
    );
    const canvas = texture?.canvas ?? document.createElement("canvas");
    const rasterScale = Math.max(
      0.01,
      Math.min(
        density,
        2,
        Math.sqrt(
          4_000_000 /
            ((Math.abs(element.w) + pad * 2) * (Math.abs(element.h) + pad * 2)),
        ),
      ),
    );
    canvas.width = Math.max(
      1,
      Math.ceil((Math.abs(element.w) + pad * 2) * rasterScale),
    );
    canvas.height = Math.max(
      1,
      Math.ceil((Math.abs(element.h) + pad * 2) * rasterScale),
    );
    const raster = canvas.getContext("2d")!;
    raster.scale(rasterScale, rasterScale);
    raster.translate(
      pad - Math.min(element.x, element.x + element.w),
      pad - Math.min(element.y, element.y + element.h),
    );
    drawElement(
      raster,
      { ...element, rot: 0, op: 1, img: image, scienceTime: textTime ?? 0 },
      true,
      glyphAnimation,
    );
    texture = { element, image, canvas, pad, density, textTime };
    textures.delete(element.id);
    textures.set(element.id, texture);
    let pixels = [...textures.values()].reduce(
      (sum, entry) => sum + entry.canvas.width * entry.canvas.height,
      0,
    );
    while ((textures.size > 24 || pixels > 24_000_000) && textures.size > 1) {
      const oldest = textures.keys().next().value!;
      const entry = textures.get(oldest)!;
      pixels -= entry.canvas.width * entry.canvas.height;
      entry.canvas.width = entry.canvas.height = 1;
      textures.delete(oldest);
    }
  }
  const { canvas, pad } = texture,
    width = Math.abs(element.w) + pad * 2,
    height = Math.abs(element.h) + pad * 2;
  const angle = (pose.rotateY * Math.PI) / 180,
    focal = 1600;
  const point = (u: number, v: number) => {
    const x = (u - 0.5) * width,
      y = (v - 0.5) * height;
    const perspective =
      focal / Math.max(focal * 0.12, focal + x * Math.sin(angle) - pose.z);
    return [x * Math.cos(angle) * perspective, y * perspective];
  };
  ctx.globalAlpha = clamp((element.op ?? 1) * pose.opacity);
  const strips = 24;
  for (let i = 0; i < strips; i++) {
    const left = i / strips,
      right = (i + 1) / strips;
    const a = point(left, 0),
      b = point(right, 0),
      c = point(right, 1),
      d = point(left, 1);
    triangle(
      ctx,
      canvas,
      [
        [left * canvas.width, 0],
        [right * canvas.width, 0],
        [right * canvas.width, canvas.height],
      ],
      [a, b, c],
    );
    triangle(
      ctx,
      canvas,
      [
        [left * canvas.width, 0],
        [right * canvas.width, canvas.height],
        [left * canvas.width, canvas.height],
      ],
      [a, c, d],
    );
  }
}

/** Draws into a local output rectangle, with no editor handles or labels. */
export function drawAnimationFrame(
  ctx: CanvasRenderingContext2D,
  frame: Element,
  children: Element[],
  time: number | undefined,
  images: MediaImages,
  options: FrameRenderOptions,
) {
  const {
    width,
    height,
    reducedMotion = false,
    transparent = false,
    textures = new Map(),
  } = options;
  const duration = sceneDuration(frame);
  const camera =
    time === undefined || reducedMotion
      ? undefined
      : motionPose(frame.scene?.camera, time / duration, time);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.scale(width / frame.w, height / frame.h);
  if (!transparent) {
    ctx.globalAlpha = frame.op ?? 1;
    ctx.fillStyle = frame.fill || "#ffffff";
    ctx.fillRect(0, 0, frame.w, frame.h);
  }
  for (const element of children) {
    if (element.hide) continue;
    const pose =
      time === undefined
        ? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, rotateY: 0, z: 0 }
        : evaluateAnimation(element, time, duration, reducedMotion);
    if (pose.opacity <= 0) continue;
    pose.opacity *= frame.op ?? 1;
    let cx = element.x + element.w / 2 - frame.x + pose.x,
      cy = element.y + element.h / 2 - frame.y + pose.y;
    if (camera && receivesCameraMotion(element)) {
      const depth = element.animation?.depth ?? 0;
      const perspective =
        1600 / Math.max(200, 1600 - camera.z * (1 + depth / 500));
      const zoom = camera.scale * perspective;
      const angle = (camera.rotation * Math.PI) / 180,
        x = (cx - frame.w / 2) * zoom,
        y = (cy - frame.h / 2) * zoom;
      cx = frame.w / 2 + x * Math.cos(angle) - y * Math.sin(angle) + camera.x;
      cy = frame.h / 2 + x * Math.sin(angle) + y * Math.cos(angle) + camera.y;
      pose.scale *= zoom;
      pose.rotation += camera.rotation;
    }
    const image = imageForElement(images, element, time);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((((element.rot ?? 0) + pose.rotation) * Math.PI) / 180);
    ctx.scale(pose.scale, pose.scale);
    const glyphAnimation = createTextAnimation(
      element,
      time,
      duration,
      reducedMotion,
    );
    if (time !== undefined && !reducedMotion) {
      const { start, end } = timing(element, duration),
        a = element.animation;
      for (const [effect, progress] of [
        [
          a?.enter,
          (time - start) /
            Math.min(
              a?.enter?.duration ?? 1,
              (end - start) / (a?.exit && a.exit.preset !== "none" ? 2 : 1),
            ),
        ],
        [
          a?.exit,
          (end - time) /
            Math.min(
              a?.exit?.duration ?? 1,
              (end - start) / (a?.enter && a.enter.preset !== "none" ? 2 : 1),
            ),
        ],
      ] as const) {
        if (!effect?.preset.startsWith("reveal-")) continue;
        const p = clamp(ease(progress, effect.easing)),
          w = Math.abs(element.w),
          h = Math.abs(element.h);
        const left = effect.preset === "reveal-right" ? w * (1 - p) : 0,
          top = effect.preset === "reveal-down" ? h * (1 - p) : 0;
        ctx.beginPath();
        ctx.rect(
          -w / 2 + left,
          -h / 2 + top,
          effect.preset === "reveal-left" || effect.preset === "reveal-right"
            ? w * p
            : w,
          effect.preset === "reveal-up" || effect.preset === "reveal-down"
            ? h * p
            : h,
        );
        ctx.clip();
      }
    }
    if (Math.abs(pose.rotateY) > 0.01) {
      drawPerspective(
        ctx,
        element,
        pose,
        image,
        textures,
        Math.max(width / frame.w, height / frame.h),
        glyphAnimation,
        element.physics || element.learning || element.illustration3d
          ? reducedMotion
            ? 0
            : Math.max(0, (time ?? 0) - timing(element, duration).start)
          : glyphAnimation
            ? time
            : undefined,
      );
    } else {
      const perspective = 1600 / Math.max(200, 1600 - pose.z);
      ctx.scale(perspective, perspective);
      ctx.translate(-element.x - element.w / 2, -element.y - element.h / 2);
      drawElement(
        ctx,
        {
          ...element,
          rot: 0,
          op: (element.op ?? 1) * pose.opacity,
          img: image,
          scienceTime: reducedMotion
            ? 0
            : Math.max(0, (time ?? 0) - timing(element, duration).start),
        },
        true,
        glyphAnimation,
      );
    }
    ctx.restore();
  }
  drawSubtitles(ctx, frame, time ?? 0);
  ctx.restore();
}

function sequenceAt(sequence: SequenceEntry[], time: number) {
  if (!sequence.length) return [];
  const t = clamp(time, 0, sequence[sequence.length - 1].end);
  return sequence.filter(
    (entry, i) =>
      t >= entry.start && (t < entry.end || i === sequence.length - 1),
  );
}
export function createSequenceRenderer(
  frames: Element[],
  children: Map<string, Element[]>,
  images: MediaImages,
  width: number,
  height: number,
  reducedMotion = false,
) {
  const sequence = buildSequence(frames),
    textures: AnimationTextures = new Map();
  const surfaces = [
    document.createElement("canvas"),
    document.createElement("canvas"),
  ];
  for (const canvas of surfaces) {
    canvas.width = width;
    canvas.height = height;
  }
  let shaderRenderer: ReturnType<typeof createShaderTransitionRenderer>;
  let shaderAttempted = false;
  return {
    duration: sequence.at(-1)?.end ?? 0,
    frameTime(frameId: string, time: number) {
      const entry = sequence.find((item) => item.frame.id === frameId);
      return entry ? clamp(time - entry.start, 0, entry.end - entry.start) : undefined;
    },
    draw(ctx: CanvasRenderingContext2D, time: number) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.clip();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      const active = sequenceAt(sequence, time);
      const transition =
        active.length === 2 ? active[0].frame.scene?.transition : undefined;
      const shader = transition && !reducedMotion
        ? shaderTransition(transition.type)
        : undefined;
      const raw = active.length === 2
        ? clamp((time - active[1].start) / active[1].overlap)
        : 1;
      const progress =
        shader && !transition?.easing
          ? shaderEase(shader, raw)
          : active.length === 2
          ? clamp(
              ease(
                raw,
                transition?.easing ?? "ease-in-out",
              ),
            )
          : 1;
      const transitionType = reducedMotion || shader ? "crossfade" : transition?.type;
      if (
        transitionType === "fade-through-black" ||
        transitionType === "fade-through-white"
      ) {
        ctx.fillStyle =
          transitionType === "fade-through-black" ? "#000000" : "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      for (let i = 0; i < active.length; i++) {
        const entry = active[i],
          surface = surfaces[i],
          raster = surface.getContext("2d")!;
        raster.clearRect(0, 0, width, height);
        raster.fillStyle = "#ffffff";
        raster.fillRect(0, 0, width, height);
        const ratio = Math.min(width / entry.frame.w, height / entry.frame.h);
        const w = entry.frame.w * ratio,
          h = entry.frame.h * ratio;
        raster.save();
        raster.translate((width - w) / 2, (height - h) / 2);
        drawAnimationFrame(
          raster,
          entry.frame,
          children.get(entry.frame.id) ?? [],
          time - entry.start,
          images,
          { width: w, height: h, textures, reducedMotion },
        );
        raster.restore();
      }
      if (shader && active.length === 2) {
        if (!shaderAttempted) {
          shaderAttempted = true;
          shaderRenderer = createShaderTransitionRenderer(width, height);
        }
        if (shaderRenderer?.draw(
          ctx, surfaces[0], surfaces[1], shader, raw, progress,
          Math.max(0, time - active[1].start),
        )) {
          ctx.restore();
          return;
        }
      }
      for (let i = 0; i < active.length; i++) {
        const surface = surfaces[i];
        ctx.save();
        if (i === 0 && active.length === 2) {
          if (transitionType === "push-left")
            ctx.translate(-width * progress, 0);
          if (transitionType === "push-right")
            ctx.translate(width * progress, 0);
          if (transitionType === "push-up")
            ctx.translate(0, -height * progress);
          if (transitionType === "push-down")
            ctx.translate(0, height * progress);
          if (
            transitionType === "fade-through-black" ||
            transitionType === "fade-through-white"
          )
            ctx.globalAlpha = 1 - clamp(progress * 2);
        }
        if (i === 1) {
          const p = progress,
            type = transitionType;
          if (type === "crossfade") ctx.globalAlpha = p;
          if (type === "slide-left" || type === "push-left")
            ctx.translate(width * (1 - p), 0);
          if (type === "slide-right" || type === "push-right")
            ctx.translate(-width * (1 - p), 0);
          if (type === "slide-up" || type === "push-up")
            ctx.translate(0, height * (1 - p));
          if (type === "slide-down" || type === "push-down")
            ctx.translate(0, -height * (1 - p));
          if (type === "wipe") {
            ctx.beginPath();
            ctx.rect(0, 0, width * p, height);
            ctx.clip();
          }
          if (
            type === "wipe-right" ||
            type === "wipe-up" ||
            type === "wipe-down"
          ) {
            ctx.beginPath();
            if (type === "wipe-right")
              ctx.rect(width * (1 - p), 0, width * p, height);
            else
              ctx.rect(
                0,
                type === "wipe-down" ? height * (1 - p) : 0,
                width,
                height * p,
              );
            ctx.clip();
          }
          if (type === "circle-in" || type === "circle-out") {
            ctx.beginPath();
            if (type === "circle-out") ctx.rect(0, 0, width, height);
            ctx.moveTo(
              width / 2 +
                (Math.hypot(width, height) / 2) *
                  (type === "circle-out" ? 1 - p : p),
              height / 2,
            );
            ctx.arc(
              width / 2,
              height / 2,
              (Math.hypot(width, height) / 2) *
                (type === "circle-out" ? 1 - p : p),
              0,
              Math.PI * 2,
            );
            ctx.clip("evenodd");
          }
          if (type === "diamond") {
            ctx.beginPath();
            ctx.moveTo(width / 2, height / 2 - height * p);
            ctx.lineTo(width / 2 + width * p, height / 2);
            ctx.lineTo(width / 2, height / 2 + height * p);
            ctx.lineTo(width / 2 - width * p, height / 2);
            ctx.closePath();
            ctx.clip();
          }
          if (type === "blinds") {
            ctx.beginPath();
            for (let strip = 0; strip < 12; strip++)
              ctx.rect((strip * width) / 12, 0, (width / 12) * p, height);
            ctx.clip();
          }
          if (type === "fade-through-black" || type === "fade-through-white")
            ctx.globalAlpha = clamp(p * 2 - 1);
          if (type === "zoom") {
            const zoom = 1.4 - p * 0.4;
            ctx.translate(width / 2, height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-width / 2, -height / 2);
            ctx.globalAlpha = p;
          }
          if (type === "zoom-out" || type === "spin") {
            const zoom = type === "zoom-out" ? 0.65 + p * 0.35 : 0.9 + p * 0.1;
            ctx.translate(width / 2, height / 2);
            ctx.rotate(type === "spin" ? ((1 - p) * -Math.PI) / 8 : 0);
            ctx.scale(zoom, zoom);
            ctx.translate(-width / 2, -height / 2);
            ctx.globalAlpha = p;
          }
        }
        ctx.drawImage(surface, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    },
    dispose() {
      shaderRenderer?.dispose();
      surfaces.forEach((canvas) => {
        canvas.width = canvas.height = 1;
      });
      textures.clear();
    },
  };
}
