import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { SelectField } from "./ui/Controls";
import {
  effortLabels,
  type CodexCapabilities,
  type CodexPreferences,
} from "../lib/codexPreferences";

export function AssistantSettings({
  preferences,
  onChange,
  codexPath,
  onPathChange,
  busy,
  checking,
  status,
  onCheck,
  conversationKey,
  onError,
}: {
  preferences: CodexPreferences;
  onChange: (value: Partial<CodexPreferences>) => void;
  codexPath: string;
  onPathChange: (value: string) => void;
  busy: boolean;
  checking: boolean;
  status?: { message: string };
  onCheck: () => void;
  conversationKey: string;
  onError: (message: string) => void;
}) {
  const [capabilities, setCapabilities] = useState<CodexCapabilities>();
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const requestId = useRef(0);
  const desktop = isTauri();
  async function refresh() {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const result = await invoke<CodexCapabilities>("codex_capabilities", {
        codexPath: codexPath.trim() || undefined,
      });
      if (id !== requestId.current) return;
      if (!result.ok)
        throw new Error(result.message || "Could not load Codex models.");
      setCapabilities(result);
      setError(result.warnings?.join(" ") || "");
    } catch (error) {
      if (id === requestId.current) setError(String(error));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    setCapabilities(undefined);
    setError("");
    const timer = setTimeout(() => {
      if (desktop) void refresh();
    }, 300);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [codexPath, desktop]);
  const models = capabilities?.models || [];
  const selected = models.find((item) => item.id === preferences.model);
  useEffect(() => {
    if (
      selected &&
      preferences.reasoningEffort !== "default" &&
      !selected.efforts.some(
        (item) => item.value === preferences.reasoningEffort,
      )
    )
      onChange({ reasoningEffort: "default" });
  }, [selected, preferences.reasoningEffort, onChange]);
  const effective = selected;
  const efforts = effective?.efforts || [];
  const modelOptions = [
    { value: "", label: "Codex default" },
    ...models.map((item) => ({ value: item.id, label: item.label })),
    ...(preferences.model && !selected
      ? [{ value: preferences.model, label: preferences.model }]
      : []),
  ];
  const effortOptions = [
    { value: "default", label: "Model default" },
    ...efforts.map((item) => ({
      value: item.value,
      label: effortLabels[item.value] || item.value,
    })),
    ...(preferences.reasoningEffort !== "default" &&
    !efforts.some((item) => item.value === preferences.reasoningEffort)
      ? [
          {
            value: preferences.reasoningEffort,
            label:
              effortLabels[preferences.reasoningEffort] ||
              preferences.reasoningEffort,
          },
        ]
      : []),
  ];
  return (
    <div
      className="chat-settings"
      id="chat-settings"
      role="region"
      aria-label="Assistant settings"
    >
      <div className="assistant-settings-title">
        <strong>Assistant settings</strong>
        <button
          disabled={!desktop || loading || busy}
          onClick={() => void refresh()}
        >
          {loading ? "Loading…" : "Refresh models"}
        </button>
      </div>
      <label>
        Model
        <SelectField
          label="Assistant model"
          value={preferences.model}
          disabled={busy || loading}
          options={modelOptions}
          onChange={(model) => onChange({ model, reasoningEffort: "default" })}
        />
      </label>
      <p className="chat-setting-note">
        {selected?.description ||
          "Default follows your Codex configuration. Model access depends on your account."}
      </p>
      <label>
        Reasoning effort
        <SelectField
          label="Reasoning effort"
          value={preferences.reasoningEffort}
          disabled={busy}
          options={effortOptions}
          onChange={(reasoningEffort) => onChange({ reasoningEffort })}
        />
      </label>
      <p className="chat-setting-note">
        {efforts.find((item) => item.value === preferences.reasoningEffort)
          ?.description ||
          (effective
            ? "Higher effort can take longer and use more tokens."
            : "Choose a model to see its reasoning options. Higher effort can take longer and use more tokens.")}
      </p>
      <label>
        Web search
        <SelectField
          label="Web search"
          value={preferences.webSearchMode}
          disabled={busy}
          options={[
            { value: "default", label: "Codex default" },
            { value: "disabled", label: "Off" },
            { value: "cached", label: "Cached results" },
            { value: "live", label: "Live web search" },
          ]}
          onChange={(webSearchMode) => onChange({ webSearchMode })}
        />
      </label>
      <p className="chat-setting-note">
        Changes apply to the next message. Conversation history and canvas stay
        in place.
      </p>
      {capabilities && (
        <div className="chat-account-status">
          <strong>
            {capabilities.account
              ? capabilities.account.type === "chatgpt"
                ? `ChatGPT${capabilities.account.plan ? ` ${capabilities.account.plan}` : ""}`
                : capabilities.account.type === "apiKey"
                  ? "API key connection"
                  : "Codex account connected"
              : capabilities.requiresOpenaiAuth
                ? "Run codex login to sign in"
                : "Using configured provider"}
          </strong>
          {[
            capabilities.limits?.primary,
            capabilities.limits?.secondary,
          ].flatMap((limit, index) =>
            limit
              ? [
                  <div key={index} className="chat-limit">
                    <span>
                      {limit.windowDurationMins
                        ? `${limit.windowDurationMins >= 60 ? `${Math.round(limit.windowDurationMins / 60)}h` : `${limit.windowDurationMins}m`} window`
                        : `Usage window ${index + 1}`}
                      : {limit.usedPercent}% used
                    </span>
                    <progress
                      max={100}
                      value={limit.usedPercent}
                      aria-label={`Account usage window ${index + 1}`}
                    />
                    {limit.resetsAt && (
                      <small>
                        Resets{" "}
                        {new Date(limit.resetsAt * 1000).toLocaleString()}
                      </small>
                    )}
                  </div>,
                ]
              : [],
          )}
        </div>
      )}
      {error && (
        <p className="chat-setting-error" role="status">
          {error}
        </p>
      )}
      <details className="chat-advanced">
        <summary>Advanced connection</summary>
        <label>
          Custom model identifier
          <input
            value={preferences.model}
            placeholder="Or enter a model identifier"
            disabled={busy}
            onChange={(event) =>
              onChange({
                model: event.target.value,
                reasoningEffort: "default",
              })
            }
          />
        </label>
        <label>
          Codex executable
          <input
            aria-label="Codex executable"
            value={codexPath}
            placeholder="Bundled CLI or automatic detection"
            disabled={busy}
            onChange={(event) => onPathChange(event.target.value)}
          />
        </label>
        <button disabled={!desktop || checking || busy} onClick={onCheck}>
          {checking ? "Checking…" : "Check installation"}
        </button>
        {status && <p role="status">{status.message}</p>}
        {desktop && (
          <button
            onClick={() =>
              void invoke("reveal_workspace", { key: conversationKey }).catch(
                (error) => onError(String(error)),
              )
            }
          >
            Open working files
          </button>
        )}
      </details>
    </div>
  );
}
