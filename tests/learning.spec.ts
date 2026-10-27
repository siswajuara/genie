import { setSceneTypes } from "./generation-helpers";
import { expect, test, type Page } from "@playwright/test";
async function documentOf(page: Page) {
  return page.evaluate(async () => {
    const { localStore, prepareLocalSave } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return w.projects
      .find((p: any) => p.id === w.activeProjectId)
      .pages.find((p: any) => p.id === w.activePageId).canvas;
  });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const r = performance
        .getEntriesByType("resource")
        .reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(r?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (r) => r.abort());
  await page.route("**/api/genie-social/**", (r) =>
    r.fulfill({
      json: {
        data: {
          storage: "file",
          opencode: {
            url: "",
            model: "",
            mode: "local",
            tokenConfigured: false,
          },
          elevenlabs: { configured: false, accounts: [] },
          buffer: { configured: false },
          zernio: { configured: false },
          accounts: [],
          organizations: [],
          profiles: [],
          issues: [],
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
});
test("geometry stays editable, animates in exports, and survives reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page
    .getByRole("button", { name: "Learning diagram", exact: true })
    .click();
  const side = page.getByRole("spinbutton", { name: "Sisi (cm)", exact: true });
  await expect(side).toHaveValue("4");
  await side.fill("5");
  await side.press("Tab");
  let doc = await documentOf(page);
  const element = doc.elements.find((o: any) => o.learning);
  expect(element.learning.side).toBe(5);
  expect(decodeURIComponent(element.src)).toContain("125");
  const result = await page.evaluate(async (doc) => {
    const { drawAnimationFrame } = await window.genieSource(
      "/src/editor/animation-renderer.ts",
    );
    const { exportImages } = await window.genieSource(
      "/src/editor/media-export.ts",
    );
    const frame = doc.elements.find((o) => o.t === "frame"),
      child = doc.elements.find((o) => o.learning);
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    const sample = { ...frame, x: 0, y: 0, w: 900, h: 500 },
      diagram = { ...child, x: 0, y: 0, w: 900, h: 500 };
    const at = (time, reducedMotion = false) => {
      ctx.clearRect(0, 0, 900, 500);
      drawAnimationFrame(ctx, sample, [diagram], time, new Map(), {
        width: 900,
        height: 500,
        reducedMotion,
      });
      return canvas.toDataURL();
    };
    const exportAt = async (time) => {
      const { blob } = await exportImages(
        doc,
        [frame],
        {
          format: "png",
          scale: 0.3,
          transparent: false,
          quality: 0.9,
          time,
          name: "learning",
        },
        new AbortController().signal,
        () => {},
      );
      return [...new Uint8Array(await blob.arrayBuffer())];
    };
    return {
      early: at(0),
      later: at(1.6),
      repeat: at(1.6),
      reduced: [at(0, true), at(1.6, true)],
      png0: await exportAt(0),
      png1: await exportAt(1.6),
    };
  }, doc);
  expect(result.early).not.toBe(result.later);
  expect(result.later).toBe(result.repeat);
  expect(result.reduced[0]).toBe(result.reduced[1]);
  expect(result.png0).not.toEqual(result.png1);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Canvas name", exact: true }),
  ).toBeVisible();
  doc = await documentOf(page);
  expect(doc.elements.find((o: any) => o.learning).learning.side).toBe(5);
});
test("Indonesian diagrams edit sentence roles and validate syllable composition", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page
    .getByRole("button", { name: "Learning diagram", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Learning model", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Struktur kalimat S–P–O–K", exact: true })
    .click();
  const parts = page.getByRole("textbox", {
    name: "Bagian / urutan (satu per baris)",
    exact: true,
  });
  await parts.fill("Budi\nmenulis\ncerita\ndi rumah");
  await page.getByRole("button", { name: "Apply diagram text" }).click();
  expect(
    (await documentOf(page)).elements.find((o: any) => o.learning).learning
      .parts,
  ).toEqual(["Budi", "menulis", "cerita", "di rumah"]);
  await page
    .getByRole("combobox", { name: "Learning model", exact: true })
    .click();
  await page.getByRole("option", { name: "Suku kata", exact: true }).click();
  await parts.fill("ke\nla");
  await page.getByRole("button", { name: "Apply diagram text" }).click();
  await expect(page.getByRole("alert")).toContainText("Syllables must form");
  expect(
    (await documentOf(page)).elements.find((o: any) => o.learning).learning
      .parts,
  ).toEqual(["ke", "la", "pa"]);
  await parts.fill("ke\nla\npa");
  await page.getByRole("button", { name: "Apply diagram text" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
for (const [topic, visual] of [
  [
    "volume kubus untuk kelas 6 SD",
    { type: "learning", settings: { kind: "cube", side: 4 } },
  ],
  [
    "Bahasa Indonesia: subjek dan predikat dalam kalimat kelas 4 SD",
    {
      type: "learning",
      settings: {
        kind: "sentence",
        parts: ["Siti", "membaca", "buku", "di kelas"],
      },
    },
  ],
  [
    "fisika gelombang transversal kelas 8 SMP",
    {
      type: "physics",
      settings: { kind: "wave", wavelength: 2, frequency: 1 },
    },
  ],
] as const) {
  test(`AI adds a new editable visual to a scene: ${topic}`, async ({
    page,
  }) => {
    let payload: any;
    await page.route("**/api/genie-social/request", async (r) => {
      const body = r.request().postDataJSON();
      if (body.action !== "ai.generate") return r.fallback();
      payload = body.payload;
      return r.fulfill({
        json: {
          data: {
            post: {
              name: "Pelajaran SD–SMP",
              caption: "Amati contoh dan jelaskan hasilnya.",
            },
            frames: payload.scenes.map((s: any) => ({
              useCase: s.useCase,
              title: "Contoh pembelajaran",
              texts: s.slots.map((slot: any) => ({
                id: slot.id,
                text:
                  slot.role === "headline"
                    ? "Amati contohnya"
                    : "Jelaskan dengan kata-katamu.",
              })),
              narration: "",
              visual,
            })),
            usage: null,
          },
        },
      });
    });
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("switch", { name: "Narration", exact: true })
      .uncheck();
    await dialog
      .getByRole("textbox", { name: "Learning content and context" })
      .fill(`Buat pelajaran tentang ${topic}.`);
    await setSceneTypes(page, dialog, ["content"]);
    await dialog
      .getByRole("button", { name: "Generate frames", exact: true })
      .click();
    await expect(
      dialog.getByText("Added teaching visual", { exact: true }),
    ).toBeVisible();
    expect(payload.scenes[0].allowVisual).toBe(true);
    expect(payload.scenes[0].diagrams).toHaveLength(0);
    expect(payload.scenes[0].learning).toHaveLength(0);
    await expect(
      dialog.getByRole("img", {
        name: "Generated scene 1 preview",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `/tmp/genie-learning-${visual.settings.kind}.png`,
    });
    await dialog
      .getByRole("button", { name: "Add 1 frame without audio", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    let doc = await documentOf(page);
    let element = doc.elements.find((o: any) =>
      visual.type === "physics" ? o.physics : o.learning,
    );
    expect(element[visual.type].kind).toBe(visual.settings.kind);
    expect(element.src).toContain("data:image/svg+xml;");
    expect(element.x).toBeGreaterThanOrEqual(0);
    const parent = doc.elements.find((o: any) => o.id === element.fid);
    expect(element.x + element.w).toBeLessThanOrEqual(parent.x + parent.w);
    expect(doc.metadata.post.frameIds).toEqual([parent.id]);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Canvas name", exact: true }),
    ).toBeVisible();
    doc = await documentOf(page);
    expect(
      doc.elements.some(
        (o: any) =>
          o.learning?.kind === visual.settings.kind ||
          o.physics?.kind === visual.settings.kind,
      ),
    ).toBe(true);
  });
}
test("all 62 SD–SMP presets load with bounded native copy and safe reserved visual space", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { initializeAssetLibrary } = await window.genieSource(
      "/src/editor/assets.ts",
    );
    await initializeAssetLibrary();
    const { loadPresetCatalog, loadPreset } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    const { ensureDocumentFonts } =
      await window.genieSource("/src/lib/fonts.ts");
    const catalog = await loadPresetCatalog();
    const entries = catalog.presets.filter((p) => p.collection === "SD & SMP");
    const problems = [];
    let auto = 0;
    const canvas = document.createElement("canvas"),
      ctx = canvas.getContext("2d");
    for (const entry of entries) {
      const p = await loadPreset(entry);
      await ensureDocumentFonts(p.objects);
      if (p.teachingArea) auto++;
      for (const o of p.objects) {
        if (o.t === "text" && o.generationRole === "editable") {
          ctx.font = `${o.weight || 800} ${o.size}px "${o.font}"`;
          for (const line of o.text.split("\n"))
            if (ctx.measureText(line).width > o.w + 2)
              problems.push(`${entry.identifier}: ${o.n} width`);
          if (o.text.split("\n").length * o.size * (o.lh || 1.2) > o.h + 2)
            problems.push(`${entry.identifier}: ${o.n} height`);
        }
        if (
          p.teachingArea &&
          o.t === "text" &&
          o.generationRole === "editable"
        ) {
          const a = p.teachingArea;
          if (
            o.x < a.x + a.w &&
            o.x + o.w > a.x &&
            o.y < a.y + a.h &&
            o.y + o.h > a.y
          )
            problems.push(`${entry.identifier}: overlapping reserved area`);
        }
        if (o.learning || o.physics)
          if (!o.src?.startsWith("data:image/svg+xml;"))
            problems.push(entry.identifier + ": not embedded");
      }
    }
    return { count: entries.length, auto, problems };
  });
  expect(result.count).toBe(62);
  expect(result.auto).toBe(6);
  expect(result.problems).toEqual([]);
});
