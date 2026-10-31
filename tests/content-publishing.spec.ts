import { expect, test, type Page } from "@playwright/test";
import { newTask } from "../src/content/task";

async function setup(
  page: Page,
  options: { schedule?: boolean; verified?: boolean; failure?: boolean } = {},
) {
  const doc = (name: string, elements: any[] = []) => ({
    version: 1,
    metadata: { name, updatedAt: "2026-10-31T00:00:00Z" },
    elements,
  });
  const frame = (id: string, n: string, x: number) => ({
    id,
    t: "frame",
    n,
    x,
    y: 0,
    w: 300,
    h: 300,
    fill: "#fff",
  });
  const workspace = {
    version: 1,
    activeProjectId: "unrelated-canvas",
    activePageId: "unrelated-page",
    projects: [
      {
        id: "unrelated-canvas",
        name: "Unrelated canvas",
        uploads: [],
        pages: [
          {
            id: "unrelated-page",
            name: "Editor context",
            canvas: doc("Unrelated", [
              frame("unrelated-frame", "Unrelated frame", 0),
            ]),
          },
        ],
      },
      {
        id: "task-canvas",
        name: "Content canvas",
        uploads: [],
        pages: [
          { id: "unused-page", name: "Another page", canvas: doc("Unused") },
          {
            id: "task-page",
            name: "Content frames",
            canvas: doc("Content", [
              frame("frame-1", "First lesson frame", 0),
              frame("frame-2", "Second lesson frame", 400),
            ]),
          },
        ],
      },
    ],
  };
  const verified = options.verified !== false;
  const task = newTask({
    id: "publishing-task",
    title: "Lesson from Content",
    caption: "Belajar pecahan bersama.",
    hashtags: "#SiswaJuara #Belajar",
    platform: "Threads",
    status: verified ? "Editing" : "Backlog",
    dueDate: options.schedule ? "2031-12-31" : "",
    checks: { answer: verified, visual: true, caption: true },
    canvasLink: {
      projectId: "task-canvas",
      pageId: "task-page",
      frameIds: ["frame-2", "frame-1"],
    },
  });
  const library = { tasks: [task], questions: [], references: [] };
  await page.addInitScript(
    ({ workspace, library }) => {
      localStorage.setItem("genie.workspace.v1", JSON.stringify(workspace));
      localStorage.setItem("genie.content.v1", JSON.stringify(library));
    },
    { workspace, library },
  );
  const calls: any[] = [];
  let published = false;
  const accounts = [
    {
      id: "account-1",
      key: "tebar:account-1",
      provider: "tebar",
      platform: "threads",
      name: "Content channel",
      username: "content",
      active: true,
      profileId: "school",
    },
  ];
  await page.route("**/api/genie-social/**", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const respond = (data: unknown) => route.fulfill({ json: { data } });
    if (route.request().url().endsWith("/settings"))
      return respond({
        storage: "file",
        tebar: { configured: true, profileId: "school" },
        elevenlabs: { configured: false, accounts: [] },
      });
    if (body.action === "accounts")
      return respond({ accounts, profiles: [], ownerKey: false, issues: [] });
    if (body.action === "usage.cached") return respond({ providers: {} });
    if (body.action === "upload") {
      expect(body.payload.confirmed).toBe(true);
      expect(body.payload.profileId).toBe("school");
      return respond({
        id: `media-${calls.filter((call) => call.action === "upload").length}`,
        type: "image",
      });
    }
    if (body.action === "publish") {
      expect(body.payload.confirmed).toBe(true);
      return respond({
        results: [
          {
            provider: "tebar",
            accountKey: "tebar:account-1",
            accountName: "Content channel",
            success: !options.failure,
            id: "tebar-post",
            status: options.failure
              ? "failed"
              : body.payload.mode === "schedule"
                ? "scheduled"
                : "pending",
            ...(options.failure ? { error: "Mock delivery failure" } : {}),
          },
        ],
      });
    }
    if (body.action === "posts")
      return respond({
        posts: published
          ? [
              {
                id: "tebar-post",
                provider: "tebar",
                accountId: "account-1",
                platform: "threads",
                content: "Belajar pecahan bersama.",
                status: "published",
                permalink: "https://threads.net/post/lesson",
              },
            ]
          : [],
        issues: [],
        nextCursor: null,
      });
    throw Error(`Unexpected provider action: ${JSON.stringify(body)}`);
  });
  await page.route("**/api/genie-assets/manifest", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) =>
    route.abort(),
  );
  await page.goto("/#content/task/" + task.id);
  await expect(
    page.getByRole("dialog", { name: "Detail tugas" }),
  ).toBeVisible();
  return {
    task,
    calls,
    markPublished: () => {
      published = true;
    },
  };
}
async function readTask(page: Page) {
  return page.evaluate(async () => {
    const { contentApi } = await import("/src/content/store.ts");
    return (await contentApi("/data")).tasks[0];
  });
}
async function openPublish(page: Page) {
  await page.getByRole("button", { name: "Buka Publish (Tebar)" }).click();
  await expect(
    page.getByRole("heading", { name: "Make your next post ready." }),
  ).toBeVisible();
}
async function confirmDialog(page: Page, schedule = false) {
  await page
    .locator(".publish-submit")
    .getByRole("button", {
      name: schedule ? "Schedule post" : "Publish now",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: schedule ? "Schedule this post?" : "Publish this post now?",
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("Content hands ordered frames and caption to the existing Tebar composer and reconciles actual delivery", async ({
  page,
}) => {
  const { calls, markPublished } = await setup(page);
  await openPublish(page);
  await expect(
    page.getByRole("textbox", { name: "Caption", exact: true }),
  ).toHaveValue("Belajar pecahan bersama.\n\n#SiswaJuara #Belajar");
  expect(
    calls.some((call) => ["upload", "publish"].includes(call.action)),
  ).toBe(false);
  const original = await page.evaluate(async () => {
    const { localStore } = await import("/src/lib/local-store.ts");
    const post = JSON.parse(localStore.getItem("genie.marketing.posts")!)[0];
    const workspace = JSON.parse(localStore.getItem("genie.workspace.v1")!);
    return {
      post,
      activeProjectId: workspace.activeProjectId,
      activePageId: workspace.activePageId,
    };
  });
  expect(original.post.media.map((media: any) => media.frameId)).toEqual([
    "frame-2",
    "frame-1",
  ]);
  expect(
    original.post.media.every(
      (media: any) =>
        media.projectId === "task-canvas" && media.pageId === "task-page",
    ),
  ).toBe(true);
  expect(original.activeProjectId).toBe("unrelated-canvas");
  expect(original.activePageId).toBe("unrelated-page");
  await page.getByRole("button", { name: /Content channel threads/ }).click();
  await page
    .getByRole("textbox", { name: "Caption", exact: true })
    .fill("Edited in Publish #Belajar");
  await page.getByRole("button", { name: "Back to Content task" }).click();
  await expect(
    page.getByText("Draft lokal · belum dikirim ke Tebar", { exact: false }),
  ).toBeVisible();
  await openPublish(page);
  await expect(
    page.getByRole("textbox", { name: "Caption", exact: true }),
  ).toHaveValue("Edited in Publish #Belajar");
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  const dialog = await confirmDialog(page);
  expect(
    calls.some((call) => ["upload", "publish"].includes(call.action)),
  ).toBe(false);
  await dialog.getByRole("button", { name: "Confirm & publish" }).click();
  await expect(dialog).toBeHidden();
  const publish = calls.find((call) => call.action === "publish");
  expect(publish.payload).toMatchObject({
    content: "Edited in Publish #Belajar",
    accountKeys: ["tebar:account-1"],
    mode: "now",
    media: [
      { id: "media-1", type: "image" },
      { id: "media-2", type: "image" },
    ],
  });
  expect(
    calls
      .filter((call) => call.action === "upload")
      .map((call) => call.payload.filename),
  ).toEqual(["Second lesson frame.png", "First lesson frame.png"]);
  expect((await readTask(page)).status).toBe("Editing");
  await page.getByRole("button", { name: "Back to Content task" }).click();
  await expect(
    page.getByText("Tebar · diterima, menunggu pengiriman", { exact: false }),
  ).toBeVisible();
  await openPublish(page);
  await expect(page.getByLabel("Delivery results")).toContainText(
    "Accepted · pending",
  );
  await page
    .locator(".publish-submit")
    .getByRole("button", { name: "Publish now", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "already has delivery results",
  );
  expect(calls.filter((call) => call.action === "publish")).toHaveLength(1);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Published & scheduled" }),
  ).toBeVisible();
  markPublished();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect
    .poll(async () => (await readTask(page)).status)
    .toBe("Published");
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.goto("/#content/task/publishing-task");
  await expect(
    page.getByText("Tebar · published", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Lihat posting" }),
  ).toHaveAttribute("href", "https://threads.net/post/lesson");
  await openPublish(page);
  await expect(page.getByLabel("Delivery results")).toContainText(
    "Accepted · published",
  );
  expect(calls.filter((call) => call.action === "publish")).toHaveLength(1);
});

test("local plans do not schedule; confirmed Tebar schedules update their Content task", async ({
  page,
}) => {
  const { calls } = await setup(page, { schedule: true });
  await openPublish(page);
  await page.getByRole("button", { name: /Content channel threads/ }).click();
  await page
    .getByRole("button", { name: "Save local plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Published & scheduled" }),
  ).toBeVisible();
  expect((await readTask(page)).status).toBe("Editing");
  expect(
    calls.some((call) => ["upload", "publish"].includes(call.action)),
  ).toBe(false);
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.goto("/#content/task/publishing-task");
  await expect(
    page.getByText("Rencana lokal · belum dikirim ke Tebar", { exact: false }),
  ).toBeVisible();
  await openPublish(page);
  const dialog = await confirmDialog(page, true);
  expect(
    calls.some((call) => ["upload", "publish"].includes(call.action)),
  ).toBe(false);
  await dialog.getByRole("button", { name: "Confirm & schedule" }).click();
  await expect(dialog).toBeHidden();
  expect(calls.find((call) => call.action === "publish").payload.mode).toBe(
    "schedule",
  );
  expect(
    calls.find((call) => call.action === "publish").payload.scheduledFor,
  ).toMatch(/^2031-12-31T/);
  expect((await readTask(page)).status).toBe("Scheduled");
});

test("unverified Content tasks cannot upload or publish even after composer confirmation", async ({
  page,
}) => {
  const { calls } = await setup(page, { verified: false });
  await openPublish(page);
  await page.getByRole("button", { name: /Content channel threads/ }).click();
  const dialog = await confirmDialog(page);
  await dialog.getByRole("button", { name: "Confirm & publish" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Verifikasi jawaban / akurasi",
  );
  expect(
    calls.some((call) => ["upload", "publish"].includes(call.action)),
  ).toBe(false);
  expect((await readTask(page)).status).toBe("Backlog");
});

test("Tebar failures stay visible on the originating Content task without advancing its stage", async ({
  page,
}) => {
  await setup(page, { failure: true });
  await openPublish(page);
  await page.getByRole("button", { name: /Content channel threads/ }).click();
  const dialog = await confirmDialog(page);
  await dialog.getByRole("button", { name: "Confirm & publish" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Back to Content task" }).click();
  await expect(
    page.getByText("Tebar · pengiriman perlu diperiksa", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Mock delivery failure", { exact: true }),
  ).toBeVisible();
  expect((await readTask(page)).status).toBe("Editing");
});

test("opening a task for publishing preserves another unfinished composer as a local draft", async ({
  page,
}) => {
  const { calls } = await setup(page);
  await page.goto("/#publish");
  await page
    .getByRole("textbox", { name: "Caption", exact: true })
    .fill("An unfinished unrelated post");
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.goto("/#content/task/publishing-task");
  await openPublish(page);
  const posts = await page.evaluate(async () => {
    const { localStore } = await import("/src/lib/local-store.ts");
    return JSON.parse(localStore.getItem("genie.marketing.posts")!);
  });
  expect(posts).toHaveLength(2);
  expect(
    posts.some(
      (post: any) =>
        !post.contentTaskId && post.caption === "An unfinished unrelated post",
    ),
  ).toBe(true);
  expect(
    posts.find((post: any) => post.contentTaskId === "publishing-task").caption,
  ).toContain("Belajar pecahan bersama.");
  expect(
    calls.some((call) => ["upload", "publish"].includes(call.action)),
  ).toBe(false);
});

test("delivery reconciliation matches every Tebar account and preserves uncertain or partial results", async ({
  page,
}) => {
  await setup(page);
  const statuses = await page.evaluate(async () => {
    const { reconcileContentDeliveries, taskPost } =
      await import("/src/content/publishing.ts");
    const { contentApi } = await import("/src/content/store.ts");
    const { localStore, flushLocalStore } =
      await import("/src/lib/local-store.ts");
    const task = (await contentApi("/data")).tasks[0];
    const post = taskPost(
      task,
      JSON.parse(localStore.getItem("genie.workspace.v1")!),
    );
    post.submissionId = "stable-request";
    post.delivery = [
      {
        provider: "tebar",
        accountKey: "tebar:account-1",
        accountName: "First",
        success: true,
        id: "shared-post",
        status: "scheduled",
      },
      {
        provider: "tebar",
        accountKey: "tebar:account-2",
        accountName: "Second",
        success: false,
        uncertain: true,
        id: "shared-post",
        error: "Uncertain response",
      },
    ];
    localStore.setItem("genie.marketing.posts", JSON.stringify([post]));
    await flushLocalStore();
    await reconcileContentDeliveries([
      {
        id: "shared-post",
        provider: "tebar",
        accountId: "wrong-account",
        content: "",
        status: "published",
      },
    ]);
    const wrong = JSON.parse(localStore.getItem("genie.marketing.posts")!)[0]
      .delivery;
    await reconcileContentDeliveries([
      {
        id: "shared-post",
        provider: "tebar",
        accountId: "account-1",
        content: "",
        status: "published",
      },
    ]);
    const partial = (await contentApi("/data")).tasks[0].status;
    await reconcileContentDeliveries([
      {
        id: "shared-post",
        provider: "tebar",
        accountId: "account-2",
        content: "",
        status: "failed",
        error: "Target failed",
      },
    ]);
    const failure = (await contentApi("/data")).tasks[0].status;
    await reconcileContentDeliveries([
      {
        id: "shared-post",
        provider: "tebar",
        accountId: "account-2",
        content: "",
        status: "published",
      },
    ]);
    const published = (await contentApi("/data")).tasks[0].status;
    return { wrong, partial, failure, published };
  });
  expect(statuses.wrong[0].status).toBe("scheduled");
  expect(statuses.wrong[1].uncertain).toBe(true);
  expect(statuses.partial).toBe("Editing");
  expect(statuses.failure).toBe("Editing");
  expect(statuses.published).toBe("Published");
});
