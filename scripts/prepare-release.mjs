import fs from "node:fs/promises";
import { root, versionState, parseVersion } from "./version.mjs";
const { version } = await versionState(),
  tag = process.env.RELEASE_TAG;
if (tag !== `v${version}`) throw Error(`Release tag must equal v${version}.`);
parseVersion(version);
if (!process.env.TAURI_SIGNING_PRIVATE_KEY)
  throw Error(
    "Set GitHub Actions secret TAURI_SIGNING_PRIVATE_KEY before publishing signed updates.",
  );
const config = JSON.parse(
  await fs.readFile(`${root}/src-tauri/tauri.conf.json`, "utf8"),
);
const pubkey = (
  process.env.TAURI_UPDATER_PUBLIC_KEY ||
  config.plugins.updater.pubkey ||
  ""
).trim();
if (
  !pubkey ||
  !Buffer.from(pubkey, "base64").toString().includes("untrusted comment:")
)
  throw Error(
    "Run npm run updater:setup and commit the public key, or set TAURI_UPDATER_PUBLIC_KEY.",
  );
if (config.plugins.updater.pubkey && config.plugins.updater.pubkey !== pubkey)
  throw Error("CI public key differs from the committed updater key.");
const repository = process.env.GITHUB_REPOSITORY || "siswajuara/genie";
if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
  throw Error("Invalid GitHub repository.");
await fs.writeFile(
  `${root}/src-tauri/tauri.release.conf.json`,
  JSON.stringify(
    {
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          ...config.plugins.updater,
          pubkey,
          endpoints: [
            `https://github.com/${repository}/releases/latest/download/latest.json`,
          ],
        },
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared signed release configuration for ${tag}.`);
