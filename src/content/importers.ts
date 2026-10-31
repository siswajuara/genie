import ExcelJS from "exceljs";
import JSZip from "jszip";

import { type Framework, type Question, type Task } from "./types";

export const stableId = (text: string) => {
  let a = 2166136261,
    b = 5381;
  for (const c of text) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ c.charCodeAt(0);
  }
  return [a, b].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
};
const framework = (value: string): Framework =>
  /debunk|sanggahan/i.test(value)
    ? "Debunking"
    : (["HCIA", "PAS", "BAB", "TIE"].find((f) =>
        value.toUpperCase().includes(f),
      ) as Framework) || "BAB";
const plain = (cell: ExcelJS.Cell) => {
  const v = cell.value;
  return v && typeof v === "object" && "richText" in v
    ? v.richText.map((x) => x.text).join("")
    : cell.text || "";
};
import { newTask } from "./task";
export { newTask, parseBeats } from "./task";
export async function importWorkbook(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
  subjectHint?: string,
) {
  // Some Excel exports prefix SpreadsheetML tags (x:workbook, x:row).
  // ExcelJS expects unprefixed tags. Normalize that namespace in memory.
  const zip = await JSZip.loadAsync(buffer);
  let normalized = false;
  for (const name of Object.keys(zip.files).filter((n) => n.endsWith(".xml"))) {
    const xml = await zip.file(name)!.async("string");
    const prefix = xml.match(
      /xmlns:([\w]+)="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/,
    )?.[1];
    if (prefix) {
      zip.file(
        name,
        xml
          .replace(new RegExp(`(<\\/?)${prefix}:`, "g"), "$1")
          .replace(`xmlns:${prefix}=`, `xmlns=`),
      );
      normalized = true;
    }
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (normalized
      ? await zip.generateAsync({ type: "uint8array" })
      : buffer) as any,
  );
  const tasks: Task[] = [],
    questions: Question[] = [];
  const master = workbook.getWorksheet("Master Storytelling");
  if (master) {
    const storyboard = workbook.getWorksheet("Storyboard Per Tahap");
    master.eachRow((row, index) => {
      if (index === 1 || !row.getCell(3).text) return;
      const c = (n: number) => plain(row.getCell(n));
      const no = Number(c(1));
      const fw = framework(c(4));
      const script: Record<string, string> = {};
      storyboard?.eachRow((r, i) => {
        if (i > 1 && Number(r.getCell(1).text) === no)
          script[plain(r.getCell(4))] = plain(r.getCell(5));
      });
      tasks.push(
        newTask({
          id: stableId(`plan:${filename}:${no}`),
          number: no,
          title: c(3),
          segment: c(2),
          framework: fw,
          script,
          visualNotes: c(10),
          accuracyNotes: c(17),
          caption: c(9),
          priority: c(16) || "P2",
          target: c(19),
          format: c(14),
          duration: c(15),
          platform: c(20) || "IG Reels",
          source: filename,
        }),
      );
    });
  } else {
    for (const sheet of workbook.worksheets) {
      const headers: Record<string, number> = {};
      sheet
        .getRow(1)
        .eachCell((c, i) => (headers[c.text.trim().toLowerCase()] = i));
      if (!headers["pertanyaan"]) continue;
      const isLanguage =
        !!headers["subkompetensi"] || /bind|bahasa/i.test(filename);
      const subject =
        subjectHint || (isLanguage ? "Bahasa Indonesia" : "Matematika");
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const c = (...keys: string[]) => {
          const col = keys.map((k) => headers[k]).find(Boolean);
          return col ? plain(row.getCell(col)) : "";
        };
        if (!c("pertanyaan")) return;
        const no = Number(c("no")) || index - 1;
        questions.push({
          id: stableId(`${subject}:${filename}:${no}`),
          number: no,
          subject,
          grade: "6 SD",
          level: c("level") || "Level 3",
          package: isLanguage ? "SD" : "A",
          type: c("tipe soal", "tipe") || "PG",
          topic: c("topik", "subkompetensi"),
          stem: c("pertanyaan"),
          options: Object.fromEntries(
            ["A", "B", "C", "D"]
              .map((k) => [
                k,
                c(`pilihan ${k.toLowerCase()}`, `opsi ${k.toLowerCase()}`),
              ])
              .filter(([, v]) => v),
          ),
          answer: c("kunci jawaban", "kunci"),
          explanation: c("pembahasan"),
          illustration: c("ilustrasi"),
          framework: framework(
            c("teknik storytelling") || (isLanguage ? "BAB" : ""),
          ),
          script: c("script konten (dengan cta)"),
          source: filename,
        });
      });
    }
  }
  if (!tasks.length && !questions.length)
    throw new Error(
      "Kolom tidak dikenali. Gunakan workbook Soal Campur SD atau Master Storytelling seperti berkas sumber.",
    );
  return { tasks, questions };
}
export function importMarkdown(
  text: string,
  filename: string,
  subjectHint?: string,
) {
  const subject =
    subjectHint ||
    (/bind|bahasa/i.test(filename + " " + text.slice(0, 150))
      ? "Bahasa Indonesia"
      : "Matematika");
  const sections = [
    ...text.matchAll(
      /^#{2,3}\s+Soal\s+(\d+)([^\n]*)\n([\s\S]*?)(?=^#{2,3}\s+Soal\s+\d+|$(?![\s\S]))/gm,
    ),
  ];
  const questions: Question[] = sections.map((m) => {
    const body = m[3]
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/^> ?/gm, "");
    const optionPattern =
      /^\s*(?:[-*]\s*)?(?:[⬜☐□]\s*|\[ \]\s*)?(?:\|\s*)?([A-D])[.)]\s*(.+)$/gm;
    const matches = [...body.matchAll(optionPattern)];
    const options = Object.fromEntries(
      matches.map((o) => [o[1], o[2].split(" |")[0].trim()]),
    );
    const beforeOptions = body.slice(
      0,
      matches[0]?.index ?? body.indexOf("Kunci"),
    );
    const stem = beforeOptions
      .replace(/^(Topik|Teknik Storytelling):.*$/gm, "")
      .replace(/^Bacaan:\s*/gm, "")
      .replace(/^Pertanyaan:\s*/gm, "")
      .split(/\n\|/)[0]
      .trim();
    const explanation =
      body
        .split(/Pembahasan(?:\s*\([^)]*\))?:\s*/i)[1]
        ?.split(/\n(?:---|#{2,3}|Prompt Ilustrasi|Ilustrasi)/)[0]
        ?.trim() || "";
    const illustration =
      body
        .split(/Prompt Ilustrasi[^\n]*\n/i)[1]
        ?.split(/\n(?:---|#{2,3})/)[0]
        ?.trim() || "";
    const script =
      body
        .split(/### [^\n]*Script Konten[^\n]*\n/)[1]
        ?.split(/\n---/)[0]
        ?.trim() || "";
    return {
      id: stableId(`${subject}:${filename}:${m[1]}`),
      number: Number(m[1]),
      subject,
      grade: "6 SD",
      level: /Sulit/i.test(m[2])
        ? "Sulit"
        : subject === "Matematika"
          ? "Level 3"
          : "Sedang",
      package: subject === "Matematika" ? "A" : "SD",
      type: /MCMA|Multiple|Multi Jawaban/.test(m[2])
        ? "MCMA"
        : /PGK|Kompleks/.test(m[2])
          ? "PGK"
          : "PG",
      topic:
        body.match(/^Topik:\s*(.+)/m)?.[1]?.trim() ||
        m[2].split("·").at(-1)?.replace(/\*/g, "").trim() ||
        "",
      stem,
      options,
      answer:
        body
          .match(/^(?:Kunci(?: Jawaban)?|Jawaban):\s*([^\n]+)/im)?.[1]
          ?.split(/\s+\*?\(/)[0]
          ?.trim() || "",
      explanation,
      illustration,
      framework: framework(
        body.match(/^Teknik Storytelling:\s*(.+)/m)?.[1] || "BAB",
      ),
      script,
      source: filename,
    };
  });
  if (!questions.length)
    throw new Error(
      "Markdown tidak berisi judul “## Soal 1” atau “### Soal 1”.",
    );
  return { tasks: [] as Task[], questions };
}
