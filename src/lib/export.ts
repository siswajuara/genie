import { invoke, isTauri } from "@tauri-apps/api/core";

export type ExportResult =
  { status: "saved"; path: string } | { status: "cancelled" | "downloaded" };
export function exportFilename(name: string) {
  let filename = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!filename) filename = "export";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename))
    filename = "_" + filename;
  return filename;
}
export async function saveExport(
  blob: Blob,
  name: string,
): Promise<ExportResult> {
  const filename = exportFilename(name);
  if (isTauri()) {
    // Raw IPC avoids expanding image bytes into a large JSON array. Encode Unicode filenames as ASCII JSON in the header.
    const header = JSON.stringify(filename).replace(
      /[^\x20-\x7e]/g,
      (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"),
    );
    const path = await invoke<string | null>(
      "save_export",
      new Uint8Array(await blob.arrayBuffer()),
      { headers: { "x-export-name": header } },
    );
    return path ? { status: "saved", path } : { status: "cancelled" };
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Browser download handlers may consume the blob after the click has returned.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { status: "downloaded" };
}
export function exportMessage(result: ExportResult) {
  return result.status === "saved"
    ? `Saved to ${result.path}`
    : result.status === "cancelled"
      ? "Export cancelled."
      : "Download started.";
}
