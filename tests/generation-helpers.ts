import type { Locator, Page } from "@playwright/test";
// Use the scene controls so tests keep exercising the current editor workflow.
export async function setSceneTypes(
  page: Page,
  dialog: Locator,
  types: string[],
) {
  while (
    (await dialog.locator(".generate-scene-card").count()) > types.length
  ) {
    await dialog.locator(".generate-scene-card").last().click();
    await dialog
      .getByRole("button", { name: "Remove this scene", exact: true })
      .click();
  }
  while ((await dialog.locator(".generate-scene-card").count()) < types.length)
    await dialog
      .getByRole("button", { name: "Add scene", exact: true })
      .click();
  for (const [i, type] of types.entries()) {
    await dialog.locator(".generate-scene-card").nth(i).click();
    await dialog
      .getByRole("combobox", { name: "Scene type", exact: true })
      .click();
    await page
      .getByRole("option", {
        name: type[0].toUpperCase() + type.slice(1),
        exact: true,
      })
      .click();
  }
  await dialog.locator(".generate-scene-card").first().click();
}
