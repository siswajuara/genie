import { expect, test } from "@playwright/test";
import schema from "../sidecar/canvas.schema.json" with { type: "json" };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance.getEntriesByType("resource").reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (r) => r.abort());
  await page.route("**/api/genie-social/**", (r) => r.fulfill({ json: { data: {
    accounts: [], organizations: [], profiles: [], issues: [], storage: "file",
    buffer: { configured: false }, zernio: { configured: false },
    elevenlabs: { configured: false, accounts: [] },
  } } }));
  await page.goto("/");
});

test("all supplied effects validate and survive a document round trip", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { shaderTransitions } = await window.genieSource("/src/editor/shader-transitions.ts");
    const { initialDocument, parseDocument } = await window.genieSource("/src/editor/model.ts");
    const { effectLabel, transitions } = await window.genieSource("/src/editor/animation.ts");
    const doc = initialDocument();
    doc.elements = shaderTransitions.map((type: string, i: number) => ({
      id: `frame-${i}`, t: "frame", n: type, x: 0, y: 0, w: 100, h: 100,
      scene: { duration: 3, transition: { type, duration: 0.8 } },
    }));
    const parsed = parseDocument(JSON.parse(JSON.stringify(doc)));
    return {
      ids: shaderTransitions,
      saved: parsed.elements.map((f: any) => f.scene.transition.type),
      label: effectLabel("shader:RGB Split"),
      legacy: transitions.includes("push-left"),
    };
  });
  expect(result.ids).toHaveLength(128);
  expect(result.saved).toEqual(result.ids);
  expect(result.label).toBe("RGB Split");
  expect(result.legacy).toBe(true);
  const allowed = schema.$defs.scene.properties.transition.properties.type.enum;
  expect(result.ids.every((id: string) => allowed.includes(id))).toBe(true);
});

test("every shader compiles, renders deterministically, and preserves source orientation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { TRANSITIONS } = await window.genieSource("/src/editor/shader-transitions.ts");
    const { createShaderTransitionRenderer } = await window.genieSource("/src/editor/shader-transition-renderer.ts");
    const make = () => Object.assign(document.createElement("canvas"), { width: 96, height: 64 });
    const from = make(), to = make(), output = make();
    const ctx = output.getContext("2d")!;
    for (const [surface, colors] of [[from, ["#ff0000", "#00ff00"]], [to, ["#0000ff", "#ffff00"]]] as const) {
      const c = surface.getContext("2d")!;
      c.fillStyle = colors[0]; c.fillRect(0, 0, 96, 32);
      c.fillStyle = colors[1]; c.fillRect(0, 32, 96, 32);
    }
    const renderer = createShaderTransitionRenderer(96, 64);
    if (!renderer) throw new Error("Test browser must provide WebGL2");
    const pixels = () => [...ctx.getImageData(0, 0, 96, 64).data];
    const failed: string[] = [], unstable: string[] = [], endpoints: string[] = [];
    for (const [name, definition] of Object.entries(TRANSITIONS)) {
      for (const raw of [0, 0.25, 0.5, 0.85, 1]) {
        if (!renderer.draw(ctx, from, to, definition, raw, raw, raw * 0.8)) failed.push(name);
        if (raw === 0 || raw === 1) {
          const source = (raw === 0 ? from : to).getContext("2d")!;
          if (JSON.stringify(pixels()) !== JSON.stringify([...source.getImageData(0, 0, 96, 64).data]))
            endpoints.push(name);
        }
      }
      renderer.draw(ctx, from, to, definition, 0.4, 0.4, 0.32);
      const first = pixels();
      renderer.draw(ctx, from, to, definition, 0.4, 0.4, 0.32);
      if (JSON.stringify(first) !== JSON.stringify(pixels())) unstable.push(name);
    }
    renderer.dispose();
    return { failed, unstable, endpoints };
  });
  expect(result).toEqual({ failed: [], unstable: [], endpoints: [] });
});

test("sequence renderer shares transition timing, supports scrubbing, reduced motion and WebGL fallback", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createSequenceRenderer } = await window.genieSource("/src/editor/animation-renderer.ts");
    const make = (id: string, fill: string) => ({
      id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100, fill,
      scene: { duration: 2, transition: { type: "shader:Glitch", duration: 1, easing: "linear" } },
    });
    const frames = [make("a", "#ff0000"), make("b", "#0000ff")];
    const canvas = Object.assign(document.createElement("canvas"), { width: 64, height: 64 });
    const ctx = canvas.getContext("2d")!;
    const pixel = () => [...ctx.getImageData(32, 32, 1, 1).data];
    const all = () => [...ctx.getImageData(0, 0, 64, 64).data];
    const renderer = createSequenceRenderer(frames, new Map(), new Map(), 64, 64);
    renderer.draw(ctx, 0); const start = pixel();
    renderer.draw(ctx, 2.5); const midpoint = all();
    renderer.draw(ctx, 5); const incoming = pixel();
    renderer.draw(ctx, 2.5); const scrubbed = all();
    renderer.dispose();
    const reduced = createSequenceRenderer(frames, new Map(), new Map(), 64, 64, true);
    reduced.draw(ctx, 2.5); const reducedPixel = pixel();
    reduced.dispose();
    const original = HTMLCanvasElement.prototype.getContext;
    let attempted = 0;
    HTMLCanvasElement.prototype.getContext = function(kind: string, ...args: any[]) {
      if (kind === "webgl2") { attempted++; return null; }
      return original.call(this, kind as any, ...args);
    } as typeof original;
    let fallbackPixel: number[] = [];
    try {
      const fallback = createSequenceRenderer(frames, new Map(), new Map(), 64, 64);
      fallback.draw(ctx, 2.5); fallbackPixel = pixel();
      fallback.draw(ctx, 2.6);
      fallback.dispose();
    } finally { HTMLCanvasElement.prototype.getContext = original; }
    return { start, incoming, stable: JSON.stringify(midpoint) === JSON.stringify(scrubbed),
      reducedPixel, fallbackPixel, attempted };
  });
  expect(result.start).toEqual([255, 0, 0, 255]);
  expect(result.incoming).toEqual([0, 0, 255, 255]);
  expect(result.stable).toBe(true);
  expect(result.fallbackPixel).toEqual(result.reducedPixel);
  expect(Math.abs(result.fallbackPixel[0] - 128)).toBeLessThanOrEqual(2);
  expect(Math.abs(result.fallbackPixel[2] - 128)).toBeLessThanOrEqual(2);
  expect(result.attempted).toBe(1);
});

test("sequence inserts a silent breathing pause between scenes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { buildSequence, transitionGap, BREATH_GAP } = await window.genieSource("/src/editor/animation.ts");
    const frame = (id: string, duration: number, transition?: { type: string; duration: number }) => ({
      id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100,
      scene: { duration, ...(transition ? { transition } : {}) },
    });
    const frames = [
      frame("a", 2, { type: "crossfade", duration: 1 }),
      frame("b", 2),
      frame("c", 2, { type: "cut", duration: 0.4 }),
    ];
    const sequence = buildSequence(frames);
    const covered = (t: number) =>
      sequence.some((entry: any) => t >= entry.start && t < entry.end);
    return {
      breath: BREATH_GAP,
      cutGap: transitionGap(frames[1], frames[2]),
      missingGap: transitionGap(undefined as any, frames[0]),
      starts: sequence.map((entry: any) => entry.start),
      ends: sequence.map((entry: any) => entry.end),
      gaps: sequence.map((entry: any) => entry.gap),
      sceneHoldsAudio: covered(1) && covered(4),
      gapIsSilent: ![2, 2.5, 2.99].some(covered),
      cutGapIsSilent: ![5, 5.2].some(covered),
    };
  });
  expect(result).toEqual({
    breath: 0.4,
    cutGap: 0.4,
    missingGap: 0.4,
    starts: [0, 3, 5.4],
    ends: [2, 5, 7.4],
    gaps: [0, 1, 0.4],
    sceneHoldsAudio: true,
    gapIsSilent: true,
    cutGapIsSilent: true,
  });
});

test("editor preview draws the next frame within the outgoing frame bounds", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { renderScene } = await window.genieSource("/src/editor/render-scene.ts");
    const { createSequenceRenderer } = await window.genieSource("/src/editor/animation-renderer.ts");
    const { buildScene } = await window.genieSource("/src/editor/scene.ts");
    const frames = [
      { id: "a", t: "frame", n: "A", x: 10, y: 40, w: 100, h: 100, fill: "#ff0000",
        scene: { duration: 2, transition: { type: "shader:Cube", duration: 1 } } },
      { id: "b", t: "frame", n: "B", x: 140, y: 40, w: 100, h: 100, fill: "#0000ff",
        scene: { duration: 2 } },
    ];
    const scene = buildScene(frames), images = new Map();
    const renderer = createSequenceRenderer(frames, scene.frameChildren, images, 64, 64);
    const canvas = Object.assign(document.createElement("canvas"), { width: 260, height: 160 });
    const ctx = canvas.getContext("2d")!;
    const preview = (time: number) => {
      ctx.clearRect(0, 0, 260, 160);
      renderScene(ctx, scene, { x: 0, y: 0, w: 260, h: 160 }, 1, 1, images,
        new Map(), 0, undefined, { frameId: "a", time, reducedMotion: false,
          textures: new Map(), sequence: { renderer, width: 64, height: 64 } });
    };
    const pixel = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    // Gap start: the outgoing scene holds its final pose behind the transition.
    preview(2);
    const outgoingStart = pixel(50, 80);
    // Gap end: the incoming scene fills the outgoing frame bounds.
    preview(3);
    const result = { outgoing: outgoingStart, next: pixel(180, 80), gap: pixel(120, 80), outgoingEnd: pixel(50, 80) };
    renderer.dispose();
    return result;
  });
  expect(result.outgoing).toEqual([255, 0, 0, 255]);
  expect(result.outgoingEnd).toEqual([0, 0, 255, 255]);
  expect(result.next).toEqual([0, 0, 255, 255]);
  expect(result.gap).toEqual([0, 0, 0, 0]);
});

test("transition picker filters shaders, previews the next frame and saves locally", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: /Square 1080/ }).click();
  await page.getByRole("button", { name: /Square 1080/ }).click();
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await page.getByRole("treeitem", { name: "Square 1", exact: true }).click();
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByRole("button", { name: "Transition Cut", exact: true }).click();
  await page.getByRole("combobox", { name: "Filter effects", exact: true }).click();
  await page.getByRole("option", { name: "Glitch & Distortion", exact: true }).click();
  await page.getByRole("option", { name: "Digital Glitch", exact: true }).click();
  await expect(page.getByRole("option", { name: "Digital Glitch", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Transitions from this frame to Square 2.", { exact: false })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Transition duration", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit canvas", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Go to end", exact: true }).click();
  await page.getByRole("option", { name: "Digital Glitch", exact: true }).click();
  await expect(page.getByLabel("Playhead time", { exact: true })).toContainText("0:04.");
  await page.getByRole("button", { name: "Edit canvas", exact: true }).click();
  const saved = () => page.evaluate(async () => {
    const { localStore, prepareLocalSave } = await window.genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const doc = workspace.projects.find((p: any) => p.id === workspace.activeProjectId)
      .pages.find((p: any) => p.id === workspace.activePageId).canvas;
    return doc.elements.find((o: any) => o.n === "Square 1").scene.transition.type;
  });
  await expect.poll(saved).toBe("shader:Digital Glitch");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Canvas name", exact: true })).toBeVisible();
  await expect.poll(saved).toBe("shader:Digital Glitch");
  expect(errors).toEqual([]);
});
