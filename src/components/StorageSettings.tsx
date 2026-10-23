import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { prepareLocalSave, useLocalStorageStatus } from "../lib/localStore";

type Stats = {
  directory: string;
  databaseBytes: number;
  backupBytes: number;
  assistantBytes: number;
  freeBytes: number | null;
  imageCount: number;
  imageBytes: number;
  documentBytes: number;
};
function size(bytes: number) {
  return (
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
      bytes / 1024 / 1024,
    ) + " MB"
  );
}
export function StorageSettings() {
  const status = useLocalStorageStatus();
  const [stats, setStats] = useState<Stats>();
  const [browser, setBrowser] = useState<StorageEstimate>();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function refresh() {
    if (isTauri()) setStats(await invoke("disk_stats"));
    else setBrowser(await navigator.storage?.estimate?.());
  }
  useEffect(() => {
    void refresh().catch((error) => setError(String(error)));
  }, []);
  async function run(action: "save" | "backup" | "optimize" | "reveal") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await prepareLocalSave();
      if (action === "backup") {
        const path = await invoke<string>("disk_backup");
        setMessage(`Backup saved: ${path}`);
      } else if (action === "optimize") {
        const result = await invoke<{ reclaimedBytes: number }>(
          "disk_optimize",
        );
        setMessage(
          `Reclaimed ${size(result.reclaimedBytes)}. Your chats, canvases, and versions have been kept.`,
        );
      } else if (action === "reveal") await invoke("disk_reveal");
      else setMessage("All pending changes have been saved.");
      await refresh();
    } catch (error) {
      setError(String(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Storage on this device</h2>
          <p>Manage local chats, canvases, images, and backups.</p>
        </div>
      </div>
      <p role="status">
        {status.error
          ? "Some changes have not been saved."
          : status.saving
            ? "Saving changes…"
            : "Local library ready."}
      </p>
      {stats ? (
        <>
          <div className="settings-preference">
            <div>
              <strong>Canvas and chat library</strong>
              <p>
                {stats.imageCount} unique images. Shared images are stored once
                across designs and versions.
              </p>
            </div>
            <span>{size(stats.databaseBytes)}</span>
          </div>
          <div className="settings-preference">
            <div>
              <strong>Backups</strong>
              <p>Includes the original imported data and backups you create.</p>
            </div>
            <span>{size(stats.backupBytes)}</span>
          </div>
          <div className="settings-preference">
            <div>
              <strong>Assistant working files</strong>
              <p>Files created while working with your assistant.</p>
            </div>
            <span>{size(stats.assistantBytes)}</span>
          </div>
          {stats.freeBytes !== null && (
            <div className="settings-preference">
              <strong>Available disk space</strong>
              <span>{size(stats.freeBytes)}</span>
            </div>
          )}
          <p
            className="settings-explanation"
            style={{ overflowWrap: "anywhere" }}
          >
            {stats.directory}
          </p>
        </>
      ) : isTauri() ? (
        <p>Reading storage usage…</p>
      ) : (
        <p>
          Browser library:{" "}
          {browser?.usage == null ? "Usage unavailable" : size(browser.usage)}
          {browser?.quota ? ` of ${size(browser.quota)} available` : ""}. Your
          browser manages this storage. Keep exports before clearing website
          data.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button disabled={busy} onClick={() => void run("save")}>
          {busy ? "Working…" : "Save now / retry"}
        </button>
        {isTauri() && (
          <>
            <button disabled={busy} onClick={() => void run("backup")}>
              Create library backup
            </button>
            <button disabled={busy} onClick={() => void run("optimize")}>
              Reclaim unused space
            </button>
            <button disabled={busy} onClick={() => void run("reveal")}>
              Open storage folder
            </button>
          </>
        )}
      </div>
      <p className="settings-explanation">
        Reclaiming space removes images no longer referenced by your library and
        compacts its database. Existing versions and backups are retained. Use
        Canvases to export or delete individual designs.
      </p>
      {(error || status.error) && <p role="alert">{error || status.error}</p>}
      {message && (
        <p role="status" style={{ overflowWrap: "anywhere" }}>
          {message}
        </p>
      )}
    </>
  );
}
