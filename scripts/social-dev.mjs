import {
  createSocialService,
  emptyConfig,
  publicConfig,
} from "../sidecar/social-core.mjs";
export function socialDevPlugin() {
  const config = emptyConfig(),
    service = createSocialService();
  return {
    name: "genie-social-api",
    configureServer(server) {
      server.middlewares.use("/api/genie-social", async (req, res) => {
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
          if (req.url === "/settings") {
            if (body.provider) {
              if (!["buffer", "zernio"].includes(body.provider))
                throw Error("Choose a provider.");
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
            res.end(JSON.stringify({ data: publicConfig(config, "memory") }));
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
        }
      });
    },
  };
}
