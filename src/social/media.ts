import type { Media } from "../marketing/store";
import type { Workspace } from "../editor/projects";
import { buildScene } from "../editor/scene";
import { drawElement } from "../editor/reference-renderer";
import { ensureDocumentFonts } from "../lib/fonts";
import { socialRequest } from "./client";
export async function prepareSocialMedia(
  media: Media,
  workspace: Workspace,
  zernioConfigured: boolean,
): Promise<{ url: string; type: "image" | "video" }> {
  if (media.kind !== "frame" && media.src?.startsWith("https://"))
    return { url: media.src, type: media.kind === "video" ? "video" : "image" };
  if (!zernioConfigured)
    throw Error(
      "Add a Zernio API key in Setting to upload Canvas designs or local files. Buffer requires a public media URL.",
    );
  let blob: Blob;
  if (media.kind === "frame") {
    const page = workspace.projects
        .find((p) => p.id === media.projectId)
        ?.pages.find((p) => p.id === media.pageId),
      frame = page?.canvas.elements.find(
        (o) => o.id === media.frameId && o.t === "frame",
      );
    if (!page || !frame)
      throw Error(`The Canvas frame “${media.name}” is no longer available.`);
    if (frame.w * frame.h > 64000000)
      throw Error("Reduce the Canvas frame size before publishing.");
    const objects =
      buildScene(page.canvas.elements).frameChildren.get(frame.id) || [];
    await ensureDocumentFonts(objects);
    const images = new Map<string, HTMLImageElement>();
    await Promise.all(
      objects
        .filter((o) => o.src && !o.hide)
        .map(async (o) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = o.src!;
          try {
            await img.decode();
          } catch {
            throw Error(
              `Could not load image “${o.n}”. Replace it in Canvas before publishing.`,
            );
          }
          images.set(o.src!, img);
        }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = frame.w;
    canvas.height = frame.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Could not render the Canvas frame.");
    ctx.fillStyle = frame.fill || "#fff";
    ctx.fillRect(0, 0, frame.w, frame.h);
    ctx.translate(-frame.x, -frame.y);
    for (const o of objects)
      drawElement(
        ctx,
        { ...o, img: o.src ? images.get(o.src) : undefined },
        true,
      );
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(Error("Could not encode the Canvas image.")),
        "image/png",
      ),
    );
    canvas.width = canvas.height = 1;
  } else {
    if (!media.src?.startsWith("data:"))
      throw Error("Choose a valid uploaded image or video.");
    blob = await (await fetch(media.src)).blob();
  }
  if (blob.size > 32 * 1024 * 1024)
    throw Error("Media uploads must be under 32 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(Error("Could not read media."));
    reader.readAsDataURL(blob);
  });
  return socialRequest("upload", {
    data,
    filename: media.kind === "frame" ? `${media.name}.png` : media.name,
    contentType: blob.type,
  });
}
