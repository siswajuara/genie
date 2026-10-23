import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function parseVersion(value) {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/.exec(
      value,
    );
  if (!match || match.slice(1, 4).some((n) => !Number.isSafeInteger(Number(n))))
    throw Error(
      "Use SemVer: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-beta.1 (without v).",
    );
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4]?.split(".") || [],
  };
}
export function compareVersions(a, b) {
  const x = parseVersion(a),
    y = parseVersion(b);
  for (const key of ["major", "minor", "patch"])
    if (x[key] !== y[key]) return x[key] > y[key] ? 1 : -1;
  if (!x.pre.length || !y.pre.length)
    return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const l = x.pre[i],
      r = y.pre[i];
    if (l === undefined || r === undefined)
      return l === r ? 0 : l === undefined ? -1 : 1;
    if (l === r) continue;
    const ln = /^\d+$/.test(l),
      rn = /^\d+$/.test(r);
    return ln && rn
      ? BigInt(l) > BigInt(r)
        ? 1
        : -1
      : ln !== rn
        ? ln
          ? -1
          : 1
        : l > r
          ? 1
          : -1;
  }
  return 0;
}
export function nextVersion(current, level) {
  const v = parseVersion(current);
  if (level === "patch")
    return `${v.major}.${v.minor}.${v.patch + (v.pre.length ? 0 : 1)}`;
  if (level === "minor") return `${v.major}.${v.minor + 1}.0`;
  if (level === "major") return `${v.major + 1}.0.0`;
  parseVersion(level);
  if (compareVersions(level, current) <= 0)
    throw Error("The new version must be greater than the current version.");
  return level;
}
export const versionFiles = [
  "package.json",
  "package-lock.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
];
export async function versionState(directory = root) {
  const values = await Promise.all(
    versionFiles.map((file) => fs.readFile(path.join(directory, file), "utf8")),
  );
  const pkg = JSON.parse(values[0]),
    lock = JSON.parse(values[1]),
    config = JSON.parse(values[4]);
  // CI checkouts on Windows use CRLF; normalize before matching TOML.
  const cargo = values[2]
    .replace(/\r\n/g, "\n")
    .match(/\[package\][\s\S]*?\nversion = "([^"]+)"/);
  const cargoLock = values[3]
    .replace(/\r\n/g, "\n")
    .match(/\[\[package\]\]\nname = "genie"\nversion = "([^"]+)"/);
  const versions = [
    pkg.version,
    lock.version,
    lock.packages?.[""]?.version,
    cargo?.[1],
    cargoLock?.[1],
    config.version,
  ];
  parseVersion(pkg.version);
  if (!versions.every((v) => v === pkg.version))
    throw Error(
      `Version mismatch: ${JSON.stringify(versions)}. Synchronize all app manifests before releasing.`,
    );
  return { version: pkg.version, values };
}
export async function bumpVersion(
  level,
  { dryRun = false, directory = root } = {},
) {
  const { version, values } = await versionState(directory),
    next = nextVersion(version, level);
  parseVersion(next);
  const pkg = JSON.parse(values[0]),
    lock = JSON.parse(values[1]),
    config = JSON.parse(values[4]);
  pkg.version = next;
  lock.version = next;
  lock.packages[""].version = next;
  config.version = next;
  const output = [
    JSON.stringify(pkg, null, 2) + "\n",
    JSON.stringify(lock, null, 2) + "\n",
    values[2].replace(
      /(\[package\][\s\S]*?\r?\nversion = ")[^"]+("(\r?\n))/,
      (_match, prefix, suffix) => prefix + next + suffix,
    ),
    values[3].replace(
      /(\[\[package\]\]\r?\nname = "genie"\r?\nversion = ")[^"]+("(\r?\n))/,
      (_match, prefix, suffix) => prefix + next + suffix,
    ),
    JSON.stringify(config, null, 2) + "\n",
  ];
  if (!dryRun)
    for (let i = 0; i < versionFiles.length; i++)
      await fs.writeFile(path.join(directory, versionFiles[i]), output[i]);
  return { previous: version, version: next, tag: `v${next}` };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const level = process.argv[2];
    if(process.argv.slice(3).some(arg=>arg!=='--dry-run'))throw Error('Unknown option. Use --dry-run to preview or --check to validate.');
    if (level === "--check") {
      const { version } = await versionState();
      const tag = process.env.RELEASE_TAG;
      if (tag && tag !== `v${version}`)
        throw Error(`Tag ${tag} does not match app version v${version}.`);
      console.log(`All manifests agree: v${version}`);
    } else {
      const result = await bumpVersion(level, {
        dryRun: process.argv.includes("--dry-run"),
      });
      console.log(
        `${result.previous} → ${result.version}${process.argv.includes("--dry-run") ? " (preview; no files changed)" : ""}`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
