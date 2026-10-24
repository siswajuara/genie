import { beforeEach, expect, test } from "bun:test";
import {
  migrateConversations,
  newProject,
  parseWorkspace,
  workspaceKey,
  type Workspace,
} from "../src/editor/projects";

const records = new Map<string, string>();
beforeEach(() => {
  records.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return records.size;
      },
      key: (index: number) => [...records.keys()][index] ?? null,
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
    },
  });
});
function legacy(): Workspace {
  const project = newProject("Old project");
  delete project.conversationId;
  return {
    version: 1,
    projects: [project],
    activeProjectId: project.id,
    activePageId: project.pages[0].id,
  };
}
test("legacy chats sharing a page migrate to distinct canvases and remain stable after reload", () => {
  const source = legacy(),
    scope = `${source.activeProjectId}-${source.activePageId}`;
  for (const key of ["chat-a", "chat-b"])
    localStorage.setItem(
      `genie.conversation.${key}`,
      JSON.stringify({
        key,
        scope,
        messages: [{ role: "user", text: key }],
        updatedAt: new Date().toISOString(),
      }),
    );
  const migrated = migrateConversations(source);
  expect(migrated.projects).toHaveLength(2);
  expect(new Set(migrated.projects.map((p) => p.conversationId)).size).toBe(2);
  expect(migrated.projects[0].pages[0].id).not.toBe(
    migrated.projects[1].pages[0].id,
  );
  const reloaded = migrateConversations(
    parseWorkspace(JSON.parse(localStorage.getItem(workspaceKey)!)),
  );
  expect(reloaded.projects.map((p) => p.id)).toEqual(
    migrated.projects.map((p) => p.id),
  );
  for (const canvas of reloaded.projects)
    expect(
      JSON.parse(
        localStorage.getItem(`genie.conversation.${canvas.conversationId}`)!,
      ).scope,
    ).toBe(canvas.id);
});
test("canvas versions retain all pages and pass backup validation", () => {
  const source = legacy(),
    canvas = source.projects[0];
  canvas.pages[0].canvas.elements = [
    {
      id: "scene",
      t: "frame",
      n: "Animated scene",
      x: 0,
      y: 0,
      w: 400,
      h: 300,
      scene: { duration: 6, transition: { type: "crossfade", duration: 0.5 } },
    },
    {
      id: "moving",
      t: "rect",
      n: "Moving layer",
      fid: "scene",
      x: 20,
      y: 20,
      w: 80,
      h: 80,
      animation: {
        start: 0.2,
        end: 6,
        enter: {
          preset: "zoom-3d",
          duration: 0.6,
          amount: 80,
          easing: "ease-out",
        },
      },
    },
  ];
  canvas.versions = [
    {
      id: "version",
      number: 1,
      name: "Chat update",
      at: new Date().toISOString(),
      pages: structuredClone(canvas.pages),
    },
  ];
  expect(
    parseWorkspace(JSON.parse(JSON.stringify(source))).projects[0].versions![0]
      .pages,
  ).toHaveLength(1);
  const restored = parseWorkspace(JSON.parse(JSON.stringify(source)))
    .projects[0];
  expect(restored.versions![0].pages[0].canvas.elements).toEqual(
    canvas.pages[0].canvas.elements,
  );
  expect(restored.pages[0].canvas.elements[0].scene?.duration).toBe(6);
  canvas.versions[0].pages = [];
  expect(() => parseWorkspace(source)).toThrow("Invalid canvas version");
});
