import { useEffect, useRef, useState } from "react";
import type { Editor } from "./useEditor";
import type { Element } from "./model";
import { LayerTree } from "./LayerTree";
import {
  SelectField,
  NumberField,
  ColorField,
} from "../components/ui/Controls";
import { FontField } from "../components/ui/FontField";
import { slugify } from "./identifiers";
import { matchLibraryAsset } from "./assets";

function IdentifierField({
  element,
  editor,
}: {
  element: Element;
  editor: Editor;
}) {
  const value = element.identifier || slugify(element.n),
    [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value, element.id]);
  const match = element.t === "img" ? matchLibraryAsset(value) : undefined;
  function commit() {
    const next = slugify(draft);
    setDraft(next || value);
    if (next && next !== value) void editor.setIdentifier(next, [element.id]);
  }
  return (
    <div className="identifier-field">
      <div className="property">
        <span>Identifier</span>
        <input
          aria-label="Identifier"
          value={draft}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(ev) => setDraft(ev.target.value)}
          onBlur={commit}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              ev.currentTarget.blur();
            }
          }}
        />
      </div>
      {element.t === "img" && (
        <>
          <p className="hint">
            Searchable name, color, then facing. Example:
            laptop-computer-blue-front.
          </p>
          <p className="hint" role="status">
            {match
              ? `Matching asset: ${match.name}`
              : "No matching library asset. You can still choose an image from Assets or upload one."}
          </p>
          {match && (
            <button
              onClick={() => void editor.setIdentifier(value, [element.id])}
            >
              Use matching asset
            </button>
          )}
        </>
      )}
    </div>
  );
}
const labels: Record<string, string> = {
  n: "Name",
  x: "X",
  y: "Y",
  w: "Width",
  h: "Height",
  rot: "Rotation",
  op: "Opacity",
  lw: "Stroke width",
  r: "Radius",
  fill2: "Gradient end",
  ls: "Letter spacing",
  lh: "Line height",
  tsw: "Outline width",
  tstroke: "Outline color",
  sh: "Shadow blur",
  shc: "Shadow color",
  shx: "Shadow X",
  shy: "Shadow Y",
  curve: "Text arc",
  bend: "Curve bend",
  dash: "Dotted",
  size: "Font size",
  weight: "Font weight",
  color: "Text color",
  fill: "Fill",
  stroke: "Stroke",
  label: "Image label",
  fit: "Image fit",
  font: "Font",
  align: "Text alignment",
  text: "Text",
};
const colors = ["fill", "fill2", "stroke", "color", "tstroke", "shc"];
const options: Record<string, string[]> = {
  align: ["left", "center", "right"],
  fit: ["contain", "cover"],
};
const main: Record<Element["t"], string[]> = {
  frame: ["n", "fill"],
  rect: ["n", "fill", "stroke", "lw", "r"],
  ellipse: ["n", "fill", "stroke", "lw"],
  line: ["n", "stroke", "lw"],
  text: ["text", "font", "size", "color", "align"],
  img: ["n", "label", "fit", "r"],
};
const more: Record<Element["t"], string[]> = {
  frame: [],
  rect: ["fill2"],
  ellipse: ["fill2"],
  line: ["bend", "dash"],
  text: ["weight", "curve", "ls", "lh", "tstroke", "tsw"],
  img: [],
};
export function Inspector({ editor: e }: { editor: Editor }) {
  const [tab, setTab] = useState("Properties"),
    [wordColor, setWordColor] = useState("#f7c600");
  const text = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null);
  const o = e.active;
  function field(key: string) {
    const value =
      (o as unknown as Record<string, unknown>)[key] ??
      (key === "op"
        ? 1
        : colors.includes(key)
          ? "#000000"
          : options[key]?.[0] ||
            (["n", "label", "text"].includes(key) ? "" : 0));
    const patch = (v: string | number) => {
      if (
        typeof v === "number" &&
        (!Number.isFinite(v) ||
          (["w", "h", "size"].includes(key) && v < 1 && o!.t !== "line") ||
          (["r", "lw", "sh", "tsw"].includes(key) && v < 0) ||
          (key === "op" && (v < 0 || v > 1)))
      )
        return;
      e.patch({ [key]: v });
    };
    const label = labels[key] || key;
    return (
      <div className="property" key={key}>
        <span>{label}</span>
        {key === "text" ? (
          <textarea
            aria-label={label}
            ref={text}
            rows={4}
            value={String(value)}
            onChange={(ev) => patch(ev.target.value)}
          />
        ) : key === "font" ? (
          <FontField
            key={o!.id}
            value={o!.font || "Nunito"}
            weight={o!.weight || 800}
            onChange={patch}
            onError={e.notify}
          />
        ) : options[key] ? (
          <SelectField
            label={label}
            value={String(value)}
            onChange={patch}
            options={options[key].map((s) => ({ value: s, label: s }))}
          />
        ) : colors.includes(key) ? (
          <ColorField label={label} value={String(value)} onChange={patch} />
        ) : ["n", "label"].includes(key) ? (
          <input
            aria-label={label}
            value={String(value)}
            onChange={(ev) => patch(ev.target.value)}
          />
        ) : (
          <NumberField
            label={label}
            value={Number(value)}
            onChange={patch}
            step={key === "op" || key === "lh" ? 0.1 : 1}
            min={
              key === "op" || ["r", "lw", "sh", "tsw"].includes(key)
                ? 0
                : ["w", "h", "size"].includes(key) && o!.t !== "line"
                  ? 1
                  : undefined
            }
            max={key === "op" ? 1 : undefined}
          />
        )}
      </div>
    );
  }
  return (
    <aside className="inspector">
      <div className="panel-tabs" role="tablist" aria-label="Inspector">
        {["Properties", "Layers"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="panel-scroll">
        {tab === "Properties" ? (
          o ? (
            <>
              <div className="section-title">
                <h2>
                  {o.t === "frame"
                    ? "Frame"
                    : o.t === "img"
                      ? "Image"
                      : o.t === "text"
                        ? "Text"
                        : "Shape"}
                </h2>
                <span>
                  {e.selected.length > 1
                    ? `${e.selected.length} selected`
                    : o.t}
                </span>
              </div>
              <div className="geometry">
                {(o.t === "frame"
                  ? ["x", "y", "w", "h", "op"]
                  : ["x", "y", "w", "h", "rot", "op"]
                ).map(field)}
              </div>
              <h3>Appearance</h3>
              <IdentifierField key={o.id} element={o} editor={e} />
              {main[o.t].map(field)}
              {o.t === "text" && (
                <>
                  <div className="row">
                    <ColorField
                      label="Selected word color"
                      value={wordColor}
                      onChange={setWordColor}
                    />
                    <button
                      onClick={() => {
                        const ta = text.current;
                        if (!ta || ta.selectionStart === ta.selectionEnd) {
                          e.notify("Select words in the Text field first.");
                          return;
                        }
                        e.patch({
                          text:
                            ta.value.slice(0, ta.selectionStart) +
                            `[c=${wordColor}]` +
                            ta.value.slice(ta.selectionStart, ta.selectionEnd) +
                            "[/c]" +
                            ta.value.slice(ta.selectionEnd),
                        });
                      }}
                    >
                      Color selection
                    </button>
                  </div>
                </>
              )}
              {o.t === "img" && (
                <>
                  <input
                    hidden
                    type="file"
                    ref={file}
                    accept="image/*"
                    onChange={(ev) => {
                      const f = ev.target.files?.[0];
                      if (!f) return;
                      const reader = new FileReader();
                      const id = o.id;
                      reader.onload = () =>
                        e.patch({ src: String(reader.result), label: f.name }, [
                          id,
                        ]);
                      reader.onerror = () =>
                        e.notify("Image could not be read.");
                      reader.readAsDataURL(f);
                      ev.target.value = "";
                    }}
                  />
                  <div className="row">
                    <button
                      className="primary"
                      onClick={() => file.current?.click()}
                    >
                      {o.src ? "Replace image" : "Upload image"}
                    </button>
                    {o.src && (
                      <button onClick={() => e.patch({ src: undefined })}>
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}
              {o.t !== "frame" && (
                <details>
                  <summary>More properties</summary>
                  {[...more[o.t], "sh", "shc", "shx", "shy"].map(field)}
                </details>
              )}
              <h3>Arrange</h3>
              {o.t !== "frame" && (
                <div className="property">
                  <span>Parent frame</span>
                  <SelectField
                    label="Parent frame"
                    value={o.fid || ""}
                    onChange={e.moveToFrame}
                    options={[
                      { value: "", label: "Canvas" },
                      ...e.scene.frames.map((f) => ({
                        value: f.id,
                        label: f.n,
                      })),
                    ]}
                  />
                </div>
              )}
              <div className="align-grid">
                {["Left", "Center", "Right", "Top", "Middle", "Bottom"].map(
                  (k) => (
                    <button key={k} onClick={() => e.align(k)}>
                      {k}
                    </button>
                  ),
                )}
              </div>
              <div className="row section-actions">
                <button onClick={() => e.order(1)}>Forward</button>
                <button onClick={() => e.order(-1)}>Back</button>
                <button onClick={() => e.order(1, true)}>Bring to front</button>
                <button onClick={() => e.order(-1, true)}>Send to back</button>
                <button onClick={e.duplicate}>Duplicate</button>
                <button onClick={() => e.group()}>Group / ungroup</button>
                <button onClick={() => e.patch({ lock: !o.lock })}>
                  {o.lock ? "Unlock" : "Lock"}
                </button>
                <button onClick={() => e.patch({ hide: !o.hide })}>
                  {o.hide ? "Show" : "Hide"}
                </button>
                <button className="danger" onClick={e.remove}>
                  Delete
                </button>
              </div>
              <p className="hint element-id">{o.id}</p>
            </>
          ) : (
            <div className="empty">
              <h2>Select an element</h2>
              <p>
                Click the canvas or choose a layer to edit text, images, and
                appearance.
              </p>
            </div>
          )
        ) : (
          <LayerTree editor={e} />
        )}
      </div>
    </aside>
  );
}
