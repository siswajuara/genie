import { localStore } from "./lib/localStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { SocialProvider } from "./social/client";
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
import { CodexPanel } from "./components/CodexPanel";
import { saveExport, exportMessage } from "./lib/export";
import { Icon, type IconName } from "./components/ui/Icon";
import { drawElement } from "./editor/reference-renderer";
import { ensureDocumentFonts } from "./lib/fonts";
import {
  MarketingWorkspace,
  type IdeaView,
  type Module,
} from "./marketing/MarketingWorkspace";
import type { Editor } from "./editor/useEditor";
import { AssetBrowser } from "./editor/AssetBrowser";
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
  "Idea",
  "Canvases",
  "Canvas",
  "Publish",
  "Schedule",
  "Insight",
  "Community",
  "Setting",
];
const currentModule = () =>
  modules.find(
    (module) =>
      `#${module.toLowerCase()}` === window.location.hash.split("/")[0],
  ) || "Idea";
const currentIdeaView = (): IdeaView =>
  window.location.hash === "#chat" || window.location.hash === "#idea/list"
    ? "list"
    : window.location.hash === "#idea/conversation"
      ? "conversation"
      : "new";

export default function App() {
  const projects = useProjects();
  const [tab, setTab] = useState("Editor");
  const [module, setRoute] = useState<Module>(currentModule);
  const [ideaView, setIdeaView] = useState<IdeaView>(currentIdeaView);
  useEffect(() => {
    const onHash = () => {
      setRoute(currentModule());
      setIdeaView(currentIdeaView());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  function setModule(next: Module, view: IdeaView = "list") {
    setRoute(next);
    if (next === "Idea") setIdeaView(view);
    const hash = next === "Idea" ? `#idea/${view}` : `#${next.toLowerCase()}`;
    if (window.location.hash !== hash) window.location.hash = hash;
  }
  return (
    <SocialProvider>
      <UpdateProvider>
        <PageSession
          key={`${projects.page.id}:${projects.importRevision}`}
          projects={projects}
          tab={tab}
          setTab={setTab}
          module={module}
          setModule={setModule}
          ideaView={ideaView}
        />
        <UpdateNotice />
      </UpdateProvider>
    </SocialProvider>
  );
}
function PageSession({
  projects,
  tab,
  setTab,
  module,
  setModule,
  ideaView,
}: {
  projects: Projects;
  tab: string;
  setTab: (tab: string) => void;
  module: Module;
  setModule: (module: Module, view?: IdeaView) => void;
  ideaView: IdeaView;
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
      ideaView={ideaView}
      renderCanvas={(onBack) => (
        <WorkspacePage
          projects={projects}
          editor={editor}
          tab={tab}
          setTab={setTab}
          onBack={onBack}
        />
      )}
    />
  );
}
function WorkspacePage({
  projects: p,
  tab,
  setTab,
  editor: e,
  onBack,
}: {
  projects: Projects;
  tab: string;
  setTab: (tab: string) => void;
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
  useEffect(() => {
    const openAssets = () => {
      setTab("Editor");
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
        if (slotId) {
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
              t: "img",
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
          live.selected.length === 1 && live.active?.t === "img"
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
        void loadAsset(asset).catch(() => {
          /* Placement reports an actionable loading error if retried. */
        });
      }
    },
    [placeAsset],
  );
  const [zen, setZen] = useState(false),
    [exporting, setExporting] = useState(false),
    [json, setJson] = useState(""),
    [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<"project" | "page">();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrameId, setExportFrameId] = useState<string>("");
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(2);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [exportTransparent, setExportTransparent] = useState(false);
  const [exportName, setExportName] = useState("");
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
        const src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("File could not be read."));
          reader.readAsDataURL(file);
        });
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Unsupported image."));
          image.src = src;
        });
        const o: Element = {
          id: uid(),
          t: "img",
          n: file.name,
          label: file.name,
          src,
          x: 0,
          y: 0,
          w: img.naturalWidth,
          h: img.naturalHeight,
          fit: "contain",
        };
        e.add(
          o,
          at ? { x: at.x + index * 24, y: at.y + index * 24 } : undefined,
        );
      } catch (err) {
        e.notify(String(err));
      }
    }
  }
  async function renderFrame(
    f: Element,
    scale: number,
    format: "png" | "jpeg",
    transparent: boolean,
  ) {
    const objects = e.scene.frameChildren.get(f.id) || [];
    if (f.w * f.h * scale * scale > 256000000)
      throw new Error("Frame is too large to export. Reduce its dimensions.");
    await ensureDocumentFonts(objects);
    await document.fonts.ready;
    const images = new Map<string, HTMLImageElement>();
    for (const o of objects) {
      if (!o.src || o.hide) continue;
      let img = images.get(o.src);
      if (!img) {
        img = new Image();
        img.crossOrigin = "anonymous";
        img.src = o.src;
        images.set(o.src, img);
      }
      try {
        await img.decode();
      } catch {
        throw new Error(
          `Image “${o.n}” could not be loaded. Upload it again, or use a URL that allows CORS.`,
        );
      }
    }
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(f.w * scale));
    cv.height = Math.max(1, Math.round(f.h * scale));
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("Could not create the export canvas.");
    ctx.scale(scale, scale);
    if (!(format === "png" && transparent)) {
      ctx.fillStyle = f.fill || "#fff";
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }
    ctx.translate(-f.x, -f.y);
    for (const o of objects)
      drawElement(
        ctx,
        { ...o, img: o.src ? images.get(o.src) : undefined },
        true,
      );
    const blob = await new Promise<Blob>((resolve, reject) =>
      cv.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("Image encoding failed.")),
        format === "png" ? "image/png" : "image/jpeg",
        0.92,
      ),
    );
    return blob;
  }
  async function exportPNG() {
    const list = frames(e.doc);
    const target =
      list.find((f) => f.id === (exportFrameId || e.frame?.id)) || e.frame;
    if (!target || exporting) return;
    const scale = exportScale;
    const format = exportFormat;
    const transparent = exportFormat === "png" && exportTransparent;
    const base =
      (exportName.trim() || target.n || "frame").replace(
        /\.(png|jpe?g)$/i,
        "",
      ) + (format === "png" ? ".png" : ".jpg");
    setExporting(true);
    try {
      const blob = await renderFrame(target, scale, format, transparent);
      e.notify(exportMessage(await saveExport(blob, base)));
      setExportOpen(false);
    } catch (err) {
      e.notify(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExporting(false);
    }
  }
  async function exportAllFrames() {
    const list = frames(e.doc);
    if (!list.length || exporting) return;
    setExporting(true);
    try {
      for (const f of list) {
        const blob = await renderFrame(
          f,
          exportScale,
          exportFormat,
          exportFormat === "png" && exportTransparent,
        );
        const name =
          (f.n || "frame").replace(/\.(png|jpe?g)$/i, "") +
          (exportFormat === "png" ? ".png" : ".jpg");
        e.notify(exportMessage(await saveExport(blob, name)));
      }
      setExportOpen(false);
    } catch (err) {
      e.notify(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExporting(false);
    }
  }
  function openExport() {
    const list = frames(e.doc);
    const current = e.frame;
    setExportFrameId(current?.id || list[0]?.id || "");
    setExportName(current?.n || list[0]?.n || "frame");
    setExportOpen(true);
  }

  return (
    <div className="studio" data-theme={theme}>
      <header className="studio-header">
        <div className="header-left">
          <button
            className="canvas-back icon-text-btn"
            onClick={onBack}
            title="Back to Idea"
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
            disabled={!e.frame || exporting}
            onClick={openExport}
            title={e.frame ? `Export ${e.frame.n}` : "Add a frame to export"}
          >
            <Icon name="export" size={16} />
            <span>{exporting ? "Exporting…" : "Export"}</span>
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
            <div
              className="library-tabs"
              role="tablist"
              aria-label="Workspace tools"
            >
              {["Chat", "Editor", "Debug"].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div
              className={`library-content ${tab === "Chat" ? "chat-content" : tab === "Debug" ? "debug-content" : ""}`}
            >
              {tab === "Editor" && (
                <>
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
                      </div>
                    </>
                  ) : editorTab === "Assets" ? (
                    <AssetBrowser
                      onChoose={chooseAsset}
                      pendingId={pendingAsset?.id}
                      slotName={
                        e.selected.length === 1 && e.active?.t === "img"
                          ? e.active.n
                          : undefined
                      }
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
                                      savePresets(
                                        saved.filter((s) => s !== preset),
                                      )
                              }
                            />
                          ))}
                      </div>
                      {!all.some((preset) =>
                        preset.name
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      ) && (
                        <p className="hint">No templates match your search.</p>
                      )}
                    </>
                  )}
                </>
              )}
              <div hidden={tab !== "Chat"} className="codex-wrapper">
                <CodexPanel
                  editor={e}
                  scope={p.project.id}
                  conversationKey={p.project.conversationId}
                  pageId={p.page.id}
                  onRestoreRevision={p.restoreChatRevision}
                  onCanvasRevision={(doc, label) => p.recordVersion(label, doc)}
                />
              </div>
              {tab === "Debug" && (
                <DebugPanel
                  editor={e}
                  workspace={p.workspace}
                  pageName={p.page.name}
                  value={json}
                  onChange={setJson}
                  onApply={importJSON}
                  onDownload={download}
                />
              )}
            </div>
          </aside>
        )}
        <Canvas
          editor={e}
          onImage={loadImages}
          pendingAsset={pendingAsset}
          onAssetPlace={placeAsset}
          onAssetCancel={cancelAsset}
        />
        {!zen && <Inspector editor={e} />}
      </main>
      <footer className="studio-footer">
        <span role="status">
          {p.storageError || e.storageError || e.notice}
        </span>
        <span>
          {p.project.name} / {p.page.name} · {artboards.length} frames ·{" "}
          {e.selection.length} selected
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
        <div
          className="dialog-backdrop"
          onClick={() => !exporting && setExportOpen(false)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") setExportOpen(false);
          }}
        >
          <section
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <header className="modal-head">
              <h2 id="export-title">Export frame</h2>
              <button
                className="icon-btn"
                aria-label="Close export"
                disabled={exporting}
                onClick={() => setExportOpen(false)}
              >
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="modal-body">
              <label className="field">
                <span>Frame</span>
                <select
                  value={exportFrameId}
                  onChange={(ev) => {
                    setExportFrameId(ev.target.value);
                    const found = artboards.find(
                      (f) => f.id === ev.target.value,
                    );
                    if (found) setExportName(found.n);
                  }}
                >
                  {artboards.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.n} · {Math.round(f.w)} × {Math.round(f.h)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span id="export-scale-label">Scale</span>
                <div
                  className="segmented"
                  role="group"
                  aria-labelledby="export-scale-label"
                >
                  {([1, 2, 3] as const).map((s) => (
                    <button
                      key={s}
                      aria-pressed={exportScale === s}
                      className={exportScale === s ? "active" : ""}
                      onClick={() => setExportScale(s)}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span id="export-format-label">Format</span>
                <div
                  className="segmented"
                  role="group"
                  aria-labelledby="export-format-label"
                >
                  {(["png", "jpeg"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      aria-pressed={exportFormat === fmt}
                      className={exportFormat === fmt ? "active" : ""}
                      onClick={() => {
                        setExportFormat(fmt);
                        if (fmt === "jpeg") setExportTransparent(false);
                      }}
                    >
                      {fmt === "png" ? "PNG" : "JPG"}
                    </button>
                  ))}
                </div>
              </div>
              {exportFormat === "png" && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={exportTransparent}
                    onChange={(ev) => setExportTransparent(ev.target.checked)}
                  />
                  Transparent background
                </label>
              )}
              <label className="field">
                <span>File name</span>
                <input
                  value={exportName}
                  placeholder="frame"
                  onChange={(ev) => setExportName(ev.target.value)}
                />
              </label>
              <p className="hint">
                {(() => {
                  const f = artboards.find((a) => a.id === exportFrameId);
                  if (!f) return "Add a frame to export.";
                  return `Output: ${Math.round(f.w * exportScale)} × ${Math.round(f.h * exportScale)} px · ${exportFormat === "png" ? "PNG" : "JPEG"}`;
                })()}
              </p>
            </div>
            <footer className="modal-foot split">
              <button
                disabled={exporting || artboards.length === 0}
                onClick={() => void exportAllFrames()}
                title="Export every frame with these settings"
              >
                Export all
              </button>
              <div className="row">
                <button
                  disabled={exporting}
                  onClick={() => setExportOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={exporting || !exportFrameId}
                  onClick={() => void exportPNG()}
                >
                  {exporting ? "Exporting…" : "Export"}
                </button>
              </div>
            </footer>
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
