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
import { PickerPopover, SelectField } from "./ui/Controls";
import { AssistantSettings } from "./AssistantSettings";
import {
  readCodexPreferences,
  readConversationUsage,
  effortLabels,
  type TokenUsage,
  type CodexPreferences,
} from "../lib/codexPreferences";

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
    message?: string;
    usage?: TokenUsage;
    item?: {
      id: string;
      type: string;
      text?: string;
      command?: string;
      aggregated_output?: string;
      status?: string;
      changes?: { path: string }[];
      items?: { text: string; completed: boolean }[];
      query?: string;
      server?: string;
      tool?: string;
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
  onCanvasRevision,
  onRestoreRevision,
}: {
  chatKey: string;
  n: number;
  editor: Editor;
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
  conversationKey,
  onCanvasRevision,
  onRestoreRevision,
  pageId,
  headingNote,
}: {
  editor: Editor;
  scope: string;
  variant?: "canvas" | "idea";
  promptSeed?: { id: string; text: string; mode?: ChatMode };
  startFresh?: boolean;
  onKeyChange?: (key: string) => void;
  conversationKey?: string;
  onCanvasRevision?: (doc: CanvasDocument, label: string) => void;
  onRestoreRevision?: (doc: CanvasDocument, pageId?: string) => void;
  pageId?: string;
  headingNote?: React.ReactNode;
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
    [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState(() =>
    readCodexPreferences(scope),
  );
  const [usage, setUsage] = useState(() => readConversationUsage(initial.key));
  function updatePreferences(value: Partial<CodexPreferences>) {
    setPreferences((previous) => ({ ...previous, ...value }));
  }
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
      localStore.setItem(
        `genie.chat.preferences.${scope}`,
        JSON.stringify(preferences),
      );
    } catch {
      setError("Assistant preferences could not be saved.");
    }
  }, [scope, preferences]);
  useEffect(() => {
    try {
      localStore.setItem(
        `genie.chat.usage.${initial.key}`,
        JSON.stringify(usage),
      );
    } catch {
      /* Usage display must not prevent working with the assistant. */
    }
  }, [usage, initial.key]);

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
        if (ev.type === "error")
          setError(ev.message || "The assistant encountered an error.");
        if (ev.type === "turn.completed" && ev.usage) {
          const tokens = ev.usage;
          setUsage((previous) => ({
            turns: previous.turns + 1,
            input: previous.input + tokens.input_tokens,
            output: previous.output + tokens.output_tokens,
            cached: previous.cached + tokens.cached_input_tokens,
            last: tokens,
          }));
        }
        if (item) {
          const text =
            item.text ||
            (item.items
              ? item.items
                  .map(
                    (task) =>
                      `${task.completed ? "Done" : "Pending"}: ${task.text}`,
                  )
                  .join("\n")
              : "") ||
            (item.query ? `Search: ${item.query}` : "") ||
            [
              item.command,
              item.aggregated_output,
              item.server && item.tool ? `${item.server}: ${item.tool}` : "",
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
          model: preferences.model.trim() || undefined,
          reasoningEffort: preferences.reasoningEffort,
          webSearchMode: preferences.webSearchMode,
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
        {headingNote && <span className="chat-head-note">{headingNote}</span>}
      </header>

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
                  <strong>{s.label}</strong>
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
              onCanvasRevision={onCanvasRevision}
              onRestoreRevision={onRestoreRevision}
            />
          ) : (
            <article className={`chat-message ${b.m.role}`} key={b.m.id}>
              {b.m.role === "assistant" && (
                <span className="chat-author">
                  <Icon name="idea" size={14} /> Assistant
                </span>
              )}
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
        <div className="chat-model-bar">
          <PickerPopover
            label="Assistant settings"
            open={showSettings}
            onOpenChange={setShowSettings}
            side="top"
            align="start"
            trigger={
              <button
                type="button"
                className="chat-model-toggle"
                aria-label="Choose model and assistant settings"
                aria-expanded={showSettings}
                aria-controls="chat-settings"
                title="Model, reasoning, web search, and account"
              >
                <Icon name="settings" size={14} />
                <span>{preferences.model || "Codex default"}</span>
                <Icon name={showSettings ? "up" : "down"} size={13} />
              </button>
            }
          >
            <div className="chat-settings-pop">
              <AssistantSettings
                preferences={preferences}
                onChange={updatePreferences}
                codexPath={codexPath}
                onPathChange={(value) => {
                  setCodexPath(value);
                  localStore.setItem("genie.codexPath", value);
                  setStatus(undefined);
                }}
                busy={busy}
                checking={checking}
                status={status}
                onCheck={() => void check()}
                conversationKey={key}
                onError={setError}
              />
              {usage.turns > 0 && (
                <details className="chat-token-usage">
                  <summary>
                    {(usage.input + usage.output).toLocaleString()} tokens
                    across {usage.turns} completed{" "}
                    {usage.turns === 1 ? "turn" : "turns"}
                  </summary>
                  <div>
                    <span>Input: {usage.input.toLocaleString()}</span>
                    <span>Output: {usage.output.toLocaleString()}</span>
                    <span>
                      Cached input: {usage.cached.toLocaleString()}
                    </span>
                  </div>
                  {usage.last && (
                    <p>
                      Last turn:{" "}
                      {usage.last.input_tokens.toLocaleString()} input,{" "}
                      {usage.last.output_tokens.toLocaleString()} output,{" "}
                      {usage.last.cached_input_tokens.toLocaleString()} cached
                      input.
                    </p>
                  )}
                  <p>
                    Recorded locally from completed turns reported by Codex.
                    Input includes conversation context; cached tokens are
                    included in input.
                  </p>
                </details>
              )}
            </div>
          </PickerPopover>
          {preferences.reasoningEffort !== "default" && (
            <span className="chat-model-detail">
              {effortLabels[preferences.reasoningEffort]} effort
            </span>
          )}
          {preferences.webSearchMode === "live" && (
            <span className="chat-model-detail">Live search</span>
          )}
        </div>
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
          <span className="chat-skill" title="Assistant skill">
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
          </span>
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
              className="primary chat-send"
              type="submit"
              disabled={!prompt.trim() || !desktop || checking}
              title="Send message"
            >
              Send <Icon name="right" size={15} />
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
