// Run with Bun. This authoring step does not start the source app or edit its data.
import { readFile, readdir, writeFile, copyFile } from "node:fs/promises";
import { importWorkbook } from "../src/content/importers";
import type { Task, Question } from "../src/content/types";
const source = new URL("../content/sources/", import.meta.url);
const data = {
  tasks: [] as Task[],
  questions: [] as Question[],
  references: [
    {
      id: "storytelling-guide",
      title: "5 teknik pembahasan video viral",
      url: "",
      notes:
        "Panduan visual HCIA, PAS, BAB, TIE, dan Sanggahan Mitos. Sumber: infographic yang disertakan bersama brief.",
      image: "",
    },
  ],
};
for (const file of (await readdir(source))
  .filter((f) => f.endsWith(".xlsx"))
  .sort()) {
  const result = await importWorkbook(
    await readFile(new URL(file, source)),
    file,
  );
  data.tasks.push(...result.tasks);
  data.questions.push(...result.questions);
}
await writeFile(
  new URL("../src/content/seed.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
await copyFile(
  new URL("WhatsApp Image 2026-10-30 at 18.17.49.jpeg", source),
  new URL("../src/content/storytelling.jpg", import.meta.url),
);
console.log(
  `Prepared ${data.tasks.length} tasks and ${data.questions.length} questions.`,
);
