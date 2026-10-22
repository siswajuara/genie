import { useState } from "react";
import Markdown from "react-markdown";
import type { Part, Permission, ToolPart } from "@opencode-ai/sdk/client";
import type { Bundle } from "../lib/opencode";

const TOOLS: Record<string, [string, string]> = {
  read: ["Read File", "filePath"],
  list: ["List Files", "path"],
  glob: ["Find Files", "pattern"],
  grep: ["Search Files", "pattern"],
  bash: ["Shell Command", "command"],
  edit: ["Edit File", "filePath"],
  write: ["Write File", "filePath"],
  webfetch: ["Fetch URL", "url"],
  websearch: ["Web Search", "query"],
  task: ["Subagent", "description"],
};

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(
    (children as { props?: { children?: unknown } })?.props?.children ?? "",
  ).replace(/\n$/, "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="codeblock">
      <button type="button" className="mini" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export function Md({ text }: { text: string }) {
  return (
    <div className="md">
      <Markdown
        components={{
          pre: CodeBlock,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

function ToolRow({ part }: { part: ToolPart }) {
  const [label, key] = TOOLS[part.tool] ?? [part.tool, ""];
  const s = part.state;
  const input = s.input as Record<string, unknown>;
  const subject = String(input[key] ?? ("title" in s ? s.title : "") ?? "");
  const secs =
    s.status === "completed" || s.status === "error"
      ? ((s.time.end - s.time.start) / 1000).toFixed(1) + "s"
      : null;
  const body =
    s.status === "completed" ? s.output : s.status === "error" ? s.error : "";
  return (
    <details className={`tool tool-${s.status}`}>
      <summary>
        <span className="tool-name">{label}</span>
        <span className="tool-subject">{subject}</span>
        <span className="tool-state">
          {secs ?? (s.status === "pending" ? "Queued" : "Running")}
        </span>
      </summary>
      {body && (
        <pre className="tool-out">
          {body.length > 4000 ? body.slice(0, 4000) + "\n… truncated" : body}
        </pre>
      )}
    </details>
  );
}

function PartView({ part }: { part: Part }) {
  if (part.type === "text")
    return part.synthetic || part.ignored || !part.text ? null : (
      <Md text={part.text} />
    );
  if (part.type === "reasoning") {
    return part.text ? (
      <details className="think">
        <summary>{part.time.end ? "Thought" : "Thinking"}</summary>
        <p>{part.text}</p>
      </details>
    ) : null;
  }
  if (part.type === "tool") return <ToolRow part={part} />;
  return null;
}

export function MessageView({ bundle }: { bundle: Bundle }) {
  const { info, parts } = bundle;
  if (info.role === "user") {
    const text = parts
      .map((p) => (p.type === "text" && !p.synthetic ? p.text : ""))
      .join("");
    return text ? (
      <div className="user-msg">
        <p>{text}</p>
      </div>
    ) : null;
  }
  const secs = info.time.completed
    ? ((info.time.completed - info.time.created) / 1000).toFixed(1) + "s"
    : null;
  return (
    <article className="ai-msg">
      {parts.map((p) => (
        <PartView key={p.id} part={p} />
      ))}
      {info.error && (
        <p className="err-inline">
          {"data" in info.error &&
          info.error.data &&
          "message" in info.error.data
            ? String(info.error.data.message)
            : info.error.name}
        </p>
      )}
      <p className="ai-meta">
        {info.modelID} · {info.mode}
        {secs ? ` · ${secs}` : " · working"}
      </p>
    </article>
  );
}

export function PermissionCard({
  p,
  onAnswer,
}: {
  p: Permission;
  onAnswer: (r: "once" | "always" | "reject") => void;
}) {
  return (
    <div className="perm" role="alertdialog" aria-label="Permission request">
      <p className="perm-title">The agent wants to run: {p.title}</p>
      <div className="perm-actions">
        <button type="button" className="btn" onClick={() => onAnswer("once")}>
          Allow once
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => onAnswer("always")}
        >
          Always allow
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => onAnswer("reject")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
