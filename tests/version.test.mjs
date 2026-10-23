import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseVersion,
  nextVersion,
  compareVersions,
  bumpVersion,
  versionState,
  versionFiles,
} from "../scripts/version.mjs";
test("SemVer releases increment predictably and prereleases sort below stable", () => {
  assert.equal(nextVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(nextVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(nextVersion("1.2.3", "major"), "2.0.0");
  assert.equal(nextVersion("1.2.3-beta.2", "patch"), "1.2.3");
  assert.equal(compareVersions("1.2.3-beta.10", "1.2.3-beta.2"), 1);
  assert.equal(compareVersions("1.2.3-beta.1", "1.2.3"), -1);
  for (const value of ["v1.2.3", "01.2.3", "1.2", "1.2.3-beta.01"])
    assert.throws(() => parseVersion(value));
  assert.throws(() => nextVersion("1.2.3", "1.2.2"));
});
test("version preview is read-only and bump synchronizes all five manifests", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "genie-version-"));
  try {
    await fs.mkdir(path.join(directory, "src-tauri"));
    const files = [
      JSON.stringify({ version: "1.2.3" }),
      JSON.stringify({
        version: "1.2.3",
        packages: { "": { version: "1.2.3" } },
      }),
      '[package]\nname = "genie"\nversion = "1.2.3"\n',
      '[[package]]\nname = "genie"\nversion = "1.2.3"\n',
      JSON.stringify({ version: "1.2.3" }),
    ];
    for (let i = 0; i < files.length; i++)
      await fs.writeFile(path.join(directory, versionFiles[i]), files[i]);
    await bumpVersion("patch", { directory, dryRun: true });
    assert.equal((await versionState(directory)).version, "1.2.3");
    const result = await bumpVersion("patch", { directory });
    assert.equal(result.tag, "v1.2.4");
    assert.equal((await versionState(directory)).version, "1.2.4");
    await fs.writeFile(
      path.join(directory, "src-tauri/tauri.conf.json"),
      JSON.stringify({ version: "9.0.0" }),
    );
    await assert.rejects(versionState(directory), /mismatch/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
