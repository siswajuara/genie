import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "src-tauri/resources/sidecar");
const manifest = JSON.parse(
  await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
);
assert.equal(manifest.platform, process.platform);
assert.equal(manifest.arch, process.arch);
const node = path.join(directory, "runtime", manifest.nodeExecutable);
const bridge = path.join(directory, "codex-bridge.mjs");
// Use an unrelated working directory and no global Node/Codex on PATH.
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "genie-sidecar-"));
const env = {
  ...process.env,
  PATH:
    process.platform === "win32"
      ? process.env.SystemRoot + "\\System32"
      : "/usr/bin:/bin",
};
for (const key of Object.keys(env))
  if (
    ["codex_path", "node_bin"].includes(key.toLowerCase()) ||
    (key !== "PATH" && key.toLowerCase() === "path")
  )
    delete env[key];
try {
  const run = (file, args) =>
    execFileSync(file, args, {
      cwd: temporary,
      env,
      encoding: "utf8",
      timeout: 30000,
    }).trim();
  assert.equal(run(node, ["--version"]), "v" + manifest.nodeVersion);
  for (const name of ["social-core.mjs", "social-bridge.mjs"])
    run(node, ["--check", path.join(directory, name)]);
  const status = JSON.parse(run(node, [bridge, "--status"]));
  assert.equal(status.ok, true, status.message);
  assert.ok(
    path.relative(directory, status.path).startsWith("codex" + path.sep),
  );
  const digest = async (file) =>
    createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex");
  assert.equal(await digest(node), manifest.sha256.node);
  assert.equal(await digest(status.path), manifest.sha256.codex);
  assert.match(
    run(status.path, ["--version"]),
    new RegExp(manifest.codexVersion.replaceAll(".", "\\.")),
  );
  const sdk = pathToFileURL(
    path.join(directory, "node_modules/@openai/codex-sdk/dist/index.js"),
  ).href;
  run(node, [
    "--input-type=module",
    "-e",
    `const {Codex}=await import(${JSON.stringify(sdk)}); new Codex({codexPathOverride:${JSON.stringify(status.path)}});`,
  ]);
  run(status.path, ["exec", "--experimental-json", "--help"]);
  console.log(
    `PASS: packaged Node, Codex ${manifest.codexVersion}, SDK import, signature/status, and streaming CLI flags on ${manifest.platform}/${manifest.arch}; no global installations or model calls.`,
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
