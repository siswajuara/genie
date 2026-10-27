import fs from "node:fs/promises";
import path from "node:path";

// Explicit file metadata lets every runtime read only listed template files.
export async function indexPackPresets(pack) {
  const presets = [];
  async function visit(folder) {
    for (const entry of await fs.readdir(path.join(pack, folder), {
      withFileTypes: true,
    })) {
      const relative = path.posix.join(folder, entry.name);
      if (entry.isDirectory()) await visit(relative);
      else if (/\.(json|webp|png)$/.test(entry.name))
        presets.push({
          path: relative,
          bytes: (await fs.stat(path.join(pack, relative))).size,
        });
    }
  }
  await visit("presets");
  const file = path.join(pack, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(file, "utf8"));
  manifest.presets = presets.sort((a, b) => a.path.localeCompare(b.path));
  await fs.writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
}
