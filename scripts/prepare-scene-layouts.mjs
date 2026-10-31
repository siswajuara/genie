import fs from "node:fs/promises";
import path from "node:path";
import { standardBranding } from "./preset-branding.mjs";
import { withSceneSafeLayout } from "../src/editor/scene-safe-layout.mjs";
import { indexPackPresets } from "./preset-pack.mjs";

// Update an already prepared external pack without re-reading flattened art or
// the original standard export. This is local authoring, never a canvas migration.
const pack = path.resolve(import.meta.dirname, "../asset-packs/siswa-juara/pack");
const folder = path.join(pack, "presets");
const read = async (file) => JSON.parse(await fs.readFile(path.join(folder, file), "utf8"));
const write = (file, value) => fs.writeFile(path.join(folder, file), JSON.stringify(value, null, 2) + "\n");
const branding = standardBranding(await read("shared/branding.json"));
const catalog = await read("catalog.json");
for (const entry of catalog.presets) {
  const preset = withSceneSafeLayout(await read(entry.file));
  await write(entry.file, preset);
  const { objects, ...summary } = preset;
  Object.assign(entry, summary, {
    elementCount: objects.length + (preset.branding ? branding.objects.length : 0),
  });
}
await write("shared/branding.json", branding);
await write("catalog.json", catalog);
await indexPackPresets(pack);
console.log(`Prepared subtitle-safe layouts and top branding for ${catalog.presets.length} templates. Rebuild previews with npm run presets:previews.`);
