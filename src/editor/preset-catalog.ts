import { parsePresets, type Preset } from "./model";
import { withStandardBranding } from "./standard-branding";
import {
  assetPackRevision,
  hasPresetLibrary,
  loadPackPresetFile,
} from "./assets";

export const useCases = [
  "cover",
  "list",
  "content",
  "image",
  "question",
  "answer",
  "explanation",
  "closing",
] as const;
export type PresetSummary = Omit<Preset, "objects"> & {
  identifier: string;
  file: string;
  thumbnail?: string;
  elementCount: number;
};
export type PresetCatalog = { version: 1; presets: PresetSummary[] };
const root = "presets/";
const safeFile = (value: unknown, extension: string) =>
  typeof value === "string" &&
  new RegExp(`^[a-z0-9][a-z0-9/_-]*\\.(?:${extension})$`).test(value) &&
  !value.includes("..");
let catalog: Promise<PresetCatalog> | undefined;
let revision = -1;
const loaded = new Map<string, Promise<Preset>>();

export async function loadPresetThumbnail(entry: PresetSummary) {
  if (!entry.thumbnail || !safeFile(entry.thumbnail, "webp|png")) return "";
  const blob = await loadPackPresetFile(root + entry.thumbnail);
  return URL.createObjectURL(blob);
}
export function parseCatalog(value: unknown): PresetCatalog {
  const c = value as PresetCatalog;
  if (!c || c.version !== 1 || !Array.isArray(c.presets))
    throw Error("Invalid template catalog.");
  const ids = new Set<string>();
  for (const entry of c.presets) {
    if (
      !entry ||
      !/^[a-z0-9-]+$/.test(entry.identifier) ||
      ids.has(entry.identifier) ||
      typeof entry.name !== "string" ||
      !entry.name.trim() ||
      !["template", "object"].includes(entry.kind) ||
      !safeFile(entry.file, "json") ||
      (entry.thumbnail !== undefined &&
        !safeFile(entry.thumbnail, "webp|png")) ||
      !Number.isInteger(entry.elementCount) ||
      entry.elementCount < 1 ||
      (entry.kind === "template" &&
        ![entry.W, entry.H].every(
          (n) =>
            typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 16000,
        )) ||
      ![entry.tags, entry.useCases, entry.requiredAssets].every(
        (list) =>
          list === undefined ||
          (Array.isArray(list) && list.every((v) => typeof v === "string")),
      ) ||
      ![entry.collection, entry.description].every(
        (v) => v === undefined || typeof v === "string",
      )
    )
      throw Error("Invalid template catalog entry.");
    ids.add(entry.identifier);
  }
  return c;
}
export function loadPresetCatalog(): Promise<PresetCatalog> {
  if (revision !== assetPackRevision()) {
    revision = assetPackRevision();
    catalog = undefined;
    loaded.clear();
  }
  if (!hasPresetLibrary()) return Promise.resolve({ version: 1, presets: [] });
  if (!catalog) {
    const request = loadPackPresetFile(root + "catalog.json")
      .then(async (blob) => parseCatalog(JSON.parse(await blob.text())))
      .catch((error) => {
        if (catalog === request) catalog = undefined;
        throw error;
      });
    catalog = request;
  }
  return catalog;
}
export function loadPreset(entry: Preset | PresetSummary): Promise<Preset> {
  if ("objects" in entry) return withStandardBranding(entry);
  if (!safeFile(entry.file, "json"))
    return Promise.reject(Error("Invalid template file."));
  const key = `${assetPackRevision()}:${entry.file}`;
  let promise = loaded.get(key);
  if (!promise) {
    promise = loadPackPresetFile(root + entry.file)
      .then(async (blob) => {
        const presets = parsePresets(JSON.parse(await blob.text()));
        if (presets.length !== 1 || presets[0].identifier !== entry.identifier)
          throw Error("The template and catalog do not match.");
        return presets[0];
      })
      .catch((error) => {
        loaded.delete(key);
        throw error;
      });
    loaded.set(key, promise);
    if (loaded.size > 12) loaded.delete(loaded.keys().next().value!);
  }
  return promise.then(withStandardBranding);
}
export function templateFormat(preset: Pick<Preset, "W" | "H" | "kind">) {
  if (preset.kind === "object") return "Elements";
  const ratio = (preset.W || 1122) / (preset.H || 1402);
  return ratio < 0.65
    ? "Story"
    : ratio > 1.15
      ? "Landscape"
      : ratio > 0.95
        ? "Square"
        : "Portrait";
}
