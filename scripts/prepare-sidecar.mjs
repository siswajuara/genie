import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { platformInfo } from "../sidecar/platform.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "sidecar");
const destination = path.join(root, "src-tauri/resources/sidecar");
const info = platformInfo();
const requested = process.env.TAURI_ENV_TARGET_TRIPLE;
if (requested && requested !== info.rustTarget)
  throw new Error(
    `Prepare sidecar on a native ${requested} runner; this runner is ${info.rustTarget}.`,
  );
// Only this generated staging directory is replaced. Source dependencies are left intact.
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
await fs.writeFile(path.join(destination, ".gitkeep"), "");
for (const file of [
  "social-core.mjs",
  "generate.mjs",
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
  await fs.copyFile(path.join(source, file), path.join(destination, file));
await fs.writeFile(
  path.join(destination, "package.json"),
  '{"private":true,"type":"module"}\n',
);
// The native Promise client and Service entry points are self-contained JS.
// Other SDK interfaces (Effect, Solid, MCP) are not used by this runtime.
const sdkSource = path.join(source, "node_modules/@opencode/client");
const sdk = JSON.parse(
  await fs.readFile(path.join(sdkSource, "package.json"), "utf8"),
);
const sdkDestination = path.join(destination, "node_modules/@opencode/client");
await fs.mkdir(sdkDestination, { recursive: true });
await fs.copyFile(
  path.join(sdkSource, "package.json"),
  path.join(sdkDestination, "package.json"),
);
await fs.cp(path.join(sdkSource, "dist"), path.join(sdkDestination, "dist"), {
  recursive: true,
});
await fs.mkdir(path.join(destination, "runtime"), { recursive: true });
const nodePath = path.join(destination, "runtime", info.nodeExecutable);
await fs.copyFile(process.execPath, nodePath);
if (process.platform !== "win32") await fs.chmod(nodePath, 0o755);
const licenseDirectory = path.join(destination, "licenses");
await fs.mkdir(licenseDirectory, { recursive: true });
await fs.copyFile(
  path.join(source, "licenses/OpenCode.LICENSE"),
  path.join(licenseDirectory, "OpenCode.LICENSE"),
);
let nodeLicense;
for (const dir of [
  path.dirname(process.execPath),
  path.dirname(path.dirname(process.execPath)),
]) {
  try {
    nodeLicense = await fs.readFile(path.join(dir, "LICENSE"));
    break;
  } catch {
    /* Official tarball and Windows installs store licenses in different locations. */
  }
}
if (!nodeLicense) {
  const response = await fetch(
    `https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`,
  );
  if (!response.ok) throw new Error("Could not download the Node license.");
  nodeLicense = Buffer.from(await response.arrayBuffer());
}
await fs.writeFile(path.join(licenseDirectory, "Node.LICENSE"), nodeLicense);
const digest = async (file) =>
  createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
await fs.writeFile(
  path.join(destination, "manifest.json"),
  JSON.stringify(
    {
      ...info,
      nodeVersion: process.versions.node,
      opencodeClientVersion: sdk.version,
      sha256: {
        node: await digest(nodePath),
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared self-contained sidecar: ${info.platform}/${info.arch}, Node ${process.versions.node}`,
);
