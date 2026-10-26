import type { CanvasDocument, Element } from "./model";
import { slugify } from "./identifiers";
import type { ChromaKey } from "./video";
export type CanvasAsset = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  source: "generated" | "upload" | "canvas";
  createdAt: string;
  prompt?: string;
  type?: "image" | "video";
  chromaKey?: ChromaKey;
};
export function mergeCanvasAssets(
  existing: CanvasAsset[],
  incoming: CanvasAsset[],
) {
  const ids = new Set(existing.map((asset) => asset.id));
  const sources = new Set(existing.map((asset) => asset.src));
  const added = incoming.filter((asset) => {
    if (ids.has(asset.id) || sources.has(asset.src)) return false;
    ids.add(asset.id);
    sources.add(asset.src);
    return true;
  });
  return [...existing, ...added];
}
export function validateCanvasAsset(value: unknown): CanvasAsset {
  const asset = value as CanvasAsset;
  if (
    !asset ||
    typeof asset.id !== "string" ||
    !asset.id ||
    typeof asset.name !== "string" ||
    !asset.name.trim() ||
    typeof asset.src !== "string" ||
    !(
      asset.type === "video"
        ? /^(data:video\/(mp4|webm|quicktime);base64,|https?:\/\/)/i
        : /^(data:image\/(png|jpeg|webp|gif|svg\+xml);base64,|https?:\/\/)/i
    ).test(asset.src) ||
    (asset.type !== undefined && !["image", "video"].includes(asset.type)) ||
    !["generated", "upload", "canvas"].includes(asset.source) ||
    ![asset.width, asset.height].every(
      (number) => Number.isFinite(number) && number > 0 && number <= 100000,
    )
  )
    throw Error("Invalid canvas media asset.");
  if (
    asset.chromaKey &&
    (asset.type !== "video" ||
      typeof asset.chromaKey.enabled !== "boolean" ||
      !/^#[0-9a-f]{6}$/i.test(asset.chromaKey.color) ||
      ![
        asset.chromaKey.tolerance,
        asset.chromaKey.softness,
        asset.chromaKey.spill,
      ].every(
        (number) => Number.isFinite(number) && number >= 0 && number <= 1,
      ))
  )
    throw Error("Invalid video green-screen settings.");
  return asset;
}
export function assetsOnCanvas(
  pages: { canvas: CanvasDocument }[],
): CanvasAsset[] {
  const sources = new Set<string>();
  return pages.flatMap(({ canvas }) =>
    canvas.elements.flatMap((element) => {
      if (
        !["img", "video"].includes(element.t) ||
        !element.src ||
        sources.has(element.src)
      )
        return [];
      sources.add(element.src);
      return [
        {
          id: `canvas-${element.id}`,
          type: element.t === "video" ? ("video" as const) : ("image" as const),
          ...(element.t === "video" ? { chromaKey: element.chromaKey } : {}),
          name: element.label || element.n,
          src: element.src,
          width: Math.max(1, element.w),
          height: Math.max(1, element.h),
          source: "canvas" as const,
          createdAt: canvas.metadata.updatedAt,
        },
      ];
    }),
  );
}
export function assetElement(asset: CanvasAsset): Element {
  return {
    id: asset.id,
    t: asset.type === "video" ? "video" : "img",
    ...(asset.type === "video" ? { chromaKey: asset.chromaKey } : {}),
    n: asset.name,
    identifier: slugify(asset.name) || undefined,
    src: asset.src,
    label: asset.name,
    x: 0,
    y: 0,
    w: asset.width,
    h: asset.height,
    fit: "contain",
  };
}
async function imageAsset(source: {
  name: string;
  src: string;
  id?: string;
  source: CanvasAsset["source"];
  prompt?: string;
  createdAt?: string;
}): Promise<CanvasAsset> {
  const image = new Image();
  image.src = source.src;
  try {
    await image.decode();
  } catch {
    throw Error(`Could not read image “${source.name}”.`);
  }
  let id = source.id;
  if (!id) {
    const bytes = await (await fetch(source.src)).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    id =
      "asset-" +
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
  }
  return validateCanvasAsset({
    ...source,
    id,
    width: image.naturalWidth,
    height: image.naturalHeight,
    createdAt: source.createdAt || new Date().toISOString(),
  });
}
export async function importImageFile(file: File) {
  if (
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ].includes(file.type)
  )
    throw Error(
      `Choose a PNG, JPEG, WebP, GIF, or SVG image. ${file.name} was not added.`,
    );
  if (file.size > 32 * 1024 * 1024) throw Error("Images must be under 32 MB.");
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return imageAsset({
    name: file.name.replace(/\.[^.]+$/, ""),
    src,
    source: "upload",
  });
}
