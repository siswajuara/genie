import { useState } from "react";
import { useSocial } from "../social/client";
import { Icon } from "../components/ui/Icon";

export function StorySettings() {
  const social = useSocial(),
    config = social.config.cloudflare;
  const [accountId, setAccountId] = useState(config?.accountId ?? ""),
    [gatewayId, setGatewayId] = useState(config?.gatewayId ?? "");
  const [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function save(removeKey = false) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await social.save(
        "cloudflare",
        removeKey
          ? { removeKey: true }
          : { accountId, gatewayId, ...(key.trim() ? { key } : {}) },
      );
      setKey("");
      setMessage(
        removeKey
          ? "Cloudflare token removed."
          : "Saved in local config.json. No inference request was made.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-stack">
      <div className="panel-heading settings-panel-head">
        <div>
          <p className="settings-eyebrow">Connections</p>
          <h2>Story AI</h2>
          <p>Cloudflare Workers AI, with optional AI Gateway routing.</p>
        </div>
      </div>
      <form
        className="settings-card provider-settings"
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
      >
        <div className="provider-heading">
          <Icon name="film" size={22} />
          <h3>Cloudflare</h3>
          <span>{config?.configured ? "Configured" : "Not configured"}</span>
        </div>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <label className="marketing-field settings-field">
            Account ID
            <input
              aria-label="Cloudflare account ID"
              required
              maxLength={32}
              value={accountId}
              onChange={(ev) => setAccountId(ev.target.value.trim())}
              placeholder="32-character Cloudflare account ID"
              autoComplete="off"
            />
          </label>
          <label className="marketing-field settings-field">
            API token
            <input
              type="password"
              aria-label="Cloudflare API token"
              autoComplete="new-password"
              value={key}
              onChange={(ev) => setKey(ev.target.value)}
              placeholder={
                config?.configured
                  ? "Saved · leave blank to keep"
                  : "Cloudflare API token"
              }
            />
          </label>
          <label className="marketing-field settings-field">
            AI Gateway ID (optional)
            <input
              aria-label="Cloudflare gateway ID"
              maxLength={64}
              value={gatewayId}
              onChange={(ev) => setGatewayId(ev.target.value.trim())}
              placeholder="For example, default"
            />
          </label>
          <label className="marketing-field settings-field">
            Model
            <input
              readOnly
              value="@cf/openai/gpt-oss-120b"
              aria-label="Cloudflare model"
            />
          </label>
          <p className="hint">
            Use an API token with Workers AI access for this account. When
            routing through AI Gateway, also grant the required gateway access.
            The gateway ID selects a gateway in this same account.
          </p>
          <div className="provider-actions">
            <button type="submit" className="primary">
              {busy ? "Saving…" : "Save Cloudflare settings"}
            </button>
            <button
              type="button"
              disabled={!config?.configured}
              onClick={() => void save(true)}
            >
              Remove token
            </button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </form>
      <p className="settings-note">
        <Icon name="help" size={15} />
        <span>
          Only a Generate button in Story Creator starts inference. Usage comes
          from each provider response; tokens are not converted into estimated
          neurons or credits. Your token stays in config.json and is never sent
          to the model.
        </span>
      </p>
    </div>
  );
}
