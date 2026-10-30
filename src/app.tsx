import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importVideoFile, defaultChromaKey } from "./editor/video";
import { SocialProvider } from "./social/client";
import { localStore } from "./lib/local-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "./editor/canvas";
import { Inspector } from "./editor/inspector";
import { useEditor } from "./editor/use-editor";
import { useProjects, type Projects } from "./editor/projects";
import { CanvasVersions } from "./components/canvas-versions";
import { UpdateProvider, UpdateNotice } from "./components/app-updates";
import {
  frames,
  parseDocument,
  parsePresets,
  uid,
  type Element,
  type Preset,
} from "./editor/model";
import { saveExport, exportMessage } from "./lib/export";
import { Icon } from "./components/ui/icon";
import { ExportDialog } from "./editor/export-dialog";
import { GenerateDialog } from "./editor/generate-dialog";
import { Sparkles } from "lucide-react";
import { useAnimationPlayback } from "./editor/use-animation-playback";
import {
  MarketingWorkspace,
  type Module,
} from "./marketing/marketing-workspace";
import type { Editor } from "./editor/use-editor";
import {
  assetsOnCanvas,
  importImageFile,
  assetElement,
} from "./editor/canvas-assets";
import { AssetBrowser, personalLibraryAsset } from "./editor/asset-browser";
import { TemplateLibrary } from "./editor/template-library";
import { DebugPanel } from "./components/debug-panel";
import { loadAsset, type LibraryAsset } from "./editor/assets";
import { prepareScienceElement } from "./editor/science";
import {
  ElementLibrary,
  buildElementForItem,
  elementLibraryItems,
  equationLibraryItems,
  type ElementLibraryItem,
} from "./editor/element-library";
const modules: Module[] = [
  "Canvases",
  "Canvas",
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
            slot.illustration3d ||
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
          live.active?.t === "img" &&
          !live.active.illustration3d
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
    [json, setJson] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<"project" | "page">();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
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
  const artboards = frames(e.doc);
  const elementItems = useMemo(() => elementLibraryItems(), []);
  const equationItems = useMemo(() => equationLibraryItems(), []);
  function selectLibraryItem(item: ElementLibraryItem) {
    if (item.kind === "Video") {
      videoInput.current?.click();
      return;
    }
    const element = buildElementForItem(item);
    if (element.latex || element.physics || element.learning || element.illustration3d)
      void prepareScienceElement(element)
        .then((ready) => e.add(ready))
        .catch((error) => e.notify(String(error)));
    else e.add(element);
  }
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
    <div
      className="studio"
      data-theme={theme}
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        if (
          event.defaultPrevented ||
          target.closest(
            "input,textarea,select,[contenteditable='true'],[role='dialog'],[role='combobox'],[role='listbox'],[role='menu'],[role='slider'],[role='switch'],[role='checkbox'],[role='radio']",
          )
        )
          return;
        if (
          event.code === "Space" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.shiftKey
        ) {
          // Capture keeps Space consistent even when a timeline clip/button has focus.
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) playback.toggle();
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "e"
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (artboards.length) openExport();
        }
      }}
    >
      <header className="studio-header">
        <div className="header-left">
          <Button
            className="canvas-back icon-text-btn"
            onClick={onBack}
            title="Back to Canvases"
            aria-label="Back to Canvases"
          >
            <Icon name="left" size={16} />
          </Button>
          <span className="header-divider" aria-hidden="true" />
          <Input
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
          <Button
            className="icon-btn"
            aria-label={zen ? "Exit zen mode" : "Zen mode"}
            title={zen ? "Exit zen mode" : "Zen mode"}
            onClick={() => setZen(!zen)}
          >
            <Icon name={zen ? "minimize" : "maximize"} size={16} />
          </Button>
          <Button
            className="icon-btn"
            aria-label="Canvas settings"
            title="Canvas settings"
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="settings" size={16} />
          </Button>
          <Button
            className="generate-btn"
            aria-haspopup="dialog"
            onClick={() => {
              playback.edit();
              setGenerateOpen(true);
            }}
          >
            <Sparkles size={16} />
            <span>Generate</span>
          </Button>
          <Button
            className="primary export-btn"
            disabled={!artboards.length}
            onClick={openExport}
            title={e.frame ? `Export ${e.frame.n}` : "Add a frame to export"}
          >
            <Icon name="export" size={16} />
            <span>Export</span>
          </Button>
        </div>
      </header>
      <main className={`studio-main ${zen ? "zen" : ""}`}>
        {!zen && (
          <nav className="page-rail" aria-label="Project pages">
            <span className="page-rail-label">Pages</span>
            <div className="page-rail-list">
              {p.project.pages.map((page, index) => (
                <Button
                  key={page.id}
                  className="page-circle"
                  title={page.name || `Page ${index + 1}`}
                  aria-label={`Page ${index + 1}${page.name ? `: ${page.name}` : ""}`}
                  aria-current={page.id === p.page.id ? "page" : undefined}
                  onClick={() => p.selectPage(page.id)}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
            <Button
              className="page-rail-add page-circle"
              onClick={() => p.createPage()}
              title="Add page"
              aria-label="Add page"
            >
              <Icon name="add" size={15} />
            </Button>
          </nav>
        )}
        {!zen && (
          <aside className="library">
            <div className="library-content">
              <div className="library-tabs-sticky">
                <div
                  className="editor-tabs"
                  role="tablist"
                  aria-label="Editor library"
                >
                  {["Elements", "Equation", "Templates", "Assets"].map((t) => (
                    <Button
                      key={t}
                      role="tab"
                      aria-selected={editorTab === t}
                      onClick={() => setEditorTab(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
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
                      <Button
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
                      </Button>
                    ))}
                  </div>
                  <h2 className="section-heading">Elements</h2>
                  <Input
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
                  <ElementLibrary
                    items={elementItems}
                    onSelect={selectLibraryItem}
                    searchPlaceholder="Search elements"
                    searchLabel="Search elements"
                  />
                </>
              ) : editorTab === "Equation" ? (
                <>
                  <h2 className="section-heading">Equation</h2>
                  <p className="hint">
                    LaTeX, 3D illustrations, physics, and learning diagrams.
                  </p>
                  <ElementLibrary
                    items={equationItems}
                    onSelect={selectLibraryItem}
                    searchPlaceholder="Search equations and diagrams"
                    searchLabel="Search equations and diagrams"
                  />
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
                <TemplateLibrary
                  editor={e}
                  saved={saved}
                  onSave={savePresets}
                  onImport={importJSON}
                />
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
          <Button
            className="debug-inline"
            aria-label="Open debug tools"
            title="Debug tools"
            onClick={() => setDebugOpen(true)}
          >
            <Icon name="bug" size={14} />
          </Button>
        </span>
      </footer>
      {settingsOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSettingsOpen(false);
          }}
        >
          <DialogContent className="modal-dialog" aria-describedby={undefined}>
            <header className="modal-head">
              <DialogTitle asChild>
                <h2>Canvas settings</h2>
              </DialogTitle>
              <Button
                className="icon-btn"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <Icon name="close" size={16} />
              </Button>
            </header>
            <div className="modal-body">
              <section className="setting-group">
                <h3>Backup</h3>
                <p className="hint">
                  Save every canvas, page, and version as JSON.
                </p>
                <div className="row">
                  <Button
                    onClick={() =>
                      download(
                        JSON.stringify(p.workspace, null, 2),
                        "siswa-juara-canvases.json",
                      )
                    }
                  >
                    Export backup
                  </Button>
                  <Button onClick={() => jsonInput.current?.click()}>
                    Import backup
                  </Button>
                </div>
              </section>
              <section className="setting-group danger-zone">
                <h3>Danger zone</h3>
                <div className="row">
                  <Button
                    className="danger"
                    disabled={p.project.pages.length <= 1}
                    onClick={() => {
                      setSettingsOpen(false);
                      setConfirmDelete("page");
                    }}
                  >
                    Delete page
                  </Button>
                  <Button
                    className="danger"
                    onClick={() => {
                      setSettingsOpen(false);
                      setConfirmDelete("project");
                    }}
                  >
                    Delete canvas
                  </Button>
                </div>
              </section>
            </div>
            <footer className="modal-foot">
              <Button
                className="primary"
                autoFocus
                onClick={() => setSettingsOpen(false)}
              >
                Done
              </Button>
            </footer>
          </DialogContent>
        </Dialog>
      )}
      {generateOpen && (
        <GenerateDialog editor={e} onClose={() => setGenerateOpen(false)} />
      )}
      {exportOpen && (
        <ExportDialog
          editor={e}
          playhead={playback.time}
          onClose={() => setExportOpen(false)}
        />
      )}
      {debugOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDebugOpen(false);
          }}
        >
          <DialogContent
            className="modal-dialog debug-dialog"
            aria-describedby={undefined}
          >
            <header className="modal-head">
              <DialogTitle asChild>
                <h2>Debug</h2>
              </DialogTitle>
              <Button
                className="icon-btn"
                aria-label="Close debug tools"
                onClick={() => setDebugOpen(false)}
              >
                <Icon name="close" size={16} />
              </Button>
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
          </DialogContent>
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmDelete(undefined);
          }}
        >
          <DialogContent
            className="confirm-dialog"
            aria-describedby="delete-description"
          >
            <DialogTitle asChild>
              <h2>
                Delete{" "}
                {confirmDelete === "project" ? p.project.name : p.page.name}?
              </h2>
            </DialogTitle>
            <p id="delete-description">
              {confirmDelete === "project"
                ? "This removes the project and all its pages."
                : "This removes this page and its canvas."}{" "}
              Export a JSON backup first if you want to keep it.
            </p>
            <div className="row">
              <Button autoFocus onClick={() => setConfirmDelete(undefined)}>
                Cancel
              </Button>
              <Button
                className="danger"
                onClick={() => {
                  if (confirmDelete === "project") p.deleteProject();
                  else p.deletePage();
                  setConfirmDelete(undefined);
                }}
              >
                Delete {confirmDelete}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Input
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
