import { useEffect, useState } from "react";
import { useSocial, type AudioAccount } from "./client";
import "./social.css";

type Credits = {
  tier: string | null;
  used: number | null;
  limit: number | null;
  remaining: number | null;
  resetsAt: string | null;
  checkedAt: string;
};
type AccountStatus = {
  accountId: string;
  usage: Credits | null;
  error: string;
  cooldownUntil: number | null;
};
type Cached = { accounts: AccountStatus[] };
const number = (value: number | null) =>
  value === null ? "Not reported" : value.toLocaleString();

export function AudioConnections() {
  const social = useSocial();
  const accounts = social.config.elevenlabs?.accounts || [];
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [snapshots, setSnapshots] = useState<AccountStatus[]>([]);
  const [cacheVersion, setCacheVersion] = useState(0);

  useEffect(() => {
    let live = true;
    void social
      .request<Cached>("elevenlabs.cached")
      .then((result) => {
        if (live) setSnapshots(result.accounts);
      })
      .catch((err) => {
        if (live) setError(String(err));
      });
    return () => {
      live = false;
    };
  }, [social.request, social.config.elevenlabs, cacheVersion]);

  async function add() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const accountId = crypto.randomUUID();
      await social.save("elevenlabs", {
        accountId,
        name: name.trim(),
        key: key.trim(),
      });
      setName("");
      setKey("");
      try {
        await social.request<Credits>("elevenlabs.usage", { accountId });
        setStatus("Account saved. Connection verified and credits updated.");
      } catch (err) {
        setError(`Account saved. ${String(err)}`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
      setCacheVersion((value) => value + 1);
    }
  }

  async function checkRotation() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await social.request<{ accountId: string; name: string }>(
        "elevenlabs.select",
      );
      setStatus(
        `${result.name} is ready. The next check starts with the following enabled account.`,
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
      setCacheVersion((value) => value + 1);
    }
  }

  return (
    <div className="settings-stack">
      <div className="panel-heading settings-panel-head">
        <div>
          <p className="settings-eyebrow">Connections</p>
          <h2>Audio</h2>
          <p>Manage ElevenLabs accounts and their available credits.</p>
        </div>
      </div>
      {social.error && (
        <p className="settings-alert is-error" role="alert">
          {social.error}
        </p>
      )}
      <section
        className="settings-card provider-settings"
        aria-label="ElevenLabs account rotation"
      >
        <div className="settings-card-head">
          <h3>ElevenLabs accounts</h3>
        </div>
        <p className="provider-hint">
          Enabled accounts take turns in list order. Selection skips accounts
          without enough verified credits and accounts on cooldown.
        </p>
        <p className="hint">
          Create voiceovers and auto-subtitles from Audio & subtitles in the
          canvas editor. Choose an account there before generating. Check
          rotation verifies account credits without generating audio.
        </p>
        <div className="provider-actions">
          <button
            disabled={
              busy ||
              social.busy ||
              !accounts.some((account) => account.enabled)
            }
            onClick={() => void checkRotation()}
          >
            {busy ? "Checking…" : "Check rotation"}
          </button>
        </div>
        {error && (
          <p className="settings-alert is-error" role="alert">
            {error}
          </p>
        )}
        {status && (
          <p className="settings-alert is-success" role="status">
            {status}
          </p>
        )}
        {!accounts.length && (
          <p className="hint">
            No accounts saved. Add your first account below.
          </p>
        )}
      </section>
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          snapshot={snapshots.find(
            (snapshot) => snapshot.accountId === account.id,
          )}
          disabled={busy || social.busy}
          onUpdate={() => setCacheVersion((value) => value + 1)}
        />
      ))}
      <section
        className="settings-card provider-settings"
        aria-label="Add ElevenLabs account"
      >
        <div className="settings-card-head">
          <h3>Add an account</h3>
        </div>
        <p className="provider-hint">
          Use an API key from your ElevenLabs account, including a free account.
          Allow User read access to check credits.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && name.trim() && key.trim()) void add();
          }}
        >
          <label className="marketing-field settings-field">
            Account name
            <input
              value={name}
              maxLength={100}
              disabled={busy || social.busy}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example, Studio account"
              required
            />
          </label>
          <label className="marketing-field settings-field">
            ElevenLabs API key
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              disabled={busy || social.busy}
              onChange={(event) => setKey(event.target.value)}
              placeholder="Paste your API key"
              required
            />
          </label>
          <div className="provider-actions">
            <button
              className="primary"
              disabled={busy || social.busy || !name.trim() || !key.trim()}
            >
              {busy ? "Working…" : "Add & connect"}
            </button>
          </div>
        </form>
      </section>
      <p className="settings-note">
        Keys and account settings are saved locally in config.json. Credit
        checks run only on request. Accounts may share an allowance;
        key-specific spending caps may also apply.
      </p>
    </div>
  );
}

function AccountCard({
  account,
  snapshot,
  disabled,
  onUpdate,
}: {
  account: AudioAccount;
  snapshot?: AccountStatus;
  disabled: boolean;
  onUpdate: () => void;
}) {
  const social = useSocial();
  const [name, setName] = useState(account.name);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const credits = snapshot?.usage;
  const headingId = `elevenlabs-${account.id}`;

  async function action(run: () => Promise<unknown>, success = "") {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await run();
      setStatus(success);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
      onUpdate();
    }
  }

  return (
    <section
      className="settings-card provider-settings audio-account"
      aria-labelledby={headingId}
      aria-busy={busy}
    >
      <div className="settings-card-head">
        <h3 id={headingId}>{account.name}</h3>
        <span
          className={`connection-badge ${error || snapshot?.error ? "error" : !account.enabled ? "" : credits ? "connected" : "saved"}`}
        >
          <span className="badge-dot" aria-hidden="true" />
          {!account.enabled
            ? "Excluded"
            : snapshot?.cooldownUntil && snapshot.cooldownUntil > Date.now()
              ? "Cooling down"
              : error || snapshot?.error
                ? "Needs attention"
                : credits?.remaining === 0
                  ? "No credits"
                  : credits
                    ? "Connected"
                    : "Key saved"}
        </span>
      </div>
      <label className="marketing-field settings-field">
        Account name
        <input
          value={name}
          maxLength={100}
          disabled={busy || disabled}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="marketing-field settings-field">
        Replace API key
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          disabled={busy || disabled}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Leave blank to keep the saved key"
        />
      </label>
      <div className="provider-actions">
        <button
          disabled={
            busy ||
            disabled ||
            !name.trim() ||
            (name === account.name && !key.trim())
          }
          onClick={() =>
            void action(async () => {
              await social.save("elevenlabs", {
                accountId: account.id,
                name: name.trim(),
                ...(key.trim() ? { key: key.trim() } : {}),
              });
              setKey("");
            }, "Account saved.")
          }
        >
          Save account
        </button>
        <button
          disabled={busy || disabled || !!key.trim()}
          onClick={() =>
            void action(
              () =>
                social.request("elevenlabs.usage", { accountId: account.id }),
              "Connection verified. Credits updated.",
            )
          }
        >
          {busy ? "Working…" : "Refresh credits"}
        </button>
        <button
          disabled={busy || disabled}
          onClick={() =>
            void action(() =>
              social.save("elevenlabs", {
                accountId: account.id,
                enabled: !account.enabled,
              }),
            )
          }
        >
          {account.enabled ? "Exclude from rotation" : "Include in rotation"}
        </button>
        <button
          className="danger-ghost"
          disabled={busy || disabled}
          onClick={() =>
            void action(() =>
              social.save("elevenlabs", {
                accountId: account.id,
                removeKey: true,
              }),
            )
          }
        >
          Remove account
        </button>
      </div>
      {(error || snapshot?.error) && (
        <p className="settings-alert is-error" role="alert">
          {error || snapshot?.error}
        </p>
      )}
      {status && (
        <p className="settings-alert is-success" role="status">
          {status}
        </p>
      )}
      <section
        className="provider-usage"
        aria-label={`${account.name} credits`}
      >
        <h4>Available credits</h4>
        {credits ? (
          <>
            <dl className="provider-usage-counts">
              <div>
                <dt>Remaining allowance</dt>
                <dd>
                  <strong>{number(credits.remaining)}</strong>
                </dd>
              </div>
              <div>
                <dt>Used this period</dt>
                <dd>{number(credits.used)}</dd>
              </div>
              <div>
                <dt>Period allowance</dt>
                <dd>{number(credits.limit)}</dd>
              </div>
              <div>
                <dt>Plan</dt>
                <dd>
                  {credits.tier === "free"
                    ? "Free"
                    : credits.tier || "Not reported"}
                </dd>
              </div>
              <div>
                <dt>Resets</dt>
                <dd>
                  {credits.resetsAt
                    ? new Date(credits.resetsAt).toLocaleString()
                    : "Not reported"}
                </dd>
              </div>
            </dl>
            <p className="hint">
              Last checked {new Date(credits.checkedAt).toLocaleString()}.
            </p>
          </>
        ) : (
          <p className="hint">
            Refresh credits to read the current account allowance.
          </p>
        )}
        {snapshot?.cooldownUntil && (
          <p className="hint">
            Cooldown until {new Date(snapshot.cooldownUntil).toLocaleString()}.
          </p>
        )}
      </section>
    </section>
  );
}
