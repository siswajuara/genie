import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance.getEntriesByType("resource").reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, r => r.abort());
  await page.route("**/api/genie-social/**", r => r.fulfill({ json: { data: {
    accounts: [], organizations: [], profiles: [], issues: [],
    buffer: { configured: false }, zernio: { configured: false },
    elevenlabs: { configured: false, accounts: [] },
    opencode: { mode: "local", tokenConfigured: false },
  } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
});

test("24 STEM lessons fit, retain editable diagrams in backups, and animate in PNG exports", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { initializeAssetLibrary } = await window.genieSource("/src/editor/assets.ts");
    await initializeAssetLibrary();
    const { loadPresetCatalog, loadPreset } = await window.genieSource("/src/editor/preset-catalog.ts");
    const { ensureDocumentFonts } = await window.genieSource("/src/lib/fonts.ts");
    const { applyPreset, initialDocument, parseDocument } = await window.genieSource("/src/editor/model.ts");
    const { exportImages } = await window.genieSource("/src/editor/media-export.ts");
    const catalog = await loadPresetCatalog();
    const entries = catalog.presets.filter(p => p.collection === "STEM SD–SMA");
    const issues = [], kinds = new Set(), grades = new Set();
    const ctx = document.createElement("canvas").getContext("2d");
    const { drawDiagram } = await window.genieSource("/src/editor/diagram-primitives.mjs");
    const { learningDrawing } = await window.genieSource("/src/editor/learning-drawing.mjs");
    ctx.canvas.width = 900; ctx.canvas.height = 500;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 900, 500);
    drawDiagram(ctx, { x: 0, y: 0, w: 900, h: 500 }, learningDrawing({ kind: "unit-circle" }, 0));
    if ([...ctx.getImageData(250, 300, 1, 1).data].join(",") !== "255,255,255,255")
      issues.push("unit-circle: unfilled circle covered its background");
    for (const entry of entries) {
      const preset = await loadPreset(entry);
      await ensureDocumentFonts(preset.objects);
      for (const level of ["SD", "SMP", "SMA"]) if (preset.tags.includes(level)) grades.add(level);
      for (const o of preset.objects) {
        if (o.t !== "text") continue;
        ctx.font = `${o.weight || 800} ${o.size}px "${o.font}"`;
        const lines = o.text.split("\n");
        if (lines.some(line => ctx.measureText(line).width > o.w + 2)) issues.push(`${entry.identifier}: ${o.n} width`);
        if (lines.length * o.size * (o.lh || 1.2) > o.h + 2) issues.push(`${entry.identifier}: ${o.n} height`);
      }
      const doc = applyPreset(initialDocument(), preset);
      const restored = parseDocument(JSON.parse(JSON.stringify(doc)));
      const diagram = restored.elements.find(o => o.learning || o.physics);
      const kind = (diagram.learning || diagram.physics).kind;
      if (!diagram.src.startsWith("data:image/svg+xml;")) issues.push(`${kind}: missing portable snapshot`);
      if (!diagram.animation || !restored.elements.find(o => o.t === "frame").scene) issues.push(`${kind}: missing timing`);
      if (kinds.has(kind)) continue;
      kinds.add(kind);
      const frame = restored.elements.find(o => o.t === "frame");
      const at = async time => {
        const { blob } = await exportImages(restored, [frame], {
          format: "png", scale: 0.3, transparent: false, quality: 0.9, time, name: "stem",
        }, new AbortController().signal, () => {});
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return Array.from(bytes).join(",");
      };
      const first = await at(0), later = await at(1.7);
      if (first === later) issues.push(`${kind}: static PNG export`);
      if (later !== await at(1.7)) issues.push(`${kind}: nondeterministic export`);
    }
    return { count: entries.length, models: kinds.size, grades: [...grades].sort(), issues };
  });
  expect(result.count).toBe(24);
  expect(result.models).toBe(18);
  expect(result.grades).toEqual(["SD", "SMA", "SMP"]);
  expect(result.issues).toEqual([]);
});

test("thermal expansion coefficient edits without rounding away and survives reload", async ({ page }) => {
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page.getByRole("button", { name: "Physics diagram", exact: true }).click();
  await page.getByRole("combobox", { name: "Physics model", exact: true }).click();
  await page.getByRole("option", { name: "Pemuaian panjang", exact: true }).click();
  const coefficient = page.getByRole("spinbutton", { name: "Expansion coefficient (×10⁻⁶ K⁻¹)", exact: true });
  await expect(coefficient).toHaveValue("12");
  await coefficient.fill("24");
  await coefficient.press("Tab");
  const saved = async () => page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const doc = w.projects.find(p => p.id === w.activeProjectId).pages.find(p => p.id === w.activePageId).canvas;
    return doc.elements.find(o => o.physics).physics;
  });
  expect((await saved()).expansionCoefficient).toBe(0.000024);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Canvas name", exact: true })).toBeVisible();
  expect((await saved()).expansionCoefficient).toBe(0.000024);
});

for (const sample of [
  { kind: "newton-first", model: "Hukum Newton 1 • Kelembaman", field: "Initial speed (m/s)", key: "initialVelocity", value: 0 },
  { kind: "newton-second", model: "Hukum Newton 2 • Gaya dan percepatan", field: "Net force (N)", key: "force", value: 12 },
  { kind: "newton-third", model: "Hukum Newton 3 • Aksi dan reaksi", field: "Mass 2 (kg)", key: "mass2", value: 8 },
  { kind: "photosynthesis", model: "Fotosintesis • Alur pada tumbuhan", field: "Illustration cycle (s)", key: "period", value: 12 },
]) test(`${sample.kind} parameters and motion settings survive reload`, async ({ page }) => {
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page.getByRole("button", { name: "Physics diagram", exact: true }).click();
  await page.getByRole("combobox", { name: "Physics model", exact: true }).click();
  await page.getByRole("option", { name: sample.model, exact: true }).click();
  const parameter = page.getByRole("spinbutton", { name: sample.field, exact: true });
  await parameter.fill(String(sample.value));
  await parameter.press("Tab");
  await page.getByRole("checkbox", { name: "Continue motion", exact: true }).uncheck();
  const saved = async () => page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const doc = workspace.projects.find(p => p.id === workspace.activeProjectId).pages.find(p => p.id === workspace.activePageId).canvas;
    const diagram = doc.elements.find(o => o.physics);
    return { settings: diagram.physics, src: diagram.src };
  });
  const before = await saved();
  expect(before.settings.kind).toBe(sample.kind);
  expect(before.settings[sample.key]).toBe(sample.value);
  expect(before.settings.loop).toBe(false);
  expect(before.src).toMatch(/^data:image\/svg\+xml;/);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Canvas name", exact: true })).toBeVisible();
  expect(await saved()).toEqual(before);
});
