import { invoke, isTauri } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { identifierFromAssetFile, matchAssetIdentifier } from "./identifiers";
import {
  parseAssetManifest,
  type PackAsset,
  type AssetManifest,
} from "./asset-manifest";

type AssetCategory = string;
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
  type?: "image" | "video";
  duration?: number;
  chromaKey?: PackAsset["chromaKey"];
};
export const assetMime = "application/x-siswa-juara-asset";
let draggedAssetId: string | undefined;
// Same-document fallback for the drag payload: some webviews do not round-trip
// custom DataTransfer MIME types, so the drop handler reads this when
// getData(assetMime) comes back empty. Cleared on drag end / drop.
export function setDraggedAssetId(id: string | undefined) {
  draggedAssetId = id;
}
export function takeDraggedAssetId() {
  const id = draggedAssetId;
  draggedAssetId = undefined;
  return id;
}
export let libraryAssets: LibraryAsset[] = [];
type PackState = {
  name: string;
  directory: string;
  error: string;
  connected: boolean;
  revision: number;
};
let state: PackState = {
  name: "",
  directory: "",
  error: "",
  connected: false,
  revision: 0,
};
const listeners = new Set<() => void>();
export function useAssetLibrary() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );
}
function update(value: Partial<PackState>) {
  state = { ...state, ...value, revision: state.revision + 1 };
  listeners.forEach((listener) => listener());
}
type ReadAsset = (asset: PackAsset, thumbnail: boolean) => Promise<Blob>;
const sources = new WeakMap<
  LibraryAsset,
  { record: PackAsset; read: ReadAsset; generation: number }
>();
let generation = 0;
const loading = new Map<string, Promise<string>>();
const thumbnails = new Map<string, Promise<string>>();
let presetFiles = new Map<string, number>();
let readPresetFile: ((path: string) => Promise<Blob>) | undefined;
export const assetPackRevision = () => state.revision;
export const hasPresetLibrary = () => presetFiles.has("presets/catalog.json");
export const hasPackPresetFile = (path: string) => presetFiles.has(path);
export async function loadPackPresetFile(path: string): Promise<Blob> {
  const bytes = presetFiles.get(path),
    read = readPresetFile,
    current = generation;
  if (!bytes || !read)
    throw Error("Connect an asset pack with templates in Setting > Assets.");
  const blob = await read(path);
  if (current !== generation)
    throw Error("The asset folder changed. Select the template again.");
  if (blob.size !== bytes)
    throw Error(
      "Template file size does not match its metadata. Refresh the asset folder.",
    );
  return blob;
}
function activate(
  pack: AssetManifest,
  directory: string,
  read: ReadAsset,
  readPreset: (path: string) => Promise<Blob>,
) {
  generation++;
  presetFiles = new Map(
    (pack.presets || []).map((file) => [file.path, file.bytes]),
  );
  readPresetFile = readPreset;
  loading.clear();
  thumbnails.clear();
  libraryAssets = pack.assets
    .map((asset) => {
      const result: LibraryAsset = {
        id: `${pack.id}:${asset.id}`,
        name: asset.name,
        file: asset.file,
        category: asset.category,
        type: asset.type,
        image: "",
        thumbnail: "",
        width: asset.width,
        height: asset.height,
        identifier: identifierFromAssetFile(asset.file),
        keywords:
          `${asset.name} ${asset.file} ${asset.tags.join(" ")} ${asset.type} ${asset.category}`.toLowerCase(),
        duration: asset.duration,
        chromaKey: asset.chromaKey,
      };
      sources.set(result, { record: asset, read, generation });
      return result;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  update({ name: pack.name, directory, connected: true, error: "" });
}
type NativePack = { manifest: unknown; directory: string; token: string };
function activateNative(result: NativePack) {
  const pack = parseAssetManifest(result.manifest);
  activate(
    pack,
    result.directory,
    async (asset, thumbnail) => {
      const bytes = await invoke<ArrayBuffer>("asset_pack_read", {
        token: result.token,
        id: asset.id,
        thumbnail,
      });
      return new Blob([bytes], {
        type: thumbnail ? thumbnailMime(asset.thumbnail) : asset.mime,
      });
    },
    async (path) =>
      new Blob([
        await invoke<ArrayBuffer>("asset_pack_read_preset", {
          token: result.token,
          path,
        }),
      ]),
  );
}
function thumbnailMime(path: string) {
  return /\.png$/i.test(path)
    ? "image/png"
    : /\.jpe?g$/i.test(path)
      ? "image/jpeg"
      : "image/webp";
}
export async function initializeAssetLibrary() {
  try {
    if (isTauri()) {
      const result = await invoke<NativePack | null>("asset_pack_status");
      if (result) activateNative(result);
    } else if (import.meta.env.DEV) {
      const response = await fetch("/api/genie-assets/manifest");
      if (response.status === 404) return;
      if (!response.ok)
        throw Error("Could not read the development asset pack.");
      const pack = parseAssetManifest(await response.json());
      activate(
        pack,
        "Development asset folder",
        async (asset, thumbnail) => {
          const response = await fetch(
            `/api/genie-assets/file?path=${encodeURIComponent(thumbnail ? asset.thumbnail : asset.path)}`,
          );
          if (!response.ok)
            throw Error("Asset file is missing. Reconnect the asset folder.");
          return response.blob();
        },
        async (path) => {
          const response = await fetch(
            `/api/genie-assets/file?path=${encodeURIComponent(path)}`,
          );
          if (!response.ok)
            throw Error(
              "Template file is missing. Reconnect the asset folder.",
            );
          return response.blob();
        },
      );
    }
  } catch (error) {
    update({ error: String(error) });
  }
}
export async function chooseAssetDirectory() {
  const result = await invoke<NativePack | null>("asset_pack_choose");
  if (result) activateNative(result);
}
export async function connectBrowserAssetDirectory(files: File[]) {
  const manifests = files.filter((file) => file.name === "manifest.json");
  if (manifests.length !== 1)
    throw Error("Choose the pack folder containing one manifest.json.");
  const manifest = manifests[0];
  if (manifest.size > 4 * 1024 * 1024)
    throw Error("The asset manifest is too large.");
  const prefix = manifest.webkitRelativePath.slice(0, -"manifest.json".length);
  const byPath = new Map(files.map((file) => [file.webkitRelativePath, file]));
  const pack = parseAssetManifest(JSON.parse(await manifest.text()));
  for (const asset of pack.assets) {
    const media = byPath.get(prefix + asset.path),
      thumb = byPath.get(prefix + asset.thumbnail);
    if (!media || !thumb)
      throw Error(`Asset pack is incomplete: ${asset.name}.`);
    if (media.size !== asset.bytes || thumb.size > 1024 * 1024)
      throw Error(
        `Asset file size does not match its metadata: ${asset.name}.`,
      );
  }
  for (const entry of pack.presets || []) {
    const file = byPath.get(prefix + entry.path);
    if (!file || file.size !== entry.bytes)
      throw Error(`Template pack is incomplete: ${entry.path}.`);
  }
  activate(
    pack,
    prefix.replace(/\/$/, ""),
    async (asset, thumbnail) =>
      new Blob(
        [byPath.get(prefix + (thumbnail ? asset.thumbnail : asset.path))!],
        { type: thumbnail ? thumbnailMime(asset.thumbnail) : asset.mime },
      ),
    async (path) => byPath.get(prefix + path)!,
  );
}
export async function disconnectAssetDirectory() {
  if (isTauri()) await invoke("asset_pack_disconnect");
  generation++;
  presetFiles.clear();
  readPresetFile = undefined;
  libraryAssets = [];
  loading.clear();
  thumbnails.clear();
  update({ name: "", directory: "", connected: false, error: "" });
}
export const findAsset = (id: string) =>
  libraryAssets.find((asset) => asset.id === id);
export const matchLibraryAsset = (identifier: string) =>
  matchAssetIdentifier(
    identifier,
    libraryAssets.filter((asset) => asset.type !== "video"),
  );
function dataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("This asset could not be read."));
    reader.readAsDataURL(blob);
  });
}
export async function loadAssetBlob(asset: LibraryAsset, thumbnail = false) {
  const source = sources.get(asset);
  if (!source) {
    const response = await fetch(thumbnail ? asset.thumbnail : asset.image);
    if (!response.ok) throw Error("This asset could not be loaded.");
    return response.blob();
  }
  if (source.generation !== generation)
    throw Error("The asset folder has changed. Select the asset again.");
  const blob = await source.read(source.record, thumbnail);
  const limit = thumbnail ? 1024 * 1024 : source.record.bytes;
  if (
    !blob ||
    blob.size > limit ||
    (!thumbnail && blob.size !== source.record.bytes)
  )
    throw Error("Asset file size does not match its metadata.");
  if (source.generation !== generation)
    throw Error("The asset folder has changed. Select the asset again.");
  return blob;
}
export function loadAssetThumbnail(asset: LibraryAsset): Promise<string> {
  if (!sources.has(asset)) return Promise.resolve(asset.thumbnail);
  const cached = thumbnails.get(asset.id);
  if (cached) return cached;
  const promise = loadAssetBlob(asset, true)
    .then(dataURL)
    .catch((error) => {
      thumbnails.delete(asset.id);
      throw error;
    });
  thumbnails.set(asset.id, promise);
  if (thumbnails.size > 64) thumbnails.delete(thumbnails.keys().next().value!);
  return promise;
}
export function loadAsset(asset: LibraryAsset): Promise<string> {
  const cached = loading.get(asset.id);
  if (cached) return cached;
  const promise = (async () => {
    const src = await dataURL(await loadAssetBlob(asset));
    if (asset.type !== "video") {
      const image = new Image();
      image.src = src;
      await image.decode();
    }
    return src;
  })().catch((error) => {
    loading.delete(asset.id);
    throw error;
  });
  if (asset.type !== "video") loading.set(asset.id, promise);
  if (loading.size > 4) loading.delete(loading.keys().next().value!);
  return promise;
}
