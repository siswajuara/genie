import { createSocialService, publicConfig } from "../sidecar/social-core.mjs";
import path from "node:path";
import { readConfig, jsonWriter } from "../sidecar/local-json.mjs";
import { saveElevenLabsAccount } from "../sidecar/elevenlabs-config.mjs";
import { saveOpenCodeConfig } from "../sidecar/opencode-config.mjs";
export function socialDevPlugin() {
  const service = createSocialService();
  let configPath, persistConfig;
  let pending = Promise.resolve();
  return {
    name: "genie-social-api",
    configResolved(config) {
      configPath = path.join(config.root, "config.json");
      persistConfig = jsonWriter(configPath);
    },
    configureServer(server) {
      server.middlewares.use("/api/genie-social", async (req, res) => {
        const previous = pending;
        let release;
        pending = new Promise((resolve) => {
          release = resolve;
        });
        await previous;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        try {
          if (
            req.method !== "POST" ||
            !req.headers["content-type"]?.startsWith("application/json")
          )
            throw Error("Use a same-origin JSON POST request.");
          const host = req.headers.host,
            origin = req.headers.origin;
          if (
            !host ||
            !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
            (origin && new URL(origin).host !== host)
          )
            throw Error(
              "This development API only accepts local same-origin requests.",
            );
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 70 * 1024 * 1024)
              throw Error("Request too large.");
          }
          const body = JSON.parse(raw || "{}");
          const config = await readConfig(configPath);
          if (req.url === "/settings") {
            if (body.provider) {
              if (
                !["buffer", "zernio", "elevenlabs", "opencode"].includes(
                  body.provider,
                )
              )
                throw Error("Choose a provider.");
              if (body.provider === "elevenlabs") {
                saveElevenLabsAccount(config, body);
              } else if (body.provider === "opencode") {
                saveOpenCodeConfig(config, body);
              } else {
                const provider = config[body.provider];
                if (body.removeKey) provider.key = "";
                else if (body.key !== undefined) {
                  if (
                    typeof body.key !== "string" ||
                    !body.key.trim() ||
                    body.key.length > 8192 ||
                    /[\r\n]/.test(body.key)
                  )
                    throw Error("Enter a valid API key.");
                  provider.key = body.key.trim();
                }
                for (const key of ["organizationId", "profileId"])
                  if (typeof body[key] === "string")
                    provider[key] = body[key].slice(0, 300);
              }
              await persistConfig(config);
            }
            res.end(JSON.stringify({ data: publicConfig(config, "file") }));
            return;
          }
          if (req.url !== "/request") throw Error("Unknown social endpoint.");
          res.end(
            JSON.stringify({
              data: await service.dispatch(
                config,
                body.action,
                body.payload || {},
              ),
            }),
          );
        } catch (error) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: error.message || "The social request failed.",
            }),
          );
        } finally {
          release();
        }
      });
    },
  };
}
