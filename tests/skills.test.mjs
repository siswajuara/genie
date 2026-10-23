import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installSkills } from "../sidecar/skills.mjs";

test("bundled skills install in a conversation, refresh, and preserve custom skills", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "genie-skills-"));
  try {
    const prompt = await installSkills(workspace, "genie-create-carousel");
    assert.match(prompt, /\$genie-create-carousel/);
    const directory = path.join(workspace, ".agents", "skills");
    await fs.mkdir(path.join(directory, "my-custom"));
    await fs.writeFile(
      path.join(directory, "my-custom", "SKILL.md"),
      "custom instructions",
    );
    await fs.writeFile(
      path.join(directory, "genie-create-carousel", "SKILL.md"),
      "stale bundled file",
    );
    await installSkills(workspace);
    assert.match(
      await fs.readFile(
        path.join(directory, "genie-create-carousel", "SKILL.md"),
        "utf8",
      ),
      /name: genie-create-carousel/,
    );
    assert.equal(
      await fs.readFile(path.join(directory, "my-custom", "SKILL.md"), "utf8"),
      "custom instructions",
    );
    assert.ok(
      (
        await fs.readFile(
          path.join(
            directory,
            "genie-create-idea",
            "references",
            "editorial.md",
          ),
          "utf8",
        )
      ).length > 0,
    );
    await assert.rejects(
      installSkills(workspace, "../../outside"),
      /Unknown assistant skill/,
    );
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
