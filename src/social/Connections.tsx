import { useEffect, useState } from "react";
import { Icon } from "../components/ui/Icon";
import { SelectField } from "../components/ui/Controls";
import { platforms } from "../marketing/store";
import { PlatformIcon } from "../marketing/Shared";
import { useSocial, openSocialUrl, type Provider } from "./client";
import "./social.css";
export function Connections() {
  const social = useSocial();
  return (
    <div className="social-connections">
      <div className="panel-heading">
        <div>
          <h2>Social connections</h2>
          <p>Save your provider keys, test them, then choose your channels.</p>
        </div>
        <button disabled={social.busy} onClick={() => void social.refresh()}>
          <Icon name="redo" size={15} />
          {social.busy ? "Refreshing…" : "Refresh accounts"}
        </button>
      </div>
      {social.error && (
        <p className="error" role="alert">
          {social.error}
        </p>
      )}
      <p className="settings-explanation">
        {social.config.storage === "keychain"
          ? "Keys are saved in your operating system credential vault. They are never included in project backups."
          : "Browser development keeps keys in server memory until the server restarts. Use the desktop app to save keys in your operating system credential vault."}
      </p>
      {(["buffer", "zernio"] as const).map((provider) => (
        <ProviderConnection key={provider} provider={provider} />
      ))}
      <h3>Connected channels</h3>
      <div className="social-account-list">
        {social.accounts.length ? (
          social.accounts.map((account) => (
            <div key={account.key}>
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
                {account.active ? "Connected" : "Reconnect needed"}
              </span>
            </div>
          ))
        ) : (
          <p className="hint">
            No channels loaded yet. Save a key and test the connection.
          </p>
        )}
      </div>
      <p className="settings-privacy">
        <Icon name="lock" size={16} /> Provider authorization opens in your
        browser. Social passwords are not stored here.
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
    [platform, setPlatform] = useState("instagram"),
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
  async function connect() {
    setBusy(true);
    setError("");
    try {
      if (provider === "zernio" && !resource)
        throw Error("Choose or create a Zernio profile first.");
      const result = await social.request<{ url: string }>("connect", {
        provider,
        platform,
        profileId: resource,
      });
      await openSocialUrl(result.url);
      setStatus(
        "Finish authorization in your browser, then refresh accounts here.",
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="provider-settings">
      <div className="provider-heading">
        <h3>{title}</h3>
        <span
          className={`connection-badge ${error || issue ? "error" : config.configured ? (accounts.length || status.startsWith("Connection verified.") ? "connected" : "saved") : ""}`}
        >
          {error || issue
            ? "Connection needs attention"
            : config.configured
              ? accounts.length || status.startsWith("Connection verified.")
                ? "Connected"
                : "Key saved · not verified"
              : "Not configured"}
        </span>
      </div>
      <p className="hint">
        {provider === "buffer"
          ? "Publish and schedule through your Buffer organization. Comments are handled by Zernio."
          : "Connect social accounts, upload media, publish, schedule, read analytics, and reply to comments."}
      </p>
      <label className="marketing-field">
        {title} API key
        <input
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
      </label>
      <div className="provider-resource">
        <label className="marketing-field">
          {provider === "buffer" ? "Organization" : "Profile"}
        </label>
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
        <button
          className="primary"
          disabled={busy || (!key.trim() && !config.configured)}
          onClick={() => void saveAndTest()}
        >
          {busy
            ? "Working…"
            : key.trim()
              ? "Save & test connection"
              : "Test connection"}
        </button>
        <button
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
        </button>
        {config.configured && (
          <button
            className="danger"
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
            Remove key
          </button>
        )}
      </div>
      {provider === "zernio" &&
        config.configured &&
        !social.profiles.length && (
          <div className="provider-create-profile">
            <input
              aria-label="New Zernio profile name"
              value={profileName}
              onChange={(ev) => setProfileName(ev.target.value)}
              placeholder="Profile name, for example Siswa Juara"
            />
            <button
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
            </button>
          </div>
        )}
      <div className="provider-connect">
        {provider === "zernio" && (
          <SelectField
            label="Platform to connect"
            value={platform}
            onChange={setPlatform}
            options={platforms.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        <button
          disabled={busy || (provider === "zernio" && !config.configured)}
          onClick={() => void connect()}
        >
          <Icon name="link" size={16} />
          {provider === "buffer" ? "Manage Buffer channels" : "Connect channel"}
        </button>
      </div>
      {status && (
        <p className="provider-status" role="status">
          {status}
        </p>
      )}
      {(error || issue) && (
        <p className="error" role="alert">
          {error || issue?.message}
        </p>
      )}
    </section>
  );
}
