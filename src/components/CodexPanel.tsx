import { useEffect, useRef, useState } from "react";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { parseDocument, uid, type CanvasDocument } from "../editor/model";
import type { Editor } from "../editor/useEditor";
type Message = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
};
type SavedChat = { key: string; thread?: string; messages: Message[] };
type Status = { ok: boolean; path?: string; message: string };
type Event = {
  type: string;
  message?: string;
  canvas?: unknown;
  baseUpdatedAt?: string;
  codexThreadId?: string;
  event?: {
    type: string;
    thread_id?: string;
    error?: { message: string };
    item?: {
      id: string;
      type: string;
      text?: string;
      command?: string;
      aggregated_output?: string;
      status?: string;
      changes?: { path: string }[];
    };
  };
};
export function CodexPanel({
  editor: e,
  scope,
}: {
  editor: Editor;
  scope: string;
}) {
  const storageKey = `genie.chat.${scope}`;
  const [initial] = useState<SavedChat>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.key && Array.isArray(saved.messages)) return saved;
    } catch {
      /* Start a new page conversation when its saved chat is invalid. */
    }
    return { key: uid(), messages: [] };
  });
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [model, setModel] = useState("");
  const [key, setKey] = useState(initial.key),
    [thread, setThread] = useState(initial.thread),
    [messages, setMessages] = useState<Message[]>(initial.messages);
  const [pending, setPending] = useState<CanvasDocument>();
  const [codexPath, setCodexPath] = useState(
    () => localStorage.getItem("genie.codexPath") || "",
  );
  const [status, setStatus] = useState<Status>(),
    [checking, setChecking] = useState(false);
  const run = useRef<string | undefined>(undefined),
    end = useRef<HTMLDivElement>(null),
    latest = useRef(e),
    mounted = useRef(true);
  latest.current = e;
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ key, thread, messages }),
      );
    } catch {
      setError("Chat storage is full. Save a JSON backup of your project.");
    }
  }, [messages, key, thread, storageKey]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (run.current)
        void invoke("cancel_run", { requestId: run.current }).catch(() => {});
    };
  }, []);
  async function check() {
    setChecking(true);
    try {
      const next = await invoke<Status>("codex_status", {
        codexPath: codexPath.trim() || undefined,
      });
      if (mounted.current) setStatus(next);
      return next.ok;
    } catch (err) {
      if (mounted.current) setStatus({ ok: false, message: String(err) });
      return false;
    } finally {
      if (mounted.current) setChecking(false);
    }
  }
  async function send() {
    if (!prompt.trim() || busy) return;
    setError("");
    setPending(undefined);
    setBusy(true);
    if (!(await check())) {
      if (mounted.current) setBusy(false);
      return;
    }
    if (!mounted.current) return;
    const value = prompt;
    setPrompt("");
    setMessages((m) => [...m, { id: uid(), role: "user", text: value }]);
    const channel = new Channel<Event>();
    channel.onmessage = (event) => {
      if (!mounted.current) return;
      if (event.type === "event" && event.event) {
        const ev = event.event,
          item = ev.item;
        if (ev.type === "thread.started") setThread(ev.thread_id);
        if (ev.type === "turn.failed")
          setError(ev.error?.message || "Agent turn failed.");
        if (item) {
          const text =
            item.text ||
            [
              item.command,
              item.aggregated_output,
              item.changes?.map((c) => c.path).join("\n"),
            ]
              .filter(Boolean)
              .join("\n") ||
            `${item.type}: ${item.status || "running"}`;
          setMessages((m) => {
            const id = "codex-" + item.id;
            const msg: Message = {
              id,
              role: item.type === "agent_message" ? "assistant" : "tool",
              text,
            };
            return m.some((x) => x.id === id)
              ? m.map((x) => (x.id === id ? msg : x))
              : [...m, msg];
          });
        }
      }
      if (event.type === "canvas") {
        try {
          const next = parseDocument(event.canvas);
          if (latest.current.doc.metadata.updatedAt === event.baseUpdatedAt) {
            latest.current.change(next);
            latest.current.select([]);
            latest.current.notify(
              "Chat updated this page’s canvas. Undo is available.",
            );
          } else {
            setPending(next);
            latest.current.notify(
              "The agent update is ready to review in Chat.",
            );
          }
        } catch (err) {
          setError(`The agent returned invalid canvas JSON: ${String(err)}`);
        }
      }
      if (event.type === "done") {
        if (event.codexThreadId) setThread(event.codexThreadId);
        setBusy(false);
        run.current = undefined;
      }
      if (event.type === "error") {
        setError(event.message || "Chat failed.");
        setBusy(false);
        run.current = undefined;
      }
    };
    try {
      const id = await invoke<string>("codex_run", {
        request: {
          key,
          prompt: value,
          model: model.trim() || undefined,
          codexPath: codexPath.trim() || undefined,
          codexThreadId: thread,
          canvas: e.doc,
          selection: e.selection,
        },
        onEvent: channel,
      });
      if (!mounted.current) {
        await invoke("cancel_run", { requestId: id });
        return;
      }
      run.current = id;
    } catch (err) {
      if (mounted.current) {
        setError(String(err));
        setBusy(false);
      }
    }
  }
  async function cancel() {
    if (run.current)
      try {
        await invoke("cancel_run", { requestId: run.current });
      } catch (err) {
        setError(String(err));
      }
  }
  return (
    <section className="codex-chat">
      <div className="section-title">
        <h2>Chat</h2>
        <button
          disabled={busy}
          onClick={() => {
            setKey(uid());
            setThread(undefined);
            setMessages([]);
            setError("");
            setPending(undefined);
          }}
        >
          New chat
        </button>
      </div>
      <p className="hint">
        Ask the agent to edit this page’s canvas, selected elements, or carousel
        frames. Each page has its own conversation.
      </p>
      {!isTauri() && (
        <p className="connection-note">
          Chat is available in the desktop app. The editor works in this
          browser.
        </p>
      )}
      <details className="cli-settings">
        <summary>Chat settings · Codex CLI</summary>
        <p className="hint">
          Desktop builds include Codex. Leave the path empty to use it, or
          select your own installation.
        </p>
        <label>
          Codex executable
          <input
            aria-label="Codex executable"
            placeholder="Bundled CLI or automatic detection"
            value={codexPath}
            disabled={busy}
            onChange={(ev) => {
              setCodexPath(ev.target.value);
              localStorage.setItem("genie.codexPath", ev.target.value);
              setStatus(undefined);
            }}
          />
        </label>
        <button
          disabled={!isTauri() || checking || busy}
          onClick={() => void check()}
        >
          {checking ? "Checking…" : "Check installation"}
        </button>
      </details>
      {status && (
        <div className={`cli-status ${status.ok ? "" : "error"}`} role="status">
          {status.ok ? "Ready: " + status.path : status.message}
          {!status.ok && (
            <p>
              Reinstall the{" "}
              <a
                href="https://developers.openai.com/codex/cli/"
                target="_blank"
                rel="noreferrer"
              >
                official Codex CLI
              </a>{" "}
              if macOS blocks your current installation.
            </p>
          )}
        </div>
      )}
      <div className="codex-messages" aria-live="polite">
        {!messages.length && (
          <div className="empty">
            <strong>Design with your canvas</strong>
            <p>
              Try “Create five carousel slides using this frame” or “Update the
              title on slide 2.”
            </p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "tool" ? (
            <details className="codex-tool" key={m.id}>
              <summary>Agent activity</summary>
              <pre>{m.text}</pre>
            </details>
          ) : (
            <article className={`codex-message ${m.role}`} key={m.id}>
              <small>{m.role === "user" ? "You" : "Agent"}</small>
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </article>
          ),
        )}
        {busy && <p className="hint">Working with this page’s canvas…</p>}
        <div ref={end} />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="pending-update">
          <p>
            The canvas changed while the agent was working. Its update is ready.
          </p>
          <div className="row">
            <button
              onClick={() => {
                e.change(pending);
                e.select([]);
                setPending(undefined);
              }}
            >
              Apply agent version
            </button>
            <button onClick={() => setPending(undefined)}>
              Keep current canvas
            </button>
          </div>
        </div>
      )}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void send();
        }}
        className="codex-composer"
      >
        <label>
          Model
          <input
            placeholder="Default model"
            value={model}
            disabled={busy}
            onChange={(ev) => setModel(ev.target.value)}
          />
        </label>
        <textarea
          aria-label="Chat message"
          placeholder="Ask the agent to edit this canvas…"
          rows={4}
          value={prompt}
          onChange={(ev) => setPrompt(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
              ev.preventDefault();
              void send();
            }
          }}
        />
        <div className="row">
          <span className="hint">
            {e.selection.length} selected · Canvas attached
          </span>
          {busy ? (
            <button
              type="button"
              className="danger"
              onClick={() => void cancel()}
            >
              Stop
            </button>
          ) : (
            <button
              className="primary"
              type="submit"
              disabled={!prompt.trim() || !isTauri() || checking}
            >
              Send
            </button>
          )}
        </div>
      </form>
      <button
        disabled={!isTauri()}
        onClick={() =>
          void invoke("reveal_workspace", { key }).catch((err) =>
            setError(String(err)),
          )
        }
      >
        Open workspace & artifacts
      </button>
    </section>
  );
}
