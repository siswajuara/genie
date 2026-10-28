import { imageForElement, type MediaImages } from "./video";
import type { Element } from "./model";
import type { buildScene, Bounds, LayerNode } from "./scene";
import { bounds, intersects } from "./scene";
import { drawElement } from "./reference-renderer";
import { drawSubtitles } from "./subtitles";
import {
  drawAnimationFrame,
  type AnimationTextures,
  type createSequenceRenderer,
} from "./animation-renderer";
export type AnimationPreview = {
  frameId: string;
  time: number;
  reducedMotion: boolean;
  textures: AnimationTextures;
  sequence?: {
    width: number;
    height: number;
    renderer: ReturnType<typeof createSequenceRenderer>;
  };
};
type FrameCache = {
  canvas: HTMLCanvasElement;
  frame: Element;
  children: Element[];
  scale: number;
  revision: number;
  editing?: string;
};
export type RenderCache = Map<string, FrameCache>;
export function renderScene(
  ctx: CanvasRenderingContext2D,
  scene: ReturnType<typeof buildScene>,
  viewport: Bounds,
  scale: number,
  zoom: number,
  images: MediaImages,
  cache: RenderCache,
  revision: number,
  editing?: string,
  preview?: AnimationPreview,
) {
  const currentFrames = new Set(scene.frames.map((f) => f.id));
  for (const id of cache.keys()) if (!currentFrames.has(id)) cache.delete(id);
  // A visible incoming frame must not seek its video back to zero after the
  // sequence renderer has sampled it for the transition on the outgoing frame.
  const image = (o: Element) => imageForElement(
    images, o, preview?.sequence?.renderer.frameTime(o.fid ?? "", preview.time),
  );
  function drawFrame(frame: Element) {
    if (
      frame.hide ||
      !intersects(
        { ...frame, y: frame.y - 32 / zoom, h: frame.h + 32 / zoom },
        viewport,
      )
    )
      return;
    const children = scene.frameChildren.get(frame.id) || [];
    if (preview?.frameId === frame.id) {
      ctx.save();
      ctx.translate(frame.x, frame.y);
      if (preview.sequence) {
        const { width, height, renderer } = preview.sequence;
        ctx.scale(frame.w / width, frame.h / height);
        renderer.draw(ctx, preview.time);
      } else drawAnimationFrame(ctx, frame, children, preview.time, images, {
        width: frame.w,
        height: frame.h,
        reducedMotion: preview.reducedMotion,
        textures: preview.textures,
      });
      ctx.restore();
      ctx.fillStyle = "#555d7a";
      ctx.font = `${12 / zoom}px Nunito, sans-serif`;
      ctx.fillText(frame.n, frame.x, frame.y - 12 / zoom);
      return;
    }
    const density = Math.max(
      0.01,
      Math.min(
        Math.ceil(scale * 4) / 4,
        2,
        Math.sqrt(8_000_000 / (frame.w * frame.h)),
      ),
    );
    let entry = cache.get(frame.id);
    if (
      !entry ||
      entry.frame !== frame ||
      entry.scale !== density ||
      entry.revision !== revision ||
      entry.editing !== editing ||
      entry.children.length !== children.length ||
      children.some((o, i) => entry!.children[i] !== o)
    ) {
      const canvas = entry?.canvas || document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(frame.w * density));
      canvas.height = Math.max(1, Math.ceil(frame.h * density));
      const raster = canvas.getContext("2d")!;
      raster.scale(density, density);
      raster.fillStyle = frame.fill || "#fff";
      raster.fillRect(0, 0, frame.w, frame.h);
      raster.translate(-frame.x, -frame.y);
      for (const o of children)
        if (o.id !== editing) drawElement(raster, { ...o, img: image(o) });
      raster.save();
      raster.translate(frame.x, frame.y);
      drawSubtitles(raster, frame);
      raster.restore();
      entry = { canvas, frame, children, scale: density, revision, editing };
    }
    cache.delete(frame.id);
    cache.set(frame.id, entry);
    ctx.save();
    ctx.globalAlpha = frame.op ?? 1;
    ctx.drawImage(entry.canvas, frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
    ctx.fillStyle = "#555d7a";
    ctx.font = `${12 / zoom}px Nunito, sans-serif`;
    ctx.fillText(frame.n, frame.x, frame.y - 12 / zoom);
  }
  function drawNode(node: LayerNode) {
    const o = node.element;
    if (!o) {
      node.children.forEach(drawNode);
      return;
    }
    if (o.t === "frame") {
      drawFrame(o);
      return;
    }
    if (o.hide || o.id === editing) return;
    const area = bounds(o),
      pad = Math.max(
        o.sh || 0,
        Math.abs(o.shx || 0),
        Math.abs(o.shy || 0),
        o.t === "text" ? (o.size || 0) * 3 : 0,
      );
    if (
      intersects(
        {
          x: area.x - pad,
          y: area.y - pad,
          w: area.w + pad * 2,
          h: area.h + pad * 2,
        },
        viewport,
      )
    )
      drawElement(ctx, { ...o, img: image(o) });
  }
  scene.tree.forEach(drawNode);
  // Bound the raster cache to roughly 96 MB regardless of the number of carousel frames.
  let pixels = [...cache.values()].reduce(
    (sum, e) => sum + e.canvas.width * e.canvas.height,
    0,
  );
  while (pixels > 24_000_000 && cache.size > 1) {
    const oldest = cache.keys().next().value!;
    const entry = cache.get(oldest)!;
    pixels -= entry.canvas.width * entry.canvas.height;
    cache.delete(oldest);
  }
}
