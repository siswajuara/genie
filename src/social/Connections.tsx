import { Icon } from "../components/ui/Icon";
import { PlatformIcon } from "../marketing/Shared";
import { ApiConnection } from "./ApiConnection";
import { useSocial } from "./client";
import "./social.css";

export function Connections() {
  const social = useSocial();
  return (
    <div className="social-connections">
      <div className="panel-heading">
        <div>
          <h2>Website connection</h2>
          <p>
            Your website manages social accounts, publishing, schedules, and
            synced data.
          </p>
        </div>
        <button disabled={social.busy} onClick={() => void social.refresh()}>
          <Icon name="redo" size={15} />
          {social.busy ? "Refreshing…" : "Refresh from website"}
        </button>
      </div>
      <ApiConnection />
      {social.error && (
        <p className="error" role="alert">
          {social.error}
        </p>
      )}
      <h3>Channels from your website</h3>
      <div className="social-account-list">
        {social.accounts.length ? (
          social.accounts.map((account) => (
            <div key={account.key}>
              <PlatformIcon id={account.platform} size={24} />
              <div>
                <strong>{account.name}</strong>
                <span>
                  {account.platform}
                  {account.username
                    ? ` · @${account.username.replace(/^@/, "")}`
                    : ""}
                </span>
              </div>
              <span
                className={`connection-badge ${account.active ? "connected" : "error"}`}
              >
                {account.active ? "Connected" : "Reconnect on website"}
              </span>
            </div>
          ))
        ) : (
          <p className="hint">
            Connect your website API to load its social channels. Add or
            reconnect channels on the website.
          </p>
        )}
      </div>
      <p className="settings-privacy">
        <Icon name="lock" size={16} /> Only your website API token is saved on
        this device. Manage provider credentials on the website.
      </p>
    </div>
  );
}
