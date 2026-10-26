import { useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Icon } from "../components/ui/Icon";
import {
  chooseAssetDirectory,
  connectBrowserAssetDirectory,
  disconnectAssetDirectory,
  initializeAssetLibrary,
  libraryAssets,
  useAssetLibrary,
} from "./assets";

export function AssetPackSettings() {
  const pack = useAssetLibrary();
  const folderInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function manage(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-stack">
      <div className="panel-heading settings-panel-head">
        <div>
          <p className="settings-eyebrow">Library</p>
          <h2>Assets</h2>
          <p>Connect an external asset pack folder for the Library tab.</p>
        </div>
        <span
          className={`storage-status ${pack.connected ? "storage-status--ready" : ""}`}
        >
          <span className="storage-status-dot" aria-hidden="true" />
          {pack.connected ? `${libraryAssets.length} assets` : "Not connected"}
        </span>
      </div>
      <section className="settings-card" aria-label="Asset library folder">
        <div>
          <h3>{pack.connected ? pack.name : "Connect an asset folder"}</h3>
          <p>
            {pack.connected
              ? `${libraryAssets.length} assets · ${pack.directory}`
              : "Install asset packs separately to keep the app small."}
          </p>
        </div>
        <div className="row">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              isTauri()
                ? void manage(chooseAssetDirectory)
                : folderInput.current?.click()
            }
          >
            {busy
              ? "Loading…"
              : pack.connected
                ? "Change folder"
                : "Choose asset folder"}
          </button>
          {isTauri() && pack.connected && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void manage(initializeAssetLibrary)}
            >
              Refresh
            </button>
          )}
          {(pack.connected || pack.error) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void manage(disconnectAssetDirectory)}
            >
              Disconnect
            </button>
          )}
        </div>
        {!isTauri() && (
          <p className="settings-note">
            <Icon name="help" size={15} />
            <span>
              Selected folders are available for this browser session.
            </span>
          </p>
        )}
        {(error || pack.error) && <p role="alert">{error || pack.error}</p>}
        <input
          ref={folderInput}
          type="file"
          hidden
          multiple
          {...{ webkitdirectory: "" }}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files || []);
            if (files.length)
              void manage(() => connectBrowserAssetDirectory(files));
            event.currentTarget.value = "";
          }}
        />
      </section>
      <p className="settings-note">
        <Icon name="check" size={15} />
        <span>
          Placed media is embedded in local canvases, so designs stay usable if
          the pack moves or is disconnected.
        </span>
      </p>
    </div>
  );
}
