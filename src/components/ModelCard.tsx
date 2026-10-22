import { useLayoutEffect, useRef, useState } from "react";
import type { Model } from "@opencode-ai/sdk/client";
import { fmtTokens } from "../lib/opencode";
import type { Usage } from "../lib/opencode";

type Props = {
  id: string;
  model: Model;
  usage?: Usage;
  contextTokens?: number;
  anchor: DOMRect;
  placement: "right" | "above";
};

const MODES = ["text", "image", "audio", "video", "pdf"] as const;
const label = (s: string) =>
  s === "pdf" ? "PDF" : s[0].toUpperCase() + s.slice(1);
const usd = (n: number) => (n === 0 ? "$0" : `$${n}`);

export function ModelCard({
  id,
  model,
  usage,
  contextTokens,
  anchor,
  placement,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left: number;
    let top: number;
    if (placement === "right") {
      left = anchor.right + 10;
      if (left + width > innerWidth - 8) left = anchor.left - width - 10;
      top = anchor.top;
    } else {
      left = anchor.left;
      top = anchor.top - height - 8;
    }
    setPos({
      left: Math.max(8, Math.min(left, innerWidth - width - 8)),
      top: Math.max(8, Math.min(top, innerHeight - height - 8)),
    });
  }, [anchor, placement, model.id]);

  const c = model.capabilities;
  const caps = [
    c.toolcall && "Tool calling",
    c.reasoning && "Reasoning",
    c.attachment && "Attachments",
  ].filter(Boolean) as string[];
  const ctxPct =
    contextTokens && model.limit.context
      ? Math.min(100, (contextTokens / model.limit.context) * 100)
      : null;

  return (
    <div ref={ref} id={id} role="tooltip" className="mcard" style={pos}>
      <h3>{model.name}</h3>
      <p className="mcard-sub">Zen · free · {model.status}</p>

      <h4>Capabilities</h4>
      <p>{caps.length ? caps.join(", ") : "Text only"}</p>

      <h4>Modalities</h4>
      <dl>
        <dt>Input</dt>
        <dd>
          {MODES.filter((m) => c.input[m])
            .map(label)
            .join(", ") || "None"}
        </dd>
        <dt>Output</dt>
        <dd>
          {MODES.filter((m) => c.output[m])
            .map(label)
            .join(", ") || "None"}
        </dd>
      </dl>

      <h4>Cost ($ / 1M tokens)</h4>
      <dl>
        <dt>Input</dt>
        <dd>{usd(model.cost.input)}</dd>
        <dt>Output</dt>
        <dd>{usd(model.cost.output)}</dd>
        <dt>Cache read</dt>
        <dd>{usd(model.cost.cache.read)}</dd>
        <dt>Cache write</dt>
        <dd>{usd(model.cost.cache.write)}</dd>
      </dl>

      <h4>Limits</h4>
      <dl>
        <dt>Context window</dt>
        <dd>{fmtTokens(model.limit.context)}</dd>
        <dt>Max output</dt>
        <dd>{fmtTokens(model.limit.output)}</dd>
      </dl>

      <h4>Usage in this chat</h4>
      {usage ? (
        <dl>
          <dt>Replies</dt>
          <dd>{usage.replies}</dd>
          <dt>Tokens in</dt>
          <dd>{fmtTokens(usage.input)}</dd>
          <dt>Tokens out</dt>
          <dd>{fmtTokens(usage.output)}</dd>
          <dt>Cache hits</dt>
          <dd>{fmtTokens(usage.cached)}</dd>
        </dl>
      ) : (
        <p className="muted">Not used in this chat yet.</p>
      )}
      {ctxPct !== null && (
        <div
          className="mcard-ctx"
          aria-label={`Context ${ctxPct.toFixed(1)} percent used`}
        >
          <div className="bar">
            <span style={{ width: `${ctxPct}%` }} />
          </div>
          <span>{ctxPct.toFixed(1)}% of context used</span>
        </div>
      )}
      <p className="mcard-foot">
        Zen rate limits are not exposed by the local server, so only your own
        token usage is shown.
      </p>
    </div>
  );
}
