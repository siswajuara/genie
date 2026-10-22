import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icon";
import { SelectField } from "./ui/Controls";
import { fmtAgo, fmtTokens, serveCommand } from "../lib/opencode";
import type { Oc } from "../hooks/useOpencode";
import { MessageView, PermissionCard } from "./Message";
import { ModelPicker } from "./ModelPicker";

function Offline({ oc }: { oc: Oc }) {
  const [copied, setCopied] = useState(false);
  const cmd = serveCommand(oc.baseUrl);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="state">
      <h2>
        {oc.conn === "connecting"
          ? "Connecting to opencode"
          : "Can't reach the opencode server"}
      </h2>
      <p>
        This app talks to a local opencode server at <code>{oc.baseUrl}</code>.
        Start it in a terminal, then it connects by itself.
      </p>
      <div className="codeblock">
        <button type="button" className="mini" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <pre>{cmd}</pre>
      </div>
      <p className="muted">
        The --cors flags allow this window to call the server.{" "}
        {oc.connError && <>Last error: {oc.connError}. </>}Retrying every 3
        seconds.
      </p>
      <button type="button" className="btn" onClick={oc.retry}>
        Retry now
      </button>
    </div>
  );
}

function Sessions({ oc, onDone }: { oc: Oc; onDone: () => void }) {
  if (oc.sessions.length === 0)
    return (
      <div className="state">
        <h2>No sessions yet</h2>
        <p>Your chats will be listed here once you send a first message.</p>
      </div>
    );
  return (
    <ul className="sessions">
      {oc.sessions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={s.id === oc.activeId ? "is-active" : ""}
            onClick={() => {
              oc.selectSession(s.id);
              onDone();
            }}
          >
            <span className="s-title">{s.title || "Untitled"}</span>
            <span className="muted">{fmtAgo(s.time.updated)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Ring({ pct, title }: { pct: number; title: string }) {
  const r = 9,
    c = 2 * Math.PI * r;
  return (
    <span className="ring" title={title} role="img" aria-label={title}>
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={r} className="ring-bg" />
        <circle
          cx="12"
          cy="12"
          r={r}
          className="ring-fg"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span>{pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</span>
    </span>
  );
}

export function ChatPane({ oc }: { oc: Oc }) {
  const [view, setView] = useState<"chat" | "sessions">("chat");
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [oc.messages, oc.permissions, view]);

  useEffect(() => {
    const el = field.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }
  }, [draft]);

  const online = oc.conn === "online";
  const canSend = online && !!oc.model && draft.trim().length > 0 && !oc.busy;
  const submit = () => {
    if (!canSend) return;
    stick.current = true;
    void oc.send(draft.trim());
    setDraft("");
  };

  const limit =
    oc.context &&
    oc.models.find((m) => `${m.providerID}/${m.id}` === oc.context!.key)?.limit
      .context;
  const pct =
    oc.context && limit
      ? Math.min(100, (oc.context.tokens / limit) * 100)
      : null;

  return (
    <div className="chat">
      <div className="chat-head">
        {view === "chat" ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="All sessions"
            onClick={() => setView("sessions")}
            disabled={!online}
          >
            <Icon name="menu" />
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn"
            aria-label="Back to chat"
            onClick={() => setView("chat")}
          >
            <Icon name="left" />
          </button>
        )}
        <h1 className="chat-title">
          {view === "sessions" ? "Sessions" : oc.active?.title || "New chat"}
        </h1>
        {pct !== null && view === "chat" && (
          <Ring
            pct={pct}
            title={`Context: ${fmtTokens(oc.context!.tokens)} of ${fmtTokens(limit!)} tokens`}
          />
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="New chat"
          disabled={!online}
          onClick={() => {
            oc.newChat();
            setView("chat");
            field.current?.focus();
          }}
        >
          <Icon name="add" />
        </button>
      </div>

      {!online ? (
        <Offline oc={oc} />
      ) : view === "sessions" ? (
        <Sessions oc={oc} onDone={() => setView("chat")} />
      ) : (
        <div
          className="log"
          role="log"
          aria-label="Conversation"
          ref={log}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {oc.messages.length === 0 && (
            <div className="state">
              <h2>
                {oc.catalogReady && !oc.model
                  ? "No free Zen models found"
                  : "Ask anything"}
              </h2>
              {oc.catalogReady && !oc.model ? (
                <p>
                  The server did not list any free models under the Zen
                  provider. Check that it can reach opencode.ai, then reload.
                </p>
              ) : (
                <p>
                  Messages go to <strong>{oc.model?.name ?? "…"}</strong>{" "}
                  through the <strong>{oc.agent?.name ?? "default"}</strong>{" "}
                  agent
                  {oc.directory && (
                    <>
                      {" "}
                      in <code>{oc.directory}</code>
                    </>
                  )}
                  . {oc.agent?.description}
                </p>
              )}
            </div>
          )}
          {oc.messages.map((b) => (
            <MessageView key={b.info.id} bundle={b} />
          ))}
          {oc.permissions.map((p) => (
            <PermissionCard
              key={p.id}
              p={p}
              onAnswer={(r) => void oc.answerPermission(p, r)}
            />
          ))}
        </div>
      )}

      {oc.error && (
        <div className="banner" role="alert">
          <span>{oc.error}</span>
          <button type="button" className="mini" onClick={oc.dismissError}>
            Dismiss
          </button>
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr" htmlFor="prompt">
          Message
        </label>
        <textarea
          id="prompt"
          ref={field}
          rows={1}
          value={draft}
          disabled={!online}
          placeholder={
            online
              ? "Message the agent. Enter to send, Shift+Enter for a new line"
              : "Waiting for the server"
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-bar">
          <ModelPicker
            models={oc.models}
            selected={oc.model}
            onSelect={oc.pickModel}
            usage={oc.usage}
            context={oc.context}
          />
          <label className="chip chip-select">
            <span className="chip-k">Agent</span>
            <SelectField
              value={oc.agent?.name ?? ""}
              onChange={oc.pickAgent}
              disabled={!oc.agents.length}
              label="Agent"
              options={oc.agents.map((a) => ({ value: a.name, label: a.name }))}
            />
          </label>
          {oc.busy ? (
            <button
              type="button"
              className="btn stop"
              onClick={() => void oc.stop()}
            >
              Stop
            </button>
          ) : (
            <button type="submit" className="btn send" disabled={!canSend}>
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
