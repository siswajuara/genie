import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bundled = fileURLToPath(new URL("./skills/", import.meta.url));
export async function installSkills(workspace, selected = "auto") {
  const catalog = JSON.parse(
    await fs.readFile(path.join(bundled, "catalog.json"), "utf8"),
  );
  if (!catalog.some((skill) => skill.id === selected))
    throw new Error("Unknown assistant skill. Choose a skill from the menu.");
  async function directory(target) {
    await fs.mkdir(target, { recursive: false }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error(
        "The assistant skills folder must be a local directory, not a link.",
      );
  }
  const agents = path.join(workspace, ".agents"),
    skills = path.join(agents, "skills");
  await directory(agents);
  await directory(skills);
  async function copy(source, destination) {
    await directory(destination);
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
      const target = path.join(destination, entry.name),
        original = path.join(source, entry.name);
      if (entry.isDirectory()) await copy(original, target);
      else if (entry.isFile()) {
        const stat = await fs.lstat(target).catch((error) => {
          if (error.code !== "ENOENT") throw error;
          return null;
        });
        if (stat && (!stat.isFile() || stat.isSymbolicLink()))
          throw new Error(
            "A bundled skill file cannot be replaced through a link.",
          );
        await fs.copyFile(original, target);
      }
    }
  }
  for (const skill of catalog.filter((skill) => skill.id !== "auto"))
    await copy(path.join(bundled, skill.id), path.join(skills, skill.id));
  const entries = catalog
    .filter((skill) => skill.id !== "auto")
    .map(
      (skill) =>
        `- ${skill.id}: ${skill.description} Read .agents/skills/${skill.id}/SKILL.md when relevant.`,
    )
    .join("\n");
  return `\nBuilt-in skills are installed in .agents/skills in this conversation's local workspace. Read only the relevant SKILL.md and linked references; do not load every skill. You may use other installed skills when relevant to the user's request.\n${entries}\n${selected === "auto" ? "Choose relevant skills automatically from the user's request." : `The user selected $${selected}. Read .agents/skills/${selected}/SKILL.md for this turn.`}\nThe current Discuss/Draw mode and the user's actual request determine whether to edit the canvas. A skill selection alone never authorizes publication or scheduling.`;
}
