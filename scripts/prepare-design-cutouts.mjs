import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const slug = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const layouts = JSON.parse(
  await fs.readFile(
    path.join(root, "design-references/artwork-layouts.json"),
    "utf8",
  ),
);
const output = path.join(root, "asset-packs/siswa-juara/source/design-cutouts");
await fs.mkdir(output, { recursive: true });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "genie-design-cutouts-"));
const jobs = [];
try {
  for (const [file, regions] of Object.entries(layouts)) {
    const source = path.join(root, "design-references", file),
      { width: W, height: H } = await sharp(source).metadata();
    for (const [title, xx, yy, ww, hh, treatment] of regions) {
      const name = `${slug(file.replace(/\.png$/, ""))}-${slug(title)}.png`,
        destination = path.join(output, name);
      const left = Math.round(xx * W),
        top = Math.round(yy * H);
      const width = Math.min(W - left, Math.round(ww * W)),
        height = Math.min(H - top, Math.round(hh * H));
      if (!process.argv.includes("--force")) {
        const current = await sharp(destination)
          .metadata()
          .catch(() => undefined);
        if (current?.width === width && current?.height === height) continue;
      }
      const input = path.join(temp, name);
      const crop = sharp(source).extract({ left, top, width, height });
      if (treatment === "image") {
        await crop
          .composite([
            {
              input: Buffer.from(
                `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="30" fill="white"/></svg>`,
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toFile(destination);
        continue;
      }
      await crop.png().toFile(input);
      jobs.push({ input, output: destination });
    }
  }
  if (jobs.length) {
    if (process.platform !== "darwin")
      throw Error(
        "Supply reviewed transparent PNG cutouts in the external source pack, or prepare them on macOS using local Vision.",
      );
    const list = path.join(temp, "jobs.json");
    await fs.writeFile(list, JSON.stringify(jobs));
    await new Promise((resolve, reject) => {
      const child = spawn(
        "swift",
        [
          "-module-cache-path",
          path.join(os.tmpdir(), "genie-swift-cache"),
          path.join(root, "scripts/isolate-artwork.swift"),
          list,
        ],
        { stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(Error(`Local cutout preparation exited ${code}.`)),
      );
    });
  }
  console.log(
    `Prepared ${jobs.length} local foreground cutouts; existing reviewed files were preserved.`,
  );
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
