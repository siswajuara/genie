import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { root } from "./version.mjs";
const directory = path.join(root, ".keys"),
  key = path.join(directory, "updater.key");
const file = path.join(root, "src-tauri/tauri.conf.json"),
  config = JSON.parse(await fs.readFile(file, "utf8"));
if (config.plugins.updater.pubkey)
  throw Error(
    "A public key is already configured. Reuse its private key; no new key was generated.",
  );
await fs.mkdir(directory, { recursive: true, mode: 0o700 });
if (
  await fs.access(key).then(
    () => true,
    () => false,
  )
)
  throw Error(
    "An updater key already exists in .keys/updater.key. It was not replaced. Back it up and reuse it.",
  );
const run = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/@tauri-apps/cli/tauri.js"),
    "signer",
    "generate",
    "--ci",
    "--write-keys",
    key,
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
if (run.status !== 0)
  throw Error(
    "Could not generate signing keys. Check that Tauri CLI is installed.",
  );
await fs.chmod(key, 0o600);
const pubkey = (await fs.readFile(key + ".pub", "utf8")).trim();
config.plugins.updater.pubkey = pubkey;
await fs.writeFile(file, JSON.stringify(config, null, 2) + "\n");
console.log(
  "Signing key generated in ignored .keys/updater.key; public key saved in tauri.conf.json. Back up the private key securely. Add its file contents to the GitHub Actions secret TAURI_SIGNING_PRIVATE_KEY. Never commit the private key.",
);
