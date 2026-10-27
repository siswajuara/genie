import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { indexPackPresets } from "./preset-pack.mjs";

// Run against the local Vite server after preparing the external pack.
const origin = process.env.GENIE_PREVIEW_ORIGIN || "http://127.0.0.1:1423";
const root = path.resolve(import.meta.dirname, "..");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.argv.find((a) => a.startsWith("--browser="))?.slice(10) ||
    undefined,
});
try {
  const page = await browser.newPage();
  await page.route("**/api/genie-social/**", (route) =>
    route.fulfill({
      json: {
        data: {
          accounts: [],
          organizations: [],
          profiles: [],
          issues: [],
          buffer: { configured: false },
          zernio: { configured: false },
          elevenlabs: { configured: false, accounts: [] },
        },
      },
    }),
  );
  await page.route(/^https?:\/\//, (route) =>
    route
      .request()
      .url()
      .startsWith(origin + "/")
      ? route.continue()
      : route.abort(),
  );
  await page.goto(origin);
  await page.evaluate(async () => {
    const assets = await import("/src/editor/assets.ts");
    await assets.initializeAssetLibrary();
  });
  const catalog = JSON.parse(
    await fs.readFile(
      path.join(root, "asset-packs/siswa-juara/pack/presets/catalog.json"),
      "utf8",
    ),
  );
  const layouts = JSON.parse(
    await fs.readFile(
      path.join(root, "design-references/text-layouts.json"),
      "utf8",
    ),
  );
  if (process.argv.includes("--fit-reference-text")) {
    for (const entry of catalog.presets.filter((p) => p.reference)) {
      const filename = path.join(
          root,
          "asset-packs/siswa-juara/pack/presets",
          entry.file,
        ),
        preset = JSON.parse(await fs.readFile(filename, "utf8"));
      preset.objects = await page.evaluate(async (objects) => {
        const { ensureFont } = await import("/src/lib/fonts.ts");
        const ctx = document.createElement("canvas").getContext("2d");
        for (const o of objects)
          if (o.t === "text") {
            const heading = o.text === o.text.toUpperCase() && o.h > 46;
            o.font = heading ? "Impact" : "Arial";
            o.weight = heading ? 400 : 700;
            await ensureFont(o.font, o.weight);
            ctx.font = `${o.weight} 100px "${o.font}"`;
            const m = ctx.measureText(o.text),
              ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
            o.size =
              Math.round(
                Math.min(
                  ((o.h - 4) * 100) / Math.max(1, ink),
                  (o.w * 100) / Math.max(1, m.width),
                ) * 100,
              ) / 100;
            o.ls = 0;
          }
        return objects;
      }, preset.objects);
      const layout = layouts[preset.reference.file];
      const lines = layout.lines.filter(
        (l) =>
          l.y + l.h / 2 > layout.height * 0.075 &&
          l.y + l.h < layout.height * 0.94 &&
          l.h > 26 &&
          l.w > 25 &&
          !/^(SJ|SISWA JUARA|[|•.])$/.test(l.text.trim()) &&
          !/siswajuara|www\.|tiktok|instagram/i.test(l.text),
      );
      preset.objects
        .filter((o) => o.t === "text")
        .forEach((o, i) => {
          lines[i].style = {
            font: o.font,
            weight: o.weight,
            size: o.size,
            ls: 0,
          };
        });
      await fs.writeFile(filename, JSON.stringify(preset, null, 2) + "\n");
    }
    await fs.writeFile(
      path.join(root, "design-references/text-layouts.json"),
      JSON.stringify(layouts, null, 2) + "\n",
    );
  }
  if (process.argv.includes("--fit-reference-text")) {
    await indexPackPresets(path.join(root, "asset-packs/siswa-juara/pack"));
    await page.evaluate(async () => {
      const assets = await import("/src/editor/assets.ts");
      await assets.initializeAssetLibrary();
    });
  }
  for (const entry of process.argv.includes("--screenshots-only")
    ? []
    : catalog.presets) {
    const src = await page.evaluate(async (entry) => {
      const [
        { loadPreset },
        { resolvePresetAssets },
        { renderTemplatePreview },
      ] = await Promise.all([
        import("/src/editor/preset-catalog.ts"),
        import("/src/editor/resolve-assets.ts"),
        import("/src/editor/template-thumbnail.tsx"),
      ]);
      return renderTemplatePreview(
        await resolvePresetAssets(await loadPreset(entry)),
      );
    }, entry);
    entry.thumbnail = `previews/${entry.identifier}.webp`;
    await fs.writeFile(
      path.join(root, "asset-packs/siswa-juara/pack/presets", entry.thumbnail),
      Buffer.from(src.split(",")[1], "base64"),
    );
  }
  await fs.writeFile(
    path.join(root, "asset-packs/siswa-juara/pack/presets/catalog.json"),
    JSON.stringify(catalog, null, 2) + "\n",
  );
  await indexPackPresets(path.join(root, "asset-packs/siswa-juara/pack"));
  await page.evaluate(async () => {
    const assets = await import("/src/editor/assets.ts");
    await assets.initializeAssetLibrary();
  });
  if (
    process.argv.includes("--screenshots") ||
    process.argv.includes("--screenshots-only")
  ) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "New Canvas", exact: true }).click();
    await page.getByRole("tab", { name: "Templates", exact: true }).click();
    await page.locator(".template-card").first().waitFor();
    await page.screenshot({ path: "/tmp/genie-template-library.png" });
    await page
      .getByRole("textbox", { name: "Search templates" })
      .fill("After-Meal");
    await page
      .getByRole("button", {
        name: "Preview After-Meal Mini Quiz with Owiya",
        exact: true,
      })
      .click();
    await page.waitForFunction(() => {
      const buttons = [
        ...document.querySelectorAll(".template-preview-dialog button"),
      ];
      return buttons.some(
        (button) =>
          button.textContent?.trim() === "Add frame" &&
          !button.hasAttribute("disabled"),
      );
    });
    await page.waitForFunction(
      () =>
        !document.querySelector(
          '.template-preview-dialog .template-thumbnail[aria-busy="true"]',
        ),
    );
    await page.screenshot({ path: "/tmp/genie-template-preview.png" });
  }
  console.log(
    process.argv.includes("--screenshots-only")
      ? "Captured template library and preview screenshots."
      : `Rendered ${catalog.presets.length} previews using Genie's actual canvas renderer.`,
  );
} finally {
  await browser.close();
}
