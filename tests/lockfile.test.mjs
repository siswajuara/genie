import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseVersion } from "../scripts/version.mjs";

const root = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);

test("every optional dependency has an installable lockfile entry", async () => {
  const lock = JSON.parse(
    await fs.readFile(path.join(root, "package-lock.json"), "utf8"),
  );
  const missing = [];
  for (const [owner, meta] of Object.entries(lock.packages || {})) {
    for (const [name, version] of Object.entries(
      meta.optionalDependencies || {},
    )) {
      const key = `node_modules/${name}`;
      const entry = lock.packages[key];
      if (!entry) {
        missing.push(`${name}@${version} (via ${owner || "<root>"})`);
        continue;
      }
      assert.ok(
        entry.optional,
        `${key} must stay marked optional so installs skip it off-platform`,
      );
      let exact = true;
      try {
        // Exact pins must match the installed entry byte-for-byte.
        parseVersion(version);
      } catch {
        // Range pins (e.g. ~2.3.3) resolve at install time; presence is enough.
        exact = false;
      }
      if (exact)
        assert.equal(
          entry.version,
          version,
          `${key} pins ${entry.version} but ${owner} wants ${version}`,
        );
    }
  }
  assert.deepEqual(missing, [], "native bindings missing from package-lock.json");
});
