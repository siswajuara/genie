import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "asset-packs/siswa-juara/source");
const output = path.join(root, "asset-packs/siswa-juara/pack");
const version = 2;
await fs.mkdir(path.join(output, "images"), { recursive: true });
await fs.mkdir(path.join(output, "video"), { recursive: true });
await fs.mkdir(path.join(output, "thumbnails"), { recursive: true });
let previous = {};
try {
  previous = JSON.parse(
    await fs.readFile(path.join(output, "manifest.json"), "utf8"),
  );
} catch {
  /* First pack build. */
}
const old = new Map((previous.assets || []).map((asset) => [asset.id, asset]));
const assets = [];
const hash = (value) =>
  createHash("sha1").update(value).digest("hex").slice(0, 14);
function category(file) {
  if (file.includes("owl-student-mascot")) return "Owls";
  if (
    /computer|laptop|keyboard|mouse|monitor|smartphone|tablet|wifi|cloud|headphone|usb|printer|camera/.test(
      file,
    )
  )
    return "Devices";
  if (
    /book|pencil|school|backpack|graduation|ruler|education|notebook/.test(file)
  )
    return "School";
  if (
    /arrow|star|check|lightbulb|question|bell|speech|chat|heart|target|trophy|calendar|clock|megaphone|play-button/.test(
      file,
    )
  )
    return "Symbols";
  return "Other";
}
function displayName(file) {
  const name = file
    .replace(/\.[^.]+$/, "")
    .replace(/owl-student-mascot-/, "owl-")
    .replace(
      /-front-\d+|-right-\d+|-left-\d+|-up-\d+|-down-\d+|-single|-multiple|-v\d+/g,
      "",
    )
    .replace(/^image-/, "illustration-")
    .replace(/-/g, " ")
    .trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
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
async function reusable(id, fingerprint) {
  const saved = old.get(id);
  if (saved?.fingerprint !== fingerprint) return;
  try {
    await Promise.all(
      [saved.path, saved.thumbnail].map((file) =>
        fs.access(path.join(output, file)),
      ),
    );
    return saved;
  } catch {
    return;
  }
}
const files = (await discover(path.join(source, "elements"))).sort();
let next = 0,
  generated = 0;
sharp.cache({ memory: 48, files: 16, items: 32 });
sharp.concurrency(1);
async function worker() {
  while (next < files.length) {
    const file = files[next++],
      relative = path
        .relative(path.join(source, "elements"), file)
        .split(path.sep)
        .join("/");
    const id = hash(relative),
      stat = await fs.stat(file),
      fingerprint = `${version}:${stat.size}:${stat.mtimeMs}`;
    const saved = await reusable(id, fingerprint);
    if (saved) {
      assets.push(saved);
      continue;
    }
    const image = `images/${id}.webp`,
      thumbnail = `thumbnails/${id}.webp`;
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
    assets.push({
      id,
      type: "image",
      file: relative,
      name: displayName(relative),
      category: category(relative),
      tags: relative.replace(/\.[^.]+$/, "").split(/[-_/]/),
      path: image,
      thumbnail,
      mime: "image/webp",
      width: result.width,
      height: result.height,
      bytes: result.size,
      fingerprint,
    });
    generated++;
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
const videoMetadata = JSON.parse(
  await fs.readFile(path.join(source, "video/metadata.json"), "utf8"),
);
for (const item of videoMetadata.assets) {
  const file = path.join(source, "video", item.file),
    stat = await fs.stat(file),
    id = hash(`video/${item.file}`),
    fingerprint = `${version}:h264-crf24-audio0:${stat.size}:${stat.mtimeMs}`;
  const saved = await reusable(id, fingerprint);
  if (saved) {
    assets.push({ ...saved, ...item });
    continue;
  }
  const metadata = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
  const stream = metadata.streams.find(
    (stream) => stream.codec_type === "video",
  );
  const video = `video/${item.file}`,
    thumbnail = `thumbnails/${id}.webp`;
  // Preserve the source resolution and frame rate for clean chroma edges; drop unused audio.
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.join(output, video),
    ],
    { stdio: "inherit" },
  );
  const frame = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-ss",
      "1",
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=192:192:force_original_aspect_ratio=decrease",
      "-f",
      "image2pipe",
      "-c:v",
      "png",
      "pipe:1",
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  await sharp(frame).webp({ quality: 78 }).toFile(path.join(output, thumbnail));
  const [numerator, denominator] = stream.r_frame_rate.split("/").map(Number);
  assets.push({
    ...item,
    id,
    type: "video",
    path: video,
    thumbnail,
    mime: "video/mp4",
    width: stream.width,
    height: stream.height,
    duration: Number(stream.duration || metadata.format.duration),
    fps: numerator / denominator,
    bytes: (await fs.stat(path.join(output, video))).size,
    fingerprint,
  });
  generated++;
}
assets.sort((a, b) => a.name.localeCompare(b.name));
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(
    {
      version: 1,
      id: "siswa-juara",
      name: "Siswa Juara Elements",
      assets,
      ...(previous.presets ? { presets: previous.presets } : {}),
    },
    null,
    2,
  ) + "\n",
);
const keep = new Set(assets.flatMap((asset) => [asset.path, asset.thumbnail]));
for (const directory of ["images", "video", "thumbnails"])
  for (const name of await fs.readdir(path.join(output, directory)))
    if (!keep.has(`${directory}/${name}`))
      await fs.rm(path.join(output, directory, name));
console.log(
  `External pack ready: ${assets.length} assets (${generated} regenerated), ${(assets.reduce((sum, asset) => sum + asset.bytes, 0) / 1024 / 1024).toFixed(1)} MB media. Not included in app builds.`,
);
