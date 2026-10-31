import { withSceneSafeLayout } from "../src/editor/scene-safe-layout.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { learningPresets } from "./learning-presets.mjs";
import { withGenerationSlots } from "../src/editor/template-slots.mjs";
import { indexPackPresets } from "./preset-pack.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  pack = path.join(root, "asset-packs/siswa-juara/pack"),
  folder = path.join(pack, "presets");
const filename = path.join(folder, "catalog.json"),
  catalog = JSON.parse(await fs.readFile(filename, "utf8")),
  branding = JSON.parse(
    await fs.readFile(path.join(folder, "shared/branding.json"), "utf8"),
  );
const presets = await learningPresets(root),
  ids = new Set(presets.map((p) => p.identifier));
catalog.presets = catalog.presets.filter((p) => !ids.has(p.identifier));
await fs.mkdir(path.join(folder, "learning"), { recursive: true });
for (const raw of presets) {
  const p = withGenerationSlots(withSceneSafeLayout({
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
    })),
    file = `learning/${p.identifier}.json`,
    thumbnail = `previews/${p.identifier}.webp`;
  await fs.writeFile(
    path.join(folder, file),
    JSON.stringify(p, null, 2) + "\n",
  );
  const { objects, ...summary } = p;
  catalog.presets.push({
    ...summary,
    file,
    ...((await fs.access(path.join(folder, thumbnail)).then(
      () => true,
      () => false,
    ))
      ? { thumbnail }
      : {}),
    elementCount: objects.length + branding.objects.length,
  });
}
await fs.writeFile(filename, JSON.stringify(catalog, null, 2) + "\n");
await indexPackPresets(pack);
console.log(
  `Prepared ${presets.length} SD–SMA learning presets; ${catalog.presets.length} templates available.`,
);
