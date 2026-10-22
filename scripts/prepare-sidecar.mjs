import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { platformInfo } from "../sidecar/platform.mjs";
import { packageExecutable } from "../sidecar/codex-executable.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "sidecar");
const destination = path.join(root, "src-tauri/resources/sidecar");
const info = platformInfo();
const requested = process.env.TAURI_ENV_TARGET_TRIPLE;
if (requested && requested !== info.rustTarget)
  throw new Error(
    `Prepare sidecar on a native ${requested} runner; this runner is ${info.rustTarget}.`,
  );
const require = createRequire(path.join(source, "package.json"));
const packageJson = require.resolve("@openai/codex/package.json");
const cli = JSON.parse(await fs.readFile(packageJson, "utf8"));
const sdkRoot = path.join(source, "node_modules/@openai/codex-sdk");
const sdk = JSON.parse(
  await fs.readFile(path.join(sdkRoot, "package.json"), "utf8"),
);
const executable = await packageExecutable(require);
if (cli.version !== "0.163.0")
  throw new Error(
    `Expected pinned Codex 0.163.0; got ${cli.version}. Run npm ci --prefix sidecar.`,
  );
if (process.platform === "darwin")
  execFileSync("/usr/bin/codesign", ["--verify", "--strict", executable], {
    stdio: "inherit",
  });
const vendor = path.dirname(path.dirname(path.dirname(executable)));
// Only this generated staging directory is replaced. Source dependencies are left intact.
await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
await fs.writeFile(path.join(destination, ".gitkeep"), "");
for (const file of [
  "codex-bridge.mjs",
  "codex-executable.mjs",
  "platform.mjs",
  "canvas.schema.json",
])
  await fs.copyFile(path.join(source, file), path.join(destination, file));
await fs.writeFile(
  path.join(destination, "package.json"),
  '{"private":true,"type":"module"}\n',
);
await fs.cp(sdkRoot, path.join(destination, "node_modules/@openai/codex-sdk"), {
  recursive: true,
  filter: (file) =>
    !path.relative(sdkRoot, file).split(path.sep).includes("node_modules"),
});
await fs.mkdir(path.join(destination, "codex"), { recursive: true });
await fs.cp(vendor, path.join(destination, "codex/vendor"), {
  recursive: true,
  verbatimSymlinks: true,
});
await fs.mkdir(path.join(destination, "runtime"), { recursive: true });
const nodePath = path.join(destination, "runtime", info.nodeExecutable);
await fs.copyFile(process.execPath, nodePath);
if (process.platform !== "win32") await fs.chmod(nodePath, 0o755);
const licenseDirectory = path.join(destination, "licenses");
await fs.mkdir(licenseDirectory, { recursive: true });
for (const [name, packageRoot] of [
  ["Codex", path.dirname(packageJson)],
  ["SDK", sdkRoot],
]) {
  try {
    await fs.copyFile(
      path.join(packageRoot, "LICENSE"),
      path.join(licenseDirectory, `${name}.LICENSE`),
    );
  } catch {
    const response = await fetch(
      `https://raw.githubusercontent.com/openai/codex/rust-v${cli.version}/LICENSE`,
    );
    if (!response.ok) throw new Error("Could not download the Codex license.");
    await fs.writeFile(
      path.join(licenseDirectory, `${name}.LICENSE`),
      await response.text(),
    );
  }
}
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
const bundledCodex = path.join(
  destination,
  "codex/vendor",
  path.relative(vendor, executable),
);
await fs.writeFile(
  path.join(destination, "manifest.json"),
  JSON.stringify(
    {
      ...info,
      nodeVersion: process.versions.node,
      codexVersion: cli.version,
      sdkVersion: sdk.version,
      sha256: {
        node: await digest(nodePath),
        codex: await digest(bundledCodex),
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared self-contained sidecar: ${info.platform}/${info.arch}, Node ${process.versions.node}, Codex ${cli.version}`,
);
