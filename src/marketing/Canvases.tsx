import { useMemo, useState } from "react";
import type { Projects } from "../editor/projects";
import { frames } from "../editor/model";
import { FramePreview } from "./FramePreview";
import { EmptyState, PageIntro, Segments } from "./Shared";
import { SelectField } from "../components/ui/Controls";
import { Icon } from "../components/ui/Icon";
import { saveExport, exportMessage } from "../lib/export";

type SortKey = "recent" | "name" | "frames";
type FilterKey = "All" | "Designed" | "Empty";

function updatedAt(project: Projects["project"]): string {
  return project.pages.reduce(
    (latest, pg) =>
      pg.canvas.metadata.updatedAt > latest
        ? pg.canvas.metadata.updatedAt
        : latest,
    "",
  );
}

function shortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function Canvases({
  projects: p,
  onOpen,
  onNew,
  notify,
}: {
  projects: Projects;
  onOpen: (id: string) => void;
  onNew: () => void;
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState<SortKey>("recent"),
    [filter, setFilter] = useState<FilterKey>("All"),
    [editingId, setEditingId] = useState(""),
    [draft, setDraft] = useState(""),
    [confirmingId, setConfirmingId] = useState("");
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = p.workspace.projects
      .map((project) => ({
        project,
        frameCount: project.pages.reduce(
          (n, pg) => n + frames(pg.canvas).length,
          0,
        ),
        edited: updatedAt(project),
      }))
      .filter(
        ({ project }) =>
          !term || project.name.toLowerCase().includes(term),
      )
      .filter(({ frameCount }) =>
        filter === "All"
          ? true
          : filter === "Designed"
            ? frameCount > 0
            : frameCount === 0,
      );
    switch (sort) {
      case "name":
        list.sort((a, b) =>
          (a.project.name || "Untitled canvas").localeCompare(
            b.project.name || "Untitled canvas",
          ),
        );
        break;
      case "frames":
        list.sort(
          (a, b) => b.frameCount - a.frameCount || b.edited.localeCompare(a.edited),
        );
        break;
      default:
        list.sort((a, b) => {
          if ((a.frameCount > 0) !== (b.frameCount > 0))
            return a.frameCount > 0 ? -1 : 1;
          return b.edited.localeCompare(a.edited);
        });
    }
    return list;
  }, [p.workspace.projects, search, sort, filter]);
  function commitRename(id: string) {
    const name = draft.trim();
    if (name) p.renameProjectById(id, name);
    setEditingId("");
  }
  async function downloadBackup() {
    try {
      notify(
        exportMessage(
          await saveExport(
            new Blob([JSON.stringify(p.workspace, null, 2)], {
              type: "application/json",
            }),
            "siswa-juara-canvases.json",
          ),
        ),
      );
    } catch (err) {
      notify(`Backup failed: ${String(err)}`);
    }
  }
  return (
    <>
      <PageIntro
        title="Your canvases, all in one place."
        description="Open a canvas to keep designing, or tidy up names and old drafts."
      />
      <div className="canvas-gallery-bar">
        <label className="marketing-search canvas-search">
          <Icon name="search" size={16} />
          <input
            aria-label="Search canvases"
            placeholder="Search canvases"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
          />
        </label>
        <Segments<FilterKey>
          label="Canvas filter"
          values={["All", "Designed", "Empty"]}
          value={filter}
          onChange={setFilter}
        />
        <SelectField
          label="Sort canvases"
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={[
            { value: "recent", label: "Recently edited" },
            { value: "name", label: "Name A–Z" },
            { value: "frames", label: "Most frames" },
          ]}
        />
        <span className="canvas-gallery-spacer" />
        <button
          type="button"
          className="canvas-backup-btn"
          title="Download all canvases, pages, and versions as JSON"
          onClick={() => void downloadBackup()}
        >
          <Icon name="export" size={16} /> Backup
        </button>
      </div>
      {items.length ? (
        <>
          <p className="canvas-count" role="status">
            {items.length} {items.length === 1 ? "canvas" : "canvases"}
            {search.trim() && ` matching “${search.trim()}”`}
          </p>
          <div className="canvas-grid">
            {items.map(({ project, frameCount, edited }) => {
              const page =
                project.pages.find((pg) => pg.id === project.activePageId) ??
                project.pages[0];
              const previewFrame = frames(page.canvas)[0];
              const isActive = project.id === p.project.id;
              const isEditing = editingId === project.id;
              const isConfirming = confirmingId === project.id;
              const title = project.name || "Untitled canvas";
              const editedLabel = shortDate(edited);
              return (
                <article
                  key={project.id}
                  className={`canvas-card${isActive ? " is-active" : ""}${frameCount === 0 ? " is-empty" : ""}`}
                >
                  <div className="canvas-preview">
                    <button
                      type="button"
                      className="canvas-preview-open"
                      onClick={() => onOpen(project.id)}
                      title={`Open ${title}`}
                      aria-label={`Open ${title}`}
                    >
                      {previewFrame ? (
                        <FramePreview
                          document={page.canvas}
                          frameId={previewFrame.id}
                          label={`Preview of ${title}`}
                        />
                      ) : (
                        <span className="canvas-preview-empty">
                          <Icon name="add" size={22} />
                          <span>Empty canvas</span>
                        </span>
                      )}
                    </button>
                    <div className="canvas-preview-bar">
                      <button
                        type="button"
                        className="canvas-open-pill"
                        onClick={() => onOpen(project.id)}
                        tabIndex={-1}
                      >
                        <Icon name="right" size={14} /> Open
                      </button>
                      <span className="canvas-preview-tools">
                        <button
                          type="button"
                          title="Rename canvas"
                          aria-label={`Rename ${title}`}
                          onClick={() => {
                            setConfirmingId("");
                            setDraft(project.name);
                            setEditingId(project.id);
                          }}
                        >
                          <Icon name="rename" size={14} />
                        </button>
                        <button
                          type="button"
                          className="danger-ghost"
                          title="Delete canvas"
                          aria-label={`Delete ${title}`}
                          disabled={p.workspace.projects.length <= 1}
                          onClick={() => {
                            setEditingId("");
                            setConfirmingId(project.id);
                          }}
                        >
                          <Icon name="delete" size={14} />
                        </button>
                      </span>
                    </div>
                    {isActive && (
                      <span className="canvas-card-badge">Current</span>
                    )}
                  </div>
                  <div className="canvas-card-body">
                    {isEditing ? (
                      <span className="canvas-card-rename">
                        <input
                          autoFocus
                          aria-label="Canvas name"
                          value={draft}
                          placeholder="Untitled canvas"
                          onChange={(ev) => setDraft(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") commitRename(project.id);
                            if (ev.key === "Escape") setEditingId("");
                          }}
                        />
                        <button
                          type="button"
                          className="icon-btn small"
                          title="Save name"
                          aria-label="Save name"
                          onClick={() => commitRename(project.id)}
                        >
                          <Icon name="check" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn small"
                          title="Cancel"
                          aria-label="Cancel"
                          onClick={() => setEditingId("")}
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </span>
                    ) : (
                      <strong className="canvas-card-name" title={title}>
                        {title}
                      </strong>
                    )}
                    <small>
                      {project.pages.length}{" "}
                      {project.pages.length === 1 ? "page" : "pages"} ·{" "}
                      {frameCount} {frameCount === 1 ? "frame" : "frames"}
                      {editedLabel && ` · Edited ${editedLabel}`}
                    </small>
                    {isConfirming && (
                      <span className="canvas-confirm">
                        <span>Delete this canvas?</span>
                        <button
                          type="button"
                          className="danger"
                          disabled={p.workspace.projects.length <= 1}
                          onClick={() => {
                            p.deleteProjectById(project.id);
                            setConfirmingId("");
                            notify("Canvas deleted.");
                          }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId("")}
                        >
                          Keep
                        </button>
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          icon="layers"
          title={search ? "No canvases match" : "No canvases here yet"}
          description={
            search
              ? "Try another search term or filter."
              : filter === "Designed"
                ? "None of your canvases have frames yet. Open one and add a frame."
                : "Create a canvas to start your first design."
          }
          action={
            search || filter !== "All" ? (
              <button
                onClick={() => {
                  setSearch("");
                  setFilter("All");
                }}
              >
                Clear search and filters
              </button>
            ) : (
              <button className="primary" onClick={onNew}>
                <Icon name="add" size={16} /> Create your first canvas
              </button>
            )
          }
        />
      )}
    </>
  );
}
