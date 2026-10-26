import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { root, versionState } from "./version.mjs";
const platforms = {
  "macos-arm64": "darwin-aarch64",
  "macos-x64": "darwin-x86_64",
  "windows-x64": "windows-x86_64",
  "windows-arm64": "windows-aarch64",
  "linux-x64": "linux-x86_64",
  "linux-arm64": "linux-aarch64",
};
export async function walk(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...(await walk(file)));
    else if (item.isFile()) files.push(file);
  }
  return files;
}
const platform = platforms[process.env.DESKTOP_PLATFORM],
  target = process.env.DESKTOP_TARGET;
if (!platform || !target)
  throw Error("Set a supported DESKTOP_PLATFORM and DESKTOP_TARGET.");
const { version } = await versionState(),
  directory = path.join(root, "src-tauri/target", target, "release/bundle"),
  output = path.join(root, "release-assets");
await fs.mkdir(output, { recursive: true });
const files = (await walk(directory)).filter((file) =>
  /\.(dmg|exe|deb|AppImage|app\.tar\.gz)(\.sig)?$/.test(file),
);
const assets = [];
for (const file of files) {
  const name = `genie-${version}-${platform}-${path.basename(file)}`,
    bytes = await fs.readFile(file);
  await fs.writeFile(path.join(output, name), bytes);
  assets.push({
    name,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const pattern = platform.startsWith("darwin")
  ? /\.app\.tar\.gz$/
  : platform.startsWith("windows")
    ? /\.exe$/
    : /\.AppImage$/;
const candidates = files.filter((file) => pattern.test(file));
if (candidates.length !== 1)
  throw Error(
    `Expected exactly one update package for ${platform}, got ${candidates.length}.`,
  );
const update = candidates[0],
  signature = (await fs.readFile(update + ".sig", "utf8")).trim();
if (!signature) throw Error("Missing updater signature.");
await fs.writeFile(
  path.join(output, `part-${platform}.json`),
  JSON.stringify(
    {
      platform,
      version,
      update: `genie-${version}-${platform}-${path.basename(update)}`,
      signature,
      assets,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Staged ${assets.length} signed release assets for ${platform}.`);
