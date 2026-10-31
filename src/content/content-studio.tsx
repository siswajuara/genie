import React, { useState, useEffect, useRef, type ReactNode } from "react";
import {
  contentApi as api,
  exportContent,
  restoreContent,
  draftTask,
} from "./store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIConnection } from "../social/ai-connection";
import type { Projects } from "../editor/projects";
import { startTaskCanvas } from "./canvas-bridge";
import { taskPublishingPost, publishingLabel } from "./publishing";
import {
  LayoutDashboard,
  Rows3,
  CalendarDays,
  Library,
  ChartNoAxesCombined,
  Settings2,
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  BookOpen,
  FileText,
  Check,
  X,
  SlidersHorizontal,
  Download,
  Upload,
  Link2,
  CheckCircle2,
  Clock3,
  WandSparkles,
  AlertCircle,
  ExternalLink,
  Trash2,
  Layers,
  Menu,
  FolderOpen,
  ShieldCheck,
  Copy,
  LoaderCircle,
} from "lucide-react";
import {
  FRAMEWORKS,
  STATUSES,
  type Framework,
  type Task,
  type Question,
  type Reference,
  type StudioData,
  type Status,
} from "./types";
import "./styles.css";

const cn = (...v: (string | false | undefined)[]) =>
  v.filter(Boolean).join(" ");

function StudioSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[][];
  placeholder?: string;
}) {
  const empty = "__studio_empty__";
  const items = options.map((o) =>
    Array.isArray(o) ? { value: o[0], label: o[1] } : o,
  );
  const current = items.find((o) => o.value === value);
  return (
    <Select
      value={value || empty}
      onValueChange={(v) => onChange(v === empty ? "" : v)}
    >
      <SelectTrigger
        aria-label={label}
        className="studio-select-trigger"
        title={current?.label || label}
      >
        <SelectValue placeholder={placeholder || label}>
          {current?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={empty}>{placeholder || label}</SelectItem>
        {items.map((o) => (
          <SelectItem key={o.value || o.label} value={o.value || o.label}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
const statusLabels: Record<Status, string> = {
  Backlog: "Backlog",
  Researching: "Researching",
  Scripting: "Scripting",
  Review: "Review",
  "Ready to shoot": "Siap syuting",
  Editing: "Editing",
  Scheduled: "Terjadwal",
  Published: "Published",
};
const statusColors = [
  "#a4aac0",
  "#8e79d9",
  "#5373ee",
  "#e7ac48",
  "#50a79e",
  "#da82af",
  "#46a1c7",
  "#60a47d",
];
const shortDate = (date: string) =>
  date
    ? new Date(date + "T12:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      })
    : "Tanpa tanggal";
function Chip({ fw }: { fw: Framework }) {
  return (
    <span className={"chip " + FRAMEWORKS[fw].color}>
      <span className="chip-dot" />
      {FRAMEWORKS[fw].name}
    </span>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FolderOpen size={35} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
const NoticeContext = React.createContext<{
  message: string;
  error: boolean;
} | null>(null);
let openDialogs = 0;
let bodyOverflow = "";
function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const notice = React.useContext(NoticeContext);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    if (openDialogs++ === 0) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialog.showModal();
    return () => {
      dialog.close();
      if (--openDialogs === 0) document.body.style.overflow = bodyOverflow;
      queueMicrotask(() => {
        if (
          previous?.isConnected &&
          !document.querySelector('[data-slot="dialog-content"]')
        )
          previous.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={cn("modal", wide && "modal-wide")}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label="Tutup dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {notice?.error && (
          <div className="inline-error" role="alert">
            {notice.message}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
type Notice = (message: string, error?: boolean) => void;
export default function ContentStudio({
  projects,
  onCanvas,
  onPublish,
}: {
  projects: Projects;
  onCanvas: () => void;
  onPublish: (task: Task) => Promise<void>;
}) {
  const [data, setData] = useState<StudioData | null>(null),
    [error, setError] = useState(""),
    [route, setRoute] = useState(
      location.hash.replace(/^#content\/?/, "") || "board",
    ),
    [view, setView] = useState(
      location.hash.startsWith("#content/task/")
        ? "board"
        : location.hash.replace(/^#content\/?/, "") || "board",
    ),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState(""),
    [notice, setNotice] = useState<{ message: string; error: boolean } | null>(
      null,
    ),
    [mobile, setMobile] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const viewRef = useRef(view);
  const notify: Notice = (message, error = false) =>
    setNotice({ message, error });
  const load = async () => {
    try {
      setData(await api("/data"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
    const onHash = () => {
      if (!location.hash.startsWith("#content")) return;
      const next = location.hash.replace(/^#content\/?/, "") || "board";
      setRoute(next);
      if (!next.startsWith("task/")) {
        if (next !== viewRef.current) setQuery("");
        viewRef.current = next;
        setView(next);
      }
      setMobile(false);
    };
    window.addEventListener("hashchange", onHash);
    const keyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const upsert = (task: Task) =>
    setData((d) =>
      d
        ? {
            ...d,
            tasks: d.tasks.some((t) => t.id === task.id)
              ? d.tasks.map((t) => (t.id === task.id ? task : t))
              : [...d.tasks, task],
          }
        : d,
    );
  const update = async (id: string, patch: Partial<Task>) => {
    try {
      const task = await api<Task>("/tasks/" + id, "PATCH", patch);
      upsert(task);
      return task;
    } catch (e) {
      notify((e as Error).message, true);
      throw e;
    }
  };
  const nav = [
    { id: "board", label: "Board konten", icon: LayoutDashboard },
    { id: "library", label: "Perpustakaan", icon: Library },
    { id: "coverage", label: "Coverage", icon: ChartNoAxesCombined },
  ];
  const current = nav.find((n) => view.startsWith(n.id)) || nav[0];
  const taskId = route.startsWith("task/") ? route.slice(5) : "";
  const task = data?.tasks.find((t) => t.id === taskId);
  return (
    <NoticeContext.Provider value={notice}>
      <div className="content-studio">
        <div className="app-shell single">
          <div className="main-shell">
            <header className="studio-header">
              <button
                className="icon-btn mobile-menu"
                aria-label="Buka navigasi"
                onClick={() => setMobile(!mobile)}
              >
                <Menu size={20} />
              </button>
              <nav
                className={cn("studio-tabs", mobile && "mobile-open")}
                aria-label="Navigasi Content"
              >
                {nav.map((item) => (
                  <a
                    href={"#content/" + item.id}
                    aria-current={current.id === item.id ? "page" : undefined}
                    className={cn(
                      "studio-tab",
                      current.id === item.id && "active",
                    )}
                    key={item.id}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </a>
                ))}
              </nav>
              <div className="studio-header-right">
                <label className="global-search">
                  <Search size={16} />
                  <Input
                    ref={search as React.Ref<HTMLInputElement>}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari konten atau soal…"
                    aria-label="Cari konten atau soal"
                  />
                  <kbd>⌘ K</kbd>
                  {query && (
                    <button
                      className="icon-btn"
                      onClick={() => setQuery("")}
                      aria-label="Hapus pencarian"
                    >
                      <X size={12} />
                    </button>
                  )}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Pengaturan Content"
                  title="Pengaturan"
                  onClick={() => setModal("settings")}
                >
                  <Settings2 size={18} />
                </Button>
              </div>
            </header>
            {!data ? (
              <div className="loading-screen">
                {error ? (
                  <>
                    <AlertCircle />
                    <h2>Workspace belum terhubung</h2>
                    <p>{error}</p>
                    <button className="btn primary" onClick={load}>
                      Coba lagi
                    </button>
                  </>
                ) : (
                  <>
                    <LoaderCircle className="spin" />
                    <p>Memuat…</p>
                  </>
                )}
              </div>
            ) : (
              <main className="main-content">
                {view === "library" ? (
                  <LibraryView
                    data={data}
                    query={query}
                    notify={notify}
                    reload={load}
                    onImport={() => setModal("import")}
                  />
                ) : view === "coverage" ? (
                  <Coverage data={data} onCreate={() => setModal("bulk")} />
                ) : view === "calendar" ? (
                  <CalendarView
                    data={data}
                    query={query}
                    onCreate={() => setModal("new")}
                  />
                ) : (
                  <TaskViews
                    data={data}
                    query={query}
                    mode={view === "table" ? "table" : "board"}
                    onCreate={() => setModal("new")}
                    onBulk={() => setModal("bulk")}
                    update={update}
                    notify={notify}
                  />
                )}
              </main>
            )}
          </div>
          {data &&
            taskId &&
            (task ? (
              <TaskEditor
                key={task.id}
                task={task}
                projects={projects}
                data={data}
                update={update}
                notify={notify}
                onData={setData}
                onPublish={onPublish}
                onCanvas={async (task, target) => {
                  const [projectId, pageId] = target ? JSON.parse(target) : [];
                  const canvasLink =
                    projectId && pageId
                      ? {
                          projectId,
                          pageId,
                          frameIds:
                            task.canvasLink &&
                            task.canvasLink.projectId === projectId &&
                            task.canvasLink.pageId === pageId
                              ? task.canvasLink.frameIds
                              : [],
                        }
                      : undefined;
                  await startTaskCanvas(
                    { ...task, canvasLink },
                    data,
                    projects,
                  );
                  onCanvas();
                }}
                onClose={() => {
                  location.hash = "content/" + view;
                }}
              />
            ) : (
              <Modal
                title="Tugas tidak ditemukan"
                onClose={() => {
                  location.hash = "content/" + view;
                }}
              >
                <p>Tugas ini mungkin sudah dihapus.</p>
              </Modal>
            ))}
          {notice && (
            <div
              className={cn("toast", notice.error && "toast-error")}
              role="status"
            >
              {notice.error ? (
                <AlertCircle size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
              <span>{notice.message}</span>
              <button
                className="icon-btn"
                onClick={() => setNotice(null)}
                aria-label="Tutup notifikasi"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {data && modal === "new" && (
            <NewTask
              onClose={() => setModal("")}
              onCreate={async (body) => {
                try {
                  const task = await api<Task>("/tasks", "POST", body);
                  upsert(task);
                  setModal("");
                  notify("Tugas baru berhasil dibuat.");
                  location.hash = "content/task/" + task.id;
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            />
          )}
          {data && modal === "bulk" && (
            <QuestionPicker
              data={data}
              onClose={() => setModal("")}
              onCreate={async (ids, framework) => {
                try {
                  await api("/tasks/bulk", "POST", {
                    questionIds: ids,
                    framework,
                  });
                  await load();
                  setModal("");
                  notify(`${ids.length} tugas berhasil dibuat dari soal.`);
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            />
          )}
          {data && modal === "settings" && (
            <Settings
              onClose={() => {
                setModal("");
                void load();
              }}
            />
          )}
          {modal === "import" && (
            <ImportModal
              onClose={() => setModal("")}
              onImport={async (file, subject) => {
                const form = new FormData();
                form.append("file", file);
                if (subject) form.append("subject", subject);
                const result = await api("/import", "POST", form);
                await load();
                notify(
                  `${result.questions} soal dan ${result.tasks} tugas diimpor. ${result.skipped} duplikat dilewati.`,
                );
                setModal("");
              }}
            />
          )}
        </div>
      </div>
    </NoticeContext.Provider>
  );
}

function TaskViews({
  data,
  query,
  mode,
  onCreate,
  onBulk,
  update,
  notify,
}: {
  data: StudioData;
  query: string;
  mode: string;
  onCreate: () => void;
  onBulk: () => void;
  update: (id: string, p: Partial<Task>) => Promise<Task>;
  notify: Notice;
}) {
  const [subject, setSubject] = useState(""),
    [framework, setFramework] = useState(""),
    [owner, setOwner] = useState(""),
    [platform, setPlatform] = useState(""),
    [phase, setPhase] = useState("all"),
    [sort, setSort] = useState("source"),
    [moreFilters, setMoreFilters] = useState(false),
    [dragged, setDragged] = useState(""),
    [showAllStages, setShowAllStages] = useState(false);
  const columnResetKey = JSON.stringify([
    query,
    subject,
    framework,
    owner,
    platform,
    phase,
    sort,
  ]);
  const filtered = data.tasks
    .filter(
      (t) =>
        (!query ||
          [t.title, t.segment, t.owner, String(t.number)]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!subject || t.subject === subject) &&
        (!framework || t.framework === framework) &&
        (!owner || (owner === "unassigned" ? !t.owner : t.owner === owner)) &&
        (!platform || t.platform.includes(platform)) &&
        (phase === "all" ||
          (phase === "active"
            ? STATUSES.indexOf(t.status) > 0 && STATUSES.indexOf(t.status) < 6
            : STATUSES.indexOf(t.status) >= 6)),
    )
    .sort((a, b) =>
      sort === "priority"
        ? a.priority.localeCompare(b.priority)
        : sort === "date"
          ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
          : a.number - b.number,
    );
  const subjects = [...new Set(data.tasks.map((t) => t.subject))];
  const owners = [...new Set(data.tasks.map((t) => t.owner).filter(Boolean))];
  const countPhase = (phase: string) =>
    data.tasks.filter((t) =>
      phase === "active"
        ? STATUSES.indexOf(t.status) > 0 && STATUSES.indexOf(t.status) < 6
        : STATUSES.indexOf(t.status) >= 6,
    ).length;
  async function drop(status: Status, taskId: string) {
    if (!taskId) return;
    try {
      await update(taskId, { status });
      notify(`Tugas dipindahkan ke ${statusLabels[status]}.`);
    } catch {}
    setDragged("");
  }
  return (
    <>
      <div className="page-heading">
        <div className="page-title">
          <h1>Board konten</h1>
          <span className="count-pill">{data.tasks.length} konten</span>
        </div>
        <div className="heading-actions">
          <div
            className="view-switch"
            role="tablist"
            aria-label="Tampilan konten"
          >
            <a
              href="#content/board"
              role="tab"
              aria-selected={mode === "board"}
              className={mode === "board" ? "selected" : ""}
            >
              <LayoutDashboard size={15} />
              Board
            </a>
            <a
              href="#content/table"
              role="tab"
              aria-selected={mode === "table"}
              className={mode === "table" ? "selected" : ""}
            >
              <Rows3 size={15} />
              Tabel
            </a>
            <a href="#content/calendar" role="tab" aria-selected={false}>
              <CalendarDays size={15} />
              Kalender
            </a>
          </div>
          <Button variant="default" onClick={onBulk}>
            <BookOpen size={16} />
            Buat dari soal
          </Button>
          <Button variant="primary" onClick={onCreate}>
            <Plus size={17} />
            Tugas baru
          </Button>
        </div>
      </div>
      <section className="board-section">
        <div className="phase-tabs">
          {[
            { id: "all", label: "Semua konten", count: data.tasks.length },
            {
              id: "active",
              label: "Dalam proses",
              count: countPhase("active"),
            },
            { id: "ready", label: "Siap & terbit", count: countPhase("ready") },
          ].map((p) => (
            <button
              key={p.id}
              className={cn("phase-tab", phase === p.id && "selected")}
              onClick={() => setPhase(p.id)}
            >
              {p.label}
              <span>{p.count}</span>
            </button>
          ))}
        </div>
        <div className="filterbar">
          <div className="filter-group">
            <FilterSelect
              label="Mata pelajaran"
              value={subject}
              onChange={setSubject}
              options={subjects.map((s) => [s, s])}
            />
            <FilterSelect
              label="Framework"
              value={framework}
              onChange={setFramework}
              options={Object.entries(FRAMEWORKS).map(([k, v]) => [k, v.name])}
            />
            <button
              className={cn("filter-btn", moreFilters && "filter-active")}
              aria-expanded={moreFilters}
              aria-haspopup="dialog"
              onClick={() => setMoreFilters(!moreFilters)}
            >
              <SlidersHorizontal size={14} />
              <span>
                Filter
                {subject || framework || owner || platform ? " · aktif" : ""}
              </span>
            </button>
            {(subject || framework || owner || platform) && (
              <button
                className="text-btn"
                onClick={() => {
                  setSubject("");
                  setFramework("");
                  setOwner("");
                  setPlatform("");
                }}
              >
                Reset
              </button>
            )}
          </div>
          <label className="sort-select">
            <span>Urutkan:</span>
            <StudioSelect
              label="Urutkan konten"
              value={sort}
              onChange={setSort}
              options={[
                { value: "source", label: "Urutan sumber" },
                { value: "priority", label: "Prioritas" },
                { value: "date", label: "Tanggal terdekat" },
              ]}
              placeholder="Urutan sumber"
            />
          </label>
        </div>
        {moreFilters && (
          <Modal title="Filter konten" onClose={() => setMoreFilters(false)}>
            <div className="filter-dialog-fields">
              <div className="mobile-filter-fields">
                <FilterSelect
                  label="Mata pelajaran"
                  value={subject}
                  onChange={setSubject}
                  options={subjects.map((s) => [s, s])}
                />
                <FilterSelect
                  label="Framework"
                  value={framework}
                  onChange={setFramework}
                  options={Object.entries(FRAMEWORKS).map(([k, v]) => [
                    k,
                    v.name,
                  ])}
                />
              </div>
              <FilterSelect
                label="Penanggung jawab"
                value={owner}
                onChange={setOwner}
                options={[
                  ["unassigned", "Belum ditugaskan"],
                  ...owners.map((o) => [o, o]),
                ]}
              />
              <FilterSelect
                label="Platform"
                value={platform}
                onChange={setPlatform}
                options={["IG Reels", "TikTok", "YouTube Shorts"].map((p) => [
                  p,
                  p,
                ])}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => {
                  setSubject("");
                  setFramework("");
                  setOwner("");
                  setPlatform("");
                }}
              >
                Reset
              </button>
              <button
                className="btn primary"
                onClick={() => setMoreFilters(false)}
              >
                Selesai
              </button>
            </div>
          </Modal>
        )}
        {mode === "table" ? (
          <TaskTable tasks={filtered} />
        ) : (
          <div className="kanban-scroll">
            <div className="kanban">
              {(showAllStages
                ? STATUSES
                : STATUSES.filter(
                    (status, i) =>
                      (phase === "active"
                        ? i >= 1 && i <= 5
                        : phase === "ready"
                          ? i >= 6
                          : i < 4) ||
                      filtered.some((t) => t.status === status),
                  )
              ).map((status) => (
                <KanbanColumn
                  key={status + columnResetKey}
                  status={status}
                  tasks={filtered.filter((t) => t.status === status)}
                  dragged={dragged}
                  onDrop={(id) => void drop(status, id)}
                  onDragStart={setDragged}
                  onDragEnd={() => setDragged("")}
                />
              ))}
            </div>
          </div>
        )}
        {mode !== "table" && (
          <div className="board-bottom">
            <span>{filtered.length} konten sesuai filter</span>
            <button
              className="text-btn"
              onClick={() => setShowAllStages(!showAllStages)}
            >
              {showAllStages
                ? "Sembunyikan tahap kosong"
                : "Lihat semua 8 tahap"}
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
const KANBAN_BATCH_SIZE = 10;
function KanbanColumn({
  status,
  tasks,
  dragged,
  onDrop,
  onDragStart,
  onDragEnd,
}: {
  status: Status;
  tasks: Task[];
  dragged: string;
  onDrop: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(KANBAN_BATCH_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < tasks.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          // One batch per observation, even if several entries are delivered.
          observer.disconnect();
          setVisibleCount((count) => count + KANBAN_BATCH_SIZE);
        }
      },
      { root: scrollRef.current, rootMargin: "0px 0px 160px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, tasks.length, hasMore]);

  return (
    <section
      className={cn("kanban-column", dragged && "drop-enabled")}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e.dataTransfer.getData("text/plain") || dragged);
      }}
    >
      <div className="column-heading">
        <div>
          <span
            className="status-dot"
            style={{ background: statusColors[STATUSES.indexOf(status)] }}
          />
          {statusLabels[status]}
          <span className="column-count">{tasks.length}</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="column-cards"
        role="region"
        aria-label={"Daftar konten " + statusLabels[status]}
        tabIndex={0}
      >
        {tasks.slice(0, visibleCount).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {!tasks.length && (
          <div className="column-empty">
            <p>{dragged ? "Lepaskan di sini" : "Belum ada konten"}</p>
          </div>
        )}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="column-sentinel"
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
}
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <span className={cn("filter-select", !!value && "filter-active")}>
      <StudioSelect
        label={label}
        value={value}
        onChange={onChange}
        options={options}
      />
    </span>
  );
}
function TaskCard({
  task,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <a
      className="task-card"
      href={"#content/task/" + task.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-top">
        <span className="task-code">
          SJ-{String(task.number).padStart(3, "0")}
        </span>
        <span className={"priority " + task.priority.toLowerCase()}>
          <span />
          {task.priority === "P1"
            ? "Tinggi"
            : task.priority === "P3"
              ? "Rendah"
              : "Sedang"}
        </span>
      </div>
      <h3>{task.title}</h3>
      <div className="task-chips">
        <Chip fw={task.framework} />
        <span className="subject-chip">
          {task.questionIds.length ? (
            <BookOpen size={11} />
          ) : (
            <FileText size={11} />
          )}{" "}
          {task.subject === "Informasi TKA"
            ? "Info TKA"
            : task.subject === "Bahasa Indonesia"
              ? "B. Indonesia"
              : task.subject}
        </span>
      </div>
      {(task.owner || task.dueDate) && (
        <div className="task-card-footer">
          <span className="task-owner">{task.owner}</span>
          {task.dueDate && (
            <span
              className={cn(
                "task-date",
                task.dueDate < new Date().toLocaleDateString("en-CA") &&
                  task.status !== "Published" &&
                  "overdue",
              )}
            >
              <CalendarDays size={12} />
              {shortDate(task.dueDate)}
            </span>
          )}
        </div>
      )}
    </a>
  );
}
function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Konten</th>
            <th>Framework</th>
            <th>Status</th>
            <th>Penanggung jawab</th>
            <th>Tanggal</th>
            <th>Akurasi</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <a className="table-title" href={"#content/task/" + t.id}>
                  <span className="task-code">
                    SJ-{String(t.number).padStart(3, "0")}
                  </span>
                  {t.title}
                </a>
              </td>
              <td>
                <Chip fw={t.framework} />
              </td>
              <td>
                <span className="table-status">
                  <span
                    className="status-dot"
                    style={{
                      background: statusColors[STATUSES.indexOf(t.status)],
                    }}
                  />
                  {statusLabels[t.status]}
                </span>
              </td>
              <td>
                {t.owner || <span className="muted">Belum ditugaskan</span>}
              </td>
              <td>{shortDate(t.dueDate)}</td>
              <td>
                {t.checks.answer ? (
                  <span className="verified">
                    <ShieldCheck size={14} />
                    Terverifikasi
                  </span>
                ) : (
                  <span className="muted">Perlu dicek</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length && (
        <Empty
          title="Tidak ada konten yang cocok"
          description="Coba ubah filter atau kata pencarian."
        />
      )}
    </div>
  );
}

function NewTask({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (b: any) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [framework, setFramework] = useState("HCIA");
  const [subject, setSubject] = useState("Informasi TKA");
  return (
    <Modal title="Tugas baru" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const form = Object.fromEntries(new FormData(e.currentTarget));
          await onCreate({ ...form, framework, subject });
          setBusy(false);
        }}
      >
        <label className="field">
          Judul konten
          <input
            name="title"
            required
            placeholder="Judul konten"
            autoFocus
            maxLength={500}
          />
        </label>
        <div className="form-grid">
          <div className="field">
            <span>Framework</span>
            <StudioSelect
              label="Framework"
              value={framework}
              onChange={setFramework}
              options={Object.entries(FRAMEWORKS).map(([k, v]) => ({
                value: k,
                label: v.name,
              }))}
              placeholder="Pilih framework"
            />
          </div>
          <div className="field">
            <span>Mata pelajaran</span>
            <StudioSelect
              label="Mata pelajaran"
              value={subject}
              onChange={setSubject}
              options={[
                { value: "Informasi TKA", label: "Informasi TKA" },
                { value: "Matematika", label: "Matematika" },
                { value: "Bahasa Indonesia", label: "Bahasa Indonesia" },
              ]}
              placeholder="Pilih mapel"
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Plus size={16} />
            )}
            Buat tugas
          </button>
        </div>
      </form>
    </Modal>
  );
}
function QuestionPicker({
  data,
  onClose,
  onCreate,
  initial = [],
}: {
  data: StudioData;
  onClose: () => void;
  onCreate: (ids: string[], framework?: Framework) => Promise<void>;
  initial?: string[];
}) {
  const [selected, setSelected] = useState(initial),
    [query, setQuery] = useState(""),
    [subject, setSubject] = useState(""),
    [fw, setFw] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const questions = data.questions.filter(
    (q) =>
      (!subject || q.subject === subject) &&
      (!query ||
        [q.stem, q.topic, String(q.number)]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  return (
    <Modal title="Buat tugas dari soal" onClose={onClose} wide>
      <div className="picker-filters">
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari soal atau topik…"
            aria-label="Cari soal untuk tugas"
          />
        </label>
        <FilterSelect
          label="Semua mapel"
          value={subject}
          onChange={setSubject}
          options={["Matematika", "Bahasa Indonesia"].map((s) => [s, s])}
        />
      </div>
      <div className="picker-select-all">
        <label className="check-label">
          <input
            type="checkbox"
            checked={
              questions.length > 0 &&
              questions.every((q) => selected.includes(q.id))
            }
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...new Set([...selected, ...questions.map((q) => q.id)])]
                  : selected.filter(
                      (id) => !questions.some((q) => q.id === id),
                    ),
              )
            }
          />
          Pilih semua yang ditampilkan
        </label>
        <span>{selected.length} dipilih</span>
      </div>
      <div className="question-picker-list">
        {questions.map((q) => (
          <label
            key={q.id}
            className={cn(
              "picker-question",
              selected.includes(q.id) && "selected",
            )}
          >
            <input
              type="checkbox"
              checked={selected.includes(q.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, q.id]
                    : selected.filter((id) => id !== q.id),
                )
              }
            />
            <div>
              <span className="question-meta">
                {q.subject} <span>·</span> Soal {q.number} <span>·</span>{" "}
                {q.type}
              </span>
              <h4>{q.topic}</h4>
              <p>{q.stem}</p>
            </div>
            <Chip fw={q.framework} />
          </label>
        ))}
        {!questions.length && (
          <Empty
            title="Soal tidak ditemukan"
            description="Coba kata pencarian yang lain."
          />
        )}
      </div>
      <label className="field picker-fw">
        Framework
        <StudioSelect
          label="Framework"
          value={fw}
          onChange={setFw}
          options={Object.entries(FRAMEWORKS).map(([k, v]) => ({
            value: k,
            label: v.name,
          }))}
          placeholder="Gunakan framework asli tiap soal"
        />
      </label>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Batal
        </button>
        <button
          className="btn primary"
          disabled={!selected.length || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onCreate(selected, (fw as Framework) || undefined);
            } catch (error) {
              setError((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          Buat {selected.length || ""} tugas
        </button>
      </div>
    </Modal>
  );
}
function Settings({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState("");
  return (
    <Modal title="Pengaturan" onClose={onClose}>
      <AIConnection />
      {error && <p role="alert">{error}</p>}
      <label className="field">
        Pulihkan backup Content Studio (.json)
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (
              !file ||
              !window.confirm(
                "Ganti seluruh tugas, soal, dan referensi Content Studio dengan backup ini? Ekspor data saat ini terlebih dahulu untuk menyimpan salinannya. Canvas tetap tersimpan.",
              )
            )
              return;
            try {
              await restoreContent(file);
              onClose();
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        />
      </label>
      <div className="settings-note">
        <ShieldCheck size={18} />
        <p>
          Draf AI perlu disunting. Verifikasi jawaban sebelum Review. Data
          tersimpan lokal di library Genie.
        </p>
      </div>
      <button className="export-link" onClick={() => void exportContent()}>
        <Download size={16} />
        Ekspor semua tugas, soal, dan referensi
      </button>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Tutup
        </button>
      </div>
    </Modal>
  );
}
function ImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (f: File, s: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [subject, setSubject] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Tambahkan bahan ceritamu"
      subtitle="Impor soal atau rencana konten ke workspace."
      onClose={onClose}
    >
      <label
        className={cn("upload-zone", !!file && "has-file")}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setFile(e.dataTransfer.files[0] || null);
        }}
      >
        <span>
          <Upload size={27} />
        </span>
        <strong>{file ? file.name : "Pilih atau tarik berkas ke sini"}</strong>
        <p>Excel (.xlsx) atau Markdown (.md), maksimal 20 MB</p>
        <input
          type="file"
          accept=".xlsx,.md"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <div className="field">
        <span>Mata pelajaran</span>
        <StudioSelect
          label="Mata pelajaran"
          value={subject}
          onChange={setSubject}
          options={[
            { value: "Matematika", label: "Matematika" },
            { value: "Bahasa Indonesia", label: "Bahasa Indonesia" },
          ]}
          placeholder="Deteksi otomatis dari berkas"
        />
      </div>
      <p className="import-help">
        Excel mengikuti kolom workbook sumber: Pertanyaan, Pilihan/Opsi, Kunci,
        dan Pembahasan; atau sheet Master Storytelling. Markdown menggunakan
        judul “## Soal 1”. Impor ulang berkas yang sama melewati data duplikat.
      </p>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Batal
        </button>
        <button
          className="btn primary"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            if (file.size > 20 * 1024 * 1024) {
              setError("Berkas melebihi 20 MB.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await onImport(file, subject);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Upload size={16} />
          )}
          Impor berkas
        </button>
      </div>
    </Modal>
  );
}

function QuestionContent({ question: q }: { question: Question }) {
  return (
    <>
      <div className="question-info">
        <span>{q.subject}</span>
        <span>{q.grade}</span>
        <span>{q.type}</span>
        <span>{q.level}</span>
      </div>
      <h3 className="question-topic">{q.topic}</h3>
      <div className="question-stem">{q.stem}</div>
      <div className="question-options">
        {Object.entries(q.options).map(([key, value]) => (
          <div
            key={key}
            className={cn(
              "question-option",
              q.type === "PG" && q.answer.trim() === key && "correct",
            )}
          >
            <span>{key}</span>
            <p>{value}</p>
            {q.type === "PG" && q.answer.trim() === key && (
              <CheckCircle2 size={16} />
            )}
          </div>
        ))}
      </div>
      <div className="answer-box">
        <ShieldCheck size={16} />
        <div>
          <strong>Kunci jawaban: {q.answer || "Belum tersedia"}</strong>
          <p>
            {q.explanation.replace(/\*\*/g, "") ||
              "Pembahasan belum tersedia. Verifikasi dari sumber sebelum Review."}
          </p>
        </div>
      </div>
      {q.illustration && (
        <details className="illustration-notes">
          <summary>Brief ilustrasi dari sumber</summary>
          <p>{q.illustration}</p>
        </details>
      )}
      <div className="source-caption">
        <FileText size={12} />
        {q.source}
      </div>
    </>
  );
}

function TaskEditor({
  task: initial,
  projects,
  data,
  update,
  notify,
  onData,
  onCanvas,
  onPublish,
  onClose,
}: {
  onClose: () => void;
  task: Task;
  projects: Projects;
  data: StudioData;
  update: (id: string, p: Partial<Task>) => Promise<Task>;
  notify: Notice;
  onData: React.Dispatch<React.SetStateAction<StudioData | null>>;
  onCanvas: (task: Task, target: string) => Promise<void>;
  onPublish: (task: Task) => Promise<void>;
}) {
  const [task, setTask] = useState(initial),
    [tab, setTab] = useState("script"),
    [saved, setSaved] = useState("Tersimpan"),
    [drafting, setDrafting] = useState(false),
    [linking, setLinking] = useState(false),
    [deleting, setDeleting] = useState(false),
    [closing, setClosing] = useState(false),
    [questionIndex, setQuestionIndex] = useState(0);
  const [canvasTarget, setCanvasTarget] = useState(() =>
    initial.canvasLink
      ? JSON.stringify([
          initial.canvasLink.projectId,
          initial.canvasLink.pageId,
        ])
      : "",
  );
  const taskRef = useRef(task);
  const publishingPost = taskPublishingPost(task.id);
  taskRef.current = task;
  const queue = useRef(Promise.resolve(true));
  const editRevision = useRef(0);
  const fw = FRAMEWORKS[task.framework],
    questions = task.questionIds
      .map((id) => data.questions.find((q) => q.id === id))
      .filter(Boolean) as Question[];
  const reference = data.references.find((r) => r.id === task.referenceId);
  const local = (patch: Partial<Task>) => {
    editRevision.current++;
    setTask((t) => ({ ...t, ...patch }));
    setSaved("Belum tersimpan");
  };
  const persist = (patch: Partial<Task>) => {
    const revision = ++editRevision.current;
    setTask((t) => ({ ...t, ...patch }));
    setSaved("Menyimpan…");
    queue.current = queue.current.then(async () => {
      try {
        await update(task.id, patch);
        if (editRevision.current === revision) setSaved("Tersimpan");
        return true;
      } catch {
        if ("status" in patch || "checks" in patch || "questionIds" in patch) {
          try {
            const latest = await api<StudioData>("/data");
            const stored = latest.tasks.find((t) => t.id === task.id);
            if (stored)
              setTask((t) => ({
                ...t,
                status: stored.status,
                checks: stored.checks,
                questionIds: stored.questionIds,
              }));
          } catch {}
        }
        setSaved("Gagal menyimpan");
        return false;
      }
    });
    return queue.current;
  };
  const saveAll = async () => {
    const t = taskRef.current;
    return persist({
      title: t.title,
      subject: t.subject,
      framework: t.framework,
      status: t.status,
      priority: t.priority,
      owner: t.owner,
      platform: t.platform,
      dueDate: t.dueDate,
      questionIds: t.questionIds,
      referenceId: t.referenceId,
      script: t.script,
      caption: t.caption,
      hashtags: t.hashtags,
      checks: t.checks,
      visualNotes: t.visualNotes,
      accuracyNotes: t.accuracyNotes,
      target: t.target,
      aiDraft: t.aiDraft,
    });
  };
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saved !== "Tersimpan") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saved]);
  async function generate() {
    if (!(await saveAll())) return;
    setDrafting(true);
    const draftRevision = editRevision.current;
    try {
      const job = await draftTask(task.id);
      onData((d) =>
        d
          ? {
              ...d,
              tasks: d.tasks.map((t) => (t.id === task.id ? job.task : t)),
            }
          : d,
      );
      if (draftRevision === editRevision.current) {
        setTask(job.task);
        setSaved("Tersimpan");
      } else
        setTask((current) => ({ ...current, aiHistory: job.task.aiHistory }));
      notify(
        job.state === "complete"
          ? "Draf AI siap disunting."
          : "Draf disimpan di riwayat karena tugas berubah.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setDrafting(false);
    }
  }
  const close = async () => {
    if (closing) return;
    setClosing(true);
    if (await saveAll()) onClose();
    setClosing(false);
  };
  return (
    <Modal title="Detail tugas" onClose={close} wide>
      <div className="task-editor" aria-busy={closing}>
        <div className="editor-meta">
          <span className="task-code">
            SJ-{String(task.number).padStart(3, "0")}
          </span>
          <span
            className={cn(
              "saved-label",
              saved === "Gagal menyimpan" && "danger",
            )}
            role="status"
          >
            {saved}
          </span>
        </div>
        <div className="editor-heading">
          <div>
            <div className="editor-tags">
              <Chip fw={task.framework} />
              <span className="subject-chip">{task.subject}</span>
              {task.aiDraft && (
                <span className="ai-label">
                  <Sparkles size={11} />
                  Draf AI · perlu disunting
                </span>
              )}
            </div>
            <input
              className="title-input"
              aria-label="Judul konten"
              value={task.title}
              title={task.title}
              onChange={(e) => local({ title: e.target.value })}
              onBlur={() => persist({ title: task.title })}
            />
          </div>
          <label className="status-select">
            <span
              className="status-dot"
              style={{
                background: statusColors[STATUSES.indexOf(task.status)],
              }}
            />
            <StudioSelect
              label="Status tugas"
              value={task.status}
              onChange={async (v) => {
                const status = v as Status;
                if (STATUSES.indexOf(status) >= 3 && !task.checks.answer) {
                  notify(
                    "Verifikasi jawaban / akurasi sebelum masuk Review.",
                    true,
                  );
                  return;
                }
                await persist({ status });
              }}
              options={STATUSES.map((s) => ({
                value: s,
                label: statusLabels[s],
              }))}
              placeholder="Status"
            />
          </label>
        </div>
        <div className="editor-workspace-tabs">
          <div
            role="tablist"
            aria-label="Bagian tugas"
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              const tabs = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "[role=tab]",
                ),
              );
              const index = tabs.indexOf(e.target as HTMLButtonElement);
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (e.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              e.preventDefault();
              tabs[next]?.click();
              tabs[next]?.focus();
            }}
          >
            {[
              { id: "script", name: "Naskah" },
              { id: "caption", name: "Caption" },
              { id: "details", name: "Detail" },
              { id: "materials", name: "Bahan" },
              ...(task.aiHistory.length
                ? [{ id: "history", name: "Riwayat AI" }]
                : []),
            ].map((item) => (
              <button
                key={item.id}
                role="tab"
                id={"task-tab-" + item.id}
                aria-controls="task-panel"
                tabIndex={tab === item.id ? 0 : -1}
                aria-selected={tab === item.id}
                className={tab === item.id ? "selected" : ""}
                onClick={() => setTab(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <label className="canvas-target">
            Canvas tujuan
            <select
              aria-label="Canvas tujuan"
              value={canvasTarget}
              disabled={drafting || closing}
              onChange={(e) => setCanvasTarget(e.target.value)}
            >
              <option value="">Buat canvas baru</option>
              {projects.workspace.projects.flatMap((project) =>
                project.pages.map((page) => (
                  <option
                    key={page.id}
                    value={JSON.stringify([project.id, page.id])}
                  >
                    {project.name} · {page.name}
                  </option>
                )),
              )}
            </select>
          </label>
          <button
            className="btn small primary"
            disabled={drafting || closing}
            onClick={async () => {
              if (!(await saveAll())) return;
              setClosing(true);
              try {
                await onCanvas(taskRef.current, canvasTarget);
              } catch (e) {
                notify((e as Error).message, true);
                setClosing(false);
              }
            }}
          >
            <Layers size={14} />
            {task.canvasLink
              ? "Buka canvas / Generate frames"
              : "Generate frames di Canvas"}
          </button>
          {data.aiAvailable && (
            <button
              className="btn small"
              onClick={generate}
              disabled={drafting}
            >
              {drafting ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <WandSparkles size={14} />
              )}
              {drafting ? "Menyusun…" : "Draft dengan AI"}
            </button>
          )}
          <Button
            className="btn small"
            disabled={drafting || closing}
            onClick={async () => {
              if (!(await saveAll())) return;
              setClosing(true);
              try {
                await onPublish(taskRef.current);
              } catch (error) {
                notify((error as Error).message, true);
                setClosing(false);
              }
            }}
          >
            <ArrowUpRight size={14} /> Buka Publish (Tebar)
          </Button>
        </div>
        <div className="task-publishing-status">
          <strong>Publikasi: {publishingLabel(publishingPost)}</strong>
          <p>
            Status tugas adalah tahap kerja lokal. Kirim atau jadwalkan melalui
            Publish; perbarui status pengiriman di Schedule.
          </p>
          {publishingPost?.delivery?.map((result) => (
            <div key={result.accountKey}>
              {result.accountName}:{" "}
              {result.status || (result.uncertain ? "belum pasti" : "gagal")}
              {result.error && <p>{result.error}</p>}
              {result.permalink && /^https:\/\//i.test(result.permalink) && (
                <a href={result.permalink} target="_blank" rel="noreferrer">
                  Lihat posting
                </a>
              )}
            </div>
          ))}
        </div>
        <div
          id="task-panel"
          className="editor-panel"
          role="tabpanel"
          aria-labelledby={"task-tab-" + tab}
        >
          {tab === "script" ? (
            <>
              {fw.beats.map((beat, i) => (
                <div className="beat-editor" key={beat}>
                  <div className="beat-editor-heading">
                    <span className="beat-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <label htmlFor={"beat-" + beat}>{beat}</label>
                    {task.script[beat]?.trim() && (
                      <CheckCircle2 size={14} className="beat-done" />
                    )}
                  </div>
                  <textarea
                    id={"beat-" + beat}
                    value={task.script[beat] || ""}
                    placeholder={fw.hints[i]}
                    onChange={(e) =>
                      local({
                        script: { ...task.script, [beat]: e.target.value },
                        aiDraft: false,
                      })
                    }
                    onBlur={() =>
                      persist({ script: task.script, aiDraft: false })
                    }
                  />
                </div>
              ))}
              <button
                className="text-btn copy-script"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      fw.beats
                        .map(
                          (b) => `${b.toUpperCase()}\n${task.script[b] || ""}`,
                        )
                        .join("\n\n"),
                    );
                    notify("Naskah disalin.");
                  } catch {
                    notify("Browser tidak mengizinkan akses clipboard.", true);
                  }
                }}
              >
                <Copy size={14} />
                Salin seluruh naskah
              </button>
            </>
          ) : tab === "caption" ? (
            <div className="caption-editor">
              <label className="field">
                Caption
                <textarea
                  value={task.caption}
                  rows={6}
                  placeholder="Beri konteks tambahan untuk penonton…"
                  onChange={(e) => local({ caption: e.target.value })}
                  onBlur={() => persist({ caption: task.caption })}
                />
              </label>
              <label className="field">
                Hashtag
                <input
                  value={task.hashtags}
                  onChange={(e) => local({ hashtags: e.target.value })}
                  onBlur={() => persist({ hashtags: task.hashtags })}
                />
              </label>
              <label className="field">
                Arahan visual & B-roll
                <textarea
                  rows={6}
                  value={task.visualNotes}
                  onChange={(e) => local({ visualNotes: e.target.value })}
                  onBlur={() => persist({ visualNotes: task.visualNotes })}
                />
              </label>
              <label className="field">
                Catatan akurasi
                <textarea
                  rows={4}
                  value={task.accuracyNotes}
                  onChange={(e) => local({ accuracyNotes: e.target.value })}
                  onBlur={() => persist({ accuracyNotes: task.accuracyNotes })}
                />
              </label>
              <label className="field">
                Target penonton
                <input
                  value={task.target}
                  onChange={(e) => local({ target: e.target.value })}
                  onBlur={() => persist({ target: task.target })}
                />
              </label>
            </div>
          ) : tab === "history" ? (
            <div className="ai-history">
              {task.aiHistory.length ? (
                task.aiHistory
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <article key={i}>
                      <div>
                        <Sparkles size={16} />
                        <strong>{h.model}</strong>
                        <span>{new Date(h.date).toLocaleString("id-ID")}</span>
                      </div>
                      <details>
                        <summary>Prompt yang dikirim</summary>
                        <pre>{h.prompt}</pre>
                      </details>
                      <details>
                        <summary>Hasil draf</summary>
                        <pre>{h.output}</pre>
                      </details>
                    </article>
                  ))
              ) : (
                <Empty
                  title="Belum ada draf AI"
                  description="Gunakan Draft dengan AI untuk mulai. Model mengikuti Setting → AI generation. Setiap prompt dan respons tercatat di sini."
                />
              )}
            </div>
          ) : null}
          {tab === "details" && (
            <>
              <div className="editor-properties">
                <label>
                  <span>Penanggung jawab</span>
                  <input
                    aria-label="Penanggung jawab"
                    placeholder="Belum ditugaskan"
                    value={task.owner}
                    onChange={(e) => local({ owner: e.target.value })}
                    onBlur={() => persist({ owner: task.owner })}
                  />
                </label>
                <label>
                  <span>
                    <CalendarDays size={12} />
                    Tanggal target
                  </span>
                  <input
                    aria-label="Tanggal target"
                    type="date"
                    value={task.dueDate}
                    onChange={(e) => persist({ dueDate: e.target.value })}
                  />
                </label>
                <label>
                  <span>Platform</span>
                  <StudioSelect
                    label="Platform tugas"
                    value={task.platform}
                    onChange={(v) => persist({ platform: v })}
                    options={[
                      ...new Set([
                        task.platform,
                        "IG Reels",
                        "TikTok",
                        "YouTube Shorts",
                        "IG Reels / TikTok / YouTube Shorts",
                      ]),
                    ]
                      .filter(Boolean)
                      .map((p) => ({ value: p, label: p }))}
                    placeholder="Pilih platform"
                  />
                </label>
                <label>
                  <span>Framework</span>
                  <StudioSelect
                    label="Framework tugas"
                    value={task.framework}
                    onChange={(v) => persist({ framework: v as Framework })}
                    options={Object.entries(FRAMEWORKS).map(([k, v]) => ({
                      value: k,
                      label: v.name,
                    }))}
                    placeholder="Pilih framework"
                  />
                </label>
                <label>
                  <span>Prioritas</span>
                  <StudioSelect
                    label="Prioritas tugas"
                    value={task.priority}
                    onChange={(v) => persist({ priority: v })}
                    options={[
                      { value: "P1", label: "Tinggi" },
                      { value: "P2", label: "Sedang" },
                      { value: "P3", label: "Rendah" },
                    ]}
                    placeholder="Pilih prioritas"
                  />
                </label>
              </div>
              <section className="production-checklist">
                <div>
                  <ShieldCheck size={17} />
                  <h3>Checklist</h3>
                  <span>
                    {Object.values(task.checks).filter(Boolean).length}/3
                  </span>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={task.checks.visual}
                    onChange={(e) =>
                      persist({
                        checks: { ...task.checks, visual: e.target.checked },
                      })
                    }
                  />
                  Visual sudah siap
                </label>
                <label className="check-label verification-check">
                  <input
                    type="checkbox"
                    checked={task.checks.answer}
                    onChange={(e) => {
                      if (
                        !e.target.checked &&
                        STATUSES.indexOf(task.status) >= 3
                      ) {
                        notify(
                          "Pindahkan tugas ke Scripting sebelum membatalkan verifikasi.",
                          true,
                        );
                        return;
                      }
                      persist({
                        checks: { ...task.checks, answer: e.target.checked },
                      });
                    }}
                  />
                  <span>
                    Jawaban / akurasi diverifikasi{" "}
                    <small>Wajib sebelum Review</small>
                  </span>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={task.checks.caption}
                    onChange={(e) =>
                      persist({
                        checks: { ...task.checks, caption: e.target.checked },
                      })
                    }
                  />
                  Caption sudah selesai
                </label>
              </section>
              <button
                className="text-btn danger"
                onClick={() => setDeleting(true)}
              >
                <Trash2 size={14} />
                Hapus tugas
              </button>
            </>
          )}
          {tab === "materials" && (
            <div className="context-column">
              <section className="context-card">
                <div className="context-card-heading">
                  <h3>
                    <BookOpen size={15} />
                    Soal terkait{" "}
                    <span className="count-pill">{questions.length}</span>
                  </h3>
                  <button className="text-btn" onClick={() => setLinking(true)}>
                    <Link2 size={13} />
                    {questions.length ? "Ubah" : "Hubungkan"}
                  </button>
                </div>
                {questions.length ? (
                  <>
                    {questions.length > 1 && (
                      <div className="question-tabs">
                        {questions.map((q, i) => (
                          <button
                            key={q.id}
                            className={questionIndex === i ? "selected" : ""}
                            onClick={() => setQuestionIndex(i)}
                          >
                            Soal {q.number}
                          </button>
                        ))}
                      </div>
                    )}
                    <QuestionContent
                      question={
                        questions[Math.min(questionIndex, questions.length - 1)]
                      }
                    />
                  </>
                ) : (
                  <div className="context-empty">
                    <p>Belum ada soal terkait.</p>
                    <button
                      className="btn small"
                      onClick={() => setLinking(true)}
                    >
                      <Plus size={13} />
                      Hubungkan soal
                    </button>
                  </div>
                )}
                {task.accuracyNotes && (
                  <div className="accuracy-note">
                    <AlertCircle size={15} />
                    <p>{task.accuracyNotes}</p>
                  </div>
                )}
              </section>
              <section className="context-card framework-context">
                <div className="context-card-heading">
                  <h3>
                    <Layers size={15} />
                    Alur {fw.name}
                  </h3>
                  <Chip fw={task.framework} />
                </div>
                <p>{fw.description}</p>
                <div className="framework-beats">
                  {fw.beats.map((beat, i) => (
                    <div key={beat}>
                      <span
                        className={
                          task.script[beat]?.trim()
                            ? "beat-number complete"
                            : "beat-number"
                        }
                      >
                        {task.script[beat]?.trim() ? (
                          <Check size={12} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div>
                        <strong>{beat}</strong>
                        <p>{fw.hints[i]}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="context-card">
                <div className="context-card-heading">
                  <h3>
                    <Link2 size={15} />
                    Referensi & inspirasi
                  </h3>
                </div>
                <StudioSelect
                  label="Referensi tugas"
                  value={task.referenceId}
                  onChange={(v) => persist({ referenceId: v })}
                  options={data.references.map((r) => ({
                    value: r.id,
                    label: r.title,
                  }))}
                  placeholder="Pilih referensi dari perpustakaan"
                />
                {reference && (
                  <div className="linked-reference">
                    {reference.image && (
                      <a
                        href={reference.image}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img src={reference.image} alt={reference.title} />
                      </a>
                    )}
                    <h4>{reference.title}</h4>
                    <p>{reference.notes}</p>
                    {reference.url && (
                      <a
                        className="text-btn"
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka referensi <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
        <div className="modal-actions editor-actions">
          <span className="save-hint">Perubahan disimpan otomatis</span>
          <button className="btn primary" disabled={closing} onClick={close}>
            {closing ? "Menyimpan…" : "Selesai"}
          </button>
        </div>
        {linking && (
          <LinkQuestions
            questions={data.questions}
            selected={task.questionIds}
            onClose={() => setLinking(false)}
            onSave={async (ids) => {
              if (STATUSES.indexOf(task.status) >= 3) {
                notify(
                  "Pindahkan ke Scripting sebelum mengubah soal agar jawaban dapat diverifikasi ulang.",
                  true,
                );
                return;
              }
              const ok = await persist({
                questionIds: ids,
                checks: { ...task.checks, answer: false },
              });
              if (ok) {
                setQuestionIndex(0);
                setLinking(false);
              }
            }}
          />
        )}
        {deleting && (
          <Modal
            title="Hapus tugas ini?"
            subtitle="Tugas dan naskah akan dihapus permanen."
            onClose={() => setDeleting(false)}
          >
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeleting(false)}>
                Batal
              </button>
              <button
                className="btn danger-solid"
                onClick={async () => {
                  try {
                    await api("/tasks/" + task.id, "DELETE");
                    onData((d) =>
                      d
                        ? {
                            ...d,
                            tasks: d.tasks.filter((t) => t.id !== task.id),
                          }
                        : d,
                    );
                    onClose();
                    notify("Tugas dihapus.");
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                Hapus tugas
              </button>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
}
function LinkQuestions({
  questions,
  selected: initial,
  onClose,
  onSave,
}: {
  questions: Question[];
  selected: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState(initial),
    [query, setQuery] = useState("");
  return (
    <Modal
      title="Hubungkan soal"
      subtitle="Jawaban akan perlu diverifikasi ulang setelah soal berubah."
      onClose={onClose}
      wide
    >
      <label className="search-field">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari topik, mapel, atau nomor…"
          aria-label="Cari soal terkait"
        />
      </label>
      <div className="question-picker-list">
        {questions
          .filter((q) =>
            [q.topic, q.subject, String(q.number)]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((q) => (
            <label className="picker-question" key={q.id}>
              <input
                type="checkbox"
                checked={selected.includes(q.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, q.id]
                      : selected.filter((id) => id !== q.id),
                  )
                }
              />
              <div>
                <span className="question-meta">
                  {q.subject} · Soal {q.number}
                </span>
                <h4>{q.topic}</h4>
                <p>{q.stem}</p>
              </div>
            </label>
          ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Batal
        </button>
        <button className="btn primary" onClick={() => onSave(selected)}>
          Hubungkan {selected.length} soal
        </button>
      </div>
    </Modal>
  );
}

function LibraryView({
  data,
  query,
  notify,
  reload,
  onImport,
}: {
  data: StudioData;
  query: string;
  notify: Notice;
  reload: () => Promise<void>;
  onImport: () => void;
}) {
  const [tab, setTab] = useState(
      () => sessionStorage.getItem("library-tab") || "questions",
    ),
    [subject, setSubject] = useState(""),
    [coverage, setCoverage] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [question, setQuestion] = useState<Question | null>(null),
    [bulk, setBulk] = useState(false),
    [newRef, setNewRef] = useState(false),
    [guide, setGuide] = useState<Framework | null>(null),
    [referenceDetail, setReferenceDetail] = useState<Reference | null>(null);
  useEffect(() => {
    sessionStorage.removeItem("library-tab");
  }, []);
  const covered = new Set(data.tasks.flatMap((t) => t.questionIds));
  const questions = data.questions.filter(
    (q) =>
      (!subject || q.subject === subject) &&
      (!query ||
        [q.stem, q.topic, String(q.number)]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!coverage ||
        (coverage === "unused" ? !covered.has(q.id) : covered.has(q.id))),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Perpustakaan</h1>
        </div>
        <div className="heading-actions">
          <button className="btn" onClick={onImport}>
            <Upload size={16} />
            Impor berkas
          </button>
          {tab === "questions" ? (
            <button className="btn primary" onClick={() => setBulk(true)}>
              <Plus size={16} />
              Buat dari {selected.length ? `${selected.length} soal` : "soal"}
            </button>
          ) : tab === "references" ? (
            <button className="btn primary" onClick={() => setNewRef(true)}>
              <Plus size={16} />
              Referensi baru
            </button>
          ) : null}
        </div>
      </div>
      <div className="library-tabs">
        {[
          {
            id: "questions",
            label: "Bank soal",
            count: data.questions.length,
            icon: BookOpen,
          },
          { id: "frameworks", label: "Framework", count: 5, icon: Layers },
          {
            id: "references",
            label: "Referensi",
            count: data.references.length,
            icon: Link2,
          },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "selected" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} />
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>
      {tab === "questions" ? (
        <>
          <section className="panel">
            <div className="library-toolbar">
              <div className="filter-group">
                <FilterSelect
                  label="Semua mapel"
                  value={subject}
                  onChange={setSubject}
                  options={["Matematika", "Bahasa Indonesia"].map((s) => [
                    s,
                    s,
                  ])}
                />
                <FilterSelect
                  label="Semua coverage"
                  value={coverage}
                  onChange={setCoverage}
                  options={[
                    ["unused", "Belum ada konten"],
                    ["used", "Sudah ada konten"],
                  ]}
                />
              </div>
              <span className="muted">
                {selected.length ? `${selected.length} dipilih · ` : ""}
                {questions.length} soal
              </span>
            </div>
            <div className="table-scroll">
              <table className="question-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="Pilih semua soal"
                        type="checkbox"
                        checked={
                          questions.length > 0 &&
                          questions.every((q) => selected.includes(q.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [
                                  ...new Set([
                                    ...selected,
                                    ...questions.map((q) => q.id),
                                  ]),
                                ]
                              : selected.filter(
                                  (id) => !questions.some((q) => q.id === id),
                                ),
                          )
                        }
                      />
                    </th>
                    <th>Soal & topik</th>
                    <th>Mata pelajaran</th>
                    <th>Tipe / level</th>
                    <th>Framework</th>
                    <th>Konten</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const tasks = data.tasks.filter((t) =>
                      t.questionIds.includes(q.id),
                    );
                    return (
                      <tr key={q.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${q.subject} soal ${q.number}`}
                            checked={selected.includes(q.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, q.id]
                                  : selected.filter((id) => id !== q.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="question-table-title"
                            onClick={() => setQuestion(q)}
                          >
                            <span className="task-code">
                              {q.subject === "Matematika" ? "MAT" : "BIND"}-
                              {String(q.number).padStart(2, "0")}
                            </span>
                            <strong>{q.topic}</strong>
                            <span>{q.stem}</span>
                          </button>
                        </td>
                        <td>
                          <span
                            className={
                              "subject-label " +
                              (q.subject === "Matematika" ? "blue" : "purple")
                            }
                          >
                            {q.subject}
                          </span>
                        </td>
                        <td>
                          {q.type}
                          <small className="cell-sub">{q.level}</small>
                        </td>
                        <td>
                          <Chip fw={q.framework} />
                        </td>
                        <td>
                          {tasks.length ? (
                            <a
                              className="verified"
                              href={"#content/task/" + tasks[0].id}
                            >
                              <CheckCircle2 size={13} />
                              {tasks.length} konten
                            </a>
                          ) : (
                            <span className="unused-label">Belum ada</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={`Buka soal ${q.number}`}
                            onClick={() => setQuestion(q)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!questions.length && (
                <Empty
                  title="Soal tidak ditemukan"
                  description="Coba ubah filter atau kata pencarian."
                />
              )}
            </div>
          </section>
        </>
      ) : tab === "frameworks" ? (
        <div className="framework-grid">
          {Object.entries(FRAMEWORKS).map(([key, f]) => (
            <article className="framework-card" key={key}>
              <Chip fw={key as Framework} />
              <h2>{f.full}</h2>
              <p>{f.description}</p>
              <button
                className="text-btn"
                onClick={() => setGuide(key as Framework)}
              >
                Lihat panduan <ArrowUpRight size={14} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="reference-grid">
          {data.references
            .filter(
              (r) =>
                !query ||
                [r.title, r.notes]
                  .join(" ")
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .map((r) => (
              <article className="reference-card" key={r.id}>
                <div>
                  <h2>{r.title}</h2>
                  <p className="reference-preview">{r.notes}</p>
                  <button
                    className="text-btn"
                    onClick={() => setReferenceDetail(r)}
                  >
                    Lihat detail <ArrowUpRight size={14} />
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
      {guide && (
        <Modal title={FRAMEWORKS[guide].name} onClose={() => setGuide(null)}>
          <div className="framework-card guide-detail">
            <h2>{FRAMEWORKS[guide].full}</h2>
            <p>{FRAMEWORKS[guide].description}</p>
            <ol>
              {FRAMEWORKS[guide].beats.map((beat, i) => (
                <li key={beat}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{beat}</strong>
                    <p>{FRAMEWORKS[guide].hints[i]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Modal>
      )}
      {referenceDetail && (
        <Modal
          title={referenceDetail.title}
          onClose={() => setReferenceDetail(null)}
        >
          <div className="linked-reference">
            {referenceDetail.image && (
              <a href={referenceDetail.image} target="_blank" rel="noreferrer">
                <img src={referenceDetail.image} alt={referenceDetail.title} />
              </a>
            )}
            <p>{referenceDetail.notes}</p>
            {referenceDetail.url && (
              <a
                className="text-btn"
                href={referenceDetail.url}
                target="_blank"
                rel="noreferrer"
              >
                Buka referensi <ExternalLink size={14} />
              </a>
            )}
          </div>
        </Modal>
      )}
      {question && (
        <Modal
          title={`${question.subject} · Soal ${question.number}`}
          onClose={() => setQuestion(null)}
          wide
        >
          <div className="question-modal-content">
            <QuestionContent question={question} />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setQuestion(null)}>
              Tutup
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setSelected([question.id]);
                setQuestion(null);
                setBulk(true);
              }}
            >
              <Plus size={15} />
              Buat konten dari soal
            </button>
          </div>
        </Modal>
      )}
      {bulk && (
        <QuestionPicker
          data={data}
          initial={selected}
          onClose={() => setBulk(false)}
          onCreate={async (ids, framework) => {
            await api("/tasks/bulk", "POST", { questionIds: ids, framework });
            await reload();
            setSelected([]);
            setBulk(false);
            notify(`${ids.length} tugas dibuat. Lihat di Board konten.`);
          }}
        />
      )}
      {newRef && (
        <Modal
          title="Simpan inspirasi baru"
          subtitle="Tautkan video, tren, atau bahan rujukan ke ceritamu."
          onClose={() => setNewRef(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const body = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await api("/references", "POST", body);
                await reload();
                setNewRef(false);
                notify("Referensi berhasil disimpan.");
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <label className="field">
              Judul referensi
              <input
                name="title"
                required
                placeholder="Apa yang menarik dari referensi ini?"
              />
            </label>
            <label className="field">
              Tautan
              <input name="url" type="url" placeholder="https://…" />
            </label>
            <label className="field">
              Catatan
              <textarea
                name="notes"
                rows={4}
                placeholder="Kenapa relevan? Bagian mana yang bisa jadi inspirasi?"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setNewRef(false)}
              >
                Batal
              </button>
              <button className="btn primary">Simpan referensi</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Coverage({
  data,
  onCreate,
}: {
  data: StudioData;
  onCreate: () => void;
}) {
  const covered = new Set(data.tasks.flatMap((t) => t.questionIds)),
    percentage = data.questions.length
      ? Math.round((covered.size / data.questions.length) * 100)
      : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Coverage konten</h1>
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          Buat dari soal
        </button>
      </div>
      <div className="coverage-grid">
        <section className="panel coverage-overview">
          <span className="eyebrow">CAKUPAN BANK SOAL</span>
          <h2>Soal terhubung</h2>
          <div
            className="coverage-ring"
            style={{
              background: `conic-gradient(#354be7 ${percentage}%,#edf0fb 0)`,
            }}
          >
            <div>
              <strong>{percentage}%</strong>
              <span>soal terhubung</span>
            </div>
          </div>
          <p>
            <strong>{covered.size}</strong> dari {data.questions.length} soal
            sudah punya konten
          </p>
          <button className="btn" onClick={onCreate}>
            Eksplorasi {data.questions.length - covered.size} soal lainnya{" "}
            <ArrowUpRight size={14} />
          </button>
        </section>
        <section className="panel framework-coverage">
          <h2>Komposisi framework</h2>
          {Object.entries(FRAMEWORKS).map(([key, f]) => {
            const count = data.tasks.filter((t) => t.framework === key).length;
            return (
              <div className="coverage-bar-row" key={key}>
                <div>
                  <Chip fw={key as Framework} />
                  <span>
                    <strong>{count}</strong> konten{" "}
                    <small>
                      {data.tasks.length
                        ? Math.round((count / data.tasks.length) * 100)
                        : 0}
                      %
                    </small>
                  </span>
                </div>
                <div className="coverage-bar">
                  <span
                    className={f.color}
                    style={{
                      width: `${data.tasks.length ? (count / data.tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>
      <div className="subject-coverage-grid">
        {[...new Set(data.questions.map((q) => q.subject))].map((s) => {
          const questions = data.questions.filter((q) => q.subject === s),
            used = questions.filter((q) => covered.has(q.id)).length;
          return (
            <section className="panel subject-coverage" key={s}>
              <span
                className={
                  "stat-icon " + (s === "Matematika" ? "blue" : "purple")
                }
              >
                <BookOpen size={20} />
              </span>
              <div>
                <h3>{s}</h3>
                <p>
                  {used} / {questions.length} soal sudah terhubung
                </p>
                <div className="coverage-bar">
                  <span
                    style={{ width: `${(used / questions.length) * 100}%` }}
                  />
                </div>
              </div>
              <a href="#content/library" aria-label={"Buka soal " + s}>
                <ArrowUpRight size={19} />
              </a>
            </section>
          );
        })}
      </div>
      <section className="panel pipeline-overview">
        <h2>Status produksi</h2>
        <div>
          {STATUSES.map((s, i) => (
            <a href="#content/board" key={s}>
              <span
                className="status-dot"
                style={{ background: statusColors[i] }}
              />
              <strong>{data.tasks.filter((t) => t.status === s).length}</strong>
              <span>{statusLabels[s]}</span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

function CalendarView({
  data,
  query,
  onCreate,
}: {
  data: StudioData;
  query: string;
  onCreate: () => void;
}) {
  const [month, setMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }),
    [day, setDay] = useState("");
  const year = month.getFullYear(),
    mo = month.getMonth(),
    offset = (month.getDay() + 6) % 7,
    days = new Date(year, mo + 1, 0).getDate();
  const tasks = data.tasks.filter(
    (t) => !query || t.title.toLowerCase().includes(query.toLowerCase()),
  );
  const unscheduled = tasks.filter((t) => !t.dueDate);
  const key = (d: number) =>
    `${year}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Kalender konten</h1>
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Plus size={16} />
          Tugas baru
        </button>
      </div>
      <section className="panel calendar-panel">
        <div className="calendar-heading">
          <h2>
            {month.toLocaleDateString("id-ID", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div>
            <button
              className="btn small"
              onClick={() =>
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
              }
            >
              Hari ini
            </button>
            <button
              className="icon-btn"
              aria-label="Bulan sebelumnya"
              onClick={() => setMonth(new Date(year, mo - 1, 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="icon-btn"
              aria-label="Bulan berikutnya"
              onClick={() => setMonth(new Date(year, mo + 1, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="calendar-weekdays">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from(
            { length: Math.ceil((offset + days) / 7) * 7 },
            (_, i) => {
              const d = i - offset + 1,
                date = key(d),
                items = tasks.filter((t) => t.dueDate === date),
                inMonth = d > 0 && d <= days;
              return (
                <div
                  key={i}
                  className={cn(
                    "calendar-cell",
                    !inMonth && "outside",
                    date === todayKey && "today",
                  )}
                  role={inMonth ? "button" : undefined}
                  tabIndex={inMonth ? 0 : undefined}
                  aria-label={
                    inMonth
                      ? `${d} ${month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}, ${items.length} konten`
                      : undefined
                  }
                  onKeyDown={(e) => {
                    if (inMonth && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setDay(date);
                    }
                  }}
                  onClick={() => inMonth && setDay(date)}
                >
                  {inMonth && (
                    <>
                      <span className="calendar-day">{d}</span>
                      {items.slice(0, 3).map((t) => (
                        <a
                          href={"#content/task/" + t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDay("");
                          }}
                          key={t.id}
                          className={
                            "calendar-task " + FRAMEWORKS[t.framework].color
                          }
                        >
                          {t.title}
                        </a>
                      ))}
                      {items.length > 3 && (
                        <button
                          className="text-btn"
                          onClick={() => setDay(date)}
                        >
                          +{items.length - 3} lainnya
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            },
          )}
        </div>
      </section>
      <section className="panel unscheduled">
        <div>
          <h2>
            <Clock3 size={18} />
            Belum dijadwalkan{" "}
            <span className="count-pill">{unscheduled.length}</span>
          </h2>
          <p>
            Buka tugas dan atur tanggal target untuk menampilkannya di kalender.
          </p>
        </div>
        <div className="unscheduled-list">
          {unscheduled.slice(0, 5).map((t) => (
            <a
              href={"#content/task/" + t.id}
              key={t.id}
              onClick={() => setDay("")}
            >
              <span className="task-code">
                SJ-{String(t.number).padStart(3, "0")}
              </span>
              <strong>{t.title}</strong>
              <Chip fw={t.framework} />
              <ArrowUpRight size={15} />
            </a>
          ))}
        </div>
        {unscheduled.length > 5 && (
          <a className="text-btn" href="#content/table">
            Lihat {unscheduled.length - 5} tugas lainnya{" "}
            <ArrowRight size={14} />
          </a>
        )}
      </section>
      {day && (
        <Modal
          title={new Date(day + "T12:00:00").toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          onClose={() => setDay("")}
        >
          <div
            className="day-tasks"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setDay("");
            }}
          >
            {tasks.filter((t) => t.dueDate === day).length ? (
              tasks
                .filter((t) => t.dueDate === day)
                .map((t) => (
                  <TaskCard
                    task={t}
                    key={t.id}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                  />
                ))
            ) : (
              <Empty
                title="Ruang untuk cerita baru"
                description="Belum ada konten dengan tanggal target ini."
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
