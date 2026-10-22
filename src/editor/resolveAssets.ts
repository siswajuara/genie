import type { Element, Preset } from "./model";
import { loadAsset, matchLibraryAsset } from "./assets";

export async function resolvePresetAssets(preset: Preset): Promise<Preset> {
  const loaded = new Map<string, Promise<string>>();
  let index = 0;
  const objects = [...preset.objects];
  async function worker() {
    while (index < objects.length) {
      const at = index++,
        object = objects[at];
      if (object.t !== "img" || object.src || !object.identifier) continue;
      const asset = matchLibraryAsset(object.identifier);
      if (!asset) continue;
      if (!loaded.has(asset.id)) loaded.set(asset.id, loadAsset(asset));
      try {
        objects[at] = {
          ...object,
          src: await loaded.get(asset.id),
          fit: object.fit || "contain",
        };
      } catch {
        /* Keep the editable slot if a library image is unavailable. */
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { ...preset, objects };
}
export function unresolvedAssetSlots(elements: Element[]) {
  return elements.filter(
    (o) =>
      o.t === "img" &&
      !o.src &&
      o.identifier &&
      matchLibraryAsset(o.identifier),
  );
}
