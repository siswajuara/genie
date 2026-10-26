import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { prepareLocalSave, useLocalStorageStatus } from "../lib/local-store";
import { Icon } from "./ui/icon";

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

function formatSize(bytes: number) {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) {
    return (
      new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
        mb / 1024,
      ) + " GB"
    );
  }
  return (
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(mb) +
    " MB"
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
          `Reclaimed ${formatSize(result.reclaimedBytes)}. Your canvases and versions have been kept.`,
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

  const storageState = status.error
    ? {
        label: "Needs attention",
        tone: "warn" as const,
        text: "Some changes have not been saved.",
      }
    : status.saving
      ? { label: "Saving…", tone: "busy" as const, text: "Saving changes…" }
      : {
          label: "Up to date",
          tone: "ready" as const,
          text: "Local library ready.",
        };

  const totalBytes = stats
    ? stats.databaseBytes + stats.backupBytes + stats.assistantBytes
    : 0;
  const segments = stats
    ? [
        { key: "library", value: stats.databaseBytes, className: "is-library" },
        { key: "backups", value: stats.backupBytes, className: "is-backup" },
        {
          key: "assistant",
          value: stats.assistantBytes,
          className: "is-assistant",
        },
      ]
    : [];

  return (
    <div className="storage-settings">
      <div className="panel-heading storage-head">
        <div>
          <h2>Storage on this device</h2>
          <p>Manage local canvases, images, and backups.</p>
        </div>
        <span
          className={`storage-status storage-status--${storageState.tone}`}
          role="status"
        >
          <span className="storage-status-dot" aria-hidden="true" />
          {storageState.label}
        </span>
      </div>

      {stats ? (
        <>
          <section className="storage-overview" aria-label="Library usage">
            <div className="storage-overview-top">
              <div>
                <p className="storage-overview-label">Library total</p>
                <p className="storage-overview-value">
                  {formatSize(totalBytes)}
                </p>
                <p className="storage-overview-sub">
                  {stats.imageCount} unique{" "}
                  {stats.imageCount === 1 ? "image" : "images"} ·{" "}
                  {storageState.text}
                </p>
              </div>
              {stats.freeBytes !== null && (
                <div className="storage-free">
                  <p className="storage-overview-label">Free on disk</p>
                  <p className="storage-free-value">
                    {formatSize(stats.freeBytes)}
                  </p>
                </div>
              )}
            </div>
            <div
              className="storage-bar"
              role="img"
              aria-label={`Library uses ${formatSize(totalBytes)}: canvas ${formatSize(stats.databaseBytes)}, backups ${formatSize(stats.backupBytes)}, archived files ${formatSize(stats.assistantBytes)}`}
            >
              {segments.map((segment) => (
                <span
                  key={segment.key}
                  className={`storage-bar-segment ${segment.className}`}
                  style={{
                    width: `${totalBytes > 0 ? Math.max((segment.value / totalBytes) * 100, segment.value > 0 ? 6 : 0) : 0}%`,
                  }}
                />
              ))}
            </div>
            <ul className="storage-legend" aria-hidden="true">
              <li>
                <span className="storage-swatch is-library" /> Library
              </li>
              <li>
                <span className="storage-swatch is-backup" /> Backups
              </li>
              <li>
                <span className="storage-swatch is-assistant" /> Archived files
              </li>
            </ul>
          </section>

          <section className="storage-list" aria-label="Storage breakdown">
            <div className="storage-row">
              <span className="storage-icon" aria-hidden="true">
                <Icon name="layers" size={18} />
              </span>
              <div className="storage-row-text">
                <strong>Canvas library</strong>
                <p>
                  {stats.imageCount} unique images. Shared images are stored
                  once across designs and versions.
                </p>
              </div>
              <span className="storage-size">
                {formatSize(stats.databaseBytes)}
              </span>
            </div>
            <div className="storage-row">
              <span className="storage-icon" aria-hidden="true">
                <Icon name="copy" size={18} />
              </span>
              <div className="storage-row-text">
                <strong>Backups</strong>
                <p>
                  Includes the original imported data and backups you create.
                </p>
              </div>
              <span className="storage-size">
                {formatSize(stats.backupBytes)}
              </span>
            </div>
            <div className="storage-row">
              <span className="storage-icon" aria-hidden="true">
                <Icon name="layers" size={18} />
              </span>
              <div className="storage-row-text">
                <strong>Archived working files</strong>
                <p>Working files retained from earlier versions of the app.</p>
              </div>
              <span className="storage-size">
                {formatSize(stats.assistantBytes)}
              </span>
            </div>
            <div className="storage-location">
              <span className="storage-icon" aria-hidden="true">
                <Icon name="expand" size={18} />
              </span>
              <div className="storage-row-text">
                <strong>Library location</strong>
                <p className="storage-path" title={stats.directory}>
                  {stats.directory}
                </p>
              </div>
              {isTauri() && (
                <Button
                  type="button"
                  className="storage-link-btn"
                  disabled={busy}
                  onClick={() => void run("reveal")}
                >
                  Open folder
                </Button>
              )}
            </div>
          </section>
        </>
      ) : isTauri() ? (
        <p className="storage-loading">Reading storage usage…</p>
      ) : (
        <div className="storage-overview">
          <p className="storage-overview-label">Browser library</p>
          <p className="storage-overview-value">
            {browser?.usage == null ? "—" : formatSize(browser.usage)}
          </p>
          <p className="storage-overview-sub">
            {browser?.quota ? `${formatSize(browser.quota)} available. ` : ""}
            Your browser manages this storage. Keep exports before clearing
            website data.
          </p>
        </div>
      )}

      <div className="storage-actions">
        <Button
          type="button"
          className="storage-primary"
          disabled={busy}
          onClick={() => void run("save")}
        >
          {busy ? "Working…" : "Save now"}
        </Button>
        {isTauri() && (
          <>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void run("backup")}
            >
              Create backup
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void run("optimize")}
            >
              Reclaim space
            </Button>
          </>
        )}
      </div>

      <p className="settings-explanation storage-note">
        <Icon name="help" size={15} />
        <span>
          Reclaiming space removes images no longer referenced by your library
          and compacts its database. Existing versions and backups are retained.
          Use Canvases to export or delete individual designs.
        </span>
      </p>

      {(error || status.error) && (
        <p role="alert" className="storage-alert storage-alert--error">
          {error || status.error}
        </p>
      )}
      {message && (
        <p role="status" className="storage-alert storage-alert--success">
          {message}
        </p>
      )}
    </div>
  );
}
