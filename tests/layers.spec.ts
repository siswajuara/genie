import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    genieSource(path: string): Promise<any>;
  }
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
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:1423\/)/, (route) =>
    route.abort(),
  );
  await page.goto("/");
});

test("tree reorder keeps siblings in place", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { dropLayer } = await window.genieSource("/src/editor/scene.ts");
    const frame = (id: string) => ({ id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100 });
    const layer = (id: string, fid?: string) => ({ id, t: "rect", n: id, x: 0, y: 0, w: 10, h: 10, fid });
    const ids = (els: any[]) => els.map((o) => `${o.id}:${o.fid ?? "-"}`);
    const els = [frame("f1"), layer("a", "f1"), layer("b", "f1"), layer("c", "f1")];
    // drop b onto a -> b already right after a: no change.
    const same = dropLayer(els, ["b"], "a");
    // drop c onto a -> c moves right after a.
    const moved = dropLayer(els, ["c"], "a");
    return { sameJson: JSON.stringify(same) === JSON.stringify(els), moved: ids(moved) };
  });
  expect(result.sameJson).toBe(true);
  expect(result.moved).toEqual(["f1:-", "a:f1", "c:f1", "b:f1"]);
});

test("dropping a layer on another frame moves it there", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { dropLayer } = await window.genieSource("/src/editor/scene.ts");
    const frame = (id: string) => ({ id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100 });
    const layer = (id: string, fid?: string) => ({ id, t: "rect", n: id, x: 0, y: 0, w: 10, h: 10, fid });
    const ids = (els: any[]) => els.map((o) => `${o.id}:${o.fid ?? "-"}`);
    const els = [frame("f1"), layer("a", "f1"), frame("f2"), layer("b", "f2")];
    return ids(dropLayer(els, ["a"], "f2"));
  });
  // a leaves f1 and lands after f2's existing children
  expect(result).toEqual(["f1:-", "f2:-", "b:f2", "a:f2"]);
});

test("dropping a layer on a row in another frame adopts that frame", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { dropLayer } = await window.genieSource("/src/editor/scene.ts");
    const frame = (id: string) => ({ id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100 });
    const layer = (id: string, fid?: string) => ({ id, t: "rect", n: id, x: 0, y: 0, w: 10, h: 10, fid });
    const ids = (els: any[]) => els.map((o) => `${o.id}:${o.fid ?? "-"}`);
    const els = [frame("f1"), layer("a", "f1"), layer("b", "f1"), frame("f2"), layer("c", "f2")];
    return ids(dropLayer(els, ["a"], "c"));
  });
  // a moves into f2 right after c
  expect(result).toEqual(["f1:-", "b:f1", "f2:-", "c:f2", "a:f2"]);
});

test("dropping on empty canvas moves layers out to the top level", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { dropLayer } = await window.genieSource("/src/editor/scene.ts");
    const frame = (id: string) => ({ id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100 });
    const layer = (id: string, fid?: string, gid?: string) => ({ id, t: "rect", n: id, x: 0, y: 0, w: 10, h: 10, fid, gid });
    const els = [frame("f1"), layer("a", "f1", "g1"), layer("b", "f1"), frame("f2")];
    return dropLayer(els, ["a", "b"], "").map((o: any) => [o.id, o.fid ?? null, o.gid ?? null]);
  });
  expect(result).toEqual([
    ["f1", null, null],
    ["f2", null, null],
    ["a", null, null],
    ["b", null, null],
  ]);
});

test("self drops and frame nesting are refused", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { dropLayer } = await window.genieSource("/src/editor/scene.ts");
    const frame = (id: string) => ({ id, t: "frame", n: id, x: 0, y: 0, w: 100, h: 100 });
    const layer = (id: string, fid?: string) => ({ id, t: "rect", n: id, x: 0, y: 0, w: 10, h: 10, fid });
    const els = [frame("f1"), layer("a", "f1"), layer("b", "f1")];
    const same = (out: any[]) => JSON.stringify(out) === JSON.stringify(els);
    return {
      selfSame: same(dropLayer(els, ["a"], "a")),
      nestedSame: same(dropLayer(els, ["f1"], "a")),
      frameSelfSame: same(dropLayer(els, ["f1"], "f1")),
    };
  });
  expect(result).toEqual({ selfSame: true, nestedSame: true, frameSelfSame: true });
});
