import manifest from "../assets/generated/elements/manifest.json";
import { identifierFromAssetFile, matchAssetIdentifier } from "./identifiers";

export type AssetCategory = "Owls" | "Devices" | "School" | "Symbols" | "Other";
export type LibraryAsset = {
  id: string;
  name: string;
  file: string;
  category: AssetCategory;
  image: string;
  thumbnail: string;
  width: number;
  height: number;
  keywords: string;
  identifier: string;
};
export const assetMime = "application/x-siswa-juara-asset";
const urls = import.meta.glob<string>("../assets/generated/elements/*.webp", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
function category(file: string): AssetCategory {
  if (file.includes("owl-student-mascot")) return "Owls";
  if (
    /computer|laptop|keyboard|mouse|monitor|smartphone|tablet|wifi|cloud|headphone|usb|printer|camera/.test(
      file,
    )
  )
    return "Devices";
  if (
    /book|pencil|school|backpack|graduation|ruler|education|notebook/.test(file)
  )
    return "School";
  if (
    /arrow|star|check|lightbulb|question|bell|speech|chat|heart|target|trophy|calendar|clock|megaphone|play-button/.test(
      file,
    )
  )
    return "Symbols";
  return "Other";
}
export function displayName(file: string) {
  const name = file
    .replace(/\.[^.]+$/, "")
    .replace(/owl-student-mascot-/, "owl-")
    .replace(
      /-front-\d+|-right-\d+|-left-\d+|-up-\d+|-down-\d+|-single|-multiple|-v\d+/g,
      "",
    )
    .replace(/^image-/, "illustration-")
    .replace(/-/g, " ");
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
export const libraryAssets: LibraryAsset[] = manifest.assets
  .map((asset) => ({
    id: asset.id,
    identifier: identifierFromAssetFile(asset.file),
    file: asset.file,
    name: displayName(asset.file),
    category: category(asset.file),
    width: asset.width,
    height: asset.height,
    image: urls[`../assets/generated/elements/${asset.image}`],
    thumbnail: urls[`../assets/generated/elements/${asset.thumbnail}`],
    keywords: asset.file.replace(/[-_/]/g, " ").toLowerCase(),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const byId = new Map(libraryAssets.map((asset) => [asset.id, asset]));
export const findAsset = (id: string) => byId.get(id);
export const matchLibraryAsset = (identifier: string) =>
  matchAssetIdentifier(identifier, libraryAssets);
const loading = new Map<string, Promise<string>>();
export function loadAsset(asset: LibraryAsset): Promise<string> {
  const cached = loading.get(asset.id);
  if (cached) return cached;
  const promise = (async () => {
    const response = await fetch(asset.image);
    if (!response.ok)
      throw new Error("This asset could not be loaded. Try again.");
    const blob = await response.blob();
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("This asset could not be read."));
      reader.readAsDataURL(blob);
    });
    const image = new Image();
    image.src = src;
    await image.decode();
    return src;
  })().catch((err) => {
    loading.delete(asset.id);
    throw err;
  });
  loading.set(asset.id, promise);
  if (loading.size > 12) loading.delete(loading.keys().next().value!);
  return promise;
}
