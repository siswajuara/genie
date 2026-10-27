import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../asset-packs",
);
const folder = path.join(root, "siswa-juara/pack");
const manifest = JSON.parse(
  await fs.readFile(path.join(folder, "manifest.json"), "utf8"),
);
const files = {};
for (const file of new Set([
  "manifest.json",
  ...(manifest.presets || []).map((file) => file.path),
  ...manifest.assets.flatMap((asset) => [asset.path, asset.thumbnail]),
]))
  files[`siswa-juara/${file}`] = new Uint8Array(
    await fs.readFile(path.join(folder, file)),
  );
// Media is already compressed. Store it without spending time recompressing it.
const target = path.join(root, "siswa-juara-assets.zip");
await fs.writeFile(target, zipSync(files, { level: 0 }));
console.log(`Asset pack archive: ${target}`);
