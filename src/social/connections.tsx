import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Icon } from "../components/ui/icon";
import { SelectField } from "../components/ui/select";
import { PlatformIcon } from "../marketing/shared";
import { useSocial, type Provider } from "./client";
export function Connections() {
  const social = useSocial();
  return (
    <div className="social-connections settings-stack">
      <div className="panel-heading settings-panel-head">
        <div>
          <p className="settings-eyebrow">Connections</p>
          <h2>Social connections</h2>
          <p>Save your provider keys, test them, then choose your channels.</p>
        </div>
        <Button
          type="button"
          className="settings-refresh"
          disabled={social.busy}
          onClick={() => void social.refresh()}
        >
          <Icon name="redo" size={15} />
          {social.busy ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {social.error && (
        <p className="settings-alert is-error mt-2.5" role="alert">
          {social.error}
        </p>
      )}
      <p className="settings-note">
        <Icon name="help" size={15} />
        <span>
          Keys and provider settings are saved locally in config.json.
        </span>
      </p>
      <section className="settings-card" aria-label="Connected channels">
        <div className="settings-card-head">
          <h3>Connected channels</h3>
          {social.accounts.length > 0 && (
            <span className="settings-value-pill is-accent">
              {social.accounts.length} connected
            </span>
          )}
        </div>
        <div className="social-account-list">
          {social.accounts.length ? (
            social.accounts.map((account) => (
              <div key={account.key} className="social-account-row">
                <PlatformIcon id={account.platform} size={24} />
                <div>
                  <strong>{account.name}</strong>
                  <span>
                    {account.platform} ·{" "}
                    {account.provider === "buffer" ? "Buffer" : "Zernio"}
                    {account.username
                      ? ` · @${account.username.replace(/^@/, "")}`
                      : ""}
                  </span>
                </div>
                <span
                  className={`connection-badge ${account.active ? "connected" : "error"}`}
                >
                  <span className="badge-dot" aria-hidden="true" />
                  {account.active ? "Connected" : "Reconnect needed"}
                </span>
              </div>
            ))
          ) : (
            <div className="social-empty">
              <span className="settings-row-icon" aria-hidden="true">
                <Icon name="link" size={18} />
              </span>
              <div>
                <strong>No channels connected yet</strong>
                <span>
                  Save a key below and test the connection to load channels.
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
      {(["buffer", "zernio"] as const).map((provider) => (
        <ProviderConnection key={provider} provider={provider} />
      ))}
      <p className="settings-note">
        <Icon name="check" size={15} />
        <span>
          Drafts, plans, and delivery receipts stay in Genie. Provider requests
          go directly to Buffer and Zernio; the website social API is not used.
        </span>
      </p>
    </div>
  );
}
function ProviderConnection({ provider }: { provider: Provider }) {
  const social = useSocial(),
    config = social.config[provider];
  const [key, setKey] = useState(""),
    [resource, setResource] = useState(
      provider === "buffer"
        ? social.config.buffer.organizationId
        : social.config.zernio.profileId,
    ),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [profileName, setProfileName] = useState("");
  useEffect(
    () =>
      setResource(
        provider === "buffer"
          ? social.config.buffer.organizationId
          : social.config.zernio.profileId,
      ),
    [provider, social.config],
  );
  const title = provider === "buffer" ? "Buffer" : "Zernio",
    accounts = social.accounts.filter((a) => a.provider === provider),
    issue = social.issues.find((i) => i.provider === provider);
  async function saveAndTest() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (
        key.trim() ||
        resource !==
          (provider === "buffer"
            ? social.config.buffer.organizationId
            : social.config.zernio.profileId)
      )
        await social.save(provider, {
          ...(key.trim() ? { key: key.trim() } : {}),
          ...(provider === "buffer"
            ? { organizationId: resource }
            : { profileId: resource }),
        });
      setKey("");
      const result = await social.test(provider);
      setStatus(
        `Connection verified. ${result.accounts.length} channels available.`,
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-card provider-settings">
      <div className="settings-card-head">
        <div className="provider-title">
          <span className={`provider-dot is-${provider}`} aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <span
          className={`connection-badge ${error || issue ? "error" : config.configured ? (accounts.length || status.startsWith("Connection verified.") ? "connected" : "saved") : ""}`}
        >
          <span className="badge-dot" aria-hidden="true" />
          {error || issue
            ? "Needs attention"
            : config.configured
              ? accounts.length || status.startsWith("Connection verified.")
                ? "Connected"
                : "Key saved"
              : "Not configured"}
        </span>
      </div>
      <p className="provider-hint">
        {provider === "buffer"
          ? "Publish and schedule through your Buffer organization."
          : "Connect social accounts, upload media, publish, and schedule."}
      </p>
      <Label className="marketing-field settings-field">
        {title} API key
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(ev) => {
            setKey(ev.target.value);
            setStatus("");
          }}
          placeholder={
            config.configured
              ? "A key is saved. Enter a new key to replace it."
              : "Paste your API key"
          }
        />
      </Label>
      <div className="provider-resource">
        <Label className="marketing-field settings-field">
          {provider === "buffer" ? "Organization" : "Profile"}
        </Label>
        <SelectField
          label={`${title} ${provider === "buffer" ? "organization" : "profile"}`}
          value={resource}
          onChange={setResource}
          options={[
            {
              value: "",
              label:
                provider === "buffer"
                  ? "Use first available organization"
                  : "Choose a profile",
            },
            ...(provider === "buffer"
              ? social.organizations.map((o) => ({
                  value: o.id,
                  label: o.name,
                }))
              : social.profiles.map((p) => ({
                  value: p._id || p.id || "",
                  label: p.name,
                }))),
            ...(resource &&
            !(provider === "buffer"
              ? social.organizations.some((o) => o.id === resource)
              : social.profiles.some((p) => (p._id || p.id) === resource))
              ? [{ value: resource, label: resource }]
              : []),
          ]}
        />
      </div>
      <div className="provider-actions">
        <Button
          className="primary"
          disabled={busy || (!key.trim() && !config.configured)}
          onClick={() => void saveAndTest()}
        >
          {busy ? "Working…" : key.trim() ? "Save & test" : "Test connection"}
        </Button>
        <Button
          disabled={busy || !config.configured}
          onClick={async () => {
            setBusy(true);
            try {
              await social.save(provider, {
                [provider === "buffer" ? "organizationId" : "profileId"]:
                  resource,
              });
              await social.test(provider);
              setStatus("Selection saved.");
            } catch (err) {
              setError(String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save selection
        </Button>
        {config.configured && (
          <Button
            className="danger-ghost"
            disabled={busy}
            onClick={async () => {
              try {
                await social.save(provider, { removeKey: true });
                setStatus("");
                setError("");
                setKey("");
              } catch (err) {
                setError(String(err));
              }
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {provider === "zernio" &&
        config.configured &&
        !social.profiles.length && (
          <div className="provider-create-profile">
            <Input
              aria-label="New Zernio profile name"
              value={profileName}
              onChange={(ev) => setProfileName(ev.target.value)}
              placeholder="Profile name, for example Siswa Juara"
            />
            <Button
              disabled={busy || !profileName.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await social.request<{
                    profile?: { _id?: string; id?: string };
                  }>("createProfile", { name: profileName });
                  const id = result.profile?._id || result.profile?.id;
                  if (id) {
                    setResource(id);
                    await social.save(provider, { profileId: id });
                  }
                  await social.test(provider);
                  setProfileName("");
                } catch (err) {
                  setError(String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create profile
            </Button>
          </div>
        )}
      {status && (
        <p className="settings-alert is-success mt-2.5" role="status">
          {status}
        </p>
      )}
      {(error || issue) && (
        <p className="settings-alert is-error mt-2.5" role="alert">
          {error || issue?.message}
        </p>
      )}
    </section>
  );
}
