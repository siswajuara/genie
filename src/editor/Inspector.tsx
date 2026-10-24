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
import { Icon, type IconName } from "../components/ui/Icon";
import { slugify } from "./identifiers";
import { matchLibraryAsset } from "./assets";
import { AnimationInspector } from "./AnimationInspector";
import type { AnimationPlayback } from "./useAnimationPlayback";

export function openAssetBrowser() {
  window.dispatchEvent(new CustomEvent("genie:open-assets"));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="insp-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ToolButton({
  title,
  icon,
  onClick,
  active,
  danger,
  disabled,
}: {
  title: string;
  icon: IconName;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

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
        <span>ID</span>
        <input
          aria-label="Identifier"
          title="Searchable asset id, e.g. laptop-blue-front"
          placeholder="e.g. laptop-blue-front"
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
        {element.t === "img" && (
          <span
            className={`match-dot${match ? " is-match" : ""}`}
            title={match ? `Matches: ${match.name}` : "No library match"}
          />
        )}
      </div>
      {element.t === "img" && match && (
        <div className="asset-match">
          <img src={match.thumbnail} alt="" width={32} height={32} />
          <span>{match.name}</span>
          <ToolButton
            title={`Apply ${match.name}`}
            icon="check"
            onClick={() => void editor.setIdentifier(value, [element.id])}
          />
        </div>
      )}
    </div>
  );
}
const labels: Record<string, string> = {
  n: "Name",
  x: "X",
  y: "Y",
  w: "W",
  h: "H",
  rot: "Rotate",
  op: "Opacity",
  lw: "Stroke",
  r: "Radius",
  fill2: "Gradient",
  ls: "Spacing",
  lh: "Line ht",
  tsw: "Outline",
  tstroke: "Outline",
  sh: "Blur",
  shc: "Shadow",
  shx: "Sh X",
  shy: "Sh Y",
  curve: "Arc",
  bend: "Bend",
  dash: "Dotted",
  size: "Size",
  weight: "Weight",
  color: "Color",
  fill: "Fill",
  stroke: "Stroke",
  label: "Label",
  fit: "Fit",
  font: "Font",
  align: "Align",
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
  text: ["text", "font", "size", "color"],
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
const alignTools: { key: string; icon: IconName }[] = [
  { key: "Left", icon: "alignLeft" },
  { key: "Center", icon: "alignCenterH" },
  { key: "Right", icon: "alignRight" },
  { key: "Top", icon: "alignTop" },
  { key: "Middle", icon: "alignMiddle" },
  { key: "Bottom", icon: "alignBottom" },
];
export function Inspector({
  editor: e,
  playback,
}: {
  editor: Editor;
  playback: AnimationPlayback;
}) {
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
    if (key === "align") {
      return (
        <div className="property" key={key}>
          <span>{label}</span>
          <div className="segmented small" role="group" aria-label={label}>
            {options.align.map((a, i) => (
              <button
                key={a}
                type="button"
                title={a}
                aria-label={`Align ${a}`}
                aria-pressed={String(value) === a}
                className={String(value) === a ? "active" : ""}
                onClick={() => patch(a)}
              >
                <Icon
                  name={
                    (["alignLeft", "alignCenterH", "alignRight"] as IconName[])[
                      i
                    ]
                  }
                  size={14}
                />
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="property" key={key}>
        <span>{label}</span>
        {key === "text" ? (
          <textarea
            aria-label={label}
            ref={text}
            rows={3}
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
        {["Properties", "Animation", "Layers"].map((t) => (
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
        {tab === "Animation" ? (
          <AnimationInspector editor={e} playback={playback} />
        ) : tab === "Properties" ? (
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
              <Section title="Transform">
                <div className="geometry">
                  {(o.t === "frame"
                    ? ["x", "y", "w", "h", "op"]
                    : ["x", "y", "w", "h", "rot", "op"]
                  ).map(field)}
                </div>
              </Section>
              <Section title={o.t === "img" ? "Asset" : "Appearance"}>
                <IdentifierField key={o.id} element={o} editor={e} />
                {main[o.t].map(field)}
                {o.t === "text" && (
                  <div className="property">
                    <span>Word</span>
                    <div className="word-color-row">
                      <ColorField
                        label="Selected word color"
                        value={wordColor}
                        onChange={setWordColor}
                      />
                      <ToolButton
                        title="Apply color to selected words in Text"
                        icon="check"
                        onClick={() => {
                          const ta = text.current;
                          if (!ta || ta.selectionStart === ta.selectionEnd) {
                            e.notify("Select words in Text first.");
                            return;
                          }
                          e.patch({
                            text:
                              ta.value.slice(0, ta.selectionStart) +
                              `[c=${wordColor}]` +
                              ta.value.slice(
                                ta.selectionStart,
                                ta.selectionEnd,
                              ) +
                              "[/c]" +
                              ta.value.slice(ta.selectionEnd),
                          });
                        }}
                      />
                    </div>
                  </div>
                )}
              </Section>
              {o.t === "img" && (
                <Section title="Image">
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
                  {o.src && (
                    <div className="asset-preview">
                      <img src={o.src} alt="" />
                    </div>
                  )}
                  <div className="tool-row">
                    <button
                      type="button"
                      className="primary tool-text-btn"
                      title={o.src ? "Replace image (upload)" : "Upload image"}
                      onClick={() => file.current?.click()}
                    >
                      <Icon name="upload" size={14} />
                      <span>{o.src ? "Replace" : "Upload"}</span>
                    </button>
                    <ToolButton
                      title="Browse library assets"
                      icon="search"
                      onClick={openAssetBrowser}
                    />
                    {o.src && (
                      <ToolButton
                        title="Clear image"
                        icon="close"
                        onClick={() => e.patch({ src: undefined })}
                      />
                    )}
                  </div>
                </Section>
              )}
              {o.t !== "frame" && (
                <details className="insp-more">
                  <summary>Effects</summary>
                  {[...more[o.t], "sh", "shc", "shx", "shy"].map(field)}
                </details>
              )}
              <Section title="Arrange">
                {o.t !== "frame" && (
                  <div className="property">
                    <span>Frame</span>
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
                <div className="tool-row" role="group" aria-label="Align">
                  {alignTools.map((a) => (
                    <ToolButton
                      key={a.key}
                      title={`Align ${a.key}`}
                      icon={a.icon}
                      onClick={() => e.align(a.key)}
                    />
                  ))}
                </div>
                <div className="tool-row" role="group" aria-label="Order">
                  <ToolButton
                    title="Forward"
                    icon="forward"
                    onClick={() => e.order(1)}
                  />
                  <ToolButton
                    title="Back"
                    icon="backward"
                    onClick={() => e.order(-1)}
                  />
                  <ToolButton
                    title="Bring to front"
                    icon="front"
                    onClick={() => e.order(1, true)}
                  />
                  <ToolButton
                    title="Send to back"
                    icon="toBack"
                    onClick={() => e.order(-1, true)}
                  />
                  <span className="tool-sep" />
                  <ToolButton
                    title="Duplicate"
                    icon="copy"
                    onClick={e.duplicate}
                  />
                  <ToolButton
                    title="Group / ungroup"
                    icon="group"
                    onClick={() => e.group()}
                  />
                  <ToolButton
                    title={o.lock ? "Unlock" : "Lock"}
                    icon={o.lock ? "unlock" : "lock"}
                    active={!!o.lock}
                    onClick={() => e.patch({ lock: !o.lock })}
                  />
                  <ToolButton
                    title={o.hide ? "Show" : "Hide"}
                    icon={o.hide ? "hidden" : "view"}
                    active={!!o.hide}
                    onClick={() => e.patch({ hide: !o.hide })}
                  />
                  <ToolButton
                    title="Delete"
                    icon="delete"
                    danger
                    onClick={e.remove}
                  />
                </div>
              </Section>
            </>
          ) : (
            <div className="empty">
              <h2>Select an element</h2>
              <p>Click the canvas or a layer to edit.</p>
            </div>
          )
        ) : (
          <LayerTree editor={e} />
        )}
      </div>
    </aside>
  );
}
