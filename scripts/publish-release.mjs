import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  root,
  versionState,
  parseVersion,
  compareVersions,
} from "./version.mjs";
const expected = [
  // Must match the build matrix in .github/workflows/build-desktop.yml.
  // The release currently builds Windows-only.
  "windows-x86_64",
  "windows-aarch64",
];
const { version } = await versionState(),
  tag = `v${version}`,
  repository = process.env.GITHUB_REPOSITORY;
if (process.env.RELEASE_TAG !== tag || !repository)
  throw Error(
    "Release tag/repository configuration is missing or does not match the app.",
  );
const source = path.join(root, "release-assets"),
  output = path.join(root, "release-publish");
await fs.mkdir(output, { recursive: true });
const platforms = {},
  assets = new Map();
for (const platform of expected) {
  const part = JSON.parse(
    await fs.readFile(path.join(source, `part-${platform}.json`), "utf8"),
  );
  if (
    part.platform !== platform ||
    part.version !== version ||
    !part.signature ||
    !part.assets.some((a) => a.name === part.update)
  )
    throw Error(`Invalid release metadata for ${platform}.`);
  for (const item of part.assets) {
    if (path.basename(item.name) !== item.name)
      throw Error("Invalid asset path.");
    const bytes = await fs.readFile(path.join(source, item.name));
    if (createHash("sha256").update(bytes).digest("hex") !== item.sha256)
      throw Error(`Checksum mismatch: ${item.name}`);
    await fs.writeFile(path.join(output, item.name), bytes);
    assets.set(item.name, item.sha256);
  }
  platforms[platform] = {
    signature: part.signature,
    url: `https://github.com/${repository}/releases/download/${tag}/${encodeURIComponent(part.update)}`,
  };
}
const changelog = await fs
  .readFile(path.join(root, "CHANGELOG.md"), "utf8")
  .catch(() => "");
const section = changelog
  .split(new RegExp(`^## ${tag.replaceAll(".", "\\.")}[^\\n]*\\n`, "m"))[1]
  ?.split(/^## /m)[0]
  ?.trim();
const manifest = {
  version,
  notes: section || `Genie ${tag}. See the GitHub release for details.`,
  pub_date: new Date().toISOString(),
  platforms,
};
await fs.writeFile(
  path.join(output, "latest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
assets.set(
  "latest.json",
  createHash("sha256")
    .update(await fs.readFile(path.join(output, "latest.json")))
    .digest("hex"),
);
await fs.writeFile(
  path.join(output, "SHA256SUMS"),
  [...assets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sha]) => `${sha}  ${name}`)
    .join("\n") + "\n",
);
const gh = (...args) =>
  execFileSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let existing;
try {
  existing = JSON.parse(
    gh("api", `repos/${repository}/releases/tags/${encodeURIComponent(tag)}`),
  );
} catch(error) {if(!String(error.stderr||'').includes('HTTP 404'))throw error;}
if (existing && !existing.draft)
  throw Error(
    `Release ${tag} is already published. Published releases are immutable; bump the patch version.`,
  );
const pre = parseVersion(version).pre.length > 0;
let latest = !pre;
if (latest) {
  try {
    const current = JSON.parse(
      gh("api", `repos/${repository}/releases/latest`),
    );
    if (current.tag_name?.startsWith("v"))
      latest = compareVersions(version, current.tag_name.slice(1)) > 0;
  } catch(error) {if(!String(error.stderr||'').includes('HTTP 404'))throw error;}
}
if (!existing)
  gh(
    "release",
    "create",
    tag,
    "--repo",
    repository,
    "--verify-tag",
    "--draft",
    "--title",
    `Genie ${tag}`,
    "--generate-notes",
    ...(pre ? ["--prerelease"] : []),
  );
const uploadFiles = (await fs.readdir(output)).map((name) =>
  path.join(output, name),
);
gh("release", "upload", tag, "--repo", repository, "--clobber", ...uploadFiles);
gh(
  "release",
  "edit",
  tag,
  "--repo",
  repository,
  "--draft=false",
  `--prerelease=${pre}`,
  `--latest=${latest}`,
);
console.log(
  `Published https://github.com/${repository}/releases/tag/${tag} with ${expected.length} signed platforms${latest ? " (stable update feed)" : ""}.`,
);
