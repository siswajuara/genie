import { expect, test, type Page } from "@playwright/test";

async function savedDocument(page: Page) {
  return page.evaluate(async () => {
    const { localStore, prepareLocalSave } = await window.genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return workspace.projects.find((p: any) => p.id === workspace.activeProjectId)
      .pages.find((p: any) => p.id === workspace.activePageId).canvas;
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const r = performance.getEntriesByType("resource").reverse().find((r) => new URL(r.name).pathname === path);
      return import(r?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (r) => r.abort());
  await page.route("**/api/genie-social/**", (r) => r.fulfill({ json: { data: {
    accounts: [], organizations: [], profiles: [], issues: [],
    buffer: { configured: false }, zernio: { configured: false },
    elevenlabs: { configured: false, accounts: [] },
    opencode: { url: "", model: "", mode: "local", tokenConfigured: false },
  } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page.getByRole("tab", { name: "Equation", exact: true }).click();
});

test("all 23 3D scenes are searchable, insertable, and editable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const library = page.getByRole("region", { name: "Element library" });
  await expect(library.getByRole("button", { name: /· 3D$/ })).toHaveCount(23);
  await page.getByRole("combobox", { name: "Element group", exact: true }).click();
  await page.getByRole("option", { name: "3D · IPA (5)", exact: true }).click();
  await expect(library.getByRole("button", { name: /· 3D$/ })).toHaveCount(5);
  await page.getByRole("combobox", { name: "Element group", exact: true }).click();
  await page.getByRole("option", { name: /^All \(/ }).click();
  const search = page.getByRole("textbox", { name: "Search equations and diagrams" });
  await search.fill("solar system");
  await expect(library.getByRole("button", { name: "Tata surya · 3D", exact: true })).toBeVisible();
  await search.fill("no-such-3d-scene");
  await expect(page.getByText("No matching elements", { exact: true })).toBeVisible();

  const models = await page.evaluate(async () => {
    const { illustration3DModels } = await window.genieSource("/src/editor/illustration3d.mjs");
    return Object.entries(illustration3DModels).map(([scene, model]: [string, any]) => ({ scene, label: model.label }));
  });
  for (const { scene, label } of models) {
    await search.fill(`${label} 3d`);
    await page.getByRole("button", { name: `${label} · 3D`, exact: true }).click();
    await expect(page.getByRole("combobox", { name: "3D scene", exact: true })).toContainText(label);
    const doc = await savedDocument(page);
    const element = doc.elements.at(-1);
    expect(element.illustration3d.scene).toBe(scene);
    expect(element.fid).toBe(doc.elements.find((o: any) => o.t === "frame").id);
    expect(element.src.startsWith("data:image/svg+xml;")).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("3D dimensions, orbit, molecule choices, and snapshots survive reload", async ({ page }) => {
  await page.getByRole("button", { name: "Kubus · 3D", exact: true }).click();
  const side = page.getByRole("spinbutton", { name: "Sisi s (cm)", exact: true });
  await side.fill("5"); await side.press("Tab");
  const preview = page.getByRole("img", { name: "Rotate Kubus 3D view", exact: true });
  await preview.focus(); await preview.press("ArrowRight");
  let doc = await savedDocument(page);
  let cube = doc.elements.find((o: any) => o.illustration3d);
  expect(cube.illustration3d.parameters.s).toBe(5);
  expect(cube.illustration3d.yaw).toBe(-25);
  expect(decodeURIComponent(cube.src)).toContain("125");
  await page.getByRole("checkbox", { name: "Show formula", exact: true }).click();
  await savedDocument(page);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Equation", exact: true })).toBeVisible();
  doc = await savedDocument(page);
  cube = doc.elements.find((o: any) => o.illustration3d);
  expect(cube.illustration3d.parameters.s).toBe(5);
  expect(cube.illustration3d.yaw).toBe(-25);
  expect(cube.illustration3d.showFormula).toBe(false);
  const restored = await page.evaluate(async (doc) => {
    const { parseDocument, parsePresets } = await window.genieSource("/src/editor/model.ts");
    const parsed = parseDocument(JSON.parse(JSON.stringify(doc)));
    const frame = parsed.elements.find((o) => o.t === "frame");
    const presets = parsePresets({ name: "3D lesson", kind: "template", W: frame.w, H: frame.h,
      objects: parsed.elements.filter((o) => o.fid === frame.id).map((o) => ({ ...o, fid: undefined })) });
    return { doc: parsed.elements.find((o) => o.illustration3d), template: presets[0].objects.find((o) => o.illustration3d) };
  }, doc);
  expect(restored.doc.illustration3d).toEqual(cube.illustration3d);
  expect(restored.template.illustration3d).toEqual(cube.illustration3d);

  await page.getByRole("tab", { name: "Equation", exact: true }).click();
  await page.getByRole("textbox", { name: "Search equations and diagrams" }).fill("molecule");
  await page.getByRole("button", { name: "Molekul · 3D", exact: true }).click();
  await page.getByRole("combobox", { name: "Molecule", exact: true }).click();
  await page.getByRole("option", { name: "CH₄ · Metana", exact: true }).click();
  doc = await savedDocument(page);
  expect(doc.elements.find((o: any) => o.illustration3d?.scene === "molekul").illustration3d.parameters.k).toBe(3);
});

test("3D drag placement animates deterministically in the export renderer", async ({ page }) => {
  const card = page.getByRole("button", { name: "Piston · 3D", exact: true });
  await card.scrollIntoViewIfNeeded();
  const data = await card.evaluate((node) => {
    const data = new DataTransfer();
    node.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
    return data.getData("genie/element");
  });
  const host = page.getByLabel("Design canvas. Use the layers and properties panels for keyboard editing.", { exact: true });
  const transfer = await page.evaluateHandle((value) => {
    const data = new DataTransfer(); data.setData("genie/element", value); return data;
  }, data);
  await host.dispatchEvent("drop", { dataTransfer: transfer, clientX: 730, clientY: 350 });
  await expect(page.getByRole("spinbutton", { name: "Gas height (cm)", exact: true })).toBeVisible();
  const doc = await savedDocument(page);
  const result = await page.evaluate(async (doc) => {
    const { drawAnimationFrame } = await window.genieSource("/src/editor/animation-renderer.ts");
    const { exportImages } = await window.genieSource("/src/editor/media-export.ts");
    const child = doc.elements.find((o) => o.illustration3d);
    const frame = { ...doc.elements.find((o) => o.t === "frame"), x: 0, y: 0, w: 900, h: 620 };
    const diagram = { ...child, x: 0, y: 0, w: 900, h: 620, fid: frame.id };
    const c = document.createElement("canvas"); c.width = 900; c.height = 620;
    const ctx = c.getContext("2d");
    const at = (time, reducedMotion = false, animated = true) => {
      ctx.clearRect(0, 0, 900, 620);
      const layer = { ...diagram, illustration3d: { ...diagram.illustration3d, animate: animated } };
      drawAnimationFrame(ctx, frame, [layer], time, new Map(), { width: 900, height: 620, reducedMotion });
      return c.toDataURL();
    };
    const pngAt = async (time) => {
      const { blob } = await exportImages({ ...doc, elements: [frame, diagram] }, [frame], { format: "png", scale: 0.3, transparent: false, quality: 0.9, time, name: "piston" }, new AbortController().signal, () => {});
      return [...new Uint8Array(await blob.arrayBuffer())];
    };
    return { early: at(0), later: at(1.6), repeat: at(1.6), reduced: [at(0, true), at(1.6, true)], paused: [at(0, false, false), at(1.6, false, false)], png: [await pngAt(0), await pngAt(1.6)] };
  }, doc);
  expect(result.early).not.toBe(result.later);
  expect(result.repeat).toBe(result.later);
  expect(result.reduced[0]).toBe(result.reduced[1]);
  expect(result.paused[0]).toBe(result.paused[1]);
  expect(result.png[0]).not.toEqual(result.png[1]);
});
