// Run with Bun to take a read-only snapshot of the standalone Content Studio.
import { Database } from "bun:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
const source = new URL("../content/.data/studio.sqlite", import.meta.url);
const db = new Database(source.pathname, { readonly: true });
try {
  const all = (kind: string) =>
    (
      db
        .query("SELECT data FROM records WHERE kind=? ORDER BY rowid")
        .all(kind) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: all("task"),
    questions: all("question"),
    references: all("reference"),
  };
  const directory = new URL("../.genie-content/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("legacy-backup.json", directory),
    JSON.stringify(data, null, 2) + "\n",
  );
  console.log(
    `Saved local backup: ${data.tasks.length} tasks, ${data.questions.length} questions. Original database unchanged.`,
  );
} finally {
  db.close();
}
