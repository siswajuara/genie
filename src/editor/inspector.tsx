import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { defaultChromaKey, importVideoFile } from "./video";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "./use-editor";
import type { Element } from "./model";
import { uid } from "./model";
import { detectLatexSource } from "../../sidecar/science.mjs";
import { textToEquation } from "./science";
import { LayerTree } from "./layer-tree";
import { SelectField } from "../components/ui/select";
import { NumberField } from "../components/ui/number-field";
import { ColorField } from "../components/ui/color-field";
import { Toggle } from "../components/ui/toggle";
import { FontField } from "../components/ui/font-field";
import { Accordion } from "../components/ui/accordion";
import { Icon, type IconName } from "../components/ui/icon";
import { AnimationInspector } from "./animation-inspector";
import type { AnimationPlayback } from "./use-animation-playback";
import { AudioPanel } from "./audio-panel";
import { ScienceInspector } from "./science-inspector";

function openAssetBrowser() {
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
    <Button
      type="button"
      className={`tool-btn${active ? " is-active" : ""}${danger ? " is-danger" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} size={15} />
    </Button>
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
  lw: "Stroke",
  r: "Radius",
  fill2: "Gradient",
  ls: "Letter spacing",
  lh: "Line spacing (Auto)",
  tsw: "Outline width",
  tstroke: "Outline color",
  sh: "Shadow blur",
  shc: "Shadow color",
  shx: "Shadow X",
  shy: "Shadow Y",
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
  video: ["n", "label", "fit", "r"],
};
const more: Record<Element["t"], string[]> = {
  frame: [],
  rect: ["fill2"],
  ellipse: ["fill2"],
  line: ["bend", "dash"],
  text: ["weight", "curve", "ls", "lh", "tstroke", "tsw"],
  img: [],
  video: [],
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
    [wordColor, setWordColor] = useState("#f7c600"),
    [aspectLocked, setAspectLocked] = useState(true),
    [narrationTrackId, setNarrationTrackId] = useState<string>();
  const [inspectorWidth, setInspectorWidth] = useState(() => {
    const saved = Number(localStorage.getItem("genie:inspector-w"));
    return Number.isFinite(saved) && saved >= 260 && saved <= 440 ? saved : 300;
  });
  const text = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null);
  const o = e.active;
  const selectedFrame =
    o?.t === "frame" ? o : o?.fid ? e.scene.byId.get(o.fid) : undefined;
  const hasFrame =
    !!selectedFrame && (selectedFrame as { t?: string }).t === "frame";
  useEffect(() => {
    const show = (ev: Event) => {
      setNarrationTrackId(
        (ev as CustomEvent<{ trackId?: string }>).detail?.trackId,
      );
      setTab("Narration");
    };
    window.addEventListener("genie:show-narration", show);
    return () => window.removeEventListener("genie:show-narration", show);
  }, []);
  useEffect(() => {
    if (!hasFrame && tab === "Narration") setTab("Properties");
  }, [hasFrame, tab]);
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
      if (
        typeof v === "number" &&
        aspectLocked &&
        (key === "w" || key === "h")
      ) {
        const w = Number(o!.w) || 0,
          h = Number(o!.h) || 0;
        if (w > 0 && h > 0 && o!.t !== "line") {
          if (key === "w") e.patch({ w: v, h: Math.max(1, (v * h) / w) });
          else e.patch({ h: v, w: Math.max(1, (v * w) / h) });
          return;
        }
      }
      e.patch({ [key]: v });
    };
    const label = labels[key] || key;
    if (key === "align") {
      return (
        <div className="property" key={key}>
          <span>{label}</span>
          <div className="segmented small" role="group" aria-label={label}>
            {options.align.map((a, i) => (
              <Button
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
              </Button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="property" key={key}>
        <span>{label}</span>
        {key === "text" ? (
          <Textarea
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
          <Input
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
    <aside
      className="inspector"
      style={{ width: inspectorWidth }}
      aria-label="Inspector"
    >
      <div
        className="inspector-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        title="Drag to resize inspector"
        onPointerDown={(ev) => {
          const startX = ev.clientX,
            startW = inspectorWidth;
          const move = (moveEv: PointerEvent) => {
            const next = Math.min(
              440,
              Math.max(260, startW + (startX - moveEv.clientX)),
            );
            setInspectorWidth(next);
            localStorage.setItem("genie:inspector-w", String(next));
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
        }}
        onPointerUp={(ev) =>
          localStorage.setItem(
            "genie:inspector-w",
            String(
              (ev.currentTarget.parentElement as HTMLElement)?.offsetWidth ??
                inspectorWidth,
            ),
          )
        }
      />
      <div className="panel-tabs" role="tablist" aria-label="Inspector">
        {["Properties", "Narration", "Animation", "Layers"].map((t) => {
          const disabled = t === "Narration" && !hasFrame;
          return (
            <Button
              role="tab"
              aria-selected={tab === t}
              key={t}
              disabled={disabled}
              title={
                disabled
                  ? "Select a frame to edit narration"
                  : t === "Narration"
                    ? "Voiceover and captions for the selected frame"
                    : t
              }
              onClick={() => {
                setTab(t);
                if (t !== "Narration") setNarrationTrackId(undefined);
              }}
            >
              {t}
            </Button>
          );
        })}
      </div>
      <div className="panel-scroll">
        {tab === "Narration" ? (
          hasFrame ? (
            <AudioPanel
              editor={e}
              playback={playback}
              trackId={narrationTrackId}
              onClose={() => setTab("Properties")}
            />
          ) : (
            <div className="empty">
              <h2>Select a frame</h2>
              <p>Choose a frame on the canvas to add narration.</p>
            </div>
          )
        ) : tab === "Animation" ? (
          <AnimationInspector editor={e} playback={playback} />
        ) : tab === "Properties" ? (
          o ? (
            <>
              <div className="section-title">
                <h2>
                  {o.t === "frame"
                    ? "Frame"
                    : o.t === "video"
                      ? "Video"
                      : o.latex
                        ? "LaTeX equation"
                        : o.physics
                          ? "Physics diagram"
                          : o.learning
                            ? "Learning diagram"
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
              <Section title="">
                <div
                  className="geometry"
                  role="group"
                  aria-labelledby="pos-position"
                >
                  {["x", "y"].map(field)}
                </div>
                <div className="pos-label-row">
                  <p className="pos-label" id="pos-size">
                    Size Ratio
                  </p>
                  <Button
                    type="button"
                    className={`tool-btn aspect-lock-inline${aspectLocked ? " is-active" : ""}`}
                    title={
                      aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"
                    }
                    aria-label={
                      aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"
                    }
                    aria-pressed={aspectLocked}
                    onClick={() => setAspectLocked((v) => !v)}
                  >
                    <Icon name={aspectLocked ? "lock" : "unlock"} size={12} />
                  </Button>
                </div>
                <div
                  className="geometry"
                  role="group"
                  aria-labelledby="pos-size"
                >
                  {["w", "h"].map(field)}
                </div>
                <div
                  className="geometry mt-2"
                  role="group"
                  aria-labelledby="pos-transform"
                >
                  {(o.t === "frame" ? ["op"] : ["rot", "op"]).map(field)}
                </div>
              </Section>
              <Section
                title={
                  o.t === "text"
                    ? "Text"
                    : o.t === "frame"
                      ? "Frame"
                      : "Appearance"
                }
              >
                {main[o.t].filter((key) => key !== "label").map(field)}
                {o.t === "text" && (
                  <>
                    {detectLatexSource(o.text || "") && (
                      <div className="tool-row">
                        <Button
                          type="button"
                          className="primary tool-text-btn"
                          title="Convert math to a rendered equation. Select part of the text first to convert only that part into a new equation below; otherwise the whole box is converted."
                          onClick={() => {
                            const ta = text.current;
                            const full = o.text || "";
                            const hasSelection =
                              !!ta &&
                              ta.selectionStart !== ta.selectionEnd;
                            const raw = hasSelection
                              ? ta!.value.slice(
                                  ta!.selectionStart,
                                  ta!.selectionEnd,
                                )
                              : full;
                            const source = detectLatexSource(raw);
                            if (!source) {
                              e.notify(
                                "Select the math part first, or wrap it in $…$ delimiters.",
                              );
                              return;
                            }
                            if (hasSelection) {
                              const h = Math.max(
                                120,
                                Math.min(300, o.w * 0.3),
                              );
                              const base = {
                                ...o,
                                id: uid(),
                                n: "Equation",
                                w: o.w,
                                h,
                              };
                              void textToEquation(base, source)
                                .then((ready) =>
                                  e.add(ready, {
                                    x: o.x + o.w / 2,
                                    y: o.y + o.h + 24 + h / 2,
                                  }),
                                )
                                .catch((err) => e.notify(String(err)));
                              return;
                            }
                            void textToEquation(o, source)
                              .then((ready) =>
                                e.patch(
                                  {
                                    t: "img",
                                    text: "",
                                    latex: ready.latex,
                                    src: ready.src,
                                    color: ready.color,
                                    fit: "contain",
                                  },
                                  [o.id],
                                ),
                              )
                              .catch((err) => e.notify(String(err)));
                          }}
                        >
                          <span aria-hidden="true" className="style-aa">
                            fx
                          </span>
                          <span>Convert to equation</span>
                        </Button>
                      </div>
                    )}
                    <div
                      className="style-presets"
                      role="group"
                      aria-label="Text style presets"
                    >
                      {(
                        [
                          [
                            "Classic",
                            "Remove outline and shadow",
                            () => e.patch({ tsw: 0, sh: 0 }),
                          ],
                          [
                            "Outline",
                            "Bold outline, no shadow",
                            () =>
                              e.patch({
                                tstroke: o.tstroke ?? "#000000",
                                tsw: 3,
                                sh: 0,
                              }),
                          ],
                          [
                            "Shadow",
                            "Soft drop shadow",
                            () =>
                              e.patch({
                                tsw: 0,
                                sh: 8,
                                shc: o.shc ?? "#00000066",
                                shx: 2,
                                shy: 2,
                              }),
                          ],
                          [
                            "Highlight",
                            "Outline highlight",
                            () =>
                              e.patch({ tstroke: "#f7c600", tsw: 4, sh: 0 }),
                          ],
                        ] as const
                      ).map(([name, hint, apply]) => (
                        <Button
                          key={name}
                          type="button"
                          title={hint}
                          onClick={apply}
                        >
                          <span aria-hidden="true" className="style-aa">
                            Aa
                          </span>
                          <span>{name}</span>
                        </Button>
                      ))}
                    </div>
                    <div className="property">
                      <span>Highlight color</span>
                      <div className="word-color-row">
                        <ColorField
                          label="Highlight color for selected words"
                          value={wordColor}
                          onChange={setWordColor}
                        />
                        <ToolButton
                          title="Apply highlight color to selected words in Text"
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
                  </>
                )}
              </Section>
              {o.t === "video" && (
                <Section title="Green screen">
                  <Label className="property">
                    <span>Remove background</span>
                    <Checkbox
                      checked={o.chromaKey?.enabled ?? false}
                      onCheckedChange={(checked) =>
                        e.patch({
                          chromaKey: {
                            ...defaultChromaKey,
                            ...o.chromaKey,
                            enabled: checked === true,
                          },
                        })
                      }
                    />
                  </Label>
                  {o.chromaKey?.enabled && (
                    <>
                      <div className="property">
                        <span>Key color</span>
                        <ColorField
                          label="Key color"
                          value={o.chromaKey.color}
                          onChange={(color) =>
                            e.patch({
                              chromaKey: {
                                ...o.chromaKey!,
                                color: color.slice(0, 7),
                              },
                            })
                          }
                        />
                      </div>
                      {(
                        [
                          ["tolerance", "Tolerance"],
                          ["softness", "Edge softness"],
                          ["spill", "Spill removal"],
                        ] as const
                      ).map(([key, label]) => (
                        <div className="property" key={key}>
                          <span>{label}</span>
                          <NumberField
                            label={label}
                            value={Math.round(o.chromaKey![key] * 100)}
                            min={0}
                            max={100}
                            onChange={(value) =>
                              e.patch({
                                chromaKey: {
                                  ...o.chromaKey!,
                                  [key]:
                                    Math.max(0, Math.min(100, value)) / 100,
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </>
                  )}
                  <div className="property">
                    <span>Start (seconds)</span>
                    <NumberField
                      label="Video start"
                      value={o.videoStart ?? 0}
                      min={0}
                      max={100000}
                      onChange={(videoStart) => e.patch({ videoStart })}
                    />
                  </div>
                  <Label className="property">
                    <span>Loop video</span>
                    <Checkbox
                      checked={o.videoLoop ?? false}
                      onCheckedChange={(checked) =>
                        e.patch({ videoLoop: checked === true })
                      }
                    />
                  </Label>
                  <p className="muted">
                    Preview with the timeline. Video exports are silent.
                  </p>
                  <Input
                    hidden
                    type="file"
                    ref={file}
                    accept="video/*,.mp4,.webm,.mov,.m4v"
                    onChange={(ev) => {
                      const f = ev.target.files?.[0],
                        id = o.id;
                      if (f)
                        void importVideoFile(f)
                          .then((video) =>
                            e.patch({ src: video.src, label: f.name }, [id]),
                          )
                          .catch((err) => e.notify(String(err)));
                      ev.target.value = "";
                    }}
                  />
                  <Button onClick={() => file.current?.click()}>
                    Replace video
                  </Button>
                </Section>
              )}
              {(o.latex || o.physics || o.learning) && (
                <ScienceInspector key={o.id} element={o} editor={e} />
              )}
              {o.t === "img" && !o.latex && !o.physics && !o.learning && (
                <Section title="Image">
                  <Input
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
                    <Button
                      type="button"
                      className="primary tool-text-btn"
                      title={o.src ? "Replace image (upload)" : "Upload image"}
                      onClick={() => file.current?.click()}
                    >
                      <Icon name="upload" size={14} />
                      <span>{o.src ? "Replace" : "Upload"}</span>
                    </Button>
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
              {o.t === "text" ? (
                <Accordion
                  className="insp-more"
                  title="Text style"
                  triggerTitle="Text style: weight, spacing, outline and shadow"
                >
                  {["weight", "curve", "ls", "lh"].map(field)}
                  <Toggle
                    label="Outline"
                    description="Show outline color and width"
                    checked={(o.tsw ?? 0) > 0}
                    onChange={(on) =>
                      e.patch(
                        on
                          ? { tstroke: o.tstroke ?? "#000000", tsw: 2 }
                          : { tsw: 0 },
                      )
                    }
                  />
                  {(o.tsw ?? 0) > 0 && (
                    <>
                      {field("tstroke")}
                      {field("tsw")}
                    </>
                  )}
                  <Toggle
                    label="Shadow"
                    description="Show shadow color, blur and offset"
                    checked={(o.sh ?? 0) > 0}
                    onChange={(on) =>
                      e.patch(
                        on
                          ? {
                              sh: 8,
                              shc: o.shc ?? "#00000066",
                              shx: o.shx ?? 2,
                              shy: o.shy ?? 2,
                            }
                          : { sh: 0 },
                      )
                    }
                  />
                  {(o.sh ?? 0) > 0 && (
                    <>
                      {field("shc")}
                      {field("sh")}
                      {field("shx")}
                      {field("shy")}
                    </>
                  )}
                </Accordion>
              ) : (
                o.t !== "frame" && (
                  <Accordion
                    className="insp-more"
                    title="Outline & Shadow"
                    triggerTitle="Outline and shadow settings"
                  >
                    {more[o.t].map(field)}
                    <Toggle
                      label="Shadow"
                      description="Show shadow color, blur and offset"
                      checked={(o.sh ?? 0) > 0}
                      onChange={(on) =>
                        e.patch(
                          on
                            ? {
                                sh: 8,
                                shc: o.shc ?? "#00000066",
                                shx: o.shx ?? 2,
                                shy: o.shy ?? 2,
                              }
                            : { sh: 0 },
                        )
                      }
                    />
                    {(o.sh ?? 0) > 0 && (
                      <>
                        {field("shc")}
                        {field("sh")}
                        {field("shx")}
                        {field("shy")}
                      </>
                    )}
                  </Accordion>
                )
              )}
              <Section title="">
                <p className="arrange-label" id="arrange-align">
                  Align
                </p>
                <div
                  className="tool-row arrange-grid"
                  role="group"
                  aria-labelledby="arrange-align"
                >
                  {alignTools.map((a) => (
                    <ToolButton
                      key={a.key}
                      title={`Align ${a.key}`}
                      icon={a.icon}
                      onClick={() => e.align(a.key)}
                    />
                  ))}
                </div>
                <p className="arrange-label" id="arrange-order">
                  Order
                </p>
                <div
                  className="tool-row arrange-grid"
                  role="group"
                  aria-labelledby="arrange-order"
                >
                  <ToolButton
                    title="Forward: move layer up one step"
                    icon="forward"
                    onClick={() => e.order(1)}
                  />
                  <ToolButton
                    title="Back: move layer down one step"
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
                </div>
                <p className="arrange-label" id="arrange-actions">
                  Actions
                </p>
                <div
                  className="tool-row arrange-grid"
                  role="group"
                  aria-labelledby="arrange-actions"
                >
                  <ToolButton
                    title="Duplicate layer"
                    icon="copy"
                    onClick={e.duplicate}
                  />
                  <ToolButton
                    title="Group / ungroup selection"
                    icon="group"
                    onClick={() => e.group()}
                  />
                  <ToolButton
                    title={o.lock ? "Unlock layer" : "Lock layer"}
                    icon={o.lock ? "unlock" : "lock"}
                    active={!!o.lock}
                    onClick={() => e.patch({ lock: !o.lock })}
                  />
                  <ToolButton
                    title={o.hide ? "Show layer" : "Hide layer"}
                    icon={o.hide ? "hidden" : "view"}
                    active={!!o.hide}
                    onClick={() => e.patch({ hide: !o.hide })}
                  />
                  <ToolButton
                    title="Delete layer"
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
