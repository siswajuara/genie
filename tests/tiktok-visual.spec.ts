import { expect, test } from "@playwright/test";
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
  await panel.getByRole("button", { name: /Captions ·/, exact: false }).click();
  await expect(
    panel.getByRole("textbox", { name: "Subtitle 1 text", exact: true }),
  ).toHaveValue("Kunjungi siswajuara.com");
  await expect(
    panel.getByRole("textbox", { name: "Subtitle 2 text", exact: true }),
  ).toHaveValue("sekarang ya.");
  await panel.getByRole("button", { name: "Style", exact: true }).click();
  await panel.getByRole("button", { name: "TikTok", exact: true }).click();
  await panel.getByRole("button", { name: "Karaoke", exact: true }).click();
  await expect(panel.getByText("Outline width · 14%")).toBeVisible();
  await page.locator(".canvas-stage canvas").first().screenshot({ path: "/tmp/tiktok-caption.png" });
  await panel.screenshot({ path: "/tmp/tiktok-panel.png" });
});
