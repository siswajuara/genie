import { setSceneTypes } from "./generation-helpers";
import { expect, test, type Page } from "@playwright/test";

async function savedDocument(page: Page) {
  return page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource(
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
      const resource = performance
        .getEntriesByType("resource")
        .reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) =>
    route.abort(),
  );
  await page.route("**/api/genie-social/**", async (route) => {
    const body = route.request().postDataJSON();
    if (route.request().url().endsWith("/settings"))
      return route.fulfill({
        json: {
          data: {
            storage: "file",
            opencode: {
              url: "",
              model: "",
              tokenConfigured: false,
              mode: "local",
            },
            buffer: { configured: false },
            zernio: { configured: false },
            elevenlabs: { configured: false, accounts: [] },
          },
        },
      });
    if (body.action === "ai.generate")
      return route.fulfill({
        json: {
          data: {
            post: {
              name: "Pendulum lesson",
              caption: "Compare pendulums with different lengths.",
            },
            frames: body.payload.scenes.map((scene: any) => ({
              useCase: scene.useCase,
              title: "Pendulum period",
              texts: scene.slots.map((slot: any) => ({
                id: slot.id,
                text:
                  slot.role === "latex"
                    ? slot.example
                    : slot.role === "headline"
                      ? "Ayunan Bandul"
                      : "Amati gerak bandul.",
              })),
              narration:
                body.payload.narration && scene.narrate
                  ? "[calm] The longer string makes each swing take more time."
                  : "",
              physics: (scene.diagrams || []).map((d: any) => ({
                id: d.id,
                settings: {
                  ...d.example,
                  ...(d.example.kind === "pendulum" ? { length: 2 } : {}),
                },
              })),
            })),
            usage: null,
          },
        },
      });
    if (body.action === "elevenlabs.speech")
      throw Error("Science tests must not call speech.");
    return route.fulfill({
      json: {
        data: { accounts: [], organizations: [], profiles: [], issues: [] },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Canvas name", exact: true }),
  ).toBeVisible();
});

test("LaTeX stays editable, rejects invalid input, reveals on the timeline, and survives reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page
    .getByRole("button", { name: "LaTeX equation", exact: true })
    .click();
  const source = page.getByRole("textbox", {
    name: "LaTeX source",
    exact: true,
  });
  await expect(source).toHaveValue("\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}");
  await source.fill("\\frac{a}{b}=\\sqrt{c}");
  await page.getByRole("button", { name: "Render LaTeX", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Render LaTeX", exact: true }),
  ).toBeEnabled();
  let doc = await savedDocument(page);
  const equation = doc.elements.find((o: any) => o.latex);
  expect(equation.latex.source).toBe("\\frac{a}{b}=\\sqrt{c}");
  expect(equation.src).toContain("data:image/svg+xml;");
  await source.fill("\\notACommand{x}");
  await page.getByRole("button", { name: "Render LaTeX", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Undefined control sequence",
  );
  expect(
    (await savedDocument(page)).elements.find((o: any) => o.latex).src,
  ).toBe(equation.src);
  const visible = await page.evaluate(async (equation) => {
    const { drawAnimationFrame } = await window.genieSource(
      "/src/editor/animation-renderer.ts",
    );
    const image = new Image();
    image.src = equation.src;
    await image.decode();
    const images = new Map([[equation.src, image]]);
    const frame = {
      id: "f",
      t: "frame",
      x: 0,
      y: 0,
      w: 900,
      h: 300,
      fill: "#ffffff",
      scene: { duration: 5 },
    };
    const child = { ...equation, x: 20, y: 30, w: 860, h: 240 };
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    const at = (time) => {
      ctx.clearRect(0, 0, 900, 300);
      drawAnimationFrame(ctx, frame, [child], time, images, {
        width: 900,
        height: 300,
      });
      return canvas.toDataURL();
    };
    return { early: at(0.1), full: at(2) };
  }, equation);
  expect(visible.early).not.toBe(visible.full);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "LaTeX equation", exact: true }),
  ).toBeVisible();
  doc = await savedDocument(page);
  expect(doc.elements.find((o: any) => o.latex).latex.source).toBe(
    equation.latex.source,
  );
});

test("physics controls change deterministic playback and exported PNG frames", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page
    .getByRole("button", { name: "Physics diagram", exact: true })
    .click();
  const length = page.getByRole("spinbutton", {
    name: "Length (m)",
    exact: true,
  });
  await expect(length).toHaveValue("1.5");
  await length.fill("2");
  await length.press("Tab");
  const doc = await savedDocument(page);
  expect(doc.elements.find((o: any) => o.physics).physics.length).toBe(2);
  const rendered = await page.evaluate(async (doc) => {
    const { drawAnimationFrame, createSequenceRenderer } =
      await window.genieSource("/src/editor/animation-renderer.ts");
    const { exportImages } = await window.genieSource(
      "/src/editor/media-export.ts",
    );
    const frame = doc.elements.find((o) => o.t === "frame");
    const child = doc.elements.find((o) => o.physics);
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    const sample = { ...frame, x: 0, y: 0, w: 900, h: 500 };
    const diagram = { ...child, x: 0, y: 0, w: 900, h: 500 };
    const at = (time, reducedMotion = false) => {
      ctx.clearRect(0, 0, 900, 500);
      drawAnimationFrame(ctx, sample, [diagram], time, new Map(), {
        width: 900,
        height: 500,
        reducedMotion,
      });
      return [...ctx.getImageData(0, 50, 900, 350).data].reduce(
        (hash, n, i) => (hash + n * ((i % 997) + 1)) % 2147483647,
        0,
      );
    };
    const still = at(0),
      moving = at(0.6),
      repeat = at(0.6),
      reduced = [at(0, true), at(0.6, true)];
    const sequence = createSequenceRenderer(
      [sample],
      new Map([[sample.id, [diagram]]]),
      new Map(),
      900,
      500,
    );
    sequence.draw(ctx, 0);
    const before = canvas.toDataURL();
    sequence.draw(ctx, 0.6);
    const after = canvas.toDataURL();
    sequence.dispose();
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
          name: "physics",
        },
        new AbortController().signal,
        () => {},
      );
      return {
        type: blob.type,
        bytes: [...new Uint8Array(await blob.arrayBuffer())],
      };
    };
    return {
      still,
      moving,
      repeat,
      reduced,
      sequenceMoves: before !== after,
      png0: await exportAt(0),
      png1: await exportAt(0.6),
    };
  }, doc);
  expect(rendered.still).not.toBe(rendered.moving);
  expect(rendered.repeat).toBe(rendered.moving);
  expect(rendered.reduced[0]).toBe(rendered.reduced[1]);
  expect(rendered.sequenceMoves).toBe(true);
  expect(rendered.png0.type).toBe("image/png");
  expect(rendered.png0.bytes).not.toEqual(rendered.png1.bytes);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Physics diagram", exact: true }),
  ).toBeVisible();
  expect(
    (await savedDocument(page)).elements.find((o: any) => o.physics).physics
      .length,
  ).toBe(2);
});

test("generation uses typed math and physics slots and preserves them in editable frames", async ({
  page,
}) => {
  let payload: any;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/genie-social/request") &&
      request.postDataJSON()?.action === "ai.generate"
    )
      payload = request.postDataJSON().payload;
  });
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill(
      "Explain pendulum physics with a length of 2 metres and gravity 9.81 metres per second squared.",
    );
  await setSceneTypes(page, dialog, ["content"]);
  await dialog.getByRole("button", { name: "Change scene template" }).click();
  await page
    .getByRole("textbox", { name: "Search all templates" })
    .fill("Bandul");
  await page
    .locator(".generate-template-picker")
    .getByRole("button", { name: /Bandul/ })
    .first()
    .click();
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: /LaTeX equation/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("spinbutton", { name: "Length (m)", exact: true }),
  ).toHaveValue("2");
  expect(
    payload.scenes[0].slots.some((slot: any) => slot.role === "latex"),
  ).toBe(true);
  expect(payload.scenes[0].diagrams[0].example.kind).toBe("pendulum");
  await expect(
    dialog.getByRole("img", { name: "Generated scene 1 preview", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Add without audio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const doc = await savedDocument(page);
  expect(doc.elements.find((o: any) => o.physics).physics.length).toBe(2);
  expect(doc.elements.find((o: any) => o.latex).src).toContain(
    "data:image/svg+xml;",
  );
  expect(
    doc.elements.find((o: any) => o.t === "frame").voiceoverDraft.script,
  ).toContain("longer string");
});

test("all science examples have readable native copy, portable equations, and the intended models", async ({
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
    const entries = (await loadPresetCatalog()).presets.filter(
      (p) => p.collection === "Math & Physics",
    );
    const presets = await Promise.all(entries.map(loadPreset));
    await ensureDocumentFonts(presets.flatMap((p) => p.objects));
    const ctx = document.createElement("canvas").getContext("2d"),
      overflow = [];
    for (const preset of presets)
      for (const o of preset.objects.filter(
        (o) => o.t === "text" && !o.brandRole,
      )) {
        ctx.font = `${o.weight} ${o.size}px "${o.font}"`;
        const lines = o.text.split("\n");
        const width = Math.max(
          ...lines.map((line) =>
            [...line].reduce(
              (sum, char) => sum + ctx.measureText(char).width + (o.ls || 0),
              0,
            ),
          ),
        );
        if (width > o.w + 1)
          overflow.push(
            `${preset.identifier}: ${o.n} (${Math.ceil(width)} > ${o.w})`,
          );
      }
    const objects = presets.flatMap((p) => p.objects);
    const steps = presets
      .find((p) => p.identifier === "science-latex-linear-steps")
      .objects.filter((o) => o.latex);
    return {
      count: presets.length,
      overflow,
      equations: objects.filter((o) => o.latex).length,
      diagrams: objects.filter((o) => o.physics).length,
      kinds: [
        ...new Set(objects.filter((o) => o.physics).map((o) => o.physics.kind)),
      ].sort(),
      baked: objects
        .filter((o) => o.latex || o.physics)
        .every((o) => o.src.startsWith("data:image/svg+xml;")),
      starts: steps.map((o) => o.animation.start),
      thumbnails: entries.every((p) => p.thumbnail),
    };
  });
  expect(result.count).toBe(16);
  expect(result.overflow).toEqual([]);
  expect(result.equations).toBe(18);
  expect(result.diagrams).toBe(8);
  expect(result.kinds).toEqual(["orbit", "pendulum", "projectile", "spring"]);
  expect(result.baked).toBe(true);
  expect(result.starts).toHaveLength(3);
  expect(result.starts[0]).toBeGreaterThanOrEqual(0);
  expect(result.starts[1]).toBeGreaterThan(result.starts[0]);
  expect(result.starts[2]).toBeGreaterThan(result.starts[1]);
  expect(result.starts[2]).toBeLessThan(6);
  expect(result.thumbnails).toBe(true);
});
