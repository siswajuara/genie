import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "../editor/use-editor";
import type { Workspace } from "../editor/projects";
import { Icon } from "./ui/icon";
import { SelectField } from "./ui/select";

type Scope = "canvas" | "frame" | "selection" | "library";
export function DebugPanel({
  editor: e,
  workspace,
  pageName,
  value,
  onChange,
  onApply,
  onDownload,
}: {
  editor: Editor;
  workspace: Workspace;
  pageName: string;
  value: string;
  onChange: (value: string) => void;
  onApply: (value: string) => void;
  onDownload: (value: string, filename: string) => Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>("canvas");
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState("");
  const [validation, setValidation] = useState({
    source: "",
    error: "",
    lines: 0,
    bytes: 0,
  });
  const input = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const fileRequest = useRef(0);
  const initial = useRef({ value, doc: e.doc, onChange });
  useEffect(() => {
    if (!initial.current.value)
      initial.current.onChange(JSON.stringify(initial.current.doc, null, 2));
    return () => {
      fileRequest.current++;
    };
  }, []);
  useEffect(() => {
    setFeedback("");
    setFailure("");
    const timer = setTimeout(() => {
      let error = "";
      if (value.trim())
        try {
          JSON.parse(value);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
      setValidation({
        source: value,
        error,
        lines: value ? value.split("\n").length : 0,
        bytes: new TextEncoder().encode(value).length,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [value]);
  const checking = validation.source !== value;
  const valid = !!value.trim() && !checking && !validation.error;
  const unavailable =
    (scope === "selection" && !e.selection.length) ||
    (scope === "frame" && !e.frame);
  const filename =
    scope === "library"
      ? "canvases.json"
      : scope === "canvas"
        ? "canvas.json"
        : `${scope}-preset.json`;
  function read() {
    try {
      const data =
        scope === "library"
          ? workspace
          : scope === "frame"
            ? e.preset("template", e.frame?.n || "Frame")
            : scope === "selection"
              ? e.preset("object", "Selection")
              : e.doc;
      fileRequest.current++;
      onChange(JSON.stringify(data, null, 2));
    } catch (err) {
      setFailure(String(err));
    }
  }
  function format(compact: boolean) {
    try {
      onChange(
        JSON.stringify(JSON.parse(value), null, compact ? undefined : 2),
      );
    } catch (err) {
      setFailure(String(err));
    }
  }
  return (
    <section className="debug-panel" aria-label="Canvas JSON tools">
      <div className="debug-heading">
        <h2>JSON</h2>
        <span title={pageName}>{pageName}</span>
      </div>
      <div className="debug-source">
        <SelectField
          label="Read JSON from"
          value={scope}
          onChange={(value) => setScope(value as Scope)}
          options={[
            { value: "canvas", label: "Current page" },
            { value: "frame", label: "Active frame" },
            { value: "selection", label: "Selection" },
            { value: "library", label: "All canvases" },
          ]}
        />
        <Button
          disabled={unavailable}
          onClick={read}
          title={
            unavailable
              ? "Select a frame or elements on the canvas first"
              : "Replace editor content with the latest JSON"
          }
        >
          Read
        </Button>
        <Button
          className="debug-icon"
          aria-label="Open JSON file"
          title="Open JSON file to preview"
          onClick={() => input.current?.click()}
        >
          <Icon name="attach" size={16} />
        </Button>
      </div>
      <div className="debug-code">
        <div className="debug-tools" role="toolbar" aria-label="JSON actions">
          <Button
            disabled={!valid}
            onClick={() => format(false)}
            title="Indent JSON with two spaces"
          >
            Format
          </Button>
          <Button
            disabled={!valid}
            onClick={() => format(true)}
            title="Remove whitespace"
          >
            Minify
          </Button>
          <span className="debug-tool-spacer" />
          <Button
            className="debug-icon"
            disabled={!value}
            aria-label="Copy JSON"
            title="Copy JSON"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value);
                setFeedback("Copied to clipboard.");
              } catch {
                editor.current?.focus();
                editor.current?.select();
                setFailure(
                  "Copy unavailable. JSON selected; use your keyboard to copy.",
                );
              }
            }}
          >
            <Icon name="copy" size={15} />
          </Button>
          <Button
            className="debug-icon"
            disabled={!value}
            aria-label="Download JSON"
            title="Download JSON"
            onClick={() => void onDownload(value, filename)}
          >
            <Icon name="export" size={15} />
          </Button>
        </div>
        <Textarea
          ref={editor}
          className="json-editor"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          aria-label="Canvas or preset JSON"
          aria-invalid={!!validation.error && !checking}
          aria-describedby="debug-status"
          value={value}
          onChange={(event) => {
            fileRequest.current++;
            onChange(event.target.value);
          }}
          placeholder="Paste JSON or read from your canvas"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (valid) onApply(value);
            }
          }}
        />
        <div className="debug-code-meta">
          <span>{validation.lines.toLocaleString()} lines</span>
          <span>
            {(validation.bytes / 1024).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}{" "}
            KB
          </span>
        </div>
      </div>
      <div
        id="debug-status"
        className={`debug-status ${failure || (!checking && validation.error) ? "has-error" : ""}`}
        role="status"
      >
        {failure ||
          (checking
            ? "Checking JSON…"
            : validation.error ||
              feedback ||
              (valid ? "Valid JSON" : "Paste or open JSON to begin."))}
      </div>
      <Button
        className="primary debug-apply"
        disabled={!valid}
        onClick={() => onApply(value)}
      >
        Apply JSON
      </Button>
      <p className="debug-note">
        Applies to the current page. Presets are added to Templates; backups
        restore canvases.
      </p>
      <Input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const request = ++fileRequest.current;
          try {
            const json = await file.text();
            if (request === fileRequest.current) onChange(json);
          } catch (err) {
            if (request === fileRequest.current)
              setFailure(`Could not open file: ${String(err)}`);
          }
        }}
      />
    </section>
  );
}
