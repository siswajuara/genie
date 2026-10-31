import { setSceneTypes } from "./generation-helpers";
import { expect, test, type Page } from "@playwright/test";

async function elements(page: Page) {
  return page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return w.projects
      .find((p: any) => p.id === w.activeProjectId)
      .pages.find((p: any) => p.id === w.activePageId).canvas.elements;
  });
}
function silentSpeech() {
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
  return {
    src: `data:audio/mpeg;base64,${bytes.toString("base64")}`,
    alignment: {
      characters: ["[warm] ", "Read", " ", "together."],
      character_start_times_seconds: [0, 0, 1, 2],
      character_end_times_seconds: [0, 1, 2, 3],
    },
    characterCost: 20,
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance
        .getEntriesByType("resource")
        .reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) =>
    route.abort(),
  );
});

async function mockProviders(
  page: Page,
  options: { failSecondSpeech?: boolean; audioConfigured?: boolean } = {},
) {
  const requests: any[] = [];
  let speechCount = 0;
  await page.route("**/api/genie-social/**", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const config = {
      storage: "file",
      opencode: { url: "", model: "", tokenConfigured: false, mode: "local" },
      tebar: { configured: false, profileId: "" },
      elevenlabs: {
        configured: options.audioConfigured !== false,
        accounts:
          options.audioConfigured === false
            ? []
            : [
                {
                  id: "studio",
                  name: "Studio",
                  configured: true,
                  enabled: true,
                },
              ],
      },
    };
    if (route.request().url().endsWith("/settings"))
      return route.fulfill({ json: { data: config } });
    if (body.action === "ai.models")
      return route.fulfill({
        json: {
          data: [
            { providerID: "opencode-go", id: "beam-free", name: "Beam Free" },
          ],
        },
      });
    if (body.action === "ai.generate") {
      return route.fulfill({
        json: {
          data: {
            post: {
              name: "Reading together",
              caption: "Ask your child about their story. Read together today.",
            },
            frames: body.payload.scenes.map((scene: any, index: number) => ({
              useCase: scene.useCase,
              title: `Reading scene ${index + 1}`,
              motionPlan: "build",
              texts: scene.slots.map((slot: any) => ({
                id: slot.id,
                text:
                  slot.role === "latex"
                    ? slot.example
                    : slot.role === "headline"
                      ? `Tip ${index + 1}`
                      : "1",
              })),
              physics: (scene.diagrams || []).map((diagram: any) => ({
                id: diagram.id,
                settings: diagram.example,
              })),
              narration:
                body.payload.narration && scene.narrate
                  ? "[warm] Read the story together, then ask your child what happened."
                  : "",
            })),
            model: { providerID: "opencode-go", id: "beam-free" },
            usage: null,
          },
        },
      });
    }
    if (body.action === "elevenlabs.voices")
      return route.fulfill({
        json: {
          data: {
            voices: [{ id: "testVoice123", name: "Test voice" }],
            hasMore: false,
          },
        },
      });
    if (body.action === "elevenlabs.speech") {
      speechCount++;
      if (options.failSecondSpeech && speechCount === 2)
        return route.fulfill({
          status: 400,
          json: { error: "Mock voice failure" },
        });
      return route.fulfill({ json: { data: silentSpeech() } });
    }
    return route.fulfill({
      json: {
        data: { accounts: [], profiles: [], ownerKey: false, issues: [] },
      },
    });
  });
  return requests;
}

test("generate, edit, and append frames; preserve existing frames and undo as one change", async ({
  page,
}) => {
  const requests = await mockProviders(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Generate frames" }),
  ).toBeVisible();
  await dialog
    .getByRole("switch", { name: "Narration", exact: true })
    .uncheck();
  await expect(
    dialog.getByRole("button", { name: "Generate frames" }),
  ).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("Help parents talk about reading with their children.");
  await expect(
    dialog.getByRole("button", { name: "Generate frames" }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Scene 2: Content", exact: true })
    .click();
  const recommended = await page.evaluate(async () => {
    const { loadPresetCatalog } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    const { sequenceTemplates, makeScenes, GENERATION_PRESETS } =
      await window.genieSource("/src/editor/generation.ts");
    return sequenceTemplates(
      (await loadPresetCatalog()).presets,
      makeScenes(GENERATION_PRESETS[0]),
      "Help parents talk about reading with their children.",
    )[1].name;
  });
  await expect(dialog.locator(".generate-template-trigger")).toContainText(
    recommended,
  );
  await setSceneTypes(page, dialog, ["cover", "explanation", "list"]);
  await dialog.getByRole("button", { name: "Change scene template" }).click();
  const picker = page.locator(".generate-template-picker");
  const templateCount = await page.evaluate(async () => {
    const { loadPresetCatalog } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    return (await loadPresetCatalog()).presets.filter(
      (entry: { kind: string }) => entry.kind === "template",
    ).length;
  });
  await expect(
    picker.getByRole("textbox", { name: "Search all templates" }),
  ).toHaveAttribute("placeholder", `Search ${templateCount} templates…`);
  await picker
    .getByRole("textbox", { name: "Search all templates" })
    .fill("essentials cover");
  // Search includes metadata and use cases; selecting a template overrides auto.
  await picker
    .getByRole("textbox", { name: "Search all templates" })
    .fill("Mulai dari satu bacaan");
  await picker
    .getByRole("button", { name: /Mulai dari satu bacaan/ })
    .last()
    .click();
  await expect(dialog.locator(".generate-template-trigger")).toContainText(
    "Selected template",
  );
  await dialog.getByRole("combobox", { name: "Output language" }).click();
  await page.getByRole("option", { name: "English", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Scene length" }).click();
  await page.getByRole("option", { name: "8 seconds", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: /What should this scene cover/ })
    .fill("A warm introduction");
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Frame name", exact: true }),
  ).toHaveValue("Reading scene 1");
  await expect(dialog.getByRole("combobox", { name: "Scene motion", exact: true })).toContainText("Build step by step");
  await dialog.getByRole("combobox", { name: "Scene motion", exact: true }).click();
  await page.getByRole("option", { name: "Reading pause", exact: true }).click();
  await page.screenshot({ path: "/tmp/genie-generate-review.png" });
  expect(requests.filter((r) => r.action === "ai.generate")).toHaveLength(1);
  const request = requests.find((r) => r.action === "ai.generate").payload;
  expect(request.language).toBe("en");
  expect(request.narration).toBe(false);
  expect(request.scenes[0]).toMatchObject({
    seconds: 8,
    note: "A warm introduction",
    tone: "warm",
  });
  expect(request.scenes).toHaveLength(3);
  await dialog
    .getByRole("textbox", { name: "Frame name", exact: true })
    .fill("Our reading scene");
  await dialog
    .getByRole("textbox", { name: "Post caption", exact: true })
    .fill("Our edited post caption.");
  await dialog
    .getByRole("button", { name: "Add 3 frames without audio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const before = await elements(page);
  expect(before.filter((o: any) => o.t === "frame")).toHaveLength(3);
  expect(before.some((o: any) => o.n === "Our reading scene")).toBe(true);
  const firstFrame = before.find((o: any) => o.t === "frame");
  const firstContent = before.filter((o: any) => o.fid === firstFrame.id && o.t === "text" && !o.brandRole);
  expect(firstContent.length).toBeGreaterThan(0);
  expect(firstContent.every((o: any) => o.animation.start === 0 && !o.animation.enter)).toBe(true);
  expect(before.some((o: any) => o.brandRole === "footer")).toBe(false);

  expect(before.find((o: any) => o.t === "frame").scene.duration).toBe(8);
  expect(
    before.filter((o: any) => o.brandRole === "handle").length,
  ).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await dialog
    .getByRole("switch", { name: "Narration", exact: true })
    .uncheck();
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("Create another simple reading tip for parents to try at home.");
  await setSceneTypes(page, dialog, ["content"]);
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Add 1 frame without audio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const after = await elements(page);
  expect(after.filter((o: any) => o.t === "frame")).toHaveLength(4);
  expect(after.slice(0, before.length)).toEqual(before);
  await page.getByRole("button", { name: /Undo/ }).first().click();
  expect(await elements(page)).toEqual(before);
  expect(requests.filter((r) => r.action === "elevenlabs.speech")).toHaveLength(
    0,
  );
  await page.reload();
  await expect(page.locator(".footer-meta")).toContainText("3 frames");
  expect(await elements(page)).toEqual(before);
  await page.getByRole("button", { name: "Back to Canvases" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByLabel("Caption", { exact: true })).toHaveValue(
    "Our edited post caption.",
  );
});

test("default narration calls ElevenLabs only for scenes with narration enabled", async ({
  page,
}) => {
  const requests = await mockProviders(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("switch", { name: "Narration", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByText("Write a script and generate ElevenLabs audio.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("Explain how parents can discuss a story with their child.");
  await setSceneTypes(page, dialog, ["cover", "explanation", "list"]);
  await dialog
    .getByRole("button", { name: "Scene 2: Explanation", exact: true })
    .click();
  await dialog
    .getByRole("switch", { name: "Narrate this scene", exact: true })
    .uncheck();
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Narration script", exact: true }),
  ).toHaveValue(/Read the story/);
  const request = requests.find((r) => r.action === "ai.generate").payload;
  expect(request.narration).toBe(true);
  expect(request.scenes.map((scene: any) => scene.narrate)).toEqual([
    true,
    false,
    true,
  ]);
  expect(requests.filter((r) => r.action === "elevenlabs.speech")).toHaveLength(
    0,
  );
  await dialog
    .getByRole("button", { name: "Add frames & generate voice", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(requests.filter((r) => r.action === "elevenlabs.speech")).toHaveLength(
    2,
  );
  const frames = (await elements(page)).filter((o: any) => o.t === "frame");
  expect(frames.map((frame: any) => frame.audioTracks?.length || 0)).toEqual([
    1, 0, 1,
  ]);
  expect(frames[1].voiceoverDraft.script).toBe("");
});

test("missing ElevenLabs account keeps narration scripts and requires explicit add without audio", async ({
  page,
}) => {
  const requests = await mockProviders(page, { audioConfigured: false });
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("Invite parents to read a short story together with their child.");
  await setSceneTypes(page, dialog, ["content"]);
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Narration script", exact: true }),
  ).toHaveValue(/Read the story/);
  await expect(
    dialog.getByText(/Connect an ElevenLabs account to generate voice/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Add frames & generate voice",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Add without audio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(requests.filter((r) => r.action === "elevenlabs.speech")).toHaveLength(
    0,
  );
  const frame = (await elements(page)).find((o: any) => o.t === "frame");
  expect(frame.voiceoverDraft.script).toContain("Read the story");
  expect(frame.audioTracks || []).toHaveLength(0);
});

test("voice failure preserves review and reuses completed audio on explicit retry", async ({
  page,
}) => {
  const requests = await mockProviders(page, { failSecondSpeech: true });
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("Create a short explanation for parents reading stories together.");
  await setSceneTypes(page, dialog, ["cover", "explanation", "list"]);
  await expect(
    dialog.getByRole("switch", { name: "Narration", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Load voices" }).click();
  await expect(
    dialog.getByRole("button", { name: "Load voices" }),
  ).toBeEnabled();
  await dialog
    .getByRole("combobox", { name: "Default voice", exact: true })
    .click();
  await page.getByRole("option", { name: "Test voice", exact: true }).click();
  const before = await elements(page);
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "Narration script", exact: true }),
  ).not.toBeEmpty();
  expect(
    requests.find((r) => r.action === "ai.generate").payload.narration,
  ).toBe(true);
  expect(requests.filter((r) => r.action === "elevenlabs.speech")).toHaveLength(
    0,
  );
  await dialog
    .getByRole("button", { name: "Add frames & generate voice", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText("Mock voice failure");
  expect(await elements(page)).toEqual(before);
  expect(requests.filter((r) => r.action === "elevenlabs.speech")).toHaveLength(
    2,
  );
  await dialog
    .getByRole("button", { name: "Add frames & generate voice", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  // Scene 1 was cached; only scene 2 is retried, then scene 3 is generated.
  const speech = requests.filter((r) => r.action === "elevenlabs.speech");
  expect(speech).toHaveLength(4);
  expect(speech.every((r) => r.payload.voiceId === "testVoice123")).toBe(true);
  const frames = (await elements(page)).filter((o: any) => o.t === "frame");
  expect(frames).toHaveLength(3);
  expect(
    frames.every(
      (frame: any) =>
        frame.scene.duration === 8 && frame.audioTracks.length === 1,
    ),
  ).toBe(true);
  expect(
    frames.every(
      (frame: any) =>
        frame.subtitles.length > 0 &&
        frame.subtitles.every((cue: any) => !cue.text.includes("[warm]")),
    ),
  ).toBe(true);
  const savedElements = await elements(page);
  expect(
    savedElements
      .filter((o: any) => o.fid && o.animation)
      .every((o: any) => o.animation.end === 8),
  ).toBe(true);
  // Space works with a timeline control focused, and does not type into fields.
  await page.getByRole("button", { name: "Toggle animation timeline" }).click();
  const timeline = page.getByRole("region", { name: "Animation timeline" });
  await timeline
    .getByRole("button", { name: "Return to start", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    timeline.getByRole("button", {
      name: "Pause animation (Space)",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    timeline.getByRole("button", {
      name: "Play animation (Space)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Canvas name", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    timeline.getByRole("button", {
      name: "Play animation (Space)",
      exact: true,
    }),
  ).toBeVisible();
});

test("existing narration extends content animations and repairs older blank tails", async ({
  page,
}) => {
  await mockProviders(page);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { resizeFrameTiming, syncNarrationTiming, evaluateAnimation } =
      await window.genieSource("/src/editor/animation.ts");
    const { parseDocument } = await window.genieSource("/src/editor/model.ts");
    const frame = {
      id: "frame",
      t: "frame",
      n: "Scene",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      scene: { duration: 6 },
    };
    const text = {
      id: "title",
      t: "text",
      n: "Title",
      fid: "frame",
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      text: "1",
      size: 20,
      animation: { start: 0, end: 6 },
    };
    const transient = {
      ...text,
      id: "transient",
      animation: { start: 0, end: 2 },
    };
    const footer = {
      ...text,
      id: "footer",
      brandRole: "footer",
      animation: undefined,
    };
    const resized = resizeFrameTiming(
      [frame, text, transient, footer],
      "frame",
      12,
    );
    const audio = {
      id: "audio",
      name: "Voice",
      src: "data:audio/mpeg;base64,AAAA",
      role: "voiceover",
      start: 0,
      end: 12,
      trimStart: 0,
      sourceDuration: 12,
      volume: 1,
      loop: false,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
    };
    const old = {
      version: 1,
      metadata: { name: "Old canvas", updatedAt: "" },
      elements: [
        { ...frame, scene: { duration: 12 }, audioTracks: [audio] },
        text,
        transient,
        footer,
      ],
    };
    const repaired = parseDocument(old);
    const pose = evaluateAnimation(
      repaired.elements.find((o: any) => o.id === "title"),
      10,
      12,
    );
    const muted = syncNarrationTiming([
      { ...frame, audioTracks: [{ ...audio, muted: true }] },
      text,
    ]);
    return {
      duration: resized[0].scene.duration,
      end: resized[1].animation.end,
      transient: resized[2].animation.end,
      visible: pose.opacity,
      repairedEnd: repaired.elements[1].animation.end,
      mutedDuration: muted[0].scene.duration,
    };
  });
  expect(result).toEqual({
    duration: 12,
    end: 12,
    transient: 2,
    visible: 1,
    repairedEnd: 12,
    mutedDuration: 6,
  });
});

test("inspector narration keeps content visible past the original duration", async ({
  page,
}) => {
  await mockProviders(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("switch", { name: "Narration", exact: true })
    .uncheck();
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill("A parent and a child read a short story together at home.");
  await setSceneTypes(page, dialog, ["content"]);
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Add 1 frame without audio", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("tab", { name: "Narration", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Narration script", exact: true })
    .fill("[warm] Read together.");
  await page
    .getByRole("button", { name: "Generate narration", exact: true })
    .click();
  await expect(page.getByText(/Narration added/)).toBeVisible();
  const result = await elements(page);
  const frame = result.find((o: any) => o.t === "frame");
  expect(frame.scene.duration).toBe(8);
  expect(
    result
      .filter((o: any) => o.fid === frame.id && o.animation)
      .every((o: any) => o.animation.end === 8),
  ).toBe(true);
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.locator("canvas").first().focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause animation (Space)", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Play animation (Space)", exact: true }),
  ).toBeVisible();
});

test("connection setup and scrolling stay usable on a small screen", async ({
  page,
}) => {
  const requests = await mockProviders(page);
  await page.setViewportSize({ width: 650, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Settings", exact: true }).click();
  await dialog.getByLabel(/Service URL/i).fill("http://127.0.0.1:4096");
  await dialog.getByLabel(/Service token/i).fill("mock-token");
  await dialog
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(
    "OpenCode settings saved.",
  );
  expect(
    requests.some((r) => r.provider === "opencode" && r.token === "mock-token"),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Load models", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText(
    "1 model available from the saved connection.",
  );
  await expect(dialog.getByLabel("Available models")).toContainText(
    "Beam Free",
  );
  expect(requests.filter((r) => r.action === "ai.generate")).toHaveLength(0);
  const geometry = await dialog.evaluate((el) => ({
    width: el.clientWidth,
    scrollWidth: el.scrollWidth,
    height: el.clientHeight,
    y: el.getBoundingClientRect().y,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.y).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: "/tmp/genie-generate-mobile.png" });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

for (const width of [1440, 900, 650, 390]) {
  test(`generation panels contain a scrolling filmstrip at ${width}px`, async ({
    page,
  }) => {
    await mockProviders(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "New Canvas", exact: true }).click();
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".generate-scene-card")).toHaveCount(6);
    for (const count of [5, 8]) {
      const geometry = await dialog.evaluate((el, count) => {
        const list = el.querySelector(".generate-scene-list")!;
        while (list.children.length < count)
          list.append(list.children[0].cloneNode(true));
        const panels = [
          el,
          el.querySelector(".generate-scenes")!,
          el.querySelector(".generate-scene-editor")!,
        ];
        const film = el.querySelector(
          ".generate-filmstrip > .ui-scroll-viewport",
        )!;
        film.scrollLeft = 100;
        const editor = el
          .querySelector(".generate-scene-editor")!
          .getBoundingClientRect();
        const right = el
          .querySelector(".generate-scenes")!
          .getBoundingClientRect().right;
        const leftView = el.querySelector(
          ".generate-inputs > .ui-scroll-viewport",
        )!;
        const rightView = el.querySelector(
          ".generate-scenes > .ui-scroll-viewport",
        )!;
        leftView.scrollTop = 100;
        const rightBefore = rightView.scrollTop;
        rightView.scrollTop = 100;
        return {
          panels: panels.map((panel) => ({
            width: panel.clientWidth,
            scroll: panel.scrollWidth,
          })),
          filmWidth: film.clientWidth,
          filmScroll: film.scrollWidth,
          offset: film.scrollLeft,
          editorRight: editor.right,
          right,
          independent:
            leftView.scrollTop > 0 &&
            rightBefore === 0 &&
            rightView.scrollTop > 0,
        };
      }, count);
      for (const panel of geometry.panels)
        expect(panel.scroll).toBeLessThanOrEqual(panel.width + 1);
      if (count === 8 || width !== 650) {
        expect(geometry.filmScroll).toBeGreaterThan(geometry.filmWidth);
        expect(geometry.offset).toBeGreaterThan(0);
      }
      expect(geometry.editorRight).toBeLessThanOrEqual(geometry.right + 1);
      if (width > 760 && count === 5) expect(geometry.independent).toBe(true);
    }
  });
}

test("template slots preserve chrome, join headlines, diversify scenes, and animate essentials", async ({
  page,
}) => {
  await mockProviders(page);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { initializeAssetLibrary } = await window.genieSource(
      "/src/editor/assets.ts",
    );
    await initializeAssetLibrary();
    const { loadPresetCatalog, loadPreset } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    const {
      textSlots,
      sequenceTemplates,
      makeScenes,
      GENERATION_PRESETS,
      prepareGenerationTemplates,
      fillGenerationTemplates,
      listItemCount,
    } = await window.genieSource("/src/editor/generation.ts");
    const { parsePresets } = await window.genieSource("/src/editor/model.ts");
    const { presets } = await loadPresetCatalog();
    const classic = await loadPreset(
      presets.find((p: any) => p.identifier === "sudah-lancar-membaca-4-5"),
    );
    // Older packs have no generation metadata and remain usable without migration.
    const legacy = {
      ...classic,
      objects: classic.objects.map(
        ({ generationRole, generationGroup, ...o }: any) => o,
      ),
    };
    const slots = textSlots(legacy);
    const scenes = makeScenes(GENERATION_PRESETS[0]);
    const entries = sequenceTemplates(presets, scenes, "reading comprehension");
    scenes[2].templateId = entries[0].identifier;
    const explicit = sequenceTemplates(
      presets,
      scenes,
      "reading comprehension",
    );
    const filled = (
      await fillGenerationTemplates(
        [legacy],
        [
          {
            title: "Reading",
            texts: slots.map((slot: any) => ({
              id: slot.id,
              text:
                slot.role === "headline"
                  ? "Baca lancar, sudah paham ceritanya?"
                  : "Ajak anak bercerita bersama.",
            })),
            narration: "",
          },
        ],
        [scenes[0]],
      )
    )[0];
    const essentials = presets.filter((p: any) =>
      p.identifier.startsWith("essentials-"),
    );
    const loaded = await prepareGenerationTemplates(essentials);
    const list = await loadPreset(
      presets.find((p: any) => p.identifier === "tanyakan-3-hal-ini-4-5"),
    );
    const headline = filled.objects.filter(
      (o: any) => o.generationGroup === "headline-1",
    );
    let invalidRole = false;
    try {
      parsePresets({
        ...legacy,
        objects: [{ ...legacy.objects[0], generationRole: "bad" }],
      });
    } catch {
      invalidRole = true;
    }
    return {
      slots,
      badge: filled.objects.find((o: any) =>
        o.text?.startsWith("SISWA JUARA  •"),
      )?.text,
      page: filled.objects.find((o: any) => o.generationRole === "page-number")
        ?.text,
      headline: headline.map((o: any) => o.text.replace(/\n/g, " ")).join(" "),
      separated: headline.every(
        (o: any, i: number) =>
          !i || headline[i - 1].y + headline[i - 1].h <= o.y,
      ),
      unique: new Set(entries.map((p: any) => p.identifier)).size,
      explicit:
        explicit[2].identifier === scenes[2].templateId &&
        explicit[0].identifier !== scenes[2].templateId,
      animated: loaded.map((p: any) => p.objects.some((o: any) => o.animation)),
      count: listItemCount(list),
      invalidRole,
    };
  });
  expect(result.slots).toHaveLength(3);
  expect(
    result.slots.filter((slot: any) => slot.role === "headline"),
  ).toHaveLength(1);
  expect(
    result.slots.some((slot: any) => /SISWA JUARA|^1\/5$/.test(slot.example)),
  ).toBe(false);
  expect(result.badge).toBe("SISWA JUARA  •  ORANG TUA PERLU TAHU");
  expect(result.page).toBe("1/1");
  expect(result.headline).toBe("Baca lancar, sudah paham ceritanya?");
  expect(result.separated).toBe(true);
  expect(result.unique).toBe(5);
  expect(result.explicit).toBe(true);
  expect(result.animated).toEqual(Array(7).fill(true));
  expect(result.count).toBe(3);
  expect(result.invalidRole).toBe(true);
});

test("review renders edited copy and identifies images that need manual filling", async ({
  page,
}) => {
  await mockProviders(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .fill(
      "Invite parents to observe a photo with their child and tell a story.",
    );
  await setSceneTypes(page, dialog, ["content"]);
  await dialog.getByRole("button", { name: "Change scene template" }).click();
  const picker = page.locator(".generate-template-picker");
  await picker
    .getByRole("textbox", { name: "Search all templates" })
    .fill("essentials image");
  await picker.getByRole("button", { name: /Cerita dalam gambar/ }).click();
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  const preview = dialog.getByRole("img", {
    name: "Generated scene 1 preview",
  });
  await expect(preview).toBeVisible();
  await expect(dialog.getByText(/These slots need your images/)).toBeVisible();
  await dialog.getByRole("button", { name: "Play scene motion", exact: true }).click();
  const motion = dialog.getByRole("img", { name: "Scene motion preview", exact: true });
  await expect(motion).toBeVisible();
  await expect.poll(async () => Number(await motion.getAttribute("data-time"))).toBeGreaterThan(0.1);
  await dialog.getByRole("button", { name: "Stop scene motion", exact: true }).click();
  await expect(preview).toBeVisible();

  const original = await preview.getAttribute("src");
  await dialog
    .getByRole("textbox", { name: /Headline/ })
    .fill("Tell your story");
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.getAttribute("src")).not.toBe(original);
});


test("scene motion plans keep cards synchronized, branding static, and render settings portable", async ({ page }) => {
  await mockProviders(page);
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { withGenerationMotion } = await window.genieSource("/src/editor/generation-motion.ts");
    const { parseDocument, applyPreset, initialDocument } = await window.genieSource("/src/editor/model.ts");
    const { evaluateAnimation } = await window.genieSource("/src/editor/animation.ts");
    const base = { name: "Two sides", kind: "template", W: 1080, H: 1080,
      objects: [
        { id: "paper", t: "rect", n: "Paper", x: 0, y: 0, w: 1080, h: 1080 },
        { id: "handle", t: "text", n: "Handle", x: 700, y: 30, w: 300, h: 50, brandRole: "handle", size: 32, text: "@siswajuaraofficial" },
        { id: "left-card", t: "rect", n: "Left card", x: 80, y: 300, w: 400, h: 400 },
        { id: "left-text", t: "text", n: "Left text", x: 100, y: 350, w: 300, h: 100, size: 32, text: "Before" },
        { id: "right-card", t: "rect", n: "Right card", x: 600, y: 300, w: 400, h: 400 },
        { id: "right-text", t: "text", n: "Right text", x: 620, y: 350, w: 300, h: 100, size: 32, text: "After" },
        { id: "visual", t: "img", n: "Visual", x: 620, y: 500, w: 200, h: 150 },
      ] };
    const original = JSON.stringify(base);
    const errors = [];
    for (const plan of ["hold", "build", "focus", "compare", "resolve"]) {
      const p = withGenerationMotion(base, plan, 6);
      if (JSON.stringify(p) !== JSON.stringify(withGenerationMotion(base, plan, 6))) errors.push("nondeterministic");
      if (p.objects[0] !== base.objects[0] || p.objects[1] !== base.objects[1]) errors.push("changed static layers");
      if (p.objects[2].animation.start !== p.objects[3].animation.start ||
          p.objects[4].animation.start !== p.objects[5].animation.start ||
          p.objects[4].animation.start !== p.objects[6].animation.start) errors.push("separated card cues");
      if (plan === "compare" && p.objects[2].animation.start >= p.objects[4].animation.start) errors.push("lost comparison order");
      if (plan === "hold" && p.objects.slice(2).some((o) => o.animation.enter || o.animation.start)) errors.push("lost reading pause");
      const doc = parseDocument(JSON.parse(JSON.stringify(applyPreset(initialDocument(), p))));
      for (const o of doc.elements.filter((o) => o.animation)) {
        const a = evaluateAnimation(o, 5.9, 6);
        if (a.opacity !== 1 || a.x || a.y || a.scale !== 1) errors.push("final state did not settle");
      }
    }
    return { errors, preserved: original === JSON.stringify(base), fallback: withGenerationMotion(base, undefined, 6) === base };
  });
  expect(result).toEqual({ errors: [], preserved: true, fallback: true });
});
