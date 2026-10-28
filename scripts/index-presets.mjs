import fs from "node:fs/promises";
import path from "node:path";
import { indexPackPresets } from "./preset-pack.mjs";
const root = path.resolve(
  import.meta.dirname,
  "../asset-packs/siswa-juara/pack/presets",
);
const useCases = new Set([
  "cover",
  "list",
  "content",
  "image",
  "question",
  "answer",
  "explanation",
  "closing",
]);
const entries = [],
  identifiers = new Set();
const branding = JSON.parse(
  await fs.readFile(path.join(root, "shared/branding.json"), "utf8"),
);
async function visit(folder) {
  for (const entry of await fs.readdir(path.join(root, folder), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (!["previews", "shared"].includes(entry.name)) await visit(relative);
      continue;
    }
    if (!entry.name.endsWith(".json") || relative === "catalog.json") continue;
    const preset = JSON.parse(
      await fs.readFile(path.join(root, relative), "utf8"),
    );
    if (
      preset.schemaVersion !== 2 ||
      !/^[a-z0-9-]+$/.test(preset.identifier) ||
      identifiers.has(preset.identifier) ||
      !preset.name ||
      !preset.collection ||
      !Array.isArray(preset.useCases) ||
      !preset.useCases.length ||
      !preset.useCases.every((c) => useCases.has(c)) ||
      !Array.isArray(preset.tags) ||
      !Array.isArray(preset.objects) ||
      !preset.objects.length ||
      preset.objects.some(
        (o) =>
          !o.id ||
          !["text", "rect", "ellipse", "line", "img", "video"].includes(o.t),
      )
    )
      throw Error(`Invalid v2 preset: ${relative}`);
    identifiers.add(preset.identifier);
    const { objects, ...summary } = preset;
    const thumbnail = `previews/${preset.identifier}.webp`;
    const hasPreview = await fs.access(path.join(root, thumbnail)).then(
      () => true,
      () => false,
    );
    entries.push({
      ...summary,
      file: relative,
      ...(hasPreview ? { thumbnail } : {}),
      elementCount:
        objects.length + (preset.branding ? branding.objects.length : 0),
    });
  }
}
await visit("");
await fs.writeFile(
  path.join(root, "catalog.json"),
  JSON.stringify({ version: 1, presets: entries }, null, 2) + "\n",
);
console.log(
  `Indexed ${entries.length} templates. Only catalog metadata is loaded when browsing.`,
);
await indexPackPresets(path.dirname(root));
