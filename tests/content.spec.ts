import { expect, test, type Page } from "@playwright/test";

async function mockProviders(page: Page) {
  const requests: any[] = [];
  await page.route("**/api/genie-social/**", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (route.request().url().endsWith("/settings"))
      return route.fulfill({
        json: {
          data: {
            storage: "file",
            opencode: {
              url: "",
              model: "",
              tokenConfigured: false,
              mode: "local",
            },
            tebar: { configured: false, profileId: "" },
            elevenlabs: { configured: false, accounts: [] },
          },
        },
      });
    if (body.action === "ai.generate")
      return route.fulfill({
        json: {
          data: {
            post: {
              name: "Belajar pecahan",
              caption: "Dua dari empat sama dengan setengah.",
            },
            frames: body.payload.scenes.map((scene: any, i: number) => ({
              useCase: scene.useCase,
              title: `Pecahan ${i + 1}`,
              texts: scene.slots.map((slot: any) => ({
                id: slot.id,
                text:
                  slot.role === "latex"
                    ? slot.example
                    : slot.role === "headline"
                      ? `Tip ${i + 1}`
                      : "1",
              })),
              physics: (scene.diagrams || []).map((d: any) => ({
                id: d.id,
                settings: d.example,
              })),
              learning: (scene.learning || []).map((d: any) => ({
                id: d.id,
                settings: d.example,
              })),
              narration: "",
            })),
            model: { providerID: "opencode-go", id: "beam-free" },
            usage: null,
          },
        },
      });
    if (body.action === "ai.content-draft")
      return route.fulfill({
        json: {
          data: {
            script: {
              Problem: "Sulit memahami pecahan?",
              Agitate: "Lihat bagian yang sama.",
              Solve: "Dua dari empat adalah setengah.",
            },
            caption: "Belajar bersama.",
            hashtags: "#Belajar",
            prompt: "mock prompt",
            model: { providerID: "opencode-go", id: "beam-free" },
            usage: null,
          },
        },
      });
    return route.fulfill({
      json: {
        data: { accounts: [], profiles: [], ownerKey: false, issues: [] },
      },
    });
  });
  return requests;
}
async function studioData(page: Page) {
  return page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    return contentApi("/data");
  });
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/genie-content/legacy", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await mockProviders(page);
  await page.goto("/#content");
  await expect(
    page.getByRole("heading", { name: "Board konten", exact: true }),
  ).toBeVisible();
});

test("full source library, task saves, review gating, imports, and local persistence", async ({
  page,
}) => {
  const data = await studioData(page);
  expect(data.tasks).toHaveLength(50);
  expect(data.questions).toHaveLength(80);
  expect(data.tasks.every((t: any) => t.status === "Backlog")).toBe(true);
  await page.getByRole("link", { name: "Perpustakaan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Perpustakaan", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Coverage", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Coverage/ }).first(),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    const data = await contentApi("/data");
    const t = await contentApi("/tasks", "POST", {
      title: "Task tersimpan",
      framework: "PAS",
    });
    let gated = false;
    try {
      await contentApi("/tasks/" + t.id, "PATCH", { status: "Review" });
    } catch {
      gated = true;
    }
    await contentApi("/tasks/" + t.id, "PATCH", {
      checks: { answer: true, visual: false, caption: false },
      status: "Review",
    });
    let invalidated = false;
    try {
      await contentApi("/tasks/" + t.id, "PATCH", {
        questionIds: [data.questions[0].id],
      });
    } catch {
      invalidated = true;
    }
    await contentApi("/tasks/" + t.id, "PATCH", {
      title: "Task setelah edit",
      status: "Scripting",
      questionIds: [data.questions[0].id],
    });
    return { id: t.id, gated, invalidated };
  });
  expect(result.gated).toBe(true);
  expect(result.invalidated).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Coverage konten", exact: true }),
  ).toBeVisible();
  const saved = (await studioData(page)).tasks.find(
    (t: any) => t.id === result.id,
  );
  expect(saved.title).toBe("Task setelah edit");
  expect(saved.checks.answer).toBe(false);
  const workbook = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      "content/sources/Rencana_50_Konten_TKA_Storytelling_SiswaJuara.xlsx",
    ),
  );
  const imported = await page.evaluate(
    async (bytes) => {
      const { contentApi } = await import("/src/content/store.ts");
      const form = new FormData();
      form.set(
        "file",
        new File(
          [new Uint8Array(bytes)],
          "Rencana_50_Konten_TKA_Storytelling_SiswaJuara.xlsx",
        ),
      );
      return contentApi("/import", "POST", form);
    },
    [...workbook],
  );
  expect(imported.tasks).toBe(0);
  expect(imported.skipped).toBe(50);
});

test("task context opens linked canvas generation; review appends frames and survives navigation", async ({
  page,
}) => {
  const task = await page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    const data = await contentApi("/data");
    const t = await contentApi("/tasks", "POST", {
      title: "Belajar pecahan kelas 6",
      framework: "PAS",
    });
    return contentApi("/tasks/" + t.id, "PATCH", {
      script: {
        Problem: "Sulit memahami pecahan?",
        Agitate: "Lihat empat bagian yang sama.",
        Solve: "Dua dari empat adalah setengah.",
      },
      questionIds: [
        data.questions.find((q: any) => q.subject === "Matematika").id,
      ],
      accuracyNotes: "Pertahankan kunci jawaban.",
    });
  });
  await page.goto("/#content/task/" + task.id);
  await page.reload();
  const taskDialog = page.getByRole("dialog", { name: "Detail tugas" });
  await expect(taskDialog).toBeVisible();
  await taskDialog.getByRole("button", { name: "Draft dengan AI" }).click();
  await expect(taskDialog.getByText("Draf AI · perlu disunting")).toBeVisible();
  await taskDialog
    .getByRole("button", { name: "Generate frames di Canvas" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Generate frames" }),
  ).toBeVisible();
  const context = await dialog
    .getByRole("textbox", { name: "Learning content and context" })
    .inputValue();
  expect(context).toContain("Pertahankan kunci jawaban.");
  expect(context).toContain("Dua dari empat adalah setengah.");
  expect(context).toContain("explanation");
  await expect(dialog.locator(".generate-scene-card")).toHaveCount(3);
  await dialog
    .getByRole("switch", { name: "Narration", exact: true })
    .uncheck();
  await dialog
    .getByRole("button", { name: "Generate frames", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: /Add 3 frames/ }),
  ).toBeVisible();
  const before = await page.evaluate(async () => {
    const { localStore } = await import("/src/lib/local-store.ts");
    return JSON.parse(localStore.getItem("genie.workspace.v1")!).projects.at(-1)
      .pages[0].canvas.elements.length;
  });
  expect(before).toBe(0);
  await dialog.getByRole("button", { name: /Add 3 frames/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const { prepareLocalSave, localStore } =
          await import("/src/lib/local-store.ts");
        await prepareLocalSave();
        return JSON.parse(localStore.getItem("genie.workspace.v1")!)
          .projects.at(-1)
          .pages[0].canvas.elements.filter((e: any) => e.t === "frame").length;
      }),
    )
    .toBe(3);
  const link = (await studioData(page)).tasks.find(
    (t: any) => t.id === task.id,
  ).canvasLink;
  expect(link.frameIds).toHaveLength(3);
  await page.getByRole("button", { name: "Back to Canvases" }).click();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.goto("/#content/task/" + task.id);
  await page.reload();
  await taskDialog
    .getByRole("button", { name: "Buka canvas / Generate frames" })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Generate frames" }),
  ).toBeVisible();
  const after = await page.evaluate(async () => {
    const { localStore } = await import("/src/lib/local-store.ts");
    return JSON.parse(localStore.getItem("genie.workspace.v1")!)
      .projects.at(-1)
      .pages[0].canvas.elements.filter((e: any) => e.t === "frame").length;
  });
  expect(after).toBe(3);
});

test("content layout remains usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Tugas baru", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await page.getByRole("link", { name: "Perpustakaan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Perpustakaan", exact: true }),
  ).toBeVisible();
});

test("imports a standalone backup once and preserves its IDs and existing edits", async ({
  page,
}) => {
  const backup = await studioData(page);
  backup.tasks[0].title = "Naskah dari aplikasi Content sebelumnya";
  backup.tasks[0].script.Hook = "Perubahan lokal yang sudah disunting.";
  const originalId = backup.tasks[0].id;
  await page.route("**/api/genie-content/legacy", (route) =>
    route.fulfill({ json: backup }),
  );
  await page.evaluate(async () => {
    const { localStore, flushLocalStore } =
      await import("/src/lib/local-store.ts");
    localStore.removeItem("genie.content.v1");
    await flushLocalStore();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Board konten", exact: true }),
  ).toBeVisible();
  const migrated = await studioData(page);
  expect(migrated.tasks[0].id).toBe(originalId);
  expect(migrated.tasks[0].script.Hook).toBe(
    "Perubahan lokal yang sudah disunting.",
  );
  await page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    const data = await contentApi("/data");
    await contentApi("/tasks/" + data.tasks[0].id, "PATCH", {
      title: "Disunting lagi di Genie",
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Board konten", exact: true }),
  ).toBeVisible();
  expect((await studioData(page)).tasks[0].title).toBe(
    "Disunting lagi di Genie",
  );
});

test("AI drafting preserves changes made while a request is running and keeps failures editable", async ({
  page,
}) => {
  const task = await page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    return contentApi("/tasks", "POST", {
      title: "Draf yang sedang disunting",
      framework: "PAS",
      caption: "Caption awal",
    });
  });
  let release!: () => void;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/genie-social/request", async (route) => {
    if (route.request().postDataJSON().action !== "ai.content-draft")
      return route.fallback();
    started();
    await gate;
    return route.fulfill({
      json: {
        data: {
          script: {
            Problem: "Respons model.",
            Agitate: "Respons model.",
            Solve: "Respons model.",
          },
          caption: "Caption model",
          hashtags: "#AI",
          prompt: "Mock request",
          model: { providerID: "opencode-go", id: "beam-free" },
        },
      },
    });
  });
  const drafting = page.evaluate(async (id) => {
    const { draftTask } = await import("/src/content/store.ts");
    return draftTask(id);
  }, task.id);
  await startedPromise;
  await page.evaluate(async (id) => {
    const { contentApi } = await import("/src/content/store.ts");
    await contentApi("/tasks/" + id, "PATCH", {
      caption: "Caption yang disunting saat AI bekerja",
    });
  }, task.id);
  release();
  const result = await drafting;
  expect(result.state).toBe("saved-to-history");
  expect(result.task.caption).toBe("Caption yang disunting saat AI bekerja");
  expect(result.task.aiHistory).toHaveLength(1);
  await page.route("**/api/genie-social/request", (route) =>
    route.fulfill({ status: 400, json: { error: "Model unavailable" } }),
  );
  const error = await page.evaluate(async (id) => {
    const { draftTask } = await import("/src/content/store.ts");
    try {
      await draftTask(id);
      return "";
    } catch (error) {
      return String(error);
    }
  }, task.id);
  expect(error).toContain("Model unavailable");
  const saved = (await studioData(page)).tasks.find(
    (t: any) => t.id === task.id,
  );
  expect(saved.caption).toBe("Caption yang disunting saat AI bekerja");
  expect(saved.aiHistory).toHaveLength(1);
});

test("a task can target an existing canvas page without creating another canvas", async ({
  page,
}) => {
  const { task, target } = await page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    const { localStore, prepareLocalSave } =
      await import("/src/lib/local-store.ts");
    const task = await contentApi("/tasks", "POST", {
      title: "Gunakan canvas yang tersedia",
      framework: "HCIA",
    });
    await prepareLocalSave();
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1")!);
    return {
      task,
      target: [workspace.activeProjectId, workspace.activePageId],
    };
  });
  await page.goto("/#content/task/" + task.id);
  await page.reload();
  const dialog = page.getByRole("dialog", { name: "Detail tugas" });
  await dialog
    .getByRole("combobox", { name: "Canvas tujuan" })
    .selectOption(JSON.stringify(target));
  await dialog
    .getByRole("button", { name: "Generate frames di Canvas" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Generate frames", exact: true }),
  ).toBeVisible();
  const data = await studioData(page);
  expect(
    data.tasks.find((t: any) => t.id === task.id).canvasLink,
  ).toMatchObject({ projectId: target[0], pageId: target[1] });
  const count = await page.evaluate(async () => {
    const { prepareLocalSave, localStore } =
      await import("/src/lib/local-store.ts");
    await prepareLocalSave();
    return JSON.parse(localStore.getItem("genie.workspace.v1")!).projects
      .length;
  });
  expect(count).toBe(1);
});
