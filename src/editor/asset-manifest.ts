export type PackAsset = {
  id: string;
  type: "image" | "video";
  file: string;
  name: string;
  category: string;
  tags: string[];
  path: string;
  thumbnail: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  duration?: number;
  fps?: number;
  chromaKey?: {
    enabled: boolean;
    color: string;
    tolerance: number;
    softness: number;
    spill: number;
  };
};
export type AssetManifest = {
  version: 1;
  id: string;
  name: string;
  assets: PackAsset[];
};
const mimeExtensions: Record<string, RegExp> = {
  "image/png": /\.png$/i,
  "image/jpeg": /\.jpe?g$/i,
  "image/webp": /\.webp$/i,
  "image/gif": /\.gif$/i,
  "image/svg+xml": /\.svg$/i,
  "video/mp4": /\.(mp4|m4v)$/i,
  "video/webm": /\.webm$/i,
};
function safePackPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\\\x00-\x1f:?#%]/.test(value) &&
    !value.startsWith("/") &&
    value.split("/").every((part) => !!part && part !== "." && part !== "..")
  );
}
export function parseAssetManifest(raw: unknown): AssetManifest {
  const pack = raw as AssetManifest;
  if (
    !pack ||
    pack.version !== 1 ||
    typeof pack.id !== "string" ||
    !/^[a-z0-9-]{1,80}$/.test(pack.id) ||
    typeof pack.name !== "string" ||
    !pack.name.trim() ||
    !Array.isArray(pack.assets) ||
    pack.assets.length > 10000
  )
    throw Error(
      "Choose an asset folder containing a valid version 1 manifest.json.",
    );
  const ids = new Set<string>();
  for (const asset of pack.assets) {
    if (
      !asset ||
      typeof asset.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(asset.id) ||
      ids.has(asset.id) ||
      !["image", "video"].includes(asset.type) ||
      typeof asset.name !== "string" ||
      !asset.name.trim() ||
      typeof asset.file !== "string" ||
      typeof asset.category !== "string" ||
      !Array.isArray(asset.tags) ||
      !asset.tags.every((tag) => typeof tag === "string") ||
      !safePackPath(asset.path) ||
      !safePackPath(asset.thumbnail) ||
      !/\.(png|jpe?g|webp)$/i.test(asset.thumbnail) ||
      !mimeExtensions[asset.mime]?.test(asset.path) ||
      !asset.mime.startsWith(`${asset.type}/`) ||
      ![asset.width, asset.height].every(
        (number) => Number.isFinite(number) && number > 0 && number <= 16000,
      ) ||
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes <= 0 ||
      asset.bytes > (asset.type === "video" ? 64 : 32) * 1024 * 1024
    )
      throw Error(
        `Invalid asset metadata: ${asset?.name || asset?.id || "unnamed asset"}.`,
      );
    ids.add(asset.id);
    if (
      asset.type === "video" &&
      (!Number.isFinite(asset.duration) ||
        asset.duration! <= 0 ||
        asset.duration! > 600)
    )
      throw Error(`Invalid video duration: ${asset.name}.`);
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
      throw Error(`Invalid green-screen settings: ${asset.name}.`);
  }
  return pack;
}
