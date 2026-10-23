import { localStore } from "../lib/localStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { parseDocument, uid, type CanvasDocument } from "../editor/model";
import type { Editor } from "../editor/useEditor";
import { Icon } from "./ui/Icon";
import { FramePreview } from "../marketing/FramePreview";
import { chatEvent } from "../marketing/store";
import { assistantSkills, assistantBrand } from "../lib/assistantSkills";
import { SelectField } from "./ui/Controls";

export type ChatMode = "discuss" | "draw";
type Message = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  /** Set on the closing message of a Draw turn: points at a saved canvas revision. */
  artifact?: { n: number };
};
type SavedChat = { key: string; thread?: string; messages: Message[] };
type Revision = { n: number; at: string; doc: unknown; pageId?: string };
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

const MODE_KEY = "genie.chat.mode";
const MAX_REVISIONS = 20;
const modePrefix: Record<ChatMode, string> = {
  discuss:
    "[Mode: Discuss] Answer in plain text only. Do not edit the canvas or return canvas JSON.\n\n",
  draw: "[Mode: Draw] Create or edit the canvas to fulfil this request, then summarize what you changed in one or two sentences.\n\n",
};
const starters: { mode: ChatMode; label: string; prompt: string }[] = [
  {
    mode: "discuss",
    label: "Plan a week of posts",
    prompt:
      "Help me plan a week of social media posts. Ask about my audience, my business, and my goal first.",
  },
  {
    mode: "discuss",
    label: "Write a caption",
    prompt:
      "Help me write a caption. Ask what I am sharing, who it is for, and the tone I want.",
  },
  {
    mode: "draw",
    label: "Design a carousel",
    prompt:
      "Create a five-slide carousel on this canvas. Ask me for the topic and audience if you need them.",
  },
];

const revisionKey = (chatKey: string) => `genie.revisions.${chatKey}`;
function readRevisions(chatKey: string): Revision[] {
  try {
    const list = JSON.parse(localStore.getItem(revisionKey(chatKey)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
/** Queues a revision for local persistence and returns its number. */
function addRevision(chatKey: string, doc: unknown, pageId?: string): number {
  const list = readRevisions(chatKey);
  const n = (list.at(-1)?.n ?? 0) + 1;
  const next = [
    ...list,
    { n, at: new Date().toISOString(), doc, pageId },
  ].slice(-MAX_REVISIONS);
  localStore.setItem(revisionKey(chatKey), JSON.stringify(next));
  return n;
}

function CanvasArtifact({
  chatKey,
  n,
  editor: e,
  onOpenCanvas,
  onCanvasRevision,
  onRestoreRevision,
}: {
  chatKey: string;
  n: number;
  editor: Editor;
  onOpenCanvas?: () => void;
  onCanvasRevision?: (doc: CanvasDocument, label: string) => void;
  onRestoreRevision?: (doc: CanvasDocument, pageId?: string) => void;
}) {
  const revisions = useMemo(() => readRevisions(chatKey), [chatKey, n]);
  const [picked, setPicked] = useState(n);
  const revision = revisions.find((r) => r.n === picked);
  const parsed = useMemo(() => {
    if (!revision) return undefined;
    try {
      return parseDocument(revision.doc) as CanvasDocument;
    } catch {
      return undefined;
    }
  }, [revision]);
  const frame = parsed?.elements.find((o) => o.t === "frame");

  function download() {
    if (!revision) return;
    const body = JSON.stringify(
      { revision: revision.n, savedAt: revision.at, canvas: revision.doc },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([body], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "canvas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <figure className="chat-artifact">
      <figcaption>
        <span className="chat-artifact-file">
          <Icon name="layers" size={16} />
          canvas.json
        </span>
        <label className="chat-artifact-rev">
          <span className="sr-only">Revision</span>
          <select
            value={picked}
            onChange={(ev) => setPicked(Number(ev.target.value))}
          >
            {revisions.map((r) => (
              <option key={r.n} value={r.n}>
                Revision {r.n}
                {r.n === n ? " (this reply)" : ""}
              </option>
            ))}
          </select>
        </label>
      </figcaption>
      <div className="chat-artifact-preview">
        {parsed && frame ? (
          <FramePreview
            document={parsed}
            frameId={frame.id}
            label={`Canvas revision ${picked}`}
          />
        ) : (
          <p className="chat-artifact-missing">
            {revision
              ? "This revision has no frame to preview."
              : "This revision is no longer stored on this device."}
          </p>
        )}
      </div>
      <div className="chat-artifact-actions">
        <button
          disabled={!parsed}
          onClick={() => {
            if (!parsed) return;
            if (onRestoreRevision) {
              try {
                onRestoreRevision(parsed, revision?.pageId);
              } catch (err) {
                e.notify(String(err));
              }
              return;
            }
            onCanvasRevision?.(parsed, `Restored chat revision ${picked}`);
            e.change(parsed);
            e.select([]);
            e.notify(`Restored revision ${picked}. Undo is available.`);
          }}
        >
          Restore this revision
        </button>
        <button disabled={!revision} onClick={download}>
          Download
        </button>
        {onOpenCanvas && (
          <button className="primary" onClick={onOpenCanvas}>
            Open Canvas <Icon name="right" size={15} />
          </button>
        )}
      </div>
    </figure>
  );
}

export function CodexPanel({
  editor: e,
  scope,
  variant = "canvas",
  promptSeed,
  startFresh = false,
  onKeyChange,
  onOpenCanvas,
  conversationKey,
  onCanvasRevision,
  onRestoreRevision,
  pageId,
}: {
  editor: Editor;
  scope: string;
  variant?: "canvas" | "idea";
  promptSeed?: { id: string; text: string; mode?: ChatMode };
  startFresh?: boolean;
  onKeyChange?: (key: string) => void;
  onOpenCanvas?: () => void;
  conversationKey?: string;
  onCanvasRevision?: (doc: CanvasDocument, label: string) => void;
  onRestoreRevision?: (doc: CanvasDocument, pageId?: string) => void;
  pageId?: string;
}) {
  const storageKey = `genie.chat.${scope}`;
  const [initial] = useState<SavedChat>(() => {
    try {
      const saved = JSON.parse(localStore.getItem(storageKey) || "null");
      if (saved?.key && Array.isArray(saved.messages)) {
        if (!startFresh) return saved;
        if (saved.messages.length)
          localStore.setItem(
            `genie.conversation.${saved.key}`,
            JSON.stringify({
              ...saved,
              scope,
              updatedAt: new Date().toISOString(),
            }),
          );
      }
    } catch {
      /* Start a new page conversation when its saved chat is invalid. */
    }
    try {
      if (conversationKey) {
        const conv = JSON.parse(
          localStore.getItem(`genie.conversation.${conversationKey}`) || "null",
        );
        if (conv?.key && Array.isArray(conv.messages) && conv.messages.length)
          return {
            key: conv.key,
            thread: conv.thread,
            messages: conv.messages,
          };
      }
    } catch {
      /* Fall through to a fresh conversation. */
    }
    return { key: conversationKey || uid(), messages: [] };
  });
  const [mode, setMode] = useState<ChatMode>(() => {
    try {
      const saved = localStore.getItem(MODE_KEY);
      if (saved === "draw" || saved === "discuss") return saved;
    } catch {
      /* Fall back to the variant default. */
    }
    return variant === "canvas" ? "draw" : "discuss";
  });
  const [prompt, setPrompt] = useState(() => {
    try {
      return localStore.getItem(`genie.chat.draft.${initial.key}`) || "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [model, setModel] = useState(""),
    [showSettings, setShowSettings] = useState(false);
  const [skill, setSkill] = useState("auto");
  const key = initial.key;
  const [thread, setThread] = useState(initial.thread),
    [messages, setMessages] = useState<Message[]>(initial.messages);
  const [pending, setPending] = useState<CanvasDocument>();
  const [codexPath, setCodexPath] = useState(
    () => localStore.getItem("genie.codexPath") || "",
  );
  const [status, setStatus] = useState<Status>(),
    [checking, setChecking] = useState(false);
  const run = useRef<string | undefined>(undefined),
    end = useRef<HTMLDivElement>(null),
    latest = useRef(e),
    mounted = useRef(true);
  latest.current = e;
  const desktop = isTauri();

  useEffect(() => {
    try {
      localStore.setItem(MODE_KEY, mode);
    } catch {
      /* The mode is a convenience; ignore storage failures. */
    }
  }, [mode]);
  useEffect(() => onKeyChange?.(key), [key]);
  useEffect(() => {
    try {
      if (prompt) localStore.setItem(`genie.chat.draft.${key}`, prompt);
      else localStore.removeItem(`genie.chat.draft.${key}`);
    } catch {
      setError("Your unsent message could not be saved on this device.");
    }
  }, [prompt, key]);
  useEffect(() => {
    if (!promptSeed) return;
    setPrompt(promptSeed.text);
    if (promptSeed.mode) setMode(promptSeed.mode);
  }, [promptSeed]);
  useEffect(() => {
    if (!messages.length && !thread) return;
    try {
      localStore.setItem(storageKey, JSON.stringify({ key, thread, messages }));
      {
        localStore.setItem(
          `genie.conversation.${key}`,
          JSON.stringify({
            key,
            thread,
            messages,
            scope,
            updatedAt: new Date().toISOString(),
          }),
        );
        window.dispatchEvent(new Event(chatEvent));
      }
    } catch {
      setError(
        "This chat could not be saved. Check Settings > Storage and retry.",
      );
    }
  }, [messages, key, thread, storageKey, scope]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
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
      setShowSettings(true);
      return;
    }
    if (!mounted.current) return;
    const value = prompt,
      runMode = mode,
      runKey = key;
    let lastRevision = 0;
    setPrompt("");
    setMessages((m) => [...m, { id: uid(), role: "user", text: value }]);

    // Closes a Draw turn with the canvas.json artifact, once per turn.
    const finish = () => {
      if (lastRevision) {
        const n = lastRevision;
        lastRevision = 0;
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            text: `canvas.json, revision ${n}`,
            artifact: { n },
          },
        ]);
      }
      setBusy(false);
      run.current = undefined;
    };

    const channel = new Channel<Event>();
    channel.onmessage = (event) => {
      if (!mounted.current) return;
      if (event.type === "event" && event.event) {
        const ev = event.event,
          item = ev.item;
        if (ev.type === "thread.started") setThread(ev.thread_id);
        if (ev.type === "turn.failed")
          setError(ev.error?.message || "The assistant could not finish.");
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
      if (event.type === "canvas" && runMode === "draw") {
        try {
          const next = parseDocument(event.canvas);
          try {
            lastRevision = addRevision(runKey, event.canvas, pageId);
          } catch {
            setError(
              "Could not store this revision. Check Settings > Storage and retry.",
            );
          }
          if (latest.current.doc.metadata.updatedAt === event.baseUpdatedAt) {
            onCanvasRevision?.(next, `Chat: ${value.slice(0, 70)}`);
            latest.current.change(next);
            latest.current.select([]);
            latest.current.notify("Canvas updated. Undo is available.");
          } else {
            setPending(next);
            latest.current.notify(
              "A canvas update is ready to review in Chat.",
            );
          }
        } catch (err) {
          setError(`The assistant returned an invalid canvas: ${String(err)}`);
        }
      }
      if (event.type === "done") {
        if (event.codexThreadId) setThread(event.codexThreadId);
        finish();
      }
      if (event.type === "error") {
        setError(event.message || "Chat failed.");
        finish();
      }
    };
    try {
      const id = await invoke<string>("codex_run", {
        request: {
          key,
          prompt: modePrefix[runMode] + value,
          model: model.trim() || undefined,
          codexPath: codexPath.trim() || undefined,
          codexThreadId: thread,
          canvas: e.doc,
          selection: e.selection,
          skill,
          brand: assistantBrand(),
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

  const blocks = useMemo(() => {
    const out: (
      | { kind: "tool"; id: string; items: Message[] }
      | { kind: "msg"; m: Message }
    )[] = [];
    for (const m of messages) {
      const last = out.at(-1);
      if (m.role !== "tool") out.push({ kind: "msg", m });
      else if (last?.kind === "tool") last.items.push(m);
      else out.push({ kind: "tool", id: m.id, items: [m] });
    }
    return out;
  }, [messages]);

  return (
    <section className={`chat-panel chat-${variant}`}>
      <header className="chat-head">
        <h2>{variant === "idea" ? "Conversation" : "Chat"}</h2>
        <div className="chat-head-actions"></div>
      </header>
      <div className="chat-skill-picker">
        <SelectField
          label="Assistant skill"
          value={skill}
          disabled={busy}
          options={assistantSkills.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          onChange={(value) => {
            setSkill(value);
            const next = assistantSkills.find(
              (item) => item.id === value,
            )?.mode;
            if (next === "discuss" || next === "draw") setMode(next);
          }}
        />
      </div>

      {showSettings && (
        <div className="chat-settings" id="chat-settings">
          <label>
            Model
            <input
              placeholder="Default model"
              value={model}
              disabled={busy}
              onChange={(ev) => setModel(ev.target.value)}
            />
          </label>
          <label>
            Codex executable
            <input
              aria-label="Codex executable"
              placeholder="Bundled CLI or automatic detection"
              value={codexPath}
              disabled={busy}
              onChange={(ev) => {
                setCodexPath(ev.target.value);
                localStore.setItem("genie.codexPath", ev.target.value);
                setStatus(undefined);
              }}
            />
          </label>
          <button
            disabled={!desktop || checking || busy}
            onClick={() => void check()}
          >
            {checking ? "Checking…" : "Check installation"}
          </button>
          {status && <p role="status">{status.message}</p>}
          {desktop && (
            <button
              onClick={() =>
                void invoke("reveal_workspace", { key }).catch((err) =>
                  setError(String(err)),
                )
              }
            >
              Open workspace folder
            </button>
          )}
        </div>
      )}

      <div className="chat-thread" aria-live="polite">
        {!messages.length && (
          <div className="chat-empty">
            <h3>
              {variant === "idea"
                ? "What are we making?"
                : "Ask about this canvas"}
            </h3>
            <p>
              <b>Discuss</b> is plain conversation. <b>Draw</b> edits your
              canvas and saves each result as a revision.
            </p>
            <div className="chat-starters">
              {starters.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setMode(s.mode);
                    setPrompt(s.prompt);
                  }}
                >
                  <span>{s.mode === "draw" ? "Draw" : "Discuss"}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {blocks.map((b) =>
          b.kind === "tool" ? (
            <details className="chat-activity" key={b.id}>
              <summary>
                Activity · {b.items.length} step
                {b.items.length === 1 ? "" : "s"}
              </summary>
              <pre>{b.items.map((i) => i.text).join("\n\n")}</pre>
            </details>
          ) : b.m.artifact ? (
            <CanvasArtifact
              key={b.m.id}
              chatKey={key}
              n={b.m.artifact.n}
              editor={e}
              onOpenCanvas={onOpenCanvas}
              onCanvasRevision={onCanvasRevision}
              onRestoreRevision={onRestoreRevision}
            />
          ) : (
            <article className={`chat-message ${b.m.role}`} key={b.m.id}>
              <ReactMarkdown>{b.m.text}</ReactMarkdown>
            </article>
          ),
        )}

        {busy && (
          <p className="chat-working" role="status">
            {mode === "draw" ? "Drawing on your canvas…" : "Thinking…"}
          </p>
        )}
        <div ref={end} />
      </div>

      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="chat-pending">
          <p>
            You changed the canvas while the assistant was working. Its version
            is ready.
          </p>
          <div>
            <button
              onClick={() => {
                onCanvasRevision?.(pending, "Applied reviewed chat update");
                e.change(pending);
                e.select([]);
                setPending(undefined);
              }}
            >
              Apply assistant version
            </button>
            <button onClick={() => setPending(undefined)}>
              Keep my canvas
            </button>
          </div>
        </div>
      )}

      <form
        className="chat-composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Chat message"
          placeholder={
            mode === "draw"
              ? "Describe what to draw or change on the canvas"
              : "Ask, think out loud, or write a caption"
          }
          rows={2}
          value={prompt}
          onChange={(ev) => setPrompt(ev.target.value)}
          onKeyDown={(ev) => {
            if (
              ev.key === "Enter" &&
              !ev.shiftKey &&
              !ev.nativeEvent.isComposing
            ) {
              ev.preventDefault();
              void send();
            }
          }}
        />
        <div className="chat-composer-bar">
          <div className="chat-mode" role="group" aria-label="Chat mode">
            {(["discuss", "draw"] as const).map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={mode === m}
                disabled={busy}
                onClick={() => setMode(m)}
              >
                {m === "discuss" ? "Discuss" : "Draw"}
              </button>
            ))}
          </div>
          <span className="chat-hint">
            {!desktop
              ? "Chat runs in the desktop app"
              : mode === "draw"
                ? `Canvas attached · ${e.selection.length} selected`
                : "Text only, canvas untouched"}
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
              disabled={!prompt.trim() || !desktop || checking}
            >
              Send
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
