import { withSceneSafeLayout } from "../src/editor/scene-safe-layout.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { sciencePresets } from "./science-presets.mjs";
import { withGenerationSlots } from "../src/editor/template-slots.mjs";
import { indexPackPresets } from "./preset-pack.mjs";

const root = path.resolve(import.meta.dirname, "..");
const pack = path.join(root, "asset-packs/siswa-juara/pack"),
  folder = path.join(pack, "presets");
const file = path.join(folder, "catalog.json"),
  catalog = JSON.parse(await fs.readFile(file, "utf8"));
const branding = JSON.parse(
  await fs.readFile(path.join(folder, "shared/branding.json"), "utf8"),
);
const presets = await sciencePresets(root),
  identifiers = new Set(presets.map((p) => p.identifier));
catalog.presets = catalog.presets.filter((p) => !identifiers.has(p.identifier));
await fs.mkdir(path.join(folder, "science"), { recursive: true });
for (const raw of presets) {
  const preset = withGenerationSlots(withSceneSafeLayout({
    ...raw,
    objects: raw.objects.map((o, i) => ({
      ...o,
      id: `layer-${i + 1}`,
      identifier:
        o.identifier ||
        o.n
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
    })),
  }));
  const relative = `science/${preset.identifier}.json`;
  await fs.writeFile(
    path.join(folder, relative),
    JSON.stringify(preset, null, 2) + "\n",
  );
  const { objects, ...summary } = preset,
    thumbnail = `previews/${preset.identifier}.webp`;
  const hasPreview = await fs.access(path.join(folder, thumbnail)).then(
    () => true,
    () => false,
  );
  catalog.presets.push({
    ...summary,
    file: relative,
    ...(hasPreview ? { thumbnail } : {}),
    elementCount: objects.length + branding.objects.length,
  });
}
await fs.writeFile(file, JSON.stringify(catalog, null, 2) + "\n");
await indexPackPresets(pack);
console.log(
  `Prepared ${presets.length} math, physics, and Q&A presets; ${catalog.presets.length} templates available.`,
);
