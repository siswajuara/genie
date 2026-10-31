import { localStore, flushLocalStore } from "../lib/local-store";
import { saveExport } from "../lib/export";
import { socialRequest } from "../social/client";
import {
  FRAMEWORKS,
  STATUSES,
  type Task,
  type StudioData,
  type Question,
  type Reference,
} from "./types";
import { newTask, parseBeats } from "./task";

const key = "genie.content.v1";
type Library = Pick<StudioData, "tasks" | "questions" | "references">;
let queue: Promise<unknown> = Promise.resolve();
async function read(): Promise<Library> {
  const saved = localStore.getItem(key);
  if (saved) return JSON.parse(saved);
  if (import.meta.env.DEV) {
    const response = await fetch("/api/genie-content/legacy");
    if (response.ok) {
      const migrated = parseBackup(await response.json());
      await write(migrated);
      return migrated;
    }
    if (response.status !== 404)
      throw Error(
        "Could not read the existing Content Studio backup. Retry before starting a new library.",
      );
  }
  const seed = structuredClone(
    (await import("./seed.json")).default,
  ) as unknown as Library;
  seed.references.forEach((r) => {
    if (r.id === "storytelling-guide")
      r.image = new URL("./storytelling.jpg", import.meta.url).href;
  });
  await write(seed);
  return structuredClone(seed);
}
async function write(data: Library) {
  localStore.setItem(key, JSON.stringify(data));
  await flushLocalStore();
}
function validDate(date: unknown) {
  return (
    date === "" ||
    (typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date)
  );
}
export function validateTask(task: Task, data: Library, previous?: Task) {
  if (typeof task.title !== "string" || !task.title.trim())
    throw Error("Judul tugas wajib diisi.");
  if (
    !STATUSES.includes(task.status) ||
    !Object.hasOwn(FRAMEWORKS, task.framework)
  )
    throw Error("Status atau framework tidak valid.");
  if (
    !Array.isArray(task.questionIds) ||
    task.questionIds.some((id) => !data.questions.some((q) => q.id === id))
  )
    throw Error("Soal tidak ditemukan.");
  if (
    !validDate(task.dueDate) ||
    !task.checks ||
    ["visual", "answer", "caption"].some(
      (k) => typeof task.checks[k as keyof Task["checks"]] !== "boolean",
    )
  )
    throw Error("Data tugas tidak valid.");
  if (
    !task.script ||
    typeof task.script !== "object" ||
    Array.isArray(task.script) ||
    Object.values(task.script).some((v) => typeof v !== "string")
  )
    throw Error("Naskah tidak valid.");
  for (const field of [
    "subject",
    "segment",
    "priority",
    "owner",
    "platform",
    "referenceId",
    "caption",
    "hashtags",
    "visualNotes",
    "accuracyNotes",
    "target",
    "format",
    "duration",
  ] as const) {
    if (typeof task[field] !== "string") throw Error("Data teks tidak valid.");
  }
  if (
    task.referenceId &&
    !data.references.some((r) => r.id === task.referenceId)
  )
    throw Error("Referensi tidak ditemukan.");
  if (
    previous &&
    JSON.stringify(previous.questionIds) !== JSON.stringify(task.questionIds)
  )
    task.checks = { ...task.checks, answer: false };
  if (STATUSES.indexOf(task.status) >= 3 && !task.checks.answer)
    throw Error(
      "Verifikasi jawaban / akurasi terlebih dahulu sebelum masuk Review atau tahap berikutnya.",
    );
  return task;
}
export function mergeImport(
  data: Library,
  incoming: { questions: Question[]; tasks: Task[] },
) {
  let questions = 0,
    tasks = 0;
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const source = (s: string) => s.replace(/\.(md|xlsx)$/i, "");
  for (const q of incoming.questions) {
    if (
      data.questions.some(
        (old) =>
          old.id === q.id ||
          (old.subject === q.subject &&
            old.number === q.number &&
            (normalize(old.stem) === normalize(q.stem) ||
              source(old.source) === source(q.source))),
      )
    )
      continue;
    data.questions.push(q);
    questions++;
  }
  for (const t of incoming.tasks) {
    if (
      data.tasks.some(
        (old) =>
          old.id === t.id ||
          (old.source === t.source && old.number === t.number),
      )
    )
      continue;
    data.tasks.push(validateTask(t, data));
    tasks++;
  }
  return {
    questions,
    tasks,
    skipped:
      incoming.questions.length + incoming.tasks.length - questions - tasks,
  };
}
export function contentApi<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const data = await read();
      const b = body as any;
      let result: unknown;
      if (path === "/data")
        return {
          ...data,
          settings: { model: "beam-free" },
          aiAvailable: true,
        } as T;
      const match = path.match(/^\/tasks\/([^/]+)$/);
      if (match) {
        const current = data.tasks.find((t) => t.id === match[1]);
        if (!current) throw Error("Tugas tidak ditemukan.");
        if (method === "DELETE") {
          data.tasks = data.tasks.filter((t) => t.id !== current.id);
          result = { ok: true };
        } else if (method === "PATCH") {
          const allowed = [
            "title",
            "subject",
            "segment",
            "framework",
            "status",
            "priority",
            "owner",
            "platform",
            "dueDate",
            "questionIds",
            "referenceId",
            "script",
            "caption",
            "hashtags",
            "checks",
            "visualNotes",
            "accuracyNotes",
            "target",
            "format",
            "duration",
            "aiDraft",
          ];
          const patch = Object.fromEntries(
            Object.entries(b).filter(([k]) => allowed.includes(k)),
          );
          const task = validateTask(
            { ...current, ...patch, updatedAt: new Date().toISOString() },
            data,
            current,
          );
          data.tasks = data.tasks.map((t) => (t.id === task.id ? task : t));
          result = task;
        }
      } else if (path === "/tasks" && method === "POST") {
        const task = validateTask(
          newTask({
            ...b,
            id: crypto.randomUUID(),
            number: Math.max(0, ...data.tasks.map((t) => t.number)) + 1,
          }),
          data,
        );
        data.tasks.push(task);
        result = task;
      } else if (path === "/tasks/bulk" && method === "POST") {
        if (!Array.isArray(b.questionIds) || !b.questionIds.length)
          throw Error("Pilih setidaknya satu soal.");
        let number = Math.max(0, ...data.tasks.map((t) => t.number));
        const tasks = [...new Set<string>(b.questionIds)].map((id) => {
          const q = data.questions.find((q) => q.id === id);
          if (!q) throw Error("Soal tidak ditemukan.");
          const fw = b.framework || q.framework;
          return validateTask(
            newTask({
              number: ++number,
              title: `${q.topic} · Soal ${q.number}`,
              subject: q.subject,
              framework: fw,
              questionIds: [id],
              script: fw === q.framework ? parseBeats(q.script, fw) : {},
              accuracyNotes:
                "Periksa kembali kunci dan pembahasan sebelum Review.",
            }),
            data,
          );
        });
        data.tasks.push(...tasks);
        result = tasks;
      } else if (path === "/references" && method === "POST") {
        if (
          typeof b.title !== "string" ||
          !b.title.trim() ||
          (b.url && !/^https?:\/\//i.test(b.url))
        )
          throw Error("Judul atau tautan referensi tidak valid.");
        const item: Reference = {
          id: crypto.randomUUID(),
          title: b.title.trim(),
          url: b.url || "",
          notes: b.notes || "",
        };
        data.references.push(item);
        result = item;
      } else if (path === "/import" && method === "POST") {
        const form = body as FormData,
          file = form.get("file") as File;
        if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
          throw Error("Pilih berkas maksimal 20 MB.");
        const subject = String(form.get("subject") || "") || undefined;
        const { importWorkbook, importMarkdown } = await import("./importers");
        let incoming;
        if (/\.xlsx$/i.test(file.name))
          incoming = await importWorkbook(
            await file.arrayBuffer(),
            file.name,
            subject,
          );
        else if (/\.md$/i.test(file.name))
          incoming = importMarkdown(await file.text(), file.name, subject);
        else throw Error("Format yang didukung: .xlsx dan .md.");
        result = mergeImport(data, incoming);
      }
      if (result === undefined) throw Error("Operasi konten tidak ditemukan.");
      await write(data);
      return result as T;
    });
  queue = operation;
  return operation;
}
export async function exportContent() {
  await queue.catch(() => {});
  const data = await read();
  return saveExport(
    new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "genie-content-studio.json",
  );
}
export async function draftTask(id: string) {
  const data = await contentApi<StudioData>("/data");
  const task = data.tasks.find((t) => t.id === id);
  if (!task) throw Error("Tugas tidak ditemukan.");
  const material = taskMaterial(task, data);
  const result = await socialRequest<{
    script: Record<string, string>;
    caption: string;
    hashtags: string;
    model: { providerID: string; modelID?: string; id?: string };
    prompt: string;
  }>("ai.content-draft", {
    confirmed: true,
    framework: task.framework,
    beats: [...FRAMEWORKS[task.framework].beats],
    material,
  });
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const latest = await read();
      const current = latest.tasks.find((t) => t.id === id);
      if (!current) throw Error("Tugas sudah dihapus.");
      const changed = JSON.stringify(current) !== JSON.stringify(task);
      const updated: Task = {
        ...current,
        ...(!changed
          ? {
              script: result.script,
              caption: result.caption,
              hashtags: result.hashtags,
              aiDraft: true,
            }
          : {}),
        aiHistory: [
          ...current.aiHistory,
          {
            prompt: result.prompt,
            output: JSON.stringify({
              script: result.script,
              caption: result.caption,
              hashtags: result.hashtags,
            }),
            model: `${result.model.providerID}/${result.model.modelID || result.model.id}`,
            date: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };
      latest.tasks = latest.tasks.map((t) => (t.id === id ? updated : t));
      await write(latest);
      return {
        state: changed ? "saved-to-history" : "complete",
        task: updated,
      };
    });
  queue = operation;
  return operation;
}
export function taskMaterial(task: Task, data: Library) {
  return JSON.stringify({
    task: {
      title: task.title,
      subject: task.subject,
      segment: task.segment,
      framework: task.framework,
      guidance: FRAMEWORKS[task.framework],
      audience: task.target,
      format: task.format,
      duration: task.duration,
      platform: task.platform,
      script: task.script,
      caption: task.caption,
      hashtags: task.hashtags,
      visualNotes: task.visualNotes,
      accuracyNotes: task.accuracyNotes,
    },
    questions: data.questions.filter((q) => task.questionIds.includes(q.id)),
    reference: data.references.find((r) => r.id === task.referenceId) || null,
  });
}
export async function linkTaskCanvas(
  id: string,
  link: NonNullable<Task["canvasLink"]>,
) {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const data = await read();
      const task = data.tasks.find((t) => t.id === id);
      if (!task) throw Error("Tugas tidak ditemukan.");
      const previous = task.canvasLink;
      task.canvasLink =
        previous?.projectId === link.projectId &&
        previous.pageId === link.pageId
          ? {
              ...link,
              frameIds: [...new Set([...previous.frameIds, ...link.frameIds])],
            }
          : link;
      await write(data);
    });
  queue = operation;
  return operation;
}

export function parseBackup(value: unknown): Library {
  const data = value as Library;
  if (
    !data ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.questions) ||
    !Array.isArray(data.references)
  )
    throw Error("Expected a Content Studio JSON backup.");
  const ids = new Set<string>();
  for (const item of [...data.tasks, ...data.questions, ...data.references]) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id))
      throw Error("Invalid or duplicated backup IDs.");
    ids.add(item.id);
  }
  for (const q of data.questions) {
    if (
      !Object.hasOwn(FRAMEWORKS, q.framework) ||
      !Number.isFinite(q.number) ||
      [
        "subject",
        "grade",
        "level",
        "package",
        "type",
        "topic",
        "stem",
        "answer",
        "explanation",
        "illustration",
        "script",
        "source",
      ].some((k) => typeof q[k as keyof Question] !== "string") ||
      !q.options ||
      typeof q.options !== "object" ||
      Array.isArray(q.options) ||
      Object.values(q.options).some((v) => typeof v !== "string")
    )
      throw Error("Invalid question in backup.");
  }
  for (const r of data.references) {
    if (
      typeof r.title !== "string" ||
      typeof r.url !== "string" ||
      typeof r.notes !== "string" ||
      (r.url && !/^https?:\/\//i.test(r.url))
    )
      throw Error("Invalid reference in backup.");
    if (r.id === "storytelling-guide")
      r.image = new URL("./storytelling.jpg", import.meta.url).href;
    else if (r.image && !/^(https?:|data:image\/)/i.test(r.image))
      delete r.image;
  }
  for (const task of data.tasks) {
    validateTask(task, data);
    if (
      !Number.isFinite(task.number) ||
      !Array.isArray(task.aiHistory) ||
      task.aiHistory.some(
        (entry) =>
          !entry ||
          ["prompt", "output", "model", "date"].some(
            (k) => typeof entry[k as keyof typeof entry] !== "string",
          ),
      )
    )
      throw Error("Invalid task history in backup.");
  }
  return {
    tasks: data.tasks,
    questions: data.questions,
    references: data.references,
  };
}
export function restoreContent(file: File) {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      if (file.size > 20 * 1024 * 1024)
        throw Error("Pilih backup maksimal 20 MB.");
      const data = parseBackup(JSON.parse(await file.text()));
      await write(data);
    });
  queue = operation;
  return operation;
}

// Receipt reconciliation is separate from editing a local workflow stage.
export function advanceTaskPublication(
  id: string,
  status: "Scheduled" | "Published",
) {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const data = await read();
      const task = data.tasks.find((task) => task.id === id);
      if (!task || !task.checks.answer || task.status === status) return;
      if (status === "Scheduled" && task.status === "Published") return;
      task.status = status;
      task.updatedAt = new Date().toISOString();
      await write(data);
    });
  queue = operation;
  return operation;
}
