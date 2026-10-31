import { readFile } from "node:fs/promises";
const backup = new URL("../.genie-content/legacy-backup.json", import.meta.url);
export function contentDevPlugin() {
  return {
    name: "genie-content-migration",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/genie-content/legacy" || req.method !== "GET")
          return next();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        try {
          res.end(await readFile(backup, "utf8"));
        } catch (error) {
          res.statusCode = error.code === "ENOENT" ? 404 : 500;
          res.end(
            JSON.stringify({
              error: "Local Content Studio backup unavailable.",
            }),
          );
        }
      });
    },
  };
}
