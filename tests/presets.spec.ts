import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

declare global {
  interface Window {
    genieSource(path: string): Promise<any>;
  }
}

const packRoot = path.resolve("asset-packs/siswa-juara/pack");
test.beforeEach(async ({ page }) => {
  // Reuse the app's module URL, including Vite's HMR timestamp, so persistence
  // checks access the initialized store rather than creating another module copy.
  await page.addInitScript(() => {
    window.genieSource = (path) => {
      const resource = performance
        .getEntriesByType("resource")
        .reverse()
        .find((r) => new URL(r.name).pathname === path);
      return import(resource?.name || path);
    };
  });
  await page.route("**/api/genie-social/**", (route) =>
    route.fulfill({
      json: {
        data: {
          accounts: [],
          organizations: [],
          profiles: [],
          issues: [],
          storage: "file",
          buffer: { configured: false },
          zernio: { configured: false },
          elevenlabs: { configured: false, accounts: [] },
        },
      },
    }),
  );
  const manifest = JSON.parse(
    await fs.readFile(path.join(packRoot, "manifest.json"), "utf8"),
  );
  // Connect template files without artwork to exercise editable placeholders and
  // missing required media separately from the template catalog.
  await page.route("**/api/genie-assets/manifest", (route) =>
    route.fulfill({ json: { ...manifest, assets: [] } }),
  );
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New Canvas", exact: true }).click();
});

test("catalog is metadata only; browsing is lazy, searchable, and filtered without pagination", async ({
  page,
}) => {
  const jsonRequests: string[] = [];
  page.on("request", (r) => {
    if (
      /^presets\/.+\.json$/.test(
        new URL(r.url()).searchParams.get("path") || "",
      )
    )
      jsonRequests.push(r.url());
  });
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  const library = page.getByRole("region", { name: "Template library" });
  await expect(library.locator(".template-card")).toHaveCount(132);
  await expect(library.locator(".template-card img").first()).toBeVisible();
  expect(
    jsonRequests.map((u) =>
      new URL(u).searchParams.get("path")!.split("/").at(-1),
    ),
  ).toEqual(["catalog.json"]);
  await expect(
    library.getByText("132 templates", { exact: true }),
  ).toBeVisible();
  await expect(
    library.getByRole("button", { name: "Next template page" }),
  ).toHaveCount(0);
  await expect(
    library.getByRole("button", { name: "Previous template page" }),
  ).toHaveCount(0);
  await library.getByRole("combobox", { name: "Template use case" }).click();
  await page.getByRole("option", { name: "Question", exact: true }).click();
  await expect(library.locator(".template-card")).toHaveCount(11);
  await library
    .getByRole("textbox", { name: "Search templates" })
    .fill("studio question where");
  await expect(library.locator(".template-card")).toHaveCount(1);
  await expect(
    library.getByText("Kuis Kecil: Di Mana Rani?", { exact: true }),
  ).toBeVisible();
  await library.getByRole("button", { name: /Save favorite/ }).click();
  await library.getByRole("combobox", { name: "Template collection" }).click();
  await page.getByRole("option", { name: "Favorites", exact: true }).click();
  await expect(library.locator(".template-card")).toHaveCount(1);
  await library
    .getByRole("textbox", { name: "Search templates" })
    .fill("no such topic");
  await expect(
    library.getByText("No matching templates", { exact: true }),
  ).toBeVisible();
  await library
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  expect(jsonRequests).toHaveLength(1);
});

test("browser folder templates replace cached pack data and saved branding remains portable", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await expect(page.locator(".template-card")).toHaveCount(132);
  const catalog = JSON.parse(
    await fs.readFile(path.join(packRoot, "presets/catalog.json"), "utf8"),
  );
  const entry = catalog.presets.find(
    (p) => p.identifier === "essentials-cover",
  );
  const preset = JSON.parse(
    await fs.readFile(path.join(packRoot, "presets", entry.file), "utf8"),
  );
  const branding = JSON.parse(
    await fs.readFile(
      path.join(packRoot, "presets/shared/branding.json"),
      "utf8",
    ),
  );
  const files = [
    {
      path: "presets/catalog.json",
      text: JSON.stringify({
        version: 1,
        presets: [{ ...entry, name: "Folder template" }],
      }),
    },
    {
      path: `presets/${entry.file}`,
      text: JSON.stringify({ ...preset, name: "Folder template" }),
    },
    { path: "presets/shared/branding.json", text: JSON.stringify(branding) },
  ];
  const result = await page.evaluate(async (files) => {
    const assets = await window.genieSource("/src/editor/assets.ts");
    const templates = await window.genieSource("/src/editor/preset-catalog.ts");
    const prior = (await templates.loadPresetCatalog()).presets.find(
      (p) => p.identifier === "essentials-cover",
    );
    await templates.loadPreset(prior); // Populate JSON and branding caches from the first pack.
    const wrap = (path, text) => {
      const file = new File([text], path.split("/").at(-1));
      Object.defineProperty(file, "webkitRelativePath", {
        value: `pack/${path}`,
      });
      return file;
    };
    const manifest = {
      version: 1,
      id: "folder-pack",
      name: "Folder pack",
      assets: [],
      presets: files.map((file) => ({
        path: file.path,
        bytes: new Blob([file.text]).size,
      })),
    };
    const selected = [
      wrap("manifest.json", JSON.stringify(manifest)),
      ...files.map((file) => wrap(file.path, file.text)),
    ];
    await assets.connectBrowserAssetDirectory(selected);
    const next = await templates.loadPresetCatalog();
    const loaded = await templates.loadPreset(next.presets[0]);
    const changed = { count: next.presets.length, name: loaded.name };
    await assets.disconnectAssetDirectory();
    const after = await templates.loadPresetCatalog();
    const portable = await templates.loadPreset(loaded);
    // Media-only packs remain supported, and malformed template metadata is rejected.
    const { parseAssetManifest } = await window.genieSource(
      "/src/editor/asset-manifest.ts",
    );
    const errors = [];
    for (const entry of [
      { path: "presets/../secret.json", bytes: 2 },
      { path: "presets/oversize.json", bytes: 5 * 1024 * 1024 },
    ]) {
      try {
        parseAssetManifest({
          ...manifest,
          presets: [...manifest.presets, entry],
        });
      } catch {
        errors.push(true);
      }
    }
    let incomplete = false;
    try {
      await assets.connectBrowserAssetDirectory(selected.slice(0, -1));
    } catch {
      incomplete = true;
    }
    return {
      changed,
      disconnected: after.presets.length,
      portable: portable.objects.length === loaded.objects.length,
      errors,
      incomplete,
      legacy: parseAssetManifest({
        version: 1,
        id: "media",
        name: "Media",
        assets: [],
      }).assets.length,
    };
  }, files);
  expect(result).toEqual({
    changed: { count: 1, name: "Folder template" },
    disconnected: 0,
    portable: true,
    errors: [true, true],
    incomplete: true,
    legacy: 0,
  });
  await expect(page.locator(".template-card")).toHaveCount(0);
  await expect(
    page.getByText(/Connect an asset pack in Setting/),
  ).toBeVisible();
});

test("all catalog files validate and groups remain local", async ({ page }) => {
  const result = await page.evaluate(async () => {
    // @ts-ignore Vite serves source modules in the local test browser.
    const { loadPresetCatalog, loadPreset, parseCatalog } =
      await window.genieSource("/src/editor/preset-catalog.ts");
    // @ts-ignore
    const { applyPreset, parseDocument } = await window.genieSource(
      "/src/editor/model.ts",
    );
    const catalog = await loadPresetCatalog(),
      presets = [];
    for (const entry of catalog.presets) presets.push(await loadPreset(entry));
    const errors = [];
    for (const p of presets) {
      const doc = applyPreset(
        { version: 1, metadata: { name: "Test", updatedAt: "" }, elements: [] },
        p,
      );
      try {
        parseDocument(doc);
      } catch (e) {
        errors.push(`${p.name}: ${e}`);
      }
    }
    let invalid = false;
    try {
      parseCatalog({
        version: 1,
        presets: [
          { ...catalog.presets[0], thumbnail: "https://example.com/evil.png" },
        ],
      });
    } catch {
      invalid = true;
    }
    const groupPreset = {
      name: "Group",
      kind: "template",
      W: 100,
      H: 100,
      background: "#123456",
      objects: [
        { id: "a", t: "rect", n: "A", x: 0, y: 0, w: 20, h: 20, gid: "shared" },
        {
          id: "b",
          t: "rect",
          n: "B",
          x: 20,
          y: 0,
          w: 20,
          h: 20,
          gid: "shared",
        },
      ],
    };
    let grouped = applyPreset(
      { version: 1, metadata: { name: "Test", updatedAt: "" }, elements: [] },
      groupPreset,
    );
    grouped = applyPreset(grouped, groupPreset);
    const groups = new Set(
      grouped.elements.filter((o) => o.gid).map((o) => o.gid),
    );
    return {
      count: presets.length,
      references: presets
        .filter((p) => p.reference)
        .map((p) => p.reference.file),
      cases: [...new Set(presets.flatMap((p) => p.useCases))],
      errors,
      invalid,
      groups: groups.size,
      backgrounds: grouped.elements
        .filter((o) => o.t === "frame")
        .map((o) => o.fill),
    };
  });
  expect(result.count).toBe(132);
  expect(result.references).toEqual([]);
  expect(result.cases.sort()).toEqual([
    "answer",
    "closing",
    "content",
    "cover",
    "explanation",
    "image",
    "list",
    "question",
  ]);
  expect(result.errors).toEqual([]);
  expect(result.invalid).toBe(true);
  expect(result.groups).toBe(2);
  expect(result.backgrounds).toEqual(["#123456", "#123456"]);
});

test("remove unsuitable library presets, persist the choice, and restore without changing placed designs", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (
      /^presets\/.+\.json$/.test(
        new URL(r.url()).searchParams.get("path") || "",
      )
    )
      requests.push(r.url());
  });
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  const library = page.getByRole("region", { name: "Template library" });
  const search = library.getByRole("textbox", { name: "Search templates" });
  await search.fill("essentials cover");
  await library
    .getByRole("button", {
      name: "Preview Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add frame", exact: true })
    .click();
  await expect(page.locator(".footer-meta")).toContainText("1 frame");
  const before = await page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return w.projects
      .find((p) => p.id === w.activeProjectId)
      .pages.map((p) => p.canvas.elements);
  });
  await library
    .getByRole("button", {
      name: "Preview Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove from library", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(library.locator(".template-card")).toHaveCount(0);
  await search.fill("simulasi-ke-sekolah");
  await expect(library.locator(".template-card")).toHaveCount(1);
  const loaded = [...requests];
  await library
    .getByRole("button", {
      name: "Remove from library Simulasi di Sekolah",
      exact: true,
    })
    .click();
  await expect(library.locator(".template-card")).toHaveCount(0);
  expect(requests).toEqual(loaded);
  const persisted = await page.evaluate(async () => {
    const { prepareLocalSave, localStore } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return {
      removed: JSON.parse(localStore.getItem("genie.removed-presets.v1")),
      elements: w.projects
        .find((p) => p.id === w.activeProjectId)
        .pages.map((p) => p.canvas.elements),
    };
  });
  expect(persisted.removed).toEqual([
    "catalog:essentials-cover",
    "catalog:simulasi-ke-sekolah-4-5",
  ]);
  expect(persisted.elements).toEqual(before);
  await page.reload();
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await expect(
    library.getByText("130 templates", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".footer-meta")).toContainText("1 frame");
  await library.getByRole("combobox", { name: "Template collection" }).click();
  await page.getByRole("option", { name: "Removed", exact: true }).click();
  await expect(library.locator(".template-card")).toHaveCount(2);
  await search.fill("simulasi-ke-sekolah");
  await library
    .getByRole("button", { name: "Preview Simulasi di Sekolah", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Restore template", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore template", exact: true })
    .click();
  await expect(library.locator(".template-card")).toHaveCount(0);
  await search.fill("essentials cover");
  await library
    .getByRole("button", {
      name: "Restore Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  await expect(library.locator(".template-card")).toHaveCount(0);
  await library.getByRole("combobox", { name: "Template collection" }).click();
  await page
    .getByRole("option", { name: "Collection", exact: true })
    .click();
  await expect(library.locator(".template-card")).toHaveCount(1);
  await library.getByRole("combobox", { name: "Template collection" }).click();
  await page.getByRole("option", { name: "Removed", exact: true }).click();
  await expect(library.locator(".template-card")).toHaveCount(0);
  await expect(page.locator(".footer-meta")).toContainText("1 frame");
});

test("every library design inherits the supplied logo and footer as independent elements", async ({
  page,
}) => {
  const source = JSON.parse(
    await fs.readFile(
      path.join(packRoot, "presets/shared/branding.json"),
      "utf8",
    ),
  );
  const result = await page.evaluate(async () => {
    // @ts-ignore local source modules
    const { loadPresetCatalog, loadPreset } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    const catalog = await loadPresetCatalog();
    const presets = await Promise.all(catalog.presets.map(loadPreset));
    const branded = presets.filter((p) => p.branding);
    const positions = (p) =>
      p.objects
        .filter((o) => o.brandRole)
        .map(({ identifier, x, y, w, h }) => ({ identifier, x, y, w, h }));
    return {
      count: branded.length,
      positions: branded.map(positions),
      referenceErrors: presets
        .filter((p) => p.reference)
        .filter(
          (p) =>
            p.objects.some((o) => o.lock) ||
            p.objects.some((o) => o.n === "Reference artwork and ornaments") ||
            !p.objects.some((o) => o.identifier?.startsWith("surface-")) ||
            !p.objects.some((o) => o.t === "text" && !o.brandRole),
        )
        .map((p) => p.name),
    };
  });
  expect(result.count).toBe(132);
  const branding = source.objects.filter(
    (o) =>
      /^siswa-juara-logo-|^social-/.test(o.identifier) ||
      ["footer-pill", "website", "handle", "divider-1", "divider-2"].includes(
        o.identifier,
      ),
  );
  const expected = branding.map(({ identifier, x, y, w, h }) => ({
    identifier,
    x,
    y,
    w,
    h,
  }));
  for (const positions of result.positions) expect(positions).toEqual(expected);
  expect(result.referenceErrors).toEqual([]);
});

test("standard changes affect cached presets while existing canvas edits remain snapshots", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    // @ts-ignore
    const { loadPresetCatalog, loadPreset } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    // @ts-ignore
    const { setStandardFrame, resetStandardFrame } = await window.genieSource(
      "/src/editor/standard-branding.ts",
    );
    // @ts-ignore
    const { applyPreset, initialDocument, parseDocument } =
      await window.genieSource("/src/editor/model.ts");
    // @ts-ignore
    const { evaluateAnimation } = await window.genieSource(
      "/src/editor/animation.ts",
    );
    const entry = (await loadPresetCatalog()).presets.find(
      (p) => p.identifier === "essentials-cover",
    );
    const before = await loadPreset(entry);
    let doc = applyPreset(initialDocument(), before);
    const frame = doc.elements.find((o) => o.t === "frame");
    const headline = doc.elements.find((o) => o.n === "Headline");
    headline.text = "My local changes";
    headline.x += 17;
    const prior = JSON.stringify(doc);
    const custom = structuredClone(before);
    const logo = custom.objects.find((o) => o.brandRole === "logo");
    logo.x = 41;
    logo.y = 57;
    logo.w = 201;
    logo.h = 177;
    custom.objects.find((o) => o.identifier === "website").text =
      "www.example.test";
    custom.objects.push({
      ...custom.objects.find((o) => o.identifier === "website"),
      id: "new-footnote",
      identifier: "new-footnote",
      n: "New footnote",
      text: "An added footer element",
      x: 330,
      y: 1280,
      brandRole: "footer",
    });
    setStandardFrame(custom);
    const after = await loadPreset(entry);
    const applied = applyPreset(doc, after);
    const newFrame = applied.elements.filter((o) => o.t === "frame").at(-1);
    const newLogo = applied.elements.find(
      (o) => o.fid === newFrame.id && o.brandRole === "logo",
    );
    newLogo.animation = {
      start: 0,
      end: 6,
      enter: {
        preset: "slide-right",
        duration: 1,
        easing: "linear",
        amount: 50,
      },
    };
    const updated = parseDocument(JSON.parse(JSON.stringify(applied)));
    resetStandardFrame();
    return {
      unchanged: JSON.stringify(doc) === prior,
      oldLogoX:
        doc.elements.find((o) => o.fid === frame.id && o.brandRole === "logo")
          .x - frame.x,
      newLogo: [
        newLogo.x - newFrame.x,
        newLogo.y - newFrame.y,
        newLogo.w,
        newLogo.h,
      ],
      newWebsite: after.objects.find((o) => o.identifier === "website").text,
      newFootnote: after.objects.find((o) => o.identifier === "new-footnote")
        ?.text,
      restoredX: (await loadPreset(entry)).objects.find(
        (o) => o.brandRole === "logo",
      ).x,
      text: updated.elements.find((o) => o.id === headline.id).text,
      animation: evaluateAnimation(newLogo, 0.25, 6),
    };
  });
  expect(result.unchanged).toBe(true);
  expect(result.oldLogoX).toBe(0);
  expect(result.newLogo).toEqual([41, 57, 201, 177]);
  expect(result.newWebsite).toBe("www.example.test");
  expect(result.newFootnote).toBe("An added footer element");
  expect(result.restoredX).toBe(0);
  expect(result.text).toBe("My local changes");
  expect(result.animation.x).not.toBe(0);
});

test("pack contains no reconstructed reference artwork", async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(packRoot, "manifest.json"), "utf8"),
  );
  const catalog = JSON.parse(
    await fs.readFile(
      "asset-packs/siswa-juara/pack/presets/catalog.json",
      "utf8",
    ),
  );
  expect(catalog.presets).toHaveLength(132);
  expect(
    catalog.presets.some(
      (p) => p.reference || p.identifier.startsWith("reference-"),
    ),
  ).toBe(false);
  expect(
    manifest.assets.some((a) => a.id.startsWith("design-reference-reference-")),
  ).toBe(false);
  expect(manifest.presets.some((f) => f.path.includes("/designs/"))).toBe(
    false,
  );
  for (const entry of catalog.presets) {
    await fs.access(path.join(packRoot, "presets", entry.file));
    if (entry.thumbnail)
      await fs.access(path.join(packRoot, "presets", entry.thumbnail));
  }
  for (const file of manifest.presets) {
    await fs.access(path.join(packRoot, file.path));
  }
});

test("a failed preset fetch can be retried and a missing pack preserves the document", async ({
  page,
}) => {
  await page.route(
    "**/api/genie-assets/file?path=presets%2Fessentials%2Fessentials-cover.json",
    (route) => route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search templates" })
    .fill("essentials cover");
  await page
    .getByRole("button", {
      name: "Preview Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Mulai dari satu bacaan",
    exact: true,
  });
  await expect(dialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(dialog.getByRole("alert")).toContainText(
    "Template file is missing",
  );
  await dialog.getByRole("button", { name: "Close template preview" }).click();
  await page.unroute(
    "**/api/genie-assets/file?path=presets%2Fessentials%2Fessentials-cover.json",
  );
  await page
    .getByRole("button", {
      name: "Preview Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Add frame", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Add frame", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("1122");
  await page
    .getByRole("textbox", { name: "Search templates" })
    .fill("contoh-frame-standar");
  await page
    .getByRole("button", {
      name: "Preview contoh-frame-standar",
      exact: true,
    })
    .click();
  const reference = page.getByRole("dialog", {
    name: "contoh-frame-standar",
    exact: true,
  });
  await expect(reference.getByRole("alert")).toContainText(
    "Connect the Siswa Juara asset pack",
  );
  await expect(
    reference.getByRole("button", { name: "Add frame", exact: true }),
  ).toBeDisabled();
  await reference
    .getByRole("button", { name: "Close template preview" })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toHaveValue("1122");
});

test("save, reapply, and reload a local template without losing canvas context", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search templates" })
    .fill("essentials answer");
  await page
    .getByRole("button", { name: "Preview Temukan jawabannya", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add frame", exact: true })
    .click();
  await page.getByRole("button", { name: "Save frame", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Template name", exact: true })
    .fill("My answer layout");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search templates" })
    .fill("My answer layout");
  await expect(
    page.getByText("My answer layout", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview My answer layout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add frame", exact: true })
    .click();
  await expect(page.locator(".footer-meta")).toContainText("2 frames");
  const savedFrames = await page.evaluate(async () => {
    // @ts-ignore
    const { prepareLocalSave, localStore } = await window.genieSource(
      "/src/lib/local-store.ts",
    );
    await prepareLocalSave();
    const w = JSON.parse(localStore.getItem("genie.workspace.v1"));
    return w.projects
      .find((p) => p.id === w.activeProjectId)
      .pages.find((p) => p.id === w.activePageId)
      .canvas.elements.filter((o) => o.t === "frame").length;
  });
  expect(savedFrames).toBe(2);
  await page.reload();
  await expect(page.locator(".footer-meta")).toContainText("2 frames");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search templates" })
    .fill("My answer layout");
  await expect(
    page.getByRole("button", { name: "Preview My answer layout", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Width", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: /^Page 1/ }).click();
  await expect(page.locator(".footer-meta")).toContainText("2 frames");
});

test("Studio presets fit their copy, resolve separate artwork, animate, and generate portable frames", async ({
  page,
}) => {
  await page.unroute("**/api/genie-assets/manifest");
  const result = await page.evaluate(async () => {
    const { initializeAssetLibrary } = await window.genieSource(
      "/src/editor/assets.ts",
    );
    await initializeAssetLibrary();
    const { loadPresetCatalog, loadPreset } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    const {
      prepareGenerationTemplates,
      fillGenerationTemplates,
      textSlots,
      makeScenes,
      GENERATION_PRESETS,
    } = await window.genieSource("/src/editor/generation.ts");
    const { ensureDocumentFonts } =
      await window.genieSource("/src/lib/fonts.ts");
    const { applyPreset, parseDocument } = await window.genieSource(
      "/src/editor/model.ts",
    );
    const catalog = await loadPresetCatalog();
    const entries = catalog.presets.filter((p) => p.collection === "Studio");
    const originals = await Promise.all(entries.map(loadPreset));
    await ensureDocumentFonts(originals.flatMap((p) => p.objects));
    const ctx = document.createElement("canvas").getContext("2d");
    const overflow = [];
    for (const p of originals)
      for (const o of p.objects.filter((o) => o.t === "text" && !o.brandRole)) {
        ctx.font = `${o.weight || 800} ${o.size}px "${o.font}"`;
        const lines = o.text.split("\n");
        const width = Math.max(
          ...lines.map((line) =>
            [...line].reduce(
              (sum, char) => sum + ctx.measureText(char).width + (o.ls || 0),
              0,
            ),
          ),
        );
        const ink = Math.max(
          ...lines.map((line) => {
            const metrics = ctx.measureText(line);
            return (
              metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
            );
          }),
        );
        const height = (lines.length - 1) * o.size * (o.lh || 1.15) + ink;
        if (width > o.w + 1 || height > o.h + 1)
          overflow.push(
            `${p.identifier}: ${o.n} (${Math.ceil(width)}/${o.w}, ${Math.ceil(height)}/${o.h})`,
          );
      }
    const prepared = await prepareGenerationTemplates(entries);
    const scenes = entries.map((entry) => ({
      ...makeScenes(GENERATION_PRESETS[0])[0],
      useCase: entry.useCases[0],
    }));
    const generated = prepared.map((p, i) => ({
      useCase: scenes[i].useCase,
      title: `Studio scene ${i + 1}`,
      narration: "",
      texts: textSlots(p).map((slot) => ({
        id: slot.id,
        text: slot.role === "headline" ? `Baca bersama ${i + 1}` : "Baca.",
      })),
    }));
    const filled = await fillGenerationTemplates(prepared, generated, scenes);
    let doc = {
      version: 1,
      metadata: { name: "Studio", updatedAt: "" },
      elements: [],
    };
    for (const p of filled) doc = applyPreset(doc, p);
    const portable = parseDocument(JSON.parse(JSON.stringify(doc)));
    return {
      count: entries.length,
      cases: entries.map((p) => p.useCases[0]).sort(),
      overflow,
      thumbnails: entries.every((p) => !!p.thumbnail),
      layered: originals.every(
        (p) =>
          p.objects.some((o) => o.t === "rect") &&
          p.objects.some((o) => o.t === "text") &&
          p.requiredAssets.length === 1,
      ),
      resolved: prepared.every((p) =>
        p.requiredAssets.every((id) =>
          p.objects.some(
            (o) => o.identifier === id && o.src?.startsWith("data:image/"),
          ),
        ),
      ),
      animated: prepared.every((p) =>
        p.objects.some((o) => o.animation?.enter),
      ),
      placeholders: prepared
        .flatMap((p) => p.objects)
        .filter((o) => o.t === "img" && !o.src).length,
      fixed: filled.every((p, i) =>
        p.objects
          .filter((o) => o.generationRole === "fixed")
          .every(
            (o) =>
              o.text ===
              prepared[i].objects.find((prior) => prior.id === o.id).text,
          ),
      ),
      frames: portable.elements.filter((o) => o.t === "frame").length,
    };
  });
  expect(result.count).toBe(16);
  expect(result.cases).toEqual([
    "answer",
    "answer",
    "closing",
    "closing",
    "content",
    "content",
    "cover",
    "cover",
    "explanation",
    "explanation",
    "image",
    "image",
    "list",
    "list",
    "question",
    "question",
  ]);
  expect(result.overflow).toEqual([]);
  expect(result.thumbnails).toBe(true);
  expect(result.layered).toBe(true);
  expect(result.resolved).toBe(true);
  expect(result.animated).toBe(true);
  expect(result.placeholders).toBe(2);
  expect(result.fixed).toBe(true);
  expect(result.frames).toBe(16);
});

test("all presets adapt to each frame format without distorting their content or changing the source", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { loadPresetCatalog, loadPreset } = await window.genieSource(
      "/src/editor/preset-catalog.ts",
    );
    const { applyPreset, initialDocument, parseDocument } =
      await window.genieSource("/src/editor/model.ts");
    const { fitPresetToFrame } = await window.genieSource(
      "/src/editor/preset-layout.ts",
    );
    const catalog = await loadPresetCatalog();
    const errors = [];
    let checked = 0;
    for (const entry of catalog.presets) {
      const p = await loadPreset(entry);
      const original = JSON.stringify(p);
      for (const [w, h] of [
        [1122, 1402],
        [940, 1672],
        [1080, 1080],
        [1280, 720],
      ]) {
        const target = {
          id: "target",
          t: "frame",
          n: "Chosen frame",
          x: 123,
          y: 87,
          w,
          h,
        };
        const doc = { ...initialDocument(), elements: [target] };
        const replaced = parseDocument(applyPreset(doc, p, target.id, true));
        const frame = replaced.elements.find((o) => o.id === target.id);
        const fitted = fitPresetToFrame(p, { w, h });
        if (frame.w !== w || frame.h !== h || frame.x !== 123 || frame.y !== 87)
          errors.push(`${entry.identifier}: changed chosen frame`);
        const children = replaced.elements.filter((o) => o.fid === frame.id);
        for (const [index, layer] of p.objects.entries()) {
          const next = children[index];
          const preview = fitted.objects[index];
          if (
            !next ||
            Math.abs(next.x - frame.x - preview.x) > 0.001 ||
            Math.abs(next.y - frame.y - preview.y) > 0.001
          )
            errors.push(`${entry.identifier}: preview/application mismatch`);
          if (
            (layer.t === "text" || layer.t === "img" || layer.brandRole) &&
            layer.w &&
            layer.h &&
            Math.abs(next.w / layer.w - next.h / layer.h) > 0.001
          )
            errors.push(`${entry.identifier}: distorted ${layer.n}`);
          if (
            layer.t === "text" &&
            Math.abs(next.size / layer.size - next.w / layer.w) > 0.001
          )
            errors.push(`${entry.identifier}: incorrect font scale`);
        }
        const added = applyPreset(doc, p, target.id);
        const newFrame = added.elements.filter((o) => o.t === "frame").at(-1);
        if (
          newFrame.id === target.id ||
          newFrame.w !== w ||
          newFrame.h !== h ||
          added.elements[0].n !== target.n
        )
          errors.push(
            `${entry.identifier}: add frame lost chosen dimensions or edited the original`,
          );
        checked++;
      }
      if (JSON.stringify(p) !== original)
        errors.push(`${entry.identifier}: mutated source preset`);
    }
    return { count: catalog.presets.length, checked, errors };
  });
  expect(result.count).toBe(132);
  expect(result.checked).toBe(528);
  expect(result.errors).toEqual([]);
});

test("frame layout survives repeated resizing, reload, manual edits, and grouped element insertion", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { applyPreset, initialDocument, parseDocument } =
      await window.genieSource("/src/editor/model.ts");
    const { resizeFrameLayout } = await window.genieSource(
      "/src/editor/preset-layout.ts",
    );
    const { appendGeneratedFrames } = await window.genieSource(
      "/src/editor/generation.ts",
    );
    const p = {
      name: "Portable layout",
      kind: "template",
      W: 1000,
      H: 1200,
      objects: [
        { id: "paper", t: "rect", n: "Paper", x: 0, y: 0, w: 1000, h: 1200 },
        {
          id: "text",
          t: "text",
          n: "Text",
          x: 100,
          y: 300,
          w: 800,
          h: 200,
          text: "Keep my copy",
          size: 80,
          ls: 2,
          sh: 4,
          rot: 5,
        },
        {
          id: "logo",
          t: "img",
          n: "Logo",
          x: 20,
          y: 20,
          w: 100,
          h: 100,
          brandRole: "logo",
        },
        {
          id: "footer",
          t: "rect",
          n: "Footer",
          x: 100,
          y: 1100,
          w: 800,
          h: 50,
          brandRole: "footer",
        },
      ],
    };
    let doc = applyPreset(initialDocument(), p);
    const frameId = doc.elements[0].id;
    const before = JSON.stringify(doc.elements);
    const resize = (w, h, x, y) => {
      const frame = doc.elements.find((o) => o.id === frameId);
      doc.elements = resizeFrameLayout(doc.elements, frame, {
        ...frame,
        w,
        h,
        x: x ?? frame.x,
        y: y ?? frame.y,
      });
      doc = parseDocument(JSON.parse(JSON.stringify(doc)));
    };
    for (let i = 0; i < 3; i++) {
      resize(1280, 720);
      resize(940, 1672);
      resize(1000, 1200);
    }
    const roundTrip =
      JSON.stringify(doc.elements.map(({ responsiveLayout, ...o }) => o)) ===
      before;
    const text = doc.elements.find((o) => o.t === "text");
    text.text = "Edited locally";
    text.x += 25;
    const editedX = text.x;
    resize(500, 600, 200, 100);
    const movedText = doc.elements.find((o) => o.t === "text");
    const moved =
      movedText.x === 200 + (editedX - 20) / 2 &&
      movedText.text === "Edited locally";
    resize(1000, 1200, 20, 80);
    const editPreserved =
      doc.elements.find((o) => o.t === "text").x === editedX;
    const objectPreset = {
      name: "Grouped",
      kind: "object",
      objects: [
        {
          id: "a",
          gid: "pair",
          t: "rect",
          n: "Card",
          x: -500,
          y: 1200,
          w: 2000,
          h: 1000,
        },
        {
          id: "b",
          gid: "pair",
          t: "text",
          n: "Label",
          x: -400,
          y: 1300,
          w: 1800,
          h: 800,
          text: "Together",
          size: 100,
        },
      ],
    };
    const added = applyPreset(doc, objectPreset, frameId);
    const objects = added.elements.slice(-2);
    const k = objects[0].w / 2000;
    resize(700, 400);
    const generated = appendGeneratedFrames(
      doc,
      [p, p],
      [{}, {}],
      undefined,
      frameId,
    );
    return {
      roundTrip,
      moved,
      editPreserved,
      group: objects[0].gid === objects[1].gid && objects[0].gid !== "pair",
      relative: Math.abs((objects[1].x - objects[0].x) / k - 100) < 0.001,
      fits: objects.every(
        (o) => o.x >= 20 && o.y >= 80 && o.x + o.w <= 1020 && o.y + o.h <= 1280,
      ),
      generated:
        generated.ids.length === 2 &&
        generated.document.elements
          .filter((o) => generated.ids.includes(o.id))
          .every((o) => o.w === 700 && o.h === 400),
    };
  });
  expect(result).toEqual({
    roundTrip: true,
    moved: true,
    editPreserved: true,
    group: true,
    relative: true,
    fits: true,
    generated: true,
  });
});

test("selected frame size controls preset previews, replacement, insertion, and inspector resizing", async ({
  page,
}) => {
  await page.getByRole("button", { name: /Square 1080/ }).click();
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search templates" })
    .fill("essentials cover");
  await page
    .getByRole("button", {
      name: "Preview Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Automatically fits your selected frame: 1080 × 1080.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Replace selected frame", exact: true })
    .click();
  const width = page.getByRole("spinbutton", { name: "Width", exact: true });
  const height = page.getByRole("spinbutton", { name: "Height", exact: true });
  await expect(width).toHaveValue("1080");
  await expect(height).toHaveValue("1080");
  const read = () =>
    page.evaluate(async () => {
      const { prepareLocalSave, localStore } = await window.genieSource(
        "/src/lib/local-store.ts",
      );
      await prepareLocalSave();
      const workspace = JSON.parse(localStore.getItem("genie.workspace.v1"));
      return workspace.projects
        .find((p) => p.id === workspace.activeProjectId)
        .pages.find((p) => p.id === workspace.activePageId).canvas.elements;
    });
  const before = await read();
  const headline = before.find((o) => o.n === "Headline");
  const unlock = page.getByRole("button", {
    name: "Unlock aspect ratio",
    exact: true,
  });
  if (await unlock.count()) await unlock.click();
  await width.fill("1280");
  await width.press("Tab");
  await height.fill("720");
  await height.press("Tab");
  const resized = await read();
  const afterHeadline = resized.find((o) => o.id === headline.id);
  expect(afterHeadline.size).toBeLessThan(headline.size);
  expect(afterHeadline.text).toBe(headline.text);
  expect(resized.find((o) => o.n === "Paper").w).toBe(1280);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(height).toHaveValue("1080");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(height).toHaveValue("720");
  await page
    .getByRole("button", {
      name: "Preview Mulai dari satu bacaan",
      exact: true,
    })
    .click();
  await dialog.getByRole("button", { name: "Add frame", exact: true }).click();
  await expect(width).toHaveValue("1280");
  await expect(height).toHaveValue("720");
  await expect(page.locator(".footer-meta")).toContainText("2 frames");
  await read();
  await page.reload();
  await expect(page.locator(".footer-meta")).toContainText("2 frames");
  const restored = await read();
  expect(
    restored
      .filter((o) => o.t === "frame")
      .every((o) => o.w === 1280 && o.h === 720),
  ).toBe(true);
  expect(restored.find((o) => o.id === headline.id).text).toBe(headline.text);
});
