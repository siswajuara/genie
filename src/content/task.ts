import { FRAMEWORKS, type Task, type Framework } from "./types";
export function newTask(input: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number: 0,
    title: "Konten baru",
    subject: "Informasi TKA",
    segment: "",
    framework: "HCIA",
    status: "Backlog",
    priority: "P2",
    owner: "",
    platform: "IG Reels",
    dueDate: "",
    questionIds: [],
    referenceId: "",
    script: {},
    caption: "",
    hashtags: "#SiswaJuara #TKASD",
    checks: { visual: false, answer: false, caption: false },
    visualNotes: "",
    accuracyNotes: "",
    target: "Orang tua SD kelas 4–6",
    format: "",
    duration: "",
    source: "Dibuat di Content Studio",
    aiDraft: false,
    aiHistory: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}
export function parseBeats(
  script: string,
  fw: Framework,
): Record<string, string> {
  const result: Record<string, string> = {};
  const aliases: Record<string, string> = {
    BEFORE: "Before",
    AFTER: "After",
    BRIDGE: "Bridge",
    HOOK: "Hook",
    CONTEXT: "Context",
    INSIGHT: "Insight",
    ACTION: "Action",
    PROBLEM: "Problem",
    AGITATE: "Agitate",
    SOLVE: "Solve",
    TREND: "Trend",
    EDUCATE: "Educate",
    KLAIM: "Klaim",
    PATAHAN: "Patahan",
    BUKTI: "Bukti",
    PELAJARAN: "Pelajaran",
    CLAIM: "Klaim",
    PIVOT: "Patahan",
    PROOF: "Bukti",
    TAKEAWAY: "Pelajaran",
  };
  const parts = [
    ...script.matchAll(/\[([^\]]+)\]\s*([\s\S]*?)(?=\[[^\]]+\]|$)/g),
  ];
  for (const p of parts) {
    const key =
      aliases[p[1].trim().toUpperCase()] ||
      (/CTA/.test(p[1])
        ? fw === "HCIA"
          ? "Action"
          : FRAMEWORKS[fw].beats.at(-1)!
        : "");
    if (key)
      result[key] = [result[key], p[2].trim()].filter(Boolean).join("\n\n");
  }
  return result;
}
