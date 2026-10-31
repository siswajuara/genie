import { expect, type Locator, type Page } from "@playwright/test";
export const compositionStory = {
  idea: "Read and discuss a story together",
  format: "Question and resolution",
  device: "A recurring book and blue question",
  look: "Warm paper and blue ink with varied framing",
  palette: ["#ffffff", "#0757ec", "#1b2a7a"],
};
export function composedScene(scene: any, index: number) {
  return {
    direction: {
      action: "The book becomes a question for the child.",
      framing: index % 2 ? "close" : "wide",
      bridge: "Return to the opening question with a new answer.",
    },
    composition: {
      background: "#ffffff",
      layers: [
        {
          type: "text",
          role: "headline",
          name: "Headline",
          text:
            scene.useCase === "closing"
              ? "Continue at siswajuara.com"
              : `Tip ${index + 1}`,
          x: 0,
          y: 0,
          w: 100,
          h: 24,
          fontSize: 6,
          weight: 800,
          align: "left",
          color: "#1b2a7a",
        },
        {
          type: "rect",
          name: "Blue stage",
          x: 10,
          y: 30,
          w: 80,
          h: 38,
          fill: "#eaf1ff",
          radius: 2,
        },
        {
          type: "text",
          name: "Idea",
          text: "Ask what happens next.",
          x: 15,
          y: 38,
          w: 70,
          h: 20,
          fontSize: 4.5,
          weight: 700,
          align: "center",
          color: "#0757ec",
        },
      ],
    },
  };
}
export async function approveScenes(dialog: Locator) {
  await expect(
    dialog.getByRole("navigation", { name: "Generation review steps" }),
  ).toBeVisible();
  for (const name of [
    "Approve story & check look",
    "Approve look & review storyboard",
    "Approve storyboard & preview motion",
  ]) {
    const button = dialog.getByRole("button", { name, exact: true });
    if (await button.count()) {
      await expect(button).toBeEnabled();
      await button.click();
      await expect(button).toHaveCount(0);
    }
  }
  await expect(
    dialog.getByRole("button", {
      name: /^(Add frames & generate voice|Add \d+ frames? without audio)$/,
    }),
  ).toBeVisible();
}
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
