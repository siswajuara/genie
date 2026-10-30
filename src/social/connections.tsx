import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Icon } from "../components/ui/icon";
import { SelectField } from "../components/ui/select";
import { PlatformIcon } from "../marketing/shared";
import { useSocial, type Account } from "./client";

type Usage = { providers: { tebar?: { observedAt: string; retryAt?: string; windows: { limit?: number; remaining?: number; resetAt?: string }[] } }; issues?: { message: string }[] };
async function openConnection(url: string) {
  if (isTauri()) {
    await openUrl(url);
  } else window.open(url, "_blank", "noopener,noreferrer");
}
export function Connections() {
  const social = useSocial(), config = social.config.tebar;
  const [key, setKey] = useState(""), [profileId, setProfileId] = useState(config.profileId),
    [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [error, setError] = useState(""),
    [profileName, setProfileName] = useState(""), [usage, setUsage] = useState<Usage>();
  useEffect(() => { setProfileId(config.profileId); }, [config.profileId]);
  useEffect(() => {
    let live = true;
    setUsage(undefined);
    void social.request<Usage>("usage.cached").then((value) => { if (live) setUsage(value); }).catch(() => {});
    return () => { live = false; };
  }, [social.revision]);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); setStatus("");
    try { await work(); } catch (err) { setError(String(err)); } finally { setBusy(false); }
  }
  const snapshot = usage?.providers.tebar, window = snapshot?.windows[0];
  return <div className="social-connections settings-stack">
    <div className="panel-heading settings-panel-head">
      <div><p className="settings-eyebrow">Connections</p><h2>Tebar social accounts</h2><p>Connect your Tebar workspace to publish and schedule.</p></div>
      <Button disabled={busy || social.busy} onClick={() => void social.refresh()}><Icon name="redo" size={15} />Refresh accounts</Button>
    </div>
    <section className="settings-card provider-settings" aria-label="Tebar connection">
      <div className="settings-card-head"><div className="provider-title"><span className="provider-dot is-tebar" /><h3>Tebar</h3></div><span className="connection-badge">{config.configured ? "Key saved" : "Not configured"}</span></div>
      <p className="provider-hint">Create a read and write API key in Tebar → account menu → API key. A read-only key can browse accounts and posts.</p>
      <Label className="marketing-field settings-field">Tebar API key<Input type="password" autoComplete="off" spellCheck={false} value={key} onChange={(ev) => setKey(ev.target.value)} placeholder={config.configured ? "Enter a new key to replace the saved key" : "tb_live_…"} /></Label>
      <div className="provider-resource"><Label className="marketing-field settings-field">Workspace (optional)</Label><SelectField label="Tebar workspace" value={profileId} onChange={setProfileId} options={[
        { value: "", label: "Use key scope / all workspaces" },
        ...social.profiles.map((p) => ({ value: p.id, label: p.name })),
        ...(profileId && !social.profiles.some((p) => p.id === profileId) ? [{ value: profileId, label: profileId }] : []),
      ]} /></div>
      <p className="provider-hint">Workspace keys already have a scope. Owner keys can select a workspace here; each post uses accounts from one workspace.</p>
      <div className="provider-actions">
        <Button className="primary" disabled={busy || (!key.trim() && !config.configured)} onClick={() => void run(async () => {
          await social.save("tebar", { ...(key.trim() ? { key: key.trim() } : {}), profileId });
          setKey("");
          const result = await social.test("tebar");
          setStatus(`Connection verified. ${result.accounts.length} accounts available.${result.scopes?.includes("write") ? "" : " Read-only access; publishing needs a write key."}`);
        })}>{busy ? "Working…" : "Save & test"}</Button>
        <Button disabled={busy || !config.configured || profileId !== config.profileId} onClick={() => void run(async () => {
          const link = await social.request<{ url: string }>("connect", { provider: "tebar" });
          await openConnection(link.url);
          setStatus("Finish connecting in Tebar, then refresh accounts here.");
        })}>Connect account</Button>
        {config.configured && <Button className="danger-ghost" disabled={busy} onClick={() => void run(async () => {
          await social.save("tebar", { removeKey: true }); setKey(""); setUsage(undefined);
        })}>Remove key</Button>}
      </div>
      {social.ownerKey && <div className="provider-create-profile">
        <Input aria-label="New Tebar workspace name" value={profileName} onChange={(ev) => setProfileName(ev.target.value)} placeholder="New workspace name" />
        <Button disabled={busy || !profileName.trim()} onClick={() => void run(async () => {
          const profile = await social.request<{ id: string }>("createProfile", { name: profileName });
          await social.save("tebar", { profileId: profile.id }); await social.test("tebar"); setProfileName(""); setStatus("Workspace created and selected.");
        })}>Create workspace</Button>
      </div>}
      <p className="settings-note"><a href="https://docs.tebar.app/api/" target="_blank" rel="noreferrer">Tebar API documentation</a></p>
    </section>
    <section className="settings-card" aria-label="Connected channels">
      <div className="settings-card-head"><h3>Connected accounts</h3><span>{social.accounts.length} accounts</span></div>
      <div className="social-account-list">{social.accounts.map((account) => <ConnectedAccount key={account.key} account={account} />)}
        {!social.accounts.length && <p className="social-empty">Save and test your Tebar key to load connected accounts.</p>}
      </div>
    </section>
    <section className="settings-card" aria-label="Tebar API usage">
      <div className="settings-card-head"><h3>API usage</h3><Button disabled={busy || !config.configured} onClick={() => void run(async () => {
        const value = await social.request<Usage>("usage", { provider: "tebar" }); setUsage(value);
        if (value.issues?.length) throw Error(value.issues.map((i) => i.message).join(" "));
      })}>Fetch usage</Button></div>
      <p>{window?.remaining !== undefined ? `${window.remaining} / ${window.limit ?? "unknown"} requests remaining` : "No request quota reported yet."}</p>
      {snapshot && <p className="provider-hint">Observed {new Date(snapshot.observedAt).toLocaleString()}{window?.resetAt ? ` · Resets ${new Date(window.resetAt).toLocaleTimeString()}` : ""}{snapshot.retryAt ? ` · Retry after ${new Date(snapshot.retryAt).toLocaleTimeString()}` : ""}</p>}
      <p className="provider-hint">Observed from Tebar response headers. All keys share the account's limit. Fetch usage makes one read request; there is no automatic polling.</p>
    </section>
    {status && <p className="settings-alert is-success" role="status">{status}</p>}
    {[error, social.error, ...social.issues.map((i) => i.message)].filter(Boolean).map((message, i) => <p key={i} className="settings-alert is-error" role="alert">{message}</p>)}
    <p className="settings-note">Your key stays in local config.json. Drafts, plans, and receipts stay in Genie. Publishing and scheduling require confirmation.</p>
  </div>;
}
function ConnectedAccount({ account }: { account: Account }) {
  const social = useSocial(), [limit, setLimit] = useState<unknown>(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <div className="social-account-row">
    <PlatformIcon id={account.platform} size={24} />
    <div><strong>{account.name}</strong><span>{account.platform}{account.username ? ` · @${account.username.replace(/^@/, "")}` : ""} · {account.active ? "Connected" : "Reconnect or reactivate in Tebar"}</span>{limit !== undefined && <QuotaDetails value={limit} />}{error && <small role="alert">{error}</small>}</div>
    <Button disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try { const value = await social.request<unknown>("publishingLimit", { accountId: account.id }); setLimit(value); }
      catch (err) { setError(String(err)); } finally { setBusy(false); }
    }}>{busy ? "Loading…" : "Check posting quota"}</Button>
  </div>;
}

function QuotaDetails({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <small>Not reported</small>;
  if (typeof value !== "object") return <small>{String(value)}</small>;
  return <dl className="posting-quota">{Object.entries(value).map(([label, item]) => <div key={label}><dt>{label.replaceAll("_", " ")}</dt><dd><QuotaDetails value={item} /></dd></div>)}</dl>;
}
