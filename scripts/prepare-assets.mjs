import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src/assets/elements");
const output = path.join(root, "src/assets/generated/elements");
const version = 1;
await fs.mkdir(output, { recursive: true });
let previous = {};
try {
  previous = JSON.parse(
    await fs.readFile(path.join(output, "manifest.json"), "utf8"),
  );
} catch {
  /* First build generates every thumbnail. */
}
async function discover(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await discover(full)));
    else if (/\.(png|jpe?g|webp|avif|svg)$/i.test(entry.name)) files.push(full);
  }
  return files;
}
const files = (await discover(source)).sort();
const old = new Map((previous.assets || []).map((asset) => [asset.id, asset]));
const assets = new Array(files.length);
let next = 0,
  generated = 0;
sharp.cache({ memory: 48, files: 16, items: 32 });
sharp.concurrency(1);
async function worker() {
  while (next < files.length) {
    const index = next++,
      file = files[index],
      relative = path.relative(source, file).split(path.sep).join("/");
    const id = createHash("sha1").update(relative).digest("hex").slice(0, 14);
    const stat = await fs.stat(file),
      fingerprint = `${version}:${stat.size}:${stat.mtimeMs}`;
    const image = `${id}.webp`,
      thumbnail = `${id}.thumb.webp`;
    const saved = old.get(id);
    if (saved?.fingerprint === fingerprint) {
      try {
        await Promise.all([
          fs.access(path.join(output, image)),
          fs.access(path.join(output, thumbnail)),
        ]);
        assets[index] = saved;
        continue;
      } catch {
        /* Rebuild a missing generated image. */
      }
    }
    const original = await sharp(file).metadata();
    const result = await sharp(file)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90, alphaQuality: 100, effort: 4 })
      .toFile(path.join(output, image));
    await sharp(file)
      .rotate()
      .resize({
        width: 192,
        height: 192,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 76, alphaQuality: 90, effort: 3 })
      .toFile(path.join(output, thumbnail));
    assets[index] = {
      id,
      file: relative,
      image,
      thumbnail,
      width: result.width,
      height: result.height,
      originalWidth: original.width,
      originalHeight: original.height,
      fingerprint,
    };
    generated++;
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const manifest = JSON.stringify({ version, assets }, null, 2) + "\n";
if (JSON.stringify(previous) !== JSON.stringify({ version, assets }))
  await fs.writeFile(path.join(output, "manifest.json"), manifest);
const keep = new Set([
  "manifest.json",
  ...assets.flatMap((asset) => [asset.image, asset.thumbnail]),
]);
for (const file of await fs.readdir(output))
  if (!keep.has(file)) await fs.rm(path.join(output, file), { force: true });
console.log(
  `Assets ready: ${assets.length} images (${generated} regenerated).`,
);
