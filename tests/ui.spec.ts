import { expect, test } from "@playwright/test";

// No provider calls, paid generation, publishing, or local config mutations.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/genie-social/**", async (route) => {
    const body = route.request().postDataJSON();
    if (route.request().url().endsWith("/settings") && Object.keys(body).length === 0) {
      await route.fulfill({ json: { data: {
        storage: "file",
        buffer: { configured: false, organizationId: "" },
        zernio: { configured: false, profileId: "" },
        elevenlabs: { configured: false, accounts: [] },
      } } });
    } else if (["accounts", "elevenlabs.cached"].includes(body.action)) {
      await route.fulfill({ json: { data: { accounts: [], organizations: [], profiles: [], issues: [] } } });
    } else {
      throw new Error(`Unexpected provider operation: ${JSON.stringify(body)}`);
    }
  });
  await page.route("**/api/genie-assets/manifest", (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your canvases, all in one place." })).toBeVisible();
});

test("select keyboard navigation and dialog focus containment", async ({ page }) => {
  const sort = page.getByRole("combobox", { name: "Sort canvases" });
  await sort.click();
  await page.getByRole("option", { name: "Name A–Z" }).click();
  await expect(sort).toHaveText("Name A–Z");
  await sort.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");

  const help = page.getByRole("button", { name: "Help", exact: true });
  await help.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName("Create, publish, and schedule");
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
});

test("editor settings trap focus and edits survive navigation and reload", async ({ page }) => {
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  const name = page.getByRole("textbox", { name: "Canvas name", exact: true });
  await name.fill("Reusable UI check");
  await name.press("Tab");
  await page.getByRole("button", { name: /Square 1080/ }).click();
  await expect(page.getByRole("spinbutton", { name: "Width", exact: true })).toBeVisible();

  const settings = page.getByRole("button", { name: "Canvas settings", exact: true });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Canvas settings", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();

  await page.getByRole("button", { name: "Back to Canvases", exact: true }).click();
  await expect(page.getByText("Reusable UI check", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Open Reusable UI check/ }).click();
  await expect(name).toHaveValue("Reusable UI check");
  await expect(page.getByRole("spinbutton", { name: "Width", exact: true })).toHaveValue("1080");
  await page.reload();
  await expect(name).toHaveValue("Reusable UI check");
});

test("export nested select, checkbox, and slider remain inside the modal", async ({ page }) => {
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: /Square 1080/ }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export canvas", exact: true });
  await expect(dialog).toBeVisible();
  const transparent = dialog.getByRole("checkbox", { name: /Transparent/ });
  await transparent.check();
  await expect(transparent).toBeChecked();
  const format = dialog.getByRole("combobox", { name: "Export format" });
  await format.click();
  await page.getByRole("option", { name: /JPEG/ }).click();
  await expect(format).toHaveText(/JPEG/);
  const quality = dialog.getByRole("slider").first();
  await quality.focus();
  const previous = await quality.getAttribute("aria-valuenow");
  await quality.press("ArrowLeft");
  await expect(quality).not.toHaveAttribute("aria-valuenow", previous!);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("theme tokens and calendar popover work with keyboard controls", async ({ page }) => {
  await page.getByRole("button", { name: "Setting", exact: true }).click();
  await page.getByRole("button", { name: /Preferences/ }).click();
  await page.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(page.locator(".studio")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".studio")).toHaveCSS("background-color", "rgb(18, 20, 31)");
  await page.getByRole("radio", { name: "Light", exact: true }).click();
  await expect(page.locator(".studio")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const date = page.getByRole("button", { name: "Filter posts by date", exact: true });
  await date.click();
  const popover = page.getByRole("dialog", { name: "Filter posts by date", exact: true });
  await expect(popover.getByRole("grid")).toBeVisible();
  await popover.getByRole("button", { name: "Today", exact: true }).click();
  await expect(popover).toBeHidden();
  await expect(date).not.toHaveText(/Choose date/);
});
