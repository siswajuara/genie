import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    genieSource(path: string): Promise<any>;
  }
}
function wavSpeech(text: string) {
  const samples = 8000 * 8;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  const chars = text.split("");
  return {
    src: `data:audio/mpeg;base64,${bytes.toString("base64")}`,
    alignment: {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => (i * 4) / chars.length),
      character_end_times_seconds: chars.map(
        (_, i) => ((i + 1) * 4) / chars.length,
      ),
    },
    characterCost: 20,
  };
}
test.beforeEach(async ({ page }) => {
  // Same module-source helper as presets.spec.ts: reuse the app's module URL
  // so persistence checks read the initialized store.
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance
        .getEntriesByType("resource")
        .reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (r) => r.abort());
  await page.route("**/api/genie-social/**", async (route) => {
    if (route.request().url().endsWith("/settings"))
      return route.fulfill({
        json: {
          data: {
            storage: "file",
            opencode: { url: "", model: "", mode: "local", tokenConfigured: false },
            elevenlabs: {
              configured: true,
              accounts: [{ id: "studio", name: "Studio", configured: true, enabled: true }],
            },
            buffer: { configured: false },
            zernio: { configured: false },
            accounts: [],
            organizations: [],
            profiles: [],
            issues: [],
          },
        },
      });
    const body = route.request().postDataJSON();
    if (body.action === "elevenlabs.speech")
      return route.fulfill({ json: { data: wavSpeech(body.payload.text) } });
    return route.fallback();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
});
test("tiktok karaoke visual check", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /Post 4:5/ }).click();
  await page.getByRole("tab", { name: "Narration", exact: true }).click();
  const panel = page.locator(".narration-panel");
  await panel
    .getByRole("textbox", { name: "Narration script", exact: true })
    .fill("Kunjungi siswajuara(dot)com sekarang ya.");
  await panel
    .getByRole("button", { name: "Generate narration", exact: true })
    .click();
  await expect(panel.getByText("Voice clips (1)")).toBeVisible();
  // Captions are generated with the narration but no longer have a dedicated
  // editing section; verify them through the persisted frame instead.
  const cueTexts = await page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    const project = w.projects.find((p) => p.id === w.activeProjectId);
    const frame = project.pages[0].canvas.elements.find(
      (el) => el.t === "frame",
    );
    return (frame.subtitles || []).map((cue) => cue.text);
  });
  expect(cueTexts).toEqual(["Kunjungi siswajuara.com", "sekarang ya."]);
  // The caption style section is always visible (no toggle).
  await panel.getByRole("button", { name: "TikTok", exact: true }).click();
  await panel.getByRole("button", { name: "Karaoke", exact: true }).click();
  await expect(panel.getByText("Outline width · 14%")).toBeVisible();
  await page.locator(".canvas-stage canvas").first().screenshot({ path: "/tmp/tiktok-caption.png" });
  await panel.screenshot({ path: "/tmp/tiktok-panel.png" });
});
