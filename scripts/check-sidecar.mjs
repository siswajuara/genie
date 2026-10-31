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
// Verify the social runtime without relying on a global Node installation.
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
  for (const name of [
    "social-core.mjs",
    "generate.mjs",
    "animation-direction.mjs",
    "opencode.mjs",
    "opencode-config.mjs",
    "opencode-generation.mjs",
    "opencode-narration.mjs",
    "science.mjs",
    "learning.mjs",
    "learning-extra.mjs",
    "physics-extra.mjs",
    "frame-context.mjs",
    "social-usage.mjs",
    "social-bridge.mjs",
    "local-json.mjs",
    "elevenlabs.mjs",
    "elevenlabs-config.mjs",
    "voice-prototype.mjs",
  ])
    run(node, ["--check", path.join(directory, name)]);
  for (const name of ["social-core.mjs", "social-usage.mjs", "elevenlabs.mjs"])
    run(node, [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(pathToFileURL(path.join(directory, name)).href)});`,
    ]);
  // Exercise the shipped SDK from a temp cwd with only a mocked HTTP service.
  run(node, [
    "--input-type=module",
    "-e",
    `
    import assert from 'node:assert/strict';
    const { connectOpenCode } = await import(${JSON.stringify(pathToFileURL(path.join(directory, "opencode.mjs")).href)});
    let calls = 0;
    const { client } = await connectOpenCode({opencode:{url:'http://mock.test'}}, async (input, init) => {
      const request = new Request(input, init);
      calls++;
      if (new URL(request.url).pathname === '/openapi.json') return Response.json({paths:{'/api/experimental/generate':{post:{}}}});
      if (request.method === 'POST') assert.equal(new URL(request.url).pathname, '/api/experimental/generate');
      return Response.json(new URL(request.url).pathname === '/api/model' ? {data:[{providerID:'opencode-go',id:'beam-free'}]} : {data:{text:'{}'}});
    }, {environment:{}});
    assert.equal((await client.model.list()).data[0].id, 'beam-free');
    assert.equal((await client.generate.text({prompt:'mock',model:{providerID:'opencode-go',id:'beam-free'}})).text, '{}');
    assert.equal(calls, 3);
    const { Service } = await import(${JSON.stringify(pathToFileURL(path.join(directory, "node_modules/@opencode/client/dist/promise/service.js")).href)});
    assert.equal(typeof Service.ensure, 'function');
  `,
  ]);
  const digest = async (file) =>
    createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex");
  assert.equal(await digest(node), manifest.sha256.node);
  await assert.rejects(fs.access(path.join(directory, "codex-bridge.mjs")));
  await assert.rejects(fs.access(path.join(directory, "codex")));
  console.log(
    `PASS: packaged social runtime, Node version, architecture, hashes, and module imports on ${manifest.platform}/${manifest.arch}; no provider calls.`,
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
