import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { flushLocalStore } from "../lib/local-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { version as browserVersion } from "../../package.json";
import { Icon } from "./ui/icon";
import { Accordion } from "./ui/accordion";
type Phase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "installed"
  | "installing";
type State = {
  version: string;
  enabled: boolean;
  reason: string;
  phase: Phase;
  available: string;
  notes: string;
  error: string;
  checkedAt: string;
  progress: number | null;
  autoCheck: boolean;
  autoDownload: boolean;
  setAutoCheck: (value: boolean) => void;
  setAutoDownload: (value: boolean) => void;
  checkNow: () => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
};
const Context = createContext<State | null>(null);
const preference = (key: string, fallback: boolean) => {
  try {
    return localStorage.getItem(key) === "false"
      ? false
      : localStorage.getItem(key) === "true"
        ? true
        : fallback;
  } catch {
    return fallback;
  }
};
const releases = "https://github.com/siswajuara/genie/releases";
export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState({
      version: browserVersion,
      enabled: false,
      reason: isTauri()
        ? "Loading update settings…"
        : "Updates are available in the installed desktop app.",
    }),
    [phase, setPhase] = useState<Phase>("idle"),
    [available, setAvailable] = useState(""),
    [notes, setNotes] = useState(""),
    [error, setError] = useState(""),
    [checkedAt, setCheckedAt] = useState(""),
    [progress, setProgress] = useState<number | null>(null);
  const [autoCheck, setCheckPreference] = useState(() =>
      preference("genie.updates.autoCheck", true),
    ),
    [autoDownload, setDownloadPreference] = useState(() =>
      preference("genie.updates.autoDownload", true),
    );
  const resource = useRef<Update | null>(null),
    busy = useRef(false),
    mounted = useRef(true),
    auto = useRef(autoDownload);
  auto.current = autoDownload;
  useEffect(() => {
    mounted.current = true;
    if (isTauri())
      void invoke<typeof status>("update_status")
        .then((value) => {
          if (mounted.current) setStatus(value);
        })
        .catch((err) => {
          if (mounted.current)
            setStatus((old) => ({ ...old, reason: String(err) }));
        });
    return () => {
      mounted.current = false;
      void resource.current?.close().catch(() => {});
    };
  }, []);
  const download = useCallback(async () => {
    if (busy.current || !resource.current) return;
    busy.current = true;
    setError("");
    setPhase("downloading");
    let bytes = 0,
      total = 0;
    setProgress(null);
    try {
      await resource.current.download(
        (event) => {
          if (!mounted.current) return;
          if (event.event === "Started") {
            total = event.data.contentLength || 0;
            bytes = 0;
          }
          if (event.event === "Progress") bytes += event.data.chunkLength;
          setProgress(
            total ? Math.min(100, Math.round((bytes / total) * 100)) : null,
          );
        },
        { timeout: 120000 },
      );
      if (mounted.current) {
        setPhase("ready");
        setProgress(100);
      }
    } catch (err) {
      if (mounted.current) {
        setError(`Download failed: ${String(err)}`);
        setPhase("available");
      }
    } finally {
      busy.current = false;
    }
  }, []);
  const checkNow = useCallback(async () => {
    if (!status.enabled || busy.current) return;
    busy.current = true;
    setError("");
    setPhase("checking");
    try {
      const previous = resource.current;
      resource.current = null;
      setAvailable("");
      setNotes("");
      await previous?.close().catch(() => {});
      const update = await check({ timeout: 20000 });
      if (!mounted.current) {
        await update?.close();
        return;
      }
      resource.current = update;
      setAvailable(update?.version || "");
      setNotes(update?.body || "");
      setCheckedAt(new Date().toISOString());
      setPhase(update ? "available" : "idle");
      busy.current = false;
      if (update && auto.current) await download();
    } catch (err) {
      if (mounted.current) {
        setError(`Could not check for updates: ${String(err)}`);
        setPhase(resource.current ? "available" : "idle");
      }
    } finally {
      busy.current = false;
    }
  }, [status.enabled, download]);
  useEffect(() => {
    if (!autoCheck || !status.enabled) return;
    const first = setTimeout(() => {
        if (!resource.current) void checkNow();
      }, 5000),
      timer = setInterval(
        () => {
          if (!resource.current) void checkNow();
        },
        6 * 60 * 60 * 1000,
      );
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [autoCheck, status.enabled, checkNow]);
  async function install() {
    if (
      busy.current ||
      !resource.current ||
      !["ready", "installed"].includes(phase)
    )
      return;
    busy.current = true;
    setError("");
    let installed = phase === "installed";
    try {
      const persistence = { errors: [] as string[] };
      window.dispatchEvent(
        new CustomEvent("genie:prepare-update", { detail: persistence }),
      );
      if (persistence.errors.length) throw Error(persistence.errors.join(" "));
      await flushLocalStore();
      if (!installed) {
        setPhase("installing");
        await resource.current.install();
        installed = true;
        setPhase("installed");
      }
      await relaunch();
    } catch (err) {
      setError(
        `${installed ? "Update installed, but restart failed" : "Could not install update"}: ${String(err)}`,
      );
      setPhase(installed ? "installed" : "ready");
    } finally {
      busy.current = false;
    }
  }
  function savePreference(key: string, value: boolean) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      setError("The update preference could not be saved on this device.");
    }
  }
  return (
    <Context.Provider
      value={{
        ...status,
        phase,
        available,
        notes,
        error,
        checkedAt,
        progress,
        autoCheck,
        autoDownload,
        setAutoCheck: (value) => {
          setCheckPreference(value);
          savePreference("genie.updates.autoCheck", value);
        },
        setAutoDownload: (value) => {
          setDownloadPreference(value);
          savePreference("genie.updates.autoDownload", value);
        },
        checkNow,
        download,
        install,
      }}
    >
      {children}
    </Context.Provider>
  );
}
function useUpdates() {
  const value = useContext(Context);
  if (!value) throw Error("UpdateProvider is missing.");
  return value;
}
export function UpdateSettings() {
  const u = useUpdates();
  return (
    <section className="settings-card update-settings" aria-label="App updates">
      <div className="settings-card-head">
        <div>
          <h3>App updates</h3>
          <p className="provider-hint">
            Installed version <strong>{u.version}</strong>. Stable releases are
            downloaded from GitHub and verified before installation.
          </p>
        </div>
        <span
          className={`connection-badge ${u.available ? "saved" : "connected"}`}
        >
          <span className="badge-dot" aria-hidden="true" />
          {u.available ? `v${u.available}` : `v${u.version}`}
        </span>
      </div>
      <Label className="update-toggle">
        <Checkbox
          checked={u.autoCheck}
          onCheckedChange={(checked) => u.setAutoCheck(checked === true)}
        />
        <span>
          <strong>Check automatically</strong>
          <small>On startup and every six hours</small>
        </span>
      </Label>
      <Label className="update-toggle">
        <Checkbox
          checked={u.autoDownload}
          onCheckedChange={(checked) => u.setAutoDownload(checked === true)}
        />
        <span>
          <strong>Download updates automatically</strong>
          <small>Install when you are ready</small>
        </span>
      </Label>
      <div className="row update-actions">
        <Button
          disabled={!u.enabled || !["idle", "available"].includes(u.phase)}
          onClick={() => void u.checkNow()}
        >
          {u.phase === "checking" ? "Checking…" : "Check for updates"}
        </Button>
        <Button
          className="provider-outline"
          onClick={() => {
            if (isTauri()) void openUrl(releases);
            else window.open(releases, "_blank", "noopener,noreferrer");
          }}
        >
          GitHub releases
        </Button>
      </div>
      {!u.enabled && <p className="hint">{u.reason}</p>}
      {u.checkedAt && (
        <p className="hint update-checked">
          Last checked {new Date(u.checkedAt).toLocaleString()}
          {!u.available && !u.error
            ? " · You have the latest available version."
            : ""}
        </p>
      )}
      <UpdateControls />
    </section>
  );
}
function UpdateControls() {
  const u = useUpdates(),
    [confirm, setConfirm] = useState(false);
  return (
    <>
      {u.available && (
        <p role="status">
          {u.phase === "installed"
            ? `Version ${u.available} is installed. Restart to finish.`
            : u.phase === "ready"
              ? `Version ${u.available} is ready to install.`
              : u.phase === "downloading"
                ? `Downloading ${u.available}${u.progress !== null ? ` · ${u.progress}%` : ""}…`
                : u.phase === "installing"
                  ? "Installing update…"
                  : `Version ${u.available} is available.`}
        </p>
      )}
      {u.phase === "downloading" && (
        <Progress
          aria-label="Update download"
          max={100}
          value={u.progress ?? undefined}
        />
      )}{" "}
      {u.phase === "available" && (
        <Button className="primary" onClick={() => void u.download()}>
          Download update
        </Button>
      )}
      {u.phase === "ready" && !confirm && (
        <Button className="primary" onClick={() => setConfirm(true)}>
          Install & restart
        </Button>
      )}
      {u.phase === "installed" && (
        <Button className="primary" onClick={() => void u.install()}>
          Restart app
        </Button>
      )}
      {confirm && u.phase === "ready" && (
        <div className="update-confirm">
          <p>
            Save any unfinished social draft first. Your local canvases are
            kept. The app will close and restart.
          </p>
          <div className="row">
            <Button onClick={() => setConfirm(false)}>Later</Button>
            <Button
              className="primary"
              onClick={() => {
                setConfirm(false);
                void u.install();
              }}
            >
              Install now
            </Button>
          </div>
        </div>
      )}
      {u.error && (
        <p className="error" role="alert">
          {u.error}
        </p>
      )}
      {u.notes && (
        <Accordion title="Release notes">
          <pre>{u.notes}</pre>
        </Accordion>
      )}
    </>
  );
}
export function UpdateNotice() {
  const u = useUpdates(),
    [dismissed, setDismissed] = useState("");
  if (!u.available || dismissed === u.available) return null;
  return (
    <aside className="app-update-notice" aria-label="App update">
      <div className="update-notice-heading">
        <strong>Genie update</strong>
        <Button
          aria-label="Dismiss update notification"
          onClick={() => setDismissed(u.available)}
        >
          <Icon name="close" size={16} />
        </Button>
      </div>
      <UpdateControls />
    </aside>
  );
}
