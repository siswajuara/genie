import { useEffect, useRef, useState } from "react";
import type { CanvasDocument } from "../editor/model";
import { buildScene } from "../editor/scene";
import { drawElement } from "../editor/reference-renderer";
import { ensureDocumentFonts } from "../lib/fonts";
import { Icon } from "../components/ui/Icon";
import type { Workspace } from "../editor/projects";
import type { Media } from "./store";

export function FramePreview({
  document: doc,
  frameId,
  label,
}: {
  document: CanvasDocument;
  frameId: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    [error, setError] = useState(false);
  const frame = doc.elements.find((o) => o.id === frameId && o.t === "frame");
  useEffect(() => {
    let live = true;
    setError(false);
    async function render() {
      if (!frame || !ref.current) return;
      const objects =
        buildScene(doc.elements).frameChildren.get(frame.id) || [];
      try {
        await ensureDocumentFonts(objects);
        const images = new Map<string, HTMLImageElement>();
        await Promise.all(
          objects
            .filter((o) => o.src && !o.hide)
            .map(async (o) => {
              const image = new Image();
              image.crossOrigin = "anonymous";
              image.src = o.src!;
              try {
                await image.decode();
                images.set(o.src!, image);
              } catch {
                /* Unavailable images retain their labeled slots. */
              }
            }),
        );
        if (!live || !ref.current) return;
        const canvas = ref.current,
          scale = Math.min(1, 600 / Math.max(frame!.w, frame!.h));
        canvas.width = Math.max(1, Math.round(frame!.w * scale));
        canvas.height = Math.max(1, Math.round(frame!.h * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.fillStyle = frame!.fill || "#fff";
        ctx.fillRect(0, 0, frame!.w, frame!.h);
        ctx.translate(-frame!.x, -frame!.y);
        for (const object of objects)
          drawElement(
            ctx,
            { ...object, img: object.src ? images.get(object.src) : undefined },
            true,
          );
      } catch {
        if (live) setError(true);
      }
    }
    void render();
    return () => {
      live = false;
    };
  }, [doc, frameId]);
  if (!frame || error)
    return (
      <div className="media-unavailable">
        <Icon name="image" size={26} />
        <span>
          {!frame ? "Frame is no longer available" : "Preview unavailable"}
        </span>
      </div>
    );
  return (
    <canvas
      ref={ref}
      className="frame-preview-canvas"
      aria-label={label}
      role="img"
      style={{ aspectRatio: `${frame.w}/${frame.h}` }}
    />
  );
}
export function MediaPreview({
  media,
  workspace,
}: {
  media: Media;
  workspace: Workspace;
}) {
  if (media.kind === "frame") {
    const page = workspace.projects
      .find((p) => p.id === media.projectId)
      ?.pages.find((p) => p.id === media.pageId);
    return page ? (
      <FramePreview
        document={page.canvas}
        frameId={media.frameId!}
        label={media.name}
      />
    ) : (
      <div className="media-unavailable">
        <Icon name="image" />
        <span>Canvas unavailable</span>
      </div>
    );
  }
  return media.kind === "video" ? (
    <video
      src={media.src}
      controls
      preload="metadata"
      aria-label={media.name}
    />
  ) : (
    <img src={media.src} alt={media.alt || media.name} />
  );
}
