import {
  mergeCanvasAssets,
  validateCanvasAsset,
  type CanvasAsset,
} from "./canvas-assets";
import { localStore, useLocalStorageStatus } from "../lib/local-store";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  copy,
  parseDocument,
  uid,
  type CanvasDocument,
  type Element,
} from "./model";

export type Page = { id: string; name: string; canvas: CanvasDocument };
export type Project = {
  id: string;
  name: string;
  pages: Page[];
  uploads: Element[];
  assets?: CanvasAsset[];
  /** Retained only for reading older canvas backups. */
  conversationId?: string;
  activePageId?: string;
  versions?: CanvasVersion[];
};
type CanvasVersion = {
  id: string;
  number: number;
  name: string;
  at: string;
  pages: Page[];
};
export type Workspace = {
  version: 1;
  projects: Project[];
  activeProjectId: string;
  activePageId: string;
};
const workspaceKey = "genie.workspace.v1";
function newPage(name: string, canvas?: CanvasDocument): Page {
  return {
    id: uid(),
    name,
    canvas: canvas || {
      version: 1,
      metadata: { name, updatedAt: new Date().toISOString() },
      elements: [],
    },
  };
}
function newProject(name: string, canvas?: CanvasDocument): Project {
  return {
    id: uid(),
    name,
    versions: [],
    pages: [newPage("Page 1", canvas)],
    uploads: [],
  };
}
function migrateWorkspace(savedCanvas?: string | null): Workspace {
  let canvas: CanvasDocument;
  try {
    canvas = savedCanvas
      ? parseDocument(JSON.parse(savedCanvas))
      : newPage("Page 1").canvas;
  } catch {
    canvas = newPage("Page 1").canvas;
  }
  const project = newProject("Untitled canvas", canvas);
  return {
    version: 1,
    projects: [project],
    activeProjectId: project.id,
    activePageId: project.pages[0].id,
  };
}
function parseWorkspace(raw: unknown): Workspace {
  const w = raw as Workspace;
  if (w?.version !== 1 || !Array.isArray(w.projects) || !w.projects.length)
    throw new Error("Expected a canvas backup with pages.");
  const ids = new Set<string>();
  for (const project of w.projects) {
    if (
      !project.id ||
      ids.has(project.id) ||
      typeof project.name !== "string" ||
      !project.pages?.length
    )
      throw new Error("Invalid canvas.");
    ids.add(project.id);
    project.uploads ||= [];
    if (project.assets !== undefined) {
      if (!Array.isArray(project.assets)) throw Error("Invalid canvas assets.");
      project.assets = project.assets.map(validateCanvasAsset);
    }
    for (const page of project.pages) {
      if (!page.id || ids.has(page.id) || typeof page.name !== "string")
        throw new Error("Invalid page.");
      ids.add(page.id);
      page.canvas = parseDocument(page.canvas);
    }
    if (project.versions !== undefined) {
      if (!Array.isArray(project.versions))
        throw Error("Invalid canvas versions.");
      project.versions = project.versions.slice(-20).map((version) => {
        if (
          !version.id ||
          !Number.isInteger(version.number) ||
          !Array.isArray(version.pages) ||
          !version.pages.length ||
          typeof version.name !== "string" ||
          typeof version.at !== "string"
        )
          throw Error("Invalid canvas version.");
        const pageIds = new Set<string>();
        return {
          ...version,
          pages: version.pages.map((page) => {
            if (
              !page.id ||
              pageIds.has(page.id) ||
              typeof page.name !== "string"
            )
              throw Error("Invalid version page.");
            pageIds.add(page.id);
            return { ...page, canvas: parseDocument(page.canvas) };
          }),
        };
      });
    }
  }
  const project =
    w.projects.find((p) => p.id === w.activeProjectId) || w.projects[0];
  const page =
    project.pages.find((p) => p.id === w.activePageId) || project.pages[0];
  return { ...w, activeProjectId: project.id, activePageId: page.id };
}
export function useProjects() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      const saved = localStore.getItem(workspaceKey);
      if (saved) {
        return parseWorkspace(JSON.parse(saved));
      }
    } catch {
      /* Keep the previous storage entry available for recovery. */
    }
    return migrateWorkspace(localStore.getItem("genie.canvas"));
  });
  const [saveError, setStorageError] = useState("");
  const diskStatus = useLocalStorageStatus();
  const storageError = saveError || diskStatus.error;
  const [importRevision, setImportRevision] = useState(0);
  const latest = useRef(workspace);
  latest.current = workspace;
  useEffect(() => {
    const save = () => {
      try {
        localStore.setItem(workspaceKey, JSON.stringify(latest.current));
        setStorageError("");
        return true;
      } catch {
        setStorageError(
          "Could not save this canvas. Open Settings > Storage to retry or create a backup.",
        );
        return false;
      }
    };
    const timer = window.setTimeout(save, 250);
    const beforeUpdate = (event: Event) => {
      if (!save())
        (event as CustomEvent<{ errors: string[] }>).detail.errors.push(
          "Your canvases could not be saved. Export a backup or free local storage before installing.",
        );
    };
    window.addEventListener("beforeunload", save);
    window.addEventListener("genie:prepare-update", beforeUpdate);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", save);
      window.removeEventListener("genie:prepare-update", beforeUpdate);
    };
  }, [workspace]);
  const project = workspace.projects.find(
    (p) => p.id === workspace.activeProjectId,
  )!;
  const page = project.pages.find((p) => p.id === workspace.activePageId)!;
  const updatePage = useCallback((pageId: string, canvas: CanvasDocument) => {
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((p) => ({
        ...p,
        pages: p.pages.map((page) =>
          page.id === pageId ? { ...page, canvas } : page,
        ),
      })),
    }));
  }, []);
  function selectProject(id: string) {
    setWorkspace((w) => {
      const p = w.projects.find((p) => p.id === id);
      return p
        ? {
            ...w,
            activeProjectId: id,
            activePageId:
              p.pages.find((page) => page.id === p.activePageId)?.id ||
              p.pages[0].id,
          }
        : w;
    });
  }
  function selectPage(id: string) {
    setWorkspace((w) => {
      const project = w.projects.find((p) => p.id === w.activeProjectId);
      if (!project?.pages.some((page) => page.id === id)) return w;
      return {
        ...w,
        activePageId: id,
        projects: w.projects.map((p) =>
          p.id === project.id ? { ...p, activePageId: id } : p,
        ),
      };
    });
  }
  function createProject(name = "Untitled canvas", canvas?: CanvasDocument) {
    const p = newProject(name, canvas);
    setWorkspace((w) => ({
      ...w,
      projects: [...w.projects, p],
      activeProjectId: p.id,
      activePageId: p.pages[0].id,
    }));
    return p;
  }
  function duplicateProject() {
    const p = copy(project);
    p.id = uid();
    p.versions = [];
    p.name += " copy";
    p.pages = p.pages.map((page) => ({ ...page, id: uid() }));
    setWorkspace((w) => ({
      ...w,
      projects: [...w.projects, p],
      activeProjectId: p.id,
      activePageId: p.pages[0].id,
    }));
  }
  function renameProject(name: string) {
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((p) =>
        p.id === project.id ? { ...p, name } : p,
      ),
    }));
  }
  function renameProjectById(id: string, name: string) {
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  }
  function deleteProjectById(id: string) {
    setWorkspace((w) => {
      if (w.projects.length <= 1) return w;
      const projects = w.projects.filter((p) => p.id !== id);
      if (projects.length === w.projects.length) return w;
      const active =
        w.activeProjectId === id
          ? projects[0]
          : (projects.find((p) => p.id === w.activeProjectId) ?? projects[0]);
      return {
        ...w,
        projects,
        activeProjectId: active.id,
        activePageId:
          active.pages.find((page) => page.id === active.activePageId)?.id ??
          active.pages[0].id,
      };
    });
  }
  function deleteProject() {
    setWorkspace((w) => {
      if (w.projects.length <= 1) return w;
      const projects = w.projects.filter((p) => p.id !== project.id);
      return {
        ...w,
        projects,
        activeProjectId: projects[0].id,
        activePageId: projects[0].pages[0].id,
      };
    });
  }
  function createPage(duplicate = false) {
    const next = duplicate
      ? { ...copy(page), id: uid(), name: page.name + " copy" }
      : newPage(`Page ${project.pages.length + 1}`);
    setWorkspace((w) => ({
      ...w,
      activePageId: next.id,
      projects: w.projects.map((p) =>
        p.id === project.id ? { ...p, pages: [...p.pages, next] } : p,
      ),
    }));
  }
  function renamePage(name: string) {
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              pages: p.pages.map((pg) =>
                pg.id === page.id ? { ...pg, name } : pg,
              ),
            }
          : p,
      ),
    }));
  }
  function deletePage() {
    setWorkspace((w) => {
      if (project.pages.length <= 1) return w;
      const pages = project.pages.filter((p) => p.id !== page.id);
      return {
        ...w,
        activePageId: pages[0].id,
        projects: w.projects.map((p) =>
          p.id === project.id ? { ...p, pages } : p,
        ),
      };
    });
  }
  const addUploads = useCallback(
    (projectId: string, uploads: Element[]) =>
      setWorkspace((w) => ({
        ...w,
        projects: w.projects.map((p) =>
          p.id === projectId
            ? { ...p, uploads: [...p.uploads, ...uploads] }
            : p,
        ),
      })),
    [],
  );
  const addAssets = useCallback((projectId: string, assets: CanvasAsset[]) => {
    setWorkspace((workspace) => ({
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              assets: mergeCanvasAssets(
                project.assets || [],
                assets.map(validateCanvasAsset),
              ),
            }
          : project,
      ),
    }));
  }, []);
  const renameAsset = useCallback(
    (projectId: string, assetId: string, name: string) => {
      if (!name.trim()) throw Error("Enter an asset name.");
      setWorkspace((workspace) => ({
        ...workspace,
        projects: workspace.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                assets: (project.assets || []).map((asset) =>
                  asset.id === assetId
                    ? { ...asset, name: name.trim().slice(0, 160) }
                    : asset,
                ),
              }
            : project,
        ),
      }));
    },
    [],
  );
  const removeAsset = useCallback((projectId: string, assetId: string) => {
    setWorkspace((workspace) => ({
      ...workspace,
      projects: workspace.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              assets: (project.assets || []).filter(
                (asset) => asset.id !== assetId,
              ),
            }
          : project,
      ),
    }));
  }, []);
  function recordVersion(name: string, canvas = page.canvas, pageId = page.id) {
    setWorkspace((w) => ({
      ...w,
      projects: w.projects.map((p) => {
        if (p.id !== project.id) return p;
        const pages = p.pages.map((pg) =>
          pg.id === pageId ? { ...pg, canvas: copy(canvas) } : pg,
        );
        const versions = p.versions || [];
        const baseline = versions.length
          ? versions
          : [
              {
                id: uid(),
                number: 1,
                name: "Before first change",
                at: new Date().toISOString(),
                pages: copy(p.pages),
              },
            ];
        return {
          ...p,
          versions: [
            ...baseline,
            {
              id: uid(),
              number: baseline.at(-1)!.number + 1,
              name,
              at: new Date().toISOString(),
              pages: copy(pages),
            },
          ].slice(-20),
        };
      }),
    }));
  }
  function restoreVersion(id: string) {
    setWorkspace((w) => {
      const current = w.projects.find((p) => p.id === project.id)!;
      const version = current.versions?.find((v) => v.id === id);
      if (!version) return w;
      const versions = current.versions || [];
      const backup = {
        id: uid(),
        number: (versions.at(-1)?.number || 0) + 1,
        name: "Before restoring version " + version.number,
        at: new Date().toISOString(),
        pages: copy(current.pages),
      };
      const pages = copy(version.pages);
      return {
        ...w,
        activePageId: pages.some((p) => p.id === w.activePageId)
          ? w.activePageId
          : pages[0].id,
        projects: w.projects.map((p) =>
          p.id === current.id
            ? { ...p, pages, versions: [...versions, backup].slice(-20) }
            : p,
        ),
      };
    });
    setImportRevision((n) => n + 1);
  }
  return {
    workspace,
    project,
    page,
    storageError,
    importRevision,
    updatePage,
    selectProject,
    selectPage,
    createProject,
    duplicateProject,
    renameProject,
    renameProjectById,
    deleteProject,
    deleteProjectById,
    createPage,
    renamePage,
    deletePage,
    addUploads,
    addAssets,
    renameAsset,
    removeAsset,
    recordVersion,
    restoreVersion,
    importWorkspace: (value: unknown) => {
      const next = parseWorkspace(value);
      setWorkspace(next);
      setImportRevision((n) => n + 1);
    },
  };
}
export type Projects = ReturnType<typeof useProjects>;
