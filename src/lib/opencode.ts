import { createOpencodeClient } from "@opencode-ai/sdk/client";
import type { Message, Model, Part, Provider } from "@opencode-ai/sdk/client";

export type Client = ReturnType<typeof createOpencodeClient>;
export type Bundle = { info: Message; parts: Part[] };
export type Usage = {
  replies: number;
  input: number;
  output: number;
  cached: number;
};

export const DEFAULT_URL = "http://127.0.0.1:4096";
/** Zen is exposed by the server as the provider with id "opencode". */
const ZEN_PROVIDER = "opencode";

// The webview can't spawn the opencode binary, so we only use the client half of the SDK.
export const makeClient = (baseUrl: string): Client =>
  createOpencodeClient({ baseUrl, throwOnError: true });

export function data<T>(res: { data?: T }): T {
  if (res.data === undefined) throw new Error("Empty response from server");
  return res.data;
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as {
      data?: { message?: string };
      message?: string;
      name?: string;
    };
    return o.data?.message ?? o.message ?? o.name ?? JSON.stringify(e);
  }
  return String(e);
}

/** Only Zen models that cost nothing, in both directions. */
export function freeZenModels(providers: Provider[]): Model[] {
  const zen = providers.find((p) => p.id === ZEN_PROVIDER);
  if (!zen) return [];
  return Object.values(zen.models)
    .filter(
      (m) =>
        m.cost.input === 0 && m.cost.output === 0 && m.status !== "deprecated",
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const modelKey = (providerID: string, modelID: string) =>
  `${providerID}/${modelID}`;

export function usageByModel(list: Bundle[]): Record<string, Usage> {
  const out: Record<string, Usage> = {};
  for (const { info } of list) {
    if (info.role !== "assistant") continue;
    const u = (out[modelKey(info.providerID, info.modelID)] ??= {
      replies: 0,
      input: 0,
      output: 0,
      cached: 0,
    });
    u.replies += 1;
    u.input += info.tokens.input;
    u.output += info.tokens.output + info.tokens.reasoning;
    u.cached += info.tokens.cache.read;
  }
  return out;
}

/** Tokens in the context window after the latest completed reply. */
export function contextUsed(
  list: Bundle[],
): { tokens: number; key: string } | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i].info;
    if (m.role === "assistant" && m.tokens.input + m.tokens.output > 0) {
      const t = m.tokens;
      return {
        tokens: t.input + t.output + t.reasoning + t.cache.read + t.cache.write,
        key: modelKey(m.providerID, m.modelID),
      };
    }
  }
  return null;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return String(n);
}

export function fmtAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Command the user runs once so the webview origin is allowed to call the server. */
export function serveCommand(baseUrl: string): string {
  let port = "4096";
  try {
    port = new URL(baseUrl).port || port;
  } catch {
    /* keep default */
  }
  const origins = [
    ...new Set([
      window.location.origin,
      "tauri://localhost",
      "http://tauri.localhost",
    ]),
  ];
  return `opencode serve --port ${port} ${origins.map((o) => `--cors ${o}`).join(" ")}`;
}
