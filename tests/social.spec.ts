import { expect, test, type Page } from "@playwright/test";

async function mockSocial(page: Page) {
  let settings = { storage: "file", tebar: { configured: true, profileId: "workspace-1" }, elevenlabs: { configured: false, accounts: [] } };
  const accounts = [
    { id: "threads-1", key: "tebar:threads-1", provider: "tebar", name: "Teaching studio", username: "teaching", platform: "threads", active: true, profileId: "workspace-1" },
    { id: "youtube-1", key: "tebar:youtube-1", provider: "tebar", name: "Learning videos", username: "learning", platform: "youtube", active: true, profileId: "workspace-1" },
  ];
  const discovery = { accounts, profiles: [{ id: "workspace-1", name: "School", is_default: true }], ownerKey: true, issues: [] };
  const calls: Record<string, unknown>[] = [];
  await page.route("**/api/genie-social/**", async (route) => {
    const body = route.request().postDataJSON(); calls.push(body);
    const respond = (data: unknown) => route.fulfill({ json: { data } });
    if (route.request().url().endsWith("/settings")) {
      if (body.provider) { expect(body.provider).toBe("tebar"); settings = { ...settings, tebar: { configured: !body.removeKey, profileId: body.profileId ?? settings.tebar.profileId } }; }
      return respond(settings);
    }
    if (body.action === "accounts") return respond(discovery);
    if (body.action === "test") return respond({ ...discovery, scopes: ["read", "write"] });
    if (body.action === "usage.cached") return respond({ providers: {} });
    if (body.action === "usage") return respond({ providers: { tebar: { observedAt: "2026-10-31T00:00:00Z", windows: [{ remaining: 68, limit: 70, resetAt: "2026-10-31T00:01:00Z" }] } } });
    if (body.action === "publishingLimit") return respond({ used: 2, limit: 100, remaining: 98 });
    if (body.action === "upload") { expect(body.payload.confirmed).toBe(true); return respond({ id: "media-1", type: "image" }); }
    if (body.action === "publish") {
      expect(body.payload.confirmed).toBe(true);
      return respond({ results: [{ provider: "tebar", accountKey: body.payload.accountKeys[0], accountName: "Teaching studio", success: true, id: "post-1", status: "pending" }] });
    }
    if (body.action === "posts") {
      const second = !!body.payload.cursor;
      return respond({ posts: [{ id: second ? "post-2" : "post-1", provider: "tebar", content: second ? "Second page post" : "First page post", status: "published", platform: "threads", accountId: "threads-1", permalink: "https://threads.net/post/1" }], issues: [], nextCursor: second ? null : "next-page" });
    }
    throw Error(`Unexpected social operation ${JSON.stringify(body)}`);
  });
  await page.route("**/api/genie-assets/manifest", (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your canvases, all in one place." })).toBeVisible();
  return calls;
}

test("settings has one Tebar connection, no Brand section, workspace selection and observed usage", async ({ page }) => {
  const calls = await mockSocial(page);
  await page.getByRole("button", { name: "Setting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tebar social accounts" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Settings sections" });
  await expect(nav.getByRole("button", { name: /Brand/ })).toHaveCount(0);
  await expect(page.getByText(/Buffer|Zernio/)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Tebar workspace" })).toHaveText("School");
  await page.getByRole("textbox", { name: "Tebar API key" }).fill("tb_live_mock");
  await page.getByRole("button", { name: "Save & test", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Connection verified" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Tebar API key" })).toHaveValue("");
  await page.getByRole("button", { name: "Fetch usage", exact: true }).click();
  await expect(page.getByText("68 / 70 requests remaining")).toBeVisible();
  await page.getByRole("button", { name: "Check posting quota" }).first().click();
  await expect(page.locator(".posting-quota")).toContainText("remaining98");
  expect(calls.filter((c) => c.action === "usage")).toHaveLength(1);
});

test("local draft save uploads nothing; confirmation sends ordered Tebar media IDs and account preview", async ({ page }) => {
  const calls = await mockSocial(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const caption = page.getByRole("textbox", { name: /Caption/ });
  await caption.fill("Lesson ready to share");
  await page.getByRole("button", { name: /Teaching studio threads/ }).click();
  await expect(page.locator(".social-preview-head strong")).toHaveText("Teaching studio");
  await page.locator('input[type="file"]').setInputFiles({ name: "lesson.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64") });
  await expect(page.getByRole("button", { name: "Preview lesson.png", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Draft saved" })).toBeVisible();
  expect(calls.some((c) => ["upload", "publish"].includes(String(c.action)))).toBe(false);
  await page.getByRole("button", { name: "Publish now", exact: true }).first().click();
  await page.locator(".publish-submit").getByRole("button", { name: "Publish now", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Publish this post now?" });
  await expect(dialog).toBeVisible();
  expect(calls.some((c) => ["upload", "publish"].includes(String(c.action)))).toBe(false);
  await dialog.getByRole("button", { name: "Confirm & publish" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Delivery results")).toContainText("Accepted · pending");
  const publication = calls.find((c) => c.action === "publish") as { payload: { media: unknown[]; accountKeys: string[]; mode: string } };
  expect(publication.payload.media).toEqual([{ id: "media-1", type: "image" }]);
  expect(publication.payload.accountKeys).toEqual(["tebar:threads-1"]);
  expect(calls.filter((c) => c.action === "upload")).toHaveLength(1);
});

test("YouTube requires explicit title and audience, and schedule feed follows Tebar cursors", async ({ page }) => {
  const calls = await mockSocial(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("textbox", { name: /Caption/ }).fill("A science lesson");
  await page.getByRole("button", { name: /Learning videos youtube/ }).click();
  await page.getByRole("button", { name: "Publish now", exact: true }).first().click();
  await page.locator(".publish-submit").getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("YouTube title and audience");
  await page.getByRole("textbox", { name: "Video title", exact: true }).fill("Our science lesson");
  await page.getByRole("combobox", { name: "Learning videos audience" }).click();
  await page.getByRole("option", { name: "Made for kids", exact: true }).click();
  await page.locator(".publish-submit").getByRole("button", { name: "Publish now", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Publish this post now?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  expect(calls.some((c) => c.action === "publish")).toBe(false);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByText("First page post", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more posts" }).click();
  await expect(page.getByText("Second page post", { exact: true })).toBeVisible();
  await expect(page.getByText("First page post", { exact: true })).toBeVisible();
  expect((calls.filter((c) => c.action === "posts")[1] as { payload: { cursor: string } }).payload.cursor).toBe("next-page");
});
