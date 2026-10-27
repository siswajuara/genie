import { setSceneTypes } from "./generation-helpers";
import { expect, test } from "@playwright/test";
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
test("all 40 learning models animate on the real canvas without changing their lesson text", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { learningModels } = await window.genieSource(
      "/sidecar/learning.mjs",
    );
    const { physicsModels } = await window.genieSource("/sidecar/science.mjs");
    const { learningDrawing } = await window.genieSource(
      "/src/editor/learning-drawing.mjs",
    );
    const { physicsDrawing } = await window.genieSource(
      "/src/editor/physics-drawing.mjs",
    );
    const { drawAnimationFrame } = await window.genieSource(
      "/src/editor/animation-renderer.ts",
    );
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    const frame = {
        id: "f",
        t: "frame",
        n: "Test",
        x: 0,
        y: 0,
        w: 900,
        h: 500,
        fill: "#ffffff",
        scene: { duration: 8 },
      },
      issues = [];
    function at(kind, property, time, reducedMotion = false) {
      ctx.clearRect(0, 0, 900, 500);
      drawAnimationFrame(
        ctx,
        frame,
        [
          {
            id: "d",
            t: "img",
            n: kind,
            fid: "f",
            x: 0,
            y: 0,
            w: 900,
            h: 500,
            [property]: { kind },
            color: "#0757ec",
            animation: { start: 0, end: 8 },
          },
        ],
        time,
        new Map(),
        { width: 900, height: 500, reducedMotion },
      );
      return canvas.toDataURL();
    }
    for (const kind of Object.keys(learningModels)) {
      const a = at(kind, "learning", 0),
        b = at(kind, "learning", 1.7);
      if (a === b) issues.push(`${kind}: no animation`);
      if (b !== at(kind, "learning", 1.7))
        issues.push(`${kind}: nondeterministic`);
      if (at(kind, "learning", 0, true) !== at(kind, "learning", 1.7, true))
        issues.push(`${kind}: reduced motion`);
      const start = learningDrawing({ kind }, 0)
          .filter((s) => s.t === "text")
          .map((s) => s.value),
        later = learningDrawing({ kind }, 1.7)
          .filter((s) => s.t === "text")
          .map((s) => s.value);
      if (JSON.stringify(start) !== JSON.stringify(later))
        issues.push(`${kind}: changed data`);
    }
    for (const [property, models, drawing] of [
      ["learning", learningModels, learningDrawing],
      ["physics", physicsModels, physicsDrawing],
    ])
      for (const kind of Object.keys(models)) {
        at(kind, property, 0.7);
        for (const s of drawing({ kind }, 0.7)) {
          if (s.t !== "text") continue;
          ctx.font = `400 ${s.size}px Arial`;
          const width = ctx.measureText(String(s.value)).width,
            left = s.align === "center" ? s.x - width / 2 : s.x,
            right = s.align === "center" ? s.x + width / 2 : s.x + width;
          if (left < 0 || right > 902 || s.y > 502)
            issues.push(`${kind}: text overflow ${s.value}`);
        }
      }
    return {
      learning: Object.keys(learningModels).length,
      physics: Object.keys(physicsModels).length,
      issues,
    };
  });
  expect(result.learning).toBe(40);
  expect(result.physics).toBe(20);
  expect(result.issues).toEqual([]);
});
test("full frame context and visible text reach Generate and narration, and survive reload", async ({
  page,
}) => {
  const requests: any[] = [];
  await page.route("**/api/genie-social/request", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (body.action === "ai.generate")
      return route.fulfill({
        json: {
          data: {
            post: {
              name: "Kubus dan tumbuhan",
              caption: "Amati kubus dan bagian tumbuhan.",
            },
            frames: body.payload.scenes.map((s: any) => ({
              useCase: s.useCase,
              title: "Amati contohnya",
              texts: s.slots.map((slot: any) => ({
                id: slot.id,
                text:
                  slot.role === "headline"
                    ? "Amati contohnya"
                    : "Jelaskan dengan kata-katamu.",
              })),
              narration: "",
              physics: (s.diagrams || []).map((d: any) => ({
                id: d.id,
                settings: d.example,
              })),
              learning: (s.learning || []).map((d: any) => ({
                id: d.id,
                settings: d.example,
              })),
            })),
            usage: null,
          },
        },
      });
    if (body.action === "ai.narration")
      return route.fulfill({
        json: {
          data: {
            narration:
              "[warm] Kubus memiliki enam sisi persegi, sedangkan akar membantu tumbuhan menyerap air.",
          },
        },
      });
    if (body.action?.startsWith("elevenlabs."))
      throw Error("Context tests must not call speech providers.");
    return route.fallback();
  });
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page
    .getByRole("button", { name: "Learning diagram", exact: true })
    .click();
  await page.getByRole("button", { name: "Image slot", exact: true }).click();
  await page
    .locator('input[type=file][accept="image/*"]')
    .setInputFiles({
      name: "plant.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/LxoAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Foto tumbuhan dengan akar, batang, dan daun.");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator(".frame-context-panel summary").click();
  const context = JSON.parse(
    await dialog
      .getByRole("textbox", { name: "Full AI frame context" })
      .inputValue(),
  );
  expect(context.frames).toHaveLength(1);
  expect(
    context.frames[0].layers.some(
      (o: any) =>
        o.learning?.kind === "cube" && o.teaching.metrics.volume === 64,
    ),
  ).toBe(true);
  expect(
    context.frames[0].layers.some((o: any) =>
      o.readableText?.includes("akar, batang"),
    ),
  ).toBe(true);
  await dialog
    .getByRole("switch", { name: "Narration", exact: true })
    .uncheck();
  await setSceneTypes(page, dialog, ["content"]);
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("Jelaskan kubus dan bagian tumbuhan untuk anak kelas 5 SD.");
  await dialog
    .getByRole("button", { name: /^Generate (frames|content)$/ })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Frame name", exact: true }),
  ).toBeVisible();
  const sent = requests.find((r) => r.action === "ai.generate").payload
    .frameContext;
  expect(sent.frames[0].layers.length).toBe(context.frames[0].layers.length);
  expect(JSON.stringify(sent)).not.toContain("data:image/");
  await dialog
    .getByRole("button", { name: "Close Generate dialog", exact: true })
    .click();
  await page.getByRole("tab", { name: "Narration", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Regenerate script from canvas text",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Narration script", exact: true }),
  ).toHaveValue(/akar membantu/);
  const spoken = requests.find((r) => r.action === "ai.narration").payload
    .frameContext;
  expect(spoken.frames[0].layers.length).toBe(context.frames[0].layers.length);
  expect(
    spoken.frames[0].layers.some((o: any) =>
      o.readableText?.includes("akar, batang"),
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Canvas name", exact: true }),
  ).toBeVisible();
  const restored = await page.evaluate(async () => {
    const { localStore, prepareLocalSave } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return w.projects
      .find((p) => p.id === w.activeProjectId)
      .pages.find((p) => p.id === w.activePageId).canvas.elements;
  });
  expect(
    restored.some(
      (o: any) => o.text === "Foto tumbuhan dengan akar, batang, dan daun.",
    ),
  ).toBe(true);
});
