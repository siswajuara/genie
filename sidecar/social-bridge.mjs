import fs from "node:fs/promises";
import { createSocialService } from "./social-core.mjs";
let input = "";
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 70 * 1024 * 1024)
      throw Error("Social request is too large.");
  }
  const request = JSON.parse(input);
  let state = {};
  try {
    state = JSON.parse(await fs.readFile(request.statePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT")
      throw Error("Could not read social request history.");
  }
  const persist = async (value) => {
    const temp = request.statePath + ".tmp";
    await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 });
    await fs.rename(temp, request.statePath);
  };
  const service = createSocialService({ state, persist });
  const data = await service.dispatch(
    request.config,
    request.action,
    request.payload,
  );
  process.stdout.write(JSON.stringify({ data }));
} catch (error) {
  process.stdout.write(
    JSON.stringify({ error: error.message || "The social request failed." }),
  );
  process.exitCode = 1;
}
