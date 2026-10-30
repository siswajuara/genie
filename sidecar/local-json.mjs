import { normalizeOpenCode } from "./opencode-config.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function jsonWriter(filename) {
  let pending = Promise.resolve();
  return (value) => {
    const contents = JSON.stringify(value, null, 2) + "\n";
    const write = pending.then(async () => {
      await fs.mkdir(path.dirname(filename), { recursive: true });
      const temporary = `${filename}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, contents);
        await fs.rename(temporary, filename);
      } finally {
        await fs.rm(temporary, { force: true });
      }
    });
    pending = write.catch(() => {});
    return write;
  };
}

export async function readConfig(filename) {
  let config;
  try {
    config = JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw Error("Could not read config.json.");
    config = {};
  }
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw Error("config.json must contain an object.");
  for (const provider of ["tebar", "elevenlabs", "soniox"]) {
    config[provider] ??= {};
    if (typeof config[provider] !== "object" || Array.isArray(config[provider]))
      throw Error(`Invalid ${provider} configuration in config.json.`);
    config[provider].key ??= "";
  }
  config.opencode = normalizeOpenCode(config.opencode);
  config.tebar.profileId ??= "";
  return config;
}
