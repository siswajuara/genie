import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance.getEntriesByType("resource").reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, route => route.abort());
  await page.route("**/api/genie-social/**", route => route.fulfill({ json: { data: {
    accounts: [], organizations: [], profiles: [], issues: [],
    buffer: { configured: false }, zernio: { configured: false },
    elevenlabs: { configured: false, accounts: [] },
  } } }));
  await page.goto("/");
});

test("every camera preset moves only content media while preserving text, teaching and branding pixels", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { drawAnimationFrame } = await window.genieSource("/src/editor/animation-renderer.ts");
    const { motions } = await window.genieSource("/src/editor/animation.ts");
    const { prepareVideos, disposeVideos } = await window.genieSource("/src/editor/video.ts");
    const surface = Object.assign(document.createElement("canvas"), { width: 64, height: 48 });
    const source = surface.getContext("2d")!;
    source.fillStyle = "#d02030"; source.fillRect(0, 0, 64, 48);
    source.fillStyle = "#15a060"; source.fillRect(0, 0, 23, 19);
    const src = surface.toDataURL();
    const stream = surface.captureStream(20), recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    const recorded = new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 150));
    recorder.stop();
    const videoSrc = URL.createObjectURL(await recorded);
    stream.getTracks().forEach(track => track.stop());
    const frame = { id: "f", t: "frame", n: "Frame", x: 20, y: 30, w: 400, h: 300,
      fill: "#ffffff", scene: { duration: 4 } };
    const media = { id: "media", t: "img", n: "Content", fid: "f", x: 85, y: 100,
      w: 140, h: 100, src, fit: "contain", animation: { depth: 75 } };
    const text = { ...media, t: "text", text: "Camera stays here", font: "Arial", size: 20,
      weight: 700, color: "#112866", align: "left", curve: 30 };
    const samples = [
      { ...media, id: "image", moves: true },
      { ...media, id: "video", t: "video", src: videoSrc, moves: true },
      { ...media, id: "locked-image", lock: true, brandRole: "content", moves: true },
      { ...text, id: "curved-text" },
      { ...text, id: "header-text", curve: 0, n: "Header" },
      { ...text, id: "page", generationRole: "page-number", text: "1/3" },
      { ...text, id: "own-motion", animation: { motion: { preset: "float", amount: 20, easing: "linear" } } },
      { ...media, id: "latex", latex: { source: "F=ma" } },
      { ...media, id: "physics", physics: { kind: "newton-second" } },
      { ...media, id: "learning", learning: { kind: "square", side: 4 } },
      { ...media, id: "curve", t: "line", bend: 40, lw: 6, stroke: "#112866" },
      { ...media, id: "shape", t: "rect", fill: "#d02030", lw: 0 },
      { ...media, id: "logo", brandRole: "logo" },
      { ...media, id: "footer", brandRole: "footer" },
      { ...media, id: "fixed-image", generationRole: "fixed" },
      { ...media, id: "legacy-logo", identifier: "siswa-juara-logo-blue" },
      { ...media, id: "legacy-footer", identifier: "social-instagram-blue" },
      { ...media, id: "header-image", n: "Header artwork" },
      { ...media, id: "page-image", identifier: "page-number" },
      { ...media, id: "branded-video", t: "video", src: videoSrc, brandRole: "logo" },
    ];
    const images = new Map([[src, surface]]);
    const canvas = Object.assign(document.createElement("canvas"), { width: 400, height: 300 });
    const ctx = canvas.getContext("2d")!;
    const time = 1.13, failures: string[] = [];
    const render = (element, preset, reducedMotion = false) => {
      ctx.clearRect(0, 0, 400, 300);
      drawAnimationFrame(ctx, { ...frame, scene: { ...frame.scene,
        camera: { preset, amount: 70, easing: "linear" } } }, [element], time, images,
      { width: 400, height: 300, reducedMotion });
      return canvas.toDataURL();
    };
    try {
      await prepareVideos(images, samples);
      for (const element of samples) {
        const baseline = render(element, "none");
        for (const preset of motions.filter(p => p !== "none")) {
          const changed = render(element, preset) !== baseline;
          if (changed !== !!element.moves) failures.push(`${element.id}: ${preset}`);
        }
        if (render(element, "dolly-in", true) !== render(element, "none", true))
          failures.push(`${element.id}: reduced motion`);
      }
      // Camera exclusion must preserve explicitly authored layer animation.
      const own = samples.find(s => s.id === "own-motion");
      if (render(own, "dolly-in") === render({ ...own, animation: undefined }, "none"))
        failures.push("excluded text lost its own animation");
    } finally {
      disposeVideos(images);
      URL.revokeObjectURL(videoSrc);
    }
    return { failures, presets: motions.length - 1, layers: samples.length };
  });
  expect(result.presets).toBe(16);
  expect(result.layers).toBe(20);
  expect(result.failures).toEqual([]);
});

test("sequence and PNG export keep protected layers anchored while camera moves the image", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createSequenceRenderer } = await window.genieSource("/src/editor/animation-renderer.ts");
    const { exportImages } = await window.genieSource("/src/editor/media-export.ts");
    const { initialDocument, parseDocument } = await window.genieSource("/src/editor/model.ts");
    const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#d02030"/><rect width="30" height="20" fill="#15a060"/></svg>');
    const image = new Image(); image.src = svg; await image.decode();
    const frame = { id: "f", t: "frame", n: "Camera", x: 0, y: 0, w: 400, h: 300,
      fill: "#ffffff", scene: { duration: 4, camera: { preset: "dolly-in", amount: 70, easing: "linear" } } };
    const media = { id: "media", t: "img", n: "Content", fid: "f", x: 90, y: 80, w: 150, h: 100, src: svg };
    const logo = { ...media, id: "logo", brandRole: "logo" };
    const images = new Map([[svg, image]]);
    const canvas = Object.assign(document.createElement("canvas"), { width: 400, height: 300 });
    const ctx = canvas.getContext("2d")!;
    const sequence = (element, camera) => {
      const f = { ...frame, scene: { ...frame.scene, camera } };
      const renderer = createSequenceRenderer([f], new Map([[f.id, [element]]]), images, 400, 300);
      renderer.draw(ctx, 1.13);
      const pixels = canvas.toDataURL(); renderer.dispose(); return pixels;
    };
    const png = async (element, camera) => {
      const doc = parseDocument({ ...initialDocument(), elements: [{ ...frame, scene: { ...frame.scene, camera } }, element] });
      const { blob } = await exportImages(doc, [doc.elements[0]], { format: "png", scale: 1,
        transparent: false, quality: 1, time: 1.13, name: "camera" }, new AbortController().signal, () => {});
      return Array.from(new Uint8Array(await blob.arrayBuffer())).join(",");
    };
    const camera = frame.scene.camera;
    return {
      sequenceLogoFixed: sequence(logo, camera) === sequence(logo, undefined),
      sequenceImageMoves: sequence(media, camera) !== sequence(media, undefined),
      pngLogoFixed: await png(logo, camera) === await png(logo, undefined),
      pngImageMoves: await png(media, camera) !== await png(media, undefined),
    };
  });
  expect(result).toEqual({ sequenceLogoFixed: true, sequenceImageMoves: true, pngLogoFixed: true, pngImageMoves: true });
});
