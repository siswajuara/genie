import { expect, test } from "@playwright/test";

// Local audible PCM, with no speech service or network audio dependency.
function toneWav(seconds = 8) {
  const rate = 8000, samples = rate * seconds;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    bytes.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  return `data:audio/wav;base64,${bytes.toString("base64")}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance.getEntriesByType("resource").reverse()
        .find(r => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
    const state = (window as any).audioTest = { delay: 0, players: [], seeks: [] };
    const NativeAudio = window.Audio;
    window.Audio = function(src?: string) {
      const audio = new NativeAudio(src);
      state.players.push(audio);
      return audio;
    } as typeof Audio;
    const position = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime")!;
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      ...position,
      set(value: number) {
        if (this instanceof HTMLAudioElement)
          state.seeks.push({ from: position.get!.call(this), to: value });
        position.set!.call(this, value);
      },
    });
    // Emulate costly diagram/video rendering without slowing the audio clock.
    const raf = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map<number, { timer?: number; raf?: number }>();
    let next = 0;
    window.requestAnimationFrame = callback => {
      const id = ++next, entry: { timer?: number; raf?: number } = {};
      pending.set(id, entry);
      entry.timer = window.setTimeout(() => {
        entry.raf = raf(time => { pending.delete(id); callback(time); });
      }, state.delay);
      return id;
    };
    window.cancelAnimationFrame = id => {
      const entry = pending.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      if (entry.raf !== undefined) cancel(entry.raf);
      pending.delete(id);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, route => route.abort());
  await page.route("**/api/genie-social/**", route => route.fulfill({ json: { data: {
    accounts: [], organizations: [], profiles: [], issues: [],
    buffer: { configured: false }, zernio: { configured: false },
    elevenlabs: { configured: false, accounts: [] },
  } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page.evaluate(async src => {
    const { prepareLocalSave, localStore, flushLocalStore } = await window.genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const project = workspace.projects.find(p => p.id === workspace.activeProjectId);
    const doc = project.pages.find(p => p.id === workspace.activePageId).canvas;
    const frame = doc.elements.find(o => o.t === "frame");
    frame.scene = { duration: 8 };
    frame.audioTracks = [{ id: "tone", name: "Local tone", src, role: "voiceover",
      start: 0, end: 8, trimStart: 0, sourceDuration: 8, volume: 0.5,
      loop: false, muted: false, fadeIn: 0, fadeOut: 0 }];
    localStore.setItem("genie.workspace.v1", JSON.stringify(workspace));
    await flushLocalStore();
  }, toneWav());
  await page.reload();
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await page.getByRole("treeitem", { name: "Post 4:5 1", exact: true }).click();
});

test("timeline audio stays continuous when visual updates fall below ten frames per second", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle animation timeline", exact: true }).click();
  await page.evaluate(() => { (window as any).audioTest.delay = 240; });
  await page.getByRole("button", { name: "Play animation (Space)", exact: true }).click();
  await page.waitForFunction(() => (window as any).audioTest.players.some(a => !a.paused && a.currentTime > 2));
  const playhead = page.getByLabel("Playhead time", { exact: true });
  const seconds = Number((await playhead.textContent())!.match(/0:(\d+\.\d+)/)![1]);
  expect(seconds).toBeGreaterThan(1.6);
  expect(await page.evaluate(() => (window as any).audioTest.seeks.filter(s => s.from - s.to > 0.18))).toEqual([]);
  await page.getByRole("button", { name: "Pause animation (Space)", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).audioTest.players.every(a => a.paused))).toBe(true);
  const paused = await page.evaluate(() => (window as any).audioTest.players.at(-1).currentTime);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).audioTest.players.at(-1).currentTime)).toBeCloseTo(paused, 1);
  await page.getByRole("button", { name: "Play animation (Space)", exact: true }).click();
  await page.waitForFunction(value => (window as any).audioTest.players.at(-1).currentTime > value + 0.5, paused);
});

test("export preview uses elapsed time and does not repeatedly rewind the audio", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export canvas", exact: true });
  await dialog.getByRole("button", { name: "MP4", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Play sequence", exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as any).audioTest.delay = 240; });
  await dialog.getByRole("button", { name: "Play sequence", exact: true }).click();
  await page.waitForFunction(() => (window as any).audioTest.players.some(a => !a.paused && a.currentTime > 2));
  const time = await dialog.locator(".sequence-preview-controls output").textContent();
  expect(Number(time!.split(" / ")[0])).toBeGreaterThan(1.6);
  expect(await page.evaluate(() => (window as any).audioTest.seeks.filter(s => s.from - s.to > 0.18))).toEqual([]);
  await dialog.getByRole("button", { name: "Pause preview", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).audioTest.players.every(a => a.paused))).toBe(true);
  await dialog.getByRole("button", { name: "Close export", exact: true }).click();
  expect(await page.evaluate(() => (window as any).audioTest.players.every(a => a.paused && !a.getAttribute("src")))).toBe(true);
});

test("scene preview plays only the active frame audio during transitions", async ({ page }) => {
  await page.evaluate(async () => {
    const { localStore, flushLocalStore, prepareLocalSave } = await (window as any).genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const project = workspace.projects.find(p => p.id === workspace.activeProjectId);
    const doc = project.pages.find(p => p.id === workspace.activePageId).canvas;
    const first = doc.elements.find(o => o.t === "frame");
    const clone = JSON.parse(JSON.stringify(first));
    clone.id = crypto.randomUUID();
    clone.n = "Second frame";
    clone.x = first.x + first.w + 40;
    clone.audioTracks = first.audioTracks.map(t => ({ ...t, id: crypto.randomUUID(), end: 4 }));
    first.scene = { duration: 4, transition: { type: "crossfade", duration: 0.5 } };
    clone.scene = { duration: 4 };
    first.audioTracks = first.audioTracks.map(t => ({ ...t, end: 4 }));
    doc.elements.push(clone);
    localStore.setItem("genie.workspace.v1", JSON.stringify(workspace));
    await flushLocalStore();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await page.getByRole("treeitem", { name: "Post 4:5 1", exact: true }).click();
  await page.getByRole("button", { name: "Toggle animation timeline", exact: true }).click();
  await page.evaluate(() => { (window as any).audioTest.delay = 240; });
  await page.getByRole("button", { name: "Preview scene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause scene preview", exact: true })).toBeVisible();
  await page.waitForFunction(() => (window as any).audioTest.players.some(a => !a.paused && a.currentTime > 1));
  // The next frame is visuals-only in scene preview; its tracks must not start.
  expect(await page.evaluate(() => (window as any).audioTest.players.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).audioTest.seeks.filter(s => s.from - s.to > 0.18))).toEqual([]);
});

test("export sequence keeps audio continuous across the first frame boundary", async ({ page }) => {
  await page.evaluate(async () => {
    const { localStore, flushLocalStore, prepareLocalSave } = await (window as any).genieSource("/src/lib/local-store.ts");
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const project = workspace.projects.find(p => p.id === workspace.activeProjectId);
    const doc = project.pages.find(p => p.id === workspace.activePageId).canvas;
    const first = doc.elements.find(o => o.t === "frame");
    const clone = JSON.parse(JSON.stringify(first));
    clone.id = crypto.randomUUID();
    clone.n = "Second frame";
    clone.x = first.x + first.w + 40;
    clone.audioTracks = first.audioTracks.map(t => ({ ...t, id: crypto.randomUUID(), end: 4 }));
    first.scene = { duration: 4 };
    clone.scene = { duration: 4 };
    first.audioTracks = first.audioTracks.map(t => ({ ...t, end: 4 }));
    doc.elements.push(clone);
    localStore.setItem("genie.workspace.v1", JSON.stringify(workspace));
    await flushLocalStore();
  });
  await page.reload();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export canvas", exact: true });
  await dialog.getByRole("button", { name: "MP4", exact: true }).click();
  await dialog.getByRole("button", { name: "Select all", exact: true }).click();
  await expect(dialog.locator(".sequence-preview-controls output")).toContainText("/ 8.40");
  await expect(dialog.getByRole("button", { name: "Play sequence", exact: true })).toBeEnabled();
  await page.evaluate(() => { (window as any).audioTest.delay = 240; });
  await dialog.getByRole("button", { name: "Play sequence", exact: true }).click();
  await page.waitForFunction(() => {
    const out = document.querySelector(".sequence-preview-controls output")?.textContent ?? "";
    return Number(out.split(" / ")[0]) > 5.0;
  });
  expect(await page.evaluate(() => (window as any).audioTest.seeks.filter(s => s.from - s.to > 0.18))).toEqual([]);
  const times = await page.evaluate(() => (window as any).audioTest.players.map(a => a.currentTime));
  expect(times).toHaveLength(2);
  expect(Math.min(...times)).toBeGreaterThan(0.3);
});

test("scene preview retains speed, loop and restart controls under slow visual updates", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle animation timeline", exact: true }).click();
  await page.getByRole("button", { name: "Playback settings", exact: true }).click();
  await page.getByRole("combobox", { name: "Playback speed", exact: true }).click();
  await page.getByRole("option", { name: "2× speed", exact: true }).click();
  await page.getByRole("button", { name: "Playback settings", exact: true }).click();
  await page.getByRole("button", { name: "Loop preview", exact: true }).click();
  await page.evaluate(() => { (window as any).audioTest.delay = 240; });
  await page.getByRole("button", { name: "Preview scene", exact: true }).click();
  await page.waitForFunction(() => (window as any).audioTest.players.some(a => !a.paused && a.playbackRate === 2 && a.currentTime > 2));
  await page.waitForFunction(() => (window as any).audioTest.seeks.some(s => s.from > 6 && s.to < 1));
  await expect(page.getByRole("button", { name: "Pause scene preview", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Return to start", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).audioTest.players.every(a => a.paused))).toBe(true);
  await expect(page.getByLabel("Playhead time", { exact: true })).toContainText("0:00.0 /");
  await page.getByRole("button", { name: "Preview scene", exact: true }).click();
  await page.waitForFunction(() => (window as any).audioTest.players.some(a => !a.paused && a.currentTime < 2));
});
