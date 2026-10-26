import { importVideoFile, defaultChromaKey } from "./editor/video";
import { SocialProvider } from "./social/client";
import { localStore } from "./lib/localStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "./editor/Canvas";
import { Inspector } from "./editor/Inspector";
import { useEditor } from "./editor/useEditor";
import { useProjects, type Projects } from "./editor/projects";
import { CanvasVersions } from "./components/CanvasVersions";
import { UpdateProvider, UpdateNotice } from "./components/AppUpdates";
import {
  elementKinds,
  frames,
  makeElement,
  parseDocument,
  parsePresets,
  presets,
  uid,
  type Element,
  type Preset,
} from "./editor/model";
import { saveExport, exportMessage } from "./lib/export";
import { Icon, type IconName } from "./components/ui/Icon";
import { ExportDialog } from "./editor/ExportDialog";
import { useAnimationPlayback } from "./editor/useAnimationPlayback";
import "./editor/animation.css";
import {
  MarketingWorkspace,
  type Module,
} from "./marketing/MarketingWorkspace";
import type { Editor } from "./editor/useEditor";
import {
  assetsOnCanvas,
  importImageFile,
  assetElement,
} from "./editor/canvasAssets";
import { AssetBrowser, personalLibraryAsset } from "./editor/AssetBrowser";
import { TemplateCard } from "./editor/TemplateCard";
import { DebugPanel } from "./components/DebugPanel";
import { loadAsset, type LibraryAsset } from "./editor/assets";

const elementIcons: Record<string, IconName> = {
  Text: "text",
  Heading: "heading",
  Paragraph: "paragraph",
  "Curved text": "arc",
  Box: "box",
  "Rounded box": "rounded",
  Circle: "circle",
  Line: "line",
  Curve: "curve",
  "Image slot": "image",
};
const modules: Module[] = [
  "Canvases",
  "Canvas",
  "Story",
  "Publish",
  "Schedule",
  "Setting",
];
const currentModule = (): Module =>
  modules.find(
    (module) =>
      `#${module.toLowerCase()}` === window.location.hash.split("/")[0],
  ) || "Canvases";

export default function App() {
  const projects = useProjects();
  const [module, setRoute] = useState<Module>(currentModule);
  useEffect(() => {
    const onHash = () => {
      setRoute(currentModule());
      const hash = `#${currentModule().toLowerCase()}`;
      if (window.location.hash !== hash) window.location.replace(hash);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  function setModule(next: Module) {
    setRoute(next);
    const hash = `#${next.toLowerCase()}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }
  return (
    <SocialProvider>
      <UpdateProvider>
        <PageSession
          key={`${projects.page.id}:${projects.importRevision}`}
          projects={projects}
          module={module}
          setModule={setModule}
        />
        <UpdateNotice />
      </UpdateProvider>
    </SocialProvider>
  );
}
function PageSession({
  projects,
  module,
  setModule,
}: {
  projects: Projects;
  module: Module;
  setModule: (module: Module) => void;
}) {
  const editor = useEditor(projects.page.canvas, (canvas) =>
    projects.updatePage(projects.page.id, canvas),
  );
  return (
    <MarketingWorkspace
      projects={projects}
      editor={editor}
      module={module}
      setModule={setModule}
      renderCanvas={(onBack) => (
        <WorkspacePage projects={projects} editor={editor} onBack={onBack} />
      )}
    />
  );
}
function WorkspacePage({
  projects: p,
  editor: e,
  onBack,
}: {
  projects: Projects;
  editor: Editor;
  onBack: () => void;
}) {
  async function download(value: string, filename: string) {
    try {
      e.notify(
        exportMessage(
          await saveExport(
            new Blob([value], { type: "application/json" }),
            filename,
          ),
        ),
      );
    } catch (err) {
      e.notify(`Export failed: ${String(err)}`);
    }
  }
  const [editorTab, setEditorTab] = useState("Elements");
  const [pendingAsset, setPendingAsset] = useState<LibraryAsset>();
  const canvasImages = assetsOnCanvas(p.project.pages);
  const customAssets = [...(p.project.assets || []), ...canvasImages].map(
    personalLibraryAsset,
  );
  useEffect(() => {
    const openAssets = () => {
      setEditorTab("Assets");
    };
    window.addEventListener("genie:open-assets", openAssets);
    return () => window.removeEventListener("genie:open-assets", openAssets);
  }, []);
  const latestEditor = useRef(e),
    assetRequest = useRef(0),
    mounted = useRef(true);
  latestEditor.current = e;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      assetRequest.current++;
    };
  }, []);
  const cancelAsset = useCallback(() => {
    assetRequest.current++;
    setPendingAsset(undefined);
  }, []);
  const placeAsset = useCallback(
    async (
      asset: LibraryAsset,
      at?: { x: number; y: number },
      viewport?: { w: number; h: number },
      slotId?: string,
    ) => {
      const request = ++assetRequest.current;
      try {
        const src = await loadAsset(asset);
        if (!mounted.current || request !== assetRequest.current) return;
        const live = latestEditor.current;
        if (slotId && asset.type !== "video") {
          const slot = live.scene.byId.get(slotId);
          if (
            !slot ||
            slot.t !== "img" ||
            live.scene.isLocked(slot) ||
            live.scene.isHidden(slot)
          ) {
            live.notify(
              "Choose an unlocked, visible image slot to replace its image.",
            );
            return;
          }
          live.patch(
            {
              src,
              identifier: asset.identifier,
              label: asset.name,
              fit: slot.fit || "contain",
            },
            [slotId],
          );
        } else {
          if (!at) return;
          const frame = live.scene.frames.findLast(
            (f) =>
              !live.scene.isLocked(f) &&
              !live.scene.isHidden(f) &&
              at.x >= f.x &&
              at.x <= f.x + f.w &&
              at.y >= f.y &&
              at.y <= f.y + f.h,
          );
          const extent = Math.min(
            320,
            (viewport?.w ?? 800) * 0.45,
            (viewport?.h ?? 600) * 0.45,
            frame ? frame.w * 0.4 : Infinity,
            frame ? frame.h * 0.4 : Infinity,
          );
          const scale = Math.min(
            1,
            Math.max(1, extent) / Math.max(asset.width, asset.height),
          );
          live.add(
            {
              id: uid(),
              t: asset.type === "video" ? "video" : "img",
              ...(asset.type === "video"
                ? {
                    chromaKey: asset.chromaKey || {
                      ...defaultChromaKey,
                      enabled: false,
                    },
                    videoLoop: true,
                  }
                : {}),
              n: asset.name,
              identifier: asset.identifier,
              label: asset.name,
              src,
              x: 0,
              y: 0,
              w: asset.width * scale,
              h: asset.height * scale,
              fit: "contain",
              op: 1,
            },
            at,
          );
        }
        setPendingAsset(undefined);
      } catch (err) {
        if (mounted.current && request === assetRequest.current)
          latestEditor.current.notify(
            `Asset could not be placed: ${String(err)}`,
          );
      }
    },
    [],
  );
  const chooseAsset = useCallback(
    (asset: LibraryAsset) => {
      const live = latestEditor.current,
        slot =
          asset.type !== "video" &&
          live.selected.length === 1 &&
          live.active?.t === "img"
            ? live.active
            : undefined;
      if (slot) {
        if (live.scene.isLocked(slot) || live.scene.isHidden(slot)) {
          live.notify(
            "Unlock and show this image slot before choosing an asset.",
          );
          return;
        }
        void placeAsset(asset, undefined, undefined, slot.id);
      } else {
        assetRequest.current++;
        setPendingAsset(asset);
      }
    },
    [placeAsset],
  );
  const playback = useAnimationPlayback(e);
  const [zen, setZen] = useState(false),
    [json, setJson] = useState(""),
    [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<"project" | "page">();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [saved, setSaved] = useState<Preset[]>(() => {
    try {
      return parsePresets(
        JSON.parse(localStore.getItem("genie.presets") || "[]"),
      );
    } catch {
      return [];
    }
  });
  const [theme] = useState(() => localStore.getItem("genie.theme") || "light");
  const videoInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const all = [...presets, ...saved],
    artboards = frames(e.doc);
  function savePresets(next: Preset[]) {
    setSaved(next);
    try {
      localStore.setItem("genie.presets", JSON.stringify(next));
    } catch {
      e.notify(
        "Could not save this template. Check Settings > Storage or export a JSON backup.",
      );
    }
  }
  function importJSON(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.projects) {
        p.importWorkspace(parsed);
        e.notify("Projects imported.");
      } else if (parsed?.version) {
        e.change(parseDocument(parsed));
        e.select([]);
        e.notify("Canvas JSON applied.");
      } else {
        const imported = parsePresets(parsed);
        savePresets([...saved, ...imported]);
        e.notify(
          `${imported.length} presets imported. Open Editor > Templates to add one.`,
        );
      }
    } catch (err) {
      e.notify(
        `JSON error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  async function loadImages(files: File[], at?: { x: number; y: number }) {
    for (const [index, file] of files.entries()) {
      try {
        let o: Element;
        if (
          file.type.startsWith("video/") ||
          /\.(mp4|webm|mov|m4v)$/i.test(file.name)
        ) {
          o = await importVideoFile(file);
        } else {
          const asset = await importImageFile(file);
          p.addAssets(p.project.id, [asset]);
          o = { ...assetElement(asset), id: uid() };
        }
        e.add(
          o,
          at ? { x: at.x + index * 24, y: at.y + index * 24 } : undefined,
        );
      } catch (err) {
        e.notify(String(err));
      }
    }
  }
  function openExport() {
    playback.edit();
    setExportOpen(true);
  }

  return (
    <div className="studio" data-theme={theme}>
      <header className="studio-header">
        <div className="header-left">
          <button
            className="canvas-back icon-text-btn"
            onClick={onBack}
            title="Back to Canvases"
            aria-label="Back to Canvases"
          >
            <Icon name="left" size={16} />
          </button>
          <span className="header-divider" aria-hidden="true" />
          <input
            className="project-name"
            aria-label="Canvas name"
            value={p.project.name}
            placeholder="Untitled canvas"
            onChange={(ev) => p.renameProject(ev.target.value)}
          />
        </div>
        <div className="header-center">
          <CanvasVersions projects={p} document={e.doc} />
        </div>
        <div className="header-right">
          <button
            className="icon-btn"
            aria-label={zen ? "Exit zen mode" : "Zen mode"}
            title={zen ? "Exit zen mode" : "Zen mode"}
            onClick={() => setZen(!zen)}
          >
            <Icon name={zen ? "minimize" : "maximize"} size={16} />
          </button>
          <button
            className="icon-btn"
            aria-label="Canvas settings"
            title="Canvas settings"
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="settings" size={16} />
          </button>
          <button
            className="primary export-btn"
            disabled={!artboards.length}
            onClick={openExport}
            title={e.frame ? `Export ${e.frame.n}` : "Add a frame to export"}
          >
            <Icon name="export" size={16} />
            <span>Export</span>
          </button>
        </div>
      </header>
      <main className={`studio-main ${zen ? "zen" : ""}`}>
        {!zen && (
          <nav className="page-rail" aria-label="Project pages">
            <span className="page-rail-label">Pages</span>
            <div className="page-rail-list">
              {p.project.pages.map((page, index) => (
                <button
                  key={page.id}
                  className="page-circle"
                  title={page.name || `Page ${index + 1}`}
                  aria-label={`Page ${index + 1}${page.name ? `: ${page.name}` : ""}`}
                  aria-current={page.id === p.page.id ? "page" : undefined}
                  onClick={() => p.selectPage(page.id)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              className="page-rail-add page-circle"
              onClick={() => p.createPage()}
              title="Add page"
              aria-label="Add page"
            >
              <Icon name="add" size={15} />
            </button>
          </nav>
        )}
        {!zen && (
          <aside className="library">
            <div className="library-content">
              <div
                className="editor-tabs"
                role="tablist"
                aria-label="Editor library"
              >
                {["Elements", "Templates", "Assets"].map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={editorTab === t}
                    onClick={() => setEditorTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {editorTab === "Elements" ? (
                <>
                  <div className="section-title">
                    <h2>Frames</h2>
                  </div>
                  <div className="format-grid">
                    {[
                      ["Post 4:5", 1122, 1402],
                      ["Story 9:16", 940, 1672],
                      ["Square", 1080, 1080],
                      ["Wide 16:9", 1280, 720],
                    ].map(([n, w, h]) => (
                      <button
                        key={n}
                        onClick={() =>
                          e.addFrame(
                            Number(w),
                            Number(h),
                            `${n} ${artboards.length + 1}`,
                          )
                        }
                      >
                        <span
                          className="format-preview"
                          style={{ aspectRatio: `${w}/${h}` }}
                        />
                        <span>{n}</span>
                        <small>
                          {w} × {h}
                        </small>
                      </button>
                    ))}
                  </div>
                  <h2 className="section-heading">Elements</h2>
                  <input
                    hidden
                    type="file"
                    ref={videoInput}
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    multiple
                    onChange={(ev) => {
                      void loadImages(Array.from(ev.target.files || []));
                      ev.target.value = "";
                    }}
                  />
                  <div className="element-grid">
                    {elementKinds.map((kind) => (
                      <button
                        draggable
                        key={kind}
                        aria-label={kind}
                        onDragStart={(ev) =>
                          ev.dataTransfer.setData("genie/element", kind)
                        }
                        onClick={() => e.add(makeElement(kind))}
                      >
                        <span aria-hidden="true" className="element-symbol">
                          <Icon name={elementIcons[kind]} size={25} />
                        </span>
                        {kind}
                      </button>
                    ))}
                    <button
                      key="Video"
                      aria-label="Video"
                      onClick={() => videoInput.current?.click()}
                    >
                      <span aria-hidden="true" className="element-symbol">
                        <Icon name="video" size={25} />
                      </span>
                      Video
                    </button>
                  </div>
                </>
              ) : editorTab === "Assets" ? (
                <AssetBrowser
                  onChoose={chooseAsset}
                  assets={p.project.assets || []}
                  canvasImages={canvasImages}
                  onAdd={(assets) => p.addAssets(p.project.id, assets)}
                  onRename={(id, name) => p.renameAsset(p.project.id, id, name)}
                  onRemove={(id) => p.removeAsset(p.project.id, id)}
                  pendingId={pendingAsset?.id}
                />
              ) : (
                <>
                  <input
                    className="full"
                    placeholder="Search templates"
                    aria-label="Search templates"
                    value={search}
                    onChange={(ev) => setSearch(ev.target.value)}
                  />
                  <div className="template-list">
                    {all
                      .filter((preset) =>
                        preset.name
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((preset, i) => (
                        <TemplateCard
                          key={preset.name + i}
                          preset={preset}
                          canReplace={!!e.frame}
                          onApply={(replace) => e.template(preset, replace)}
                          onDelete={
                            preset.b
                              ? undefined
                              : () =>
                                  savePresets(saved.filter((s) => s !== preset))
                          }
                        />
                      ))}
                  </div>
                  {!all.some((preset) =>
                    preset.name.toLowerCase().includes(search.toLowerCase()),
                  ) && <p className="hint">No templates match your search.</p>}
                </>
              )}
            </div>
          </aside>
        )}
        <Canvas
          editor={e}
          playback={playback}
          onImage={loadImages}
          pendingAsset={pendingAsset}
          customAssets={customAssets}
          onAssetPlace={placeAsset}
          onAssetCancel={cancelAsset}
        />
        {!zen && <Inspector editor={e} playback={playback} />}
      </main>
      <footer className="studio-footer">
        <span role="status">
          {p.storageError || e.storageError || e.notice}
        </span>
        <span className="footer-meta">
          <span className="footer-seg footer-name" title={p.project.name}>
            {p.project.name}
          </span>
          <span className="footer-dot" aria-hidden="true" />
          <span className="footer-seg" title={p.page.name}>
            {p.page.name}
          </span>
          <span className="footer-dot" aria-hidden="true" />
          <span className="footer-seg">
            {artboards.length} {artboards.length === 1 ? "frame" : "frames"}
          </span>
          <span className="footer-dot" aria-hidden="true" />
          <span
            className={`footer-seg${e.selection.length ? " is-active" : ""}`}
          >
            {e.selection.length} selected
          </span>
          <span className="footer-divider" aria-hidden="true" />
          <button
            className="debug-inline"
            aria-label="Open debug tools"
            title="Debug tools"
            onClick={() => setDebugOpen(true)}
          >
            <Icon name="bug" size={14} />
          </button>
        </span>
      </footer>
      {settingsOpen && (
        <div
          className="dialog-backdrop"
          onClick={() => setSettingsOpen(false)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") setSettingsOpen(false);
          }}
        >
          <section
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="settings-title">Canvas settings</h2>
              <button
                className="icon-btn"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="modal-body">
              <section className="setting-group">
                <h3>Backup</h3>
                <p className="hint">
                  Save every canvas, page, and version as JSON.
                </p>
                <div className="row">
                  <button
                    onClick={() =>
                      download(
                        JSON.stringify(p.workspace, null, 2),
                        "siswa-juara-canvases.json",
                      )
                    }
                  >
                    Export backup
                  </button>
                  <button onClick={() => jsonInput.current?.click()}>
                    Import backup
                  </button>
                </div>
              </section>
              <section className="setting-group danger-zone">
                <h3>Danger zone</h3>
                <div className="row">
                  <button
                    className="danger"
                    disabled={p.project.pages.length <= 1}
                    onClick={() => {
                      setSettingsOpen(false);
                      setConfirmDelete("page");
                    }}
                  >
                    Delete page
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      setSettingsOpen(false);
                      setConfirmDelete("project");
                    }}
                  >
                    Delete canvas
                  </button>
                </div>
              </section>
            </div>
            <footer className="modal-foot">
              <button
                className="primary"
                autoFocus
                onClick={() => setSettingsOpen(false)}
              >
                Done
              </button>
            </footer>
          </section>
        </div>
      )}
      {exportOpen && (
        <ExportDialog
          editor={e}
          playhead={playback.time}
          onClose={() => setExportOpen(false)}
        />
      )}
      {debugOpen && (
        <div
          className="dialog-backdrop"
          onClick={() => setDebugOpen(false)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") setDebugOpen(false);
          }}
        >
          <section
            className="modal-dialog debug-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="debug-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="debug-title">Debug</h2>
              <button
                className="icon-btn"
                aria-label="Close debug tools"
                onClick={() => setDebugOpen(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="modal-body">
              <DebugPanel
                editor={e}
                workspace={p.workspace}
                pageName={p.page.name}
                value={json}
                onChange={setJson}
                onApply={importJSON}
                onDownload={download}
              />
            </div>
          </section>
        </div>
      )}
      {confirmDelete && (
        <div
          className="dialog-backdrop"
          onKeyDown={(ev) => {
            if (ev.key === "Escape") setConfirmDelete(undefined);
          }}
        >
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">
              Delete{" "}
              {confirmDelete === "project" ? p.project.name : p.page.name}?
            </h2>
            <p>
              {confirmDelete === "project"
                ? "This removes the project and all its pages."
                : "This removes this page and its canvas."}{" "}
              Export a JSON backup first if you want to keep it.
            </p>
            <div className="row">
              <button autoFocus onClick={() => setConfirmDelete(undefined)}>
                Cancel
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirmDelete === "project") p.deleteProject();
                  else p.deletePage();
                  setConfirmDelete(undefined);
                }}
              >
                Delete {confirmDelete}
              </button>
            </div>
          </section>
        </div>
      )}
      <input
        ref={jsonInput}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={async (ev) => {
          const file = ev.target.files?.[0];
          if (file) {
            const value = await file.text();
            setJson(value);
            importJSON(value);
          }
          ev.target.value = "";
        }}
      />
    </div>
  );
}
