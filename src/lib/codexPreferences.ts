import { localStore } from "./localStore";

export type CodexPreferences = {
  model: string;
  reasoningEffort: string;
  webSearchMode: string;
};
export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
};
export type ConversationUsage = {
  turns: number;
  input: number;
  output: number;
  cached: number;
  last?: TokenUsage;
};
export type CodexCapabilities = {
  ok: boolean;
  message?: string;
  models: {
    id: string;
    label: string;
    description: string;
    isDefault: boolean;
    defaultReasoningEffort?: string;
    efforts: { value: string; description: string }[];
  }[];
  account: { type: string; plan: string | null } | null;
  requiresOpenaiAuth: boolean | null;
  limits: { primary: LimitWindow | null; secondary: LimitWindow | null } | null;
  warnings: string[];
};
type LimitWindow = {
  usedPercent: number;
  windowDurationMins?: number;
  resetsAt?: number;
};
export function readCodexPreferences(scope: string): CodexPreferences {
  try {
    const value = JSON.parse(
      localStore.getItem(`genie.chat.preferences.${scope}`) || "{}",
    );
    return {
      model: typeof value.model === "string" ? value.model : "",
      reasoningEffort: ["minimal", "low", "medium", "high", "xhigh"].includes(
        value.reasoningEffort,
      )
        ? value.reasoningEffort
        : "default",
      webSearchMode: ["disabled", "cached", "live"].includes(
        value.webSearchMode,
      )
        ? value.webSearchMode
        : "default",
    };
  } catch {
    return { model: "", reasoningEffort: "default", webSearchMode: "default" };
  }
}
export function readConversationUsage(key: string): ConversationUsage {
  try {
    const value = JSON.parse(
      localStore.getItem(`genie.chat.usage.${key}`) || "null",
    );
    if (
      value &&
      [value.turns, value.input, value.output, value.cached].every(
        (item) =>
          typeof item === "number" && Number.isFinite(item) && item >= 0,
      )
    ) {
      if (
        value.last &&
        ![
          value.last.input_tokens,
          value.last.output_tokens,
          value.last.cached_input_tokens,
        ].every(
          (item) =>
            typeof item === "number" && Number.isFinite(item) && item >= 0,
        )
      )
        delete value.last;
      return value;
    }
  } catch {
    /* A missing usage record does not affect chat history. */
  }
  return { turns: 0, input: 0, output: 0, cached: 0 };
}
export const effortLabels: Record<string, string> = {
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};
