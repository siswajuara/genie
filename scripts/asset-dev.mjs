import fs from "node:fs/promises";
import path from "node:path";
export function assetDevPlugin() {
  let root;
  return {
    name: "genie-external-assets",
    configResolved(config) {
      root = path.resolve(
        config.root,
        process.env.GENIE_ASSET_PACK || "asset-packs/siswa-juara/pack",
      );
    },
    configureServer(server) {
      server.middlewares.use("/api/genie-assets", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const url = new URL(req.url, "http://localhost");
          const manifest = JSON.parse(
            await fs.readFile(path.join(root, "manifest.json"), "utf8"),
          );
          res.setHeader("Cache-Control", "no-store");
          if (url.pathname === "/manifest") {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(manifest));
            return;
          }
          const relative = url.searchParams.get("path");
          const asset = manifest.assets.find(
            (asset) => asset.path === relative || asset.thumbnail === relative,
          );
          const preset = manifest.presets?.find(
            (file) => file.path === relative,
          );
          if (
            url.pathname !== "/file" ||
            (!asset && !preset) ||
            !relative ||
            /[\\\x00-\x1f:?#%]/.test(relative) ||
            relative
              .split("/")
              .some((part) => !part || part === "." || part === "..")
          )
            throw Error("Missing asset");
          const base = await fs.realpath(root),
            file = await fs.realpath(path.join(base, relative));
          if (!file.startsWith(base + path.sep))
            throw Error("Invalid asset path");
          const limit = preset
            ? preset.bytes
            : relative === asset.thumbnail
              ? 1024 * 1024
              : asset.bytes;
          const stat = await fs.stat(file);
          if (!stat.isFile() || stat.size > limit || limit > 64 * 1024 * 1024)
            throw Error("Invalid asset size");
          if (
            preset &&
            (!relative.startsWith("presets/") ||
              !/\.(json|webp|png)$/.test(relative) ||
              stat.size !== preset.bytes ||
              limit > (relative.endsWith(".json") ? 4 : 1) * 1024 * 1024)
          )
            throw Error("Invalid template file");
          res.setHeader(
            "Content-Type",
            preset
              ? relative.endsWith(".json")
                ? "application/json"
                : relative.endsWith(".png")
                  ? "image/png"
                  : "image/webp"
              : relative === asset.thumbnail
                ? relative.endsWith(".png")
                  ? "image/png"
                  : /\.jpe?g$/i.test(relative)
                    ? "image/jpeg"
                    : "image/webp"
                : asset.mime,
          );
          res.setHeader("Content-Length", stat.size);
          res.end(await fs.readFile(file));
        } catch {
          res.statusCode = 404;
          res.end("Asset pack or file unavailable");
        }
      });
    },
  };
}
