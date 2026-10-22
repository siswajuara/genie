import { useCallback, useEffect, useRef, useState } from 'react';
import { copy, initialDocument, parseDocument, uid, type CanvasDocument, type Element } from './model';

export type Page = { id: string; name: string; canvas: CanvasDocument };
export type Project = { id: string; name: string; pages: Page[]; uploads: Element[] };
export type Workspace = { version: 1; projects: Project[]; activeProjectId: string; activePageId: string };
export const workspaceKey = 'genie.workspace.v1';
export function newPage(name: string, canvas?: CanvasDocument): Page {
  return { id: uid(), name, canvas: canvas || { version: 1, metadata: { name, updatedAt: new Date().toISOString() }, elements: [] } };
}
export function newProject(name: string, canvas?: CanvasDocument): Project {
  return { id: uid(), name, pages: [newPage('Page 1', canvas)], uploads: [] };
}
export function migrateWorkspace(savedCanvas?: string | null): Workspace {
  let canvas: CanvasDocument;
  try { canvas = savedCanvas ? parseDocument(JSON.parse(savedCanvas)) : initialDocument(); } catch { canvas = initialDocument(); }
  const project = newProject('My first project', canvas);
  return { version: 1, projects: [project], activeProjectId: project.id, activePageId: project.pages[0].id };
}
export function parseWorkspace(raw: unknown): Workspace {
  const w = raw as Workspace;
  if (w?.version !== 1 || !Array.isArray(w.projects) || !w.projects.length) throw new Error('Expected a workspace with projects.');
  const ids = new Set<string>();
  for (const project of w.projects) {
    if (!project.id || ids.has(project.id) || typeof project.name !== 'string' || !project.pages?.length) throw new Error('Invalid project.');
    ids.add(project.id);
    project.uploads ||= [];
    for (const page of project.pages) {
      if (!page.id || ids.has(page.id) || typeof page.name !== 'string') throw new Error('Invalid page.');
      ids.add(page.id);
      page.canvas = parseDocument(page.canvas);
    }
  }
  const project = w.projects.find(p => p.id === w.activeProjectId) || w.projects[0];
  const page = project.pages.find(p => p.id === w.activePageId) || project.pages[0];
  return { ...w, activeProjectId: project.id, activePageId: page.id };
}
export function useProjects() {
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try { const saved = localStorage.getItem(workspaceKey); if (saved) return parseWorkspace(JSON.parse(saved)); } catch { /* Keep the previous storage entry available for recovery. */ }
    return migrateWorkspace(localStorage.getItem('genie.canvas'));
  });
  const [storageError, setStorageError] = useState('');
  const [importRevision, setImportRevision] = useState(0);
  const latest = useRef(workspace); latest.current = workspace;
  useEffect(() => {
    const save = () => { try { localStorage.setItem(workspaceKey, JSON.stringify(latest.current)); setStorageError(''); } catch { setStorageError('Storage is full. Export your projects to keep a backup.'); } };
    const timer = window.setTimeout(save, 250);
    window.addEventListener('beforeunload', save);
    return () => { clearTimeout(timer); window.removeEventListener('beforeunload', save); };
  }, [workspace]);
  const project = workspace.projects.find(p => p.id === workspace.activeProjectId)!;
  const page = project.pages.find(p => p.id === workspace.activePageId)!;
  const updatePage = useCallback((pageId: string, canvas: CanvasDocument) => {
    setWorkspace(w => ({ ...w, projects: w.projects.map(p => ({ ...p, pages: p.pages.map(page => page.id === pageId ? { ...page, canvas } : page) })) }));
  }, []);
  function selectProject(id: string) { setWorkspace(w => { const p = w.projects.find(p => p.id === id); return p ? { ...w, activeProjectId: id, activePageId: p.pages[0].id } : w; }); }
  function selectPage(id: string) { setWorkspace(w => ({ ...w, activePageId: id })); }
  function createProject() { const p = newProject(`Project ${workspace.projects.length + 1}`); setWorkspace(w => ({ ...w, projects: [...w.projects, p], activeProjectId: p.id, activePageId: p.pages[0].id })); }
  function duplicateProject() {
    const p = copy(project); p.id = uid(); p.name += ' copy'; p.pages = p.pages.map(page => ({ ...page, id: uid() }));
    setWorkspace(w => ({ ...w, projects: [...w.projects, p], activeProjectId: p.id, activePageId: p.pages[0].id }));
  }
  function renameProject(name: string) { setWorkspace(w => ({ ...w, projects: w.projects.map(p => p.id === project.id ? { ...p, name } : p) })); }
  function deleteProject() { setWorkspace(w => { if (w.projects.length <= 1) return w; const projects = w.projects.filter(p => p.id !== project.id); return { ...w, projects, activeProjectId: projects[0].id, activePageId: projects[0].pages[0].id }; }); }
  function createPage(duplicate = false) {
    const next = duplicate ? { ...copy(page), id: uid(), name: page.name + ' copy' } : newPage(`Page ${project.pages.length + 1}`);
    setWorkspace(w => ({ ...w, activePageId: next.id, projects: w.projects.map(p => p.id === project.id ? { ...p, pages: [...p.pages, next] } : p) }));
  }
  function renamePage(name: string) { setWorkspace(w => ({ ...w, projects: w.projects.map(p => p.id === project.id ? { ...p, pages: p.pages.map(pg => pg.id === page.id ? { ...pg, name } : pg) } : p) })); }
  function deletePage() { setWorkspace(w => { if (project.pages.length <= 1) return w; const pages = project.pages.filter(p => p.id !== page.id); return { ...w, activePageId: pages[0].id, projects: w.projects.map(p => p.id === project.id ? { ...p, pages } : p) }; }); }
  const addUploads = useCallback((projectId: string, uploads: Element[]) => setWorkspace(w => ({ ...w, projects: w.projects.map(p => p.id === projectId ? { ...p, uploads: [...p.uploads, ...uploads] } : p) })), []);
  return { workspace, project, page, storageError, importRevision, updatePage, selectProject, selectPage, createProject, duplicateProject, renameProject, deleteProject, createPage, renamePage, deletePage, addUploads, importWorkspace: (value: unknown) => { const next = parseWorkspace(value); setWorkspace(next); setImportRevision(n => n + 1); } };
}
export type Projects = ReturnType<typeof useProjects>;
