import type { Element, Preset } from "./model";
import { loadAsset, matchLibraryAsset } from "./assets";
import { brandImageSource } from "../lib/brand";
import { prepareScienceElement } from "./science";

export async function resolvePresetAssets(preset: Preset): Promise<Preset> {
  const loaded = new Map<string, Promise<string>>();
  let index = 0;
  const objects = [...preset.objects];
  async function worker() {
    while (index < objects.length) {
      const at = index++,
        object = objects[at];
      if (object.latex || object.physics || object.learning) {
        objects[at] = await prepareScienceElement(object);
        continue;
      }
      if (object.t !== "img" || object.src || !object.identifier) continue;
      const brand = brandImageSource(object.identifier);
      if (brand) {
        objects[at] = { ...object, src: brand, fit: object.fit || "contain" };
        continue;
      }
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
  for (const identifier of preset.requiredAssets || []) {
    if (!objects.some((o) => o.identifier === identifier && o.src))
      throw Error(
        "Connect the Siswa Juara asset pack in Setting > Assets to use this design. No changes were made to your canvas.",
      );
  }
  return { ...preset, objects };
}
export function unresolvedAssetSlots(elements: Element[]) {
  return elements.filter(
    (o) =>
      o.t === "img" &&
      !o.latex &&
      !o.physics &&
      !o.learning &&
      !o.src &&
      o.identifier &&
      (brandImageSource(o.identifier) || matchLibraryAsset(o.identifier)),
  );
}
