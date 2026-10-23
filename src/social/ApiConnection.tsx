import { useEffect, useState } from "react";
import {
  apiConnection,
  websiteRequest,
  type ApiConnection as Connection,
} from "./connection";
import { useSocial } from "./client";
export function ApiConnection() {
  const social = useSocial(),
    [connection, setConnection] = useState<Connection>(),
    [url, setUrl] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  useEffect(() => {
    void apiConnection()
      .then((value) => {
        setConnection(value);
        setUrl(value.url);
      })
      .catch((err) => setError(String(err)));
  }, []);
  return (
    <section className="provider-settings">
      <h3>Your website API</h3>
      <p>
        Publish, schedules, insights, and comments are stored by your website.
        Chat and Canvas stay on this device.
      </p>
      <label className="marketing-field">
        API URL
        <input
          value={url}
          onChange={(ev) => setUrl(ev.target.value)}
          placeholder="https://your-site.com/api/genie-social"
        />
      </label>
      <label className="marketing-field">
        Website API token
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(ev) => setToken(ev.target.value)}
          placeholder={
            connection?.configured
              ? "Token saved. Enter a replacement if needed."
              : "Paste the token issued by your website"
          }
        />
      </label>
      <div className="provider-actions">
        <button
          className="primary"
          disabled={busy || !url || (!token && !connection?.configured)}
          onClick={async () => {
            setBusy(true);
            setError("");
            setStatus("");
            try {
              setConnection(
                await apiConnection({ url, ...(token ? { token } : {}) }),
              );
              setToken("");
              await websiteRequest("settings", {});
              await social.refresh();
              setStatus("Connection saved. Provider status is shown below.");
            } catch (err) {
              setError(String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Connecting…" : "Save & connect"}
        </button>
        <button
          disabled={busy || !connection?.configured}
          onClick={async () => {
            try {
              setConnection(await apiConnection({ remove: true }));
              setToken("");
              setStatus("Website disconnected.");
              await social.refresh();
            } catch (err) {
              setError(String(err));
            }
          }}
        >
          Disconnect website
        </button>
      </div>
      <p className="hint">
        The desktop token is saved in your operating system credential vault.
        Browser previews keep it in memory until reload. Manage social accounts
        and provider credentials on your website.
      </p>
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
