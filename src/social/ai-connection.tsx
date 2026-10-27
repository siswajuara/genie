import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSocial } from "./client";

type Model = { providerID: string; id: string; name: string };
export function AIConnection() {
  const social = useSocial();
  const [url, setUrl] = useState(social.config.opencode?.url || "");
  const [model, setModel] = useState(social.config.opencode?.model || "");
  const [token, setToken] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const tokenConfigured = social.config.opencode?.tokenConfigured;
  async function save(removeToken = false) {
    setBusy("save");
    setError("");
    setMessage("");
    try {
      await social.save("opencode", {
        url: url.trim(),
        model: model.trim(),
        ...(removeToken
          ? { removeToken: true }
          : token.trim()
            ? { token: token.trim() }
            : {}),
      });
      setToken("");
      setModels([]);
      setMessage(
        removeToken
          ? "OpenCode service token removed."
          : "OpenCode settings saved.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }
  async function loadModels() {
    setBusy("models");
    setError("");
    setMessage("");
    try {
      const result = await social.request<Model[]>("ai.models");
      setModels(result);
      setMessage(
        `${result.length} ${result.length === 1 ? "model" : "models"} available from the saved connection.`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="settings-stack">
      <div className="panel-heading settings-panel-head">
        <div>
          <p className="settings-eyebrow">AI generation</p>
          <h2>Write with OpenCode</h2>
          <p>
            Generate ordered scene content, equations, physics parameters, and
            narration scripts.
          </p>
        </div>
      </div>
      <section
        className="settings-card provider-settings"
        aria-label="OpenCode generation"
      >
        <div className="settings-card-head">
          <h3>OpenCode</h3>
          <span className="connection-badge">
            {social.config.opencode?.url
              ? "Service URL saved"
              : "Automatic local service"}
          </span>
        </div>
        <p>
          Beam Free via OpenCode Go. Leave blank to use the automatic local
          service.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="generate-connection-form"
        >
          <Label htmlFor="opencode-url">Service URL</Label>
          <Input
            id="opencode-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Blank: start or reuse the local service"
            autoComplete="off"
            disabled={!!busy}
          />
          <Label htmlFor="opencode-token">Service token</Label>
          <Input
            id="opencode-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={
              tokenConfigured
                ? "Token saved · enter to replace"
                : "Bearer token for a service URL"
            }
            autoComplete="new-password"
            disabled={!!busy}
          />
          <Label htmlFor="opencode-model">Model override</Label>
          <Input
            id="opencode-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="Automatic: opencode-go/beam-free"
            autoComplete="off"
            disabled={!!busy}
          />
          <div className="generate-actions">
            <Button type="submit" variant="primary" disabled={!!busy}>
              {busy === "save" ? "Saving…" : "Save settings"}
            </Button>
            <Button
              type="button"
              disabled={!!busy}
              title="Check the saved connection without generating content"
              onClick={() => void loadModels()}
            >
              {busy === "models" ? "Loading models…" : "Load models"}
            </Button>
            {tokenConfigured && (
              <Button
                type="button"
                disabled={!!busy}
                onClick={() => void save(true)}
              >
                Remove token
              </Button>
            )}
          </div>
        </form>
        {models.length > 0 && (
          <>
            <Label htmlFor="opencode-catalog">Available models</Label>
            <select
              id="opencode-catalog"
              className="generate-select"
              value={model}
              disabled={!!busy}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="">Automatic · Beam Free</option>
              {models.map((entry) => (
                <option
                  key={`${entry.providerID}/${entry.id}`}
                  value={`${entry.providerID}/${entry.id}`}
                >
                  {entry.name} · {entry.providerID}/{entry.id}
                </option>
              ))}
            </select>
            <p className="settings-note">Save to apply.</p>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </section>
    </div>
  );
}
