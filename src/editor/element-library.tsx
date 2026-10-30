import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "../components/ui/select";
import { Icon } from "../components/ui/icon";
import { makeElement, type Element } from "./model";
import {
  normalizeLatex,
  normalizePhysics,
  physicsModels,
} from "../../sidecar/science.mjs";
import { normalizeLearning, learningModels } from "../../sidecar/learning.mjs";
import { LATEX_DEFAULT_SOURCE, LATEX_PRESETS } from "./latex-presets";
import { physicsSvg } from "./physics-drawing.mjs";
import { learningSvg } from "./learning-drawing.mjs";
import { illustration3DModels, normalizeIllustration3D, illustration3DSvg, illustration3DThumbnail } from "./illustration3d.mjs";

export type ElementLibraryItem = {
  key: string;
  label: string;
  group: string;
  keywords: string;
  kind: string;
  physicsKind?: string;
  learningKind?: string;
  illustrationScene?: string;
  latexSource?: string;
  previewText?: string;
  previewSrc?: string;
};

const BASIC_GROUPS: Record<string, string[]> = {
  Text: ["Text", "Heading", "Paragraph", "Curved text"],
  Shapes: ["Box", "Rounded box", "Circle", "Line", "Curve"],
  Drawing: ["Pen", "Pencil", "Brush"],
  Media: ["Image slot", "Video"],
};

export function elementLibraryItems(): ElementLibraryItem[] {
  return Object.entries(BASIC_GROUPS).flatMap(([group, kinds]) =>
    kinds.map((kind) => ({
      key: `element-${kind}`,
      label: kind,
      group,
      keywords: `${kind} ${group} element`.toLowerCase(),
      kind,
    })),
  );
}

export function equationLibraryItems(): ElementLibraryItem[] {
  const items: ElementLibraryItem[] = [
    {
      key: "equation-latex",
      label: "LaTeX equation",
      group: "LaTeX",
      keywords: "latex equation custom math formula fraction",
      kind: "LaTeX equation",
      latexSource: LATEX_DEFAULT_SOURCE,
      previewText: "½+¼=¾",
    },
    ...LATEX_PRESETS.map((preset) => ({
      key: `equation-latex-${preset.key}`,
      label: preset.label,
      group: "LaTeX",
      keywords:
        `latex ${preset.topic} ${preset.label} ${preset.keywords}`.toLowerCase(),
      kind: "LaTeX equation",
      latexSource: preset.source,
      previewText: preset.preview,
    })),
    {
      key: "equation-physics-default",
      label: "Physics diagram",
      group: "Physics",
      keywords: "physics diagram simulation default",
      kind: "Physics diagram",
      physicsKind: "pendulum",
      previewSrc: physicsSvg({ kind: "pendulum" } as never, "#0757ec"),
    },
  ];
  for (const [kind, model] of Object.entries(physicsModels)) {
    if (kind === "pendulum") continue;
    items.push({
      key: `equation-physics-${kind}`,
      label: (model as { label: string }).label,
      group: "Physics",
      keywords: `physics ${(model as { label: string }).label} ${kind}`.toLowerCase(),
      kind: "Physics diagram",
      physicsKind: kind,
      previewSrc: physicsSvg({ kind } as never, "#0757ec"),
    });
  }
  items.push({
    key: "equation-learning-default",
    label: "Learning diagram",
    group: "Learning",
    keywords: "learning diagram teaching default",
    kind: "Learning diagram",
    learningKind: "cube",
    previewSrc: learningSvg({ kind: "cube" } as never, "#0757ec"),
  });
  for (const [kind, model] of Object.entries(learningModels)) {
    if (kind === "cube") continue;
    items.push({
      key: `equation-learning-${kind}`,
      label: (model as { label: string }).label,
      group: "Learning",
      keywords: `learning ${(model as { label: string }).label} ${kind}`.toLowerCase(),
      kind: "Learning diagram",
      learningKind: kind,
      previewSrc: learningSvg({ kind } as never, "#0757ec"),
    });
  }
  items.splice(1, 0, ...Object.entries(illustration3DModels).map(([scene, model]) => ({
    key: `equation-3d-${scene}`,
    label: `${model.label} · 3D`,
    group: `3D · ${model.group}`,
    keywords: model.keywords,
    kind: "3D illustration",
    illustrationScene: scene,
    previewSrc: illustration3DThumbnail({ scene }),
  })));
  return items;
}

export function elementDragValue(item: ElementLibraryItem): string {
  if (item.illustrationScene) return `${item.kind}::illustration3d=${item.illustrationScene}`;
  if (item.latexSource !== undefined)
    return `${item.kind}::latex=${encodeURIComponent(item.latexSource)}`;
  if (item.physicsKind) return `${item.kind}::physics=${item.physicsKind}`;
  if (item.learningKind) return `${item.kind}::learning=${item.learningKind}`;
  return item.kind;
}

export function makeElementFromDragValue(value: string): Element {
  const [kind, modifier] = value.split("::");
  const element = makeElement(kind || value);
  if (modifier?.startsWith("illustration3d=")) {
    const scene = modifier.slice("illustration3d=".length);
    const illustration3d = normalizeIllustration3D({ scene });
    const label = illustration3DModels[scene].label;
    return {
      ...element, t: "img", n: `${label} · 3D`, identifier: `illustration-3d-${scene}`,
      illustration3d, src: illustration3DSvg(illustration3d),
    };
  }
  if (modifier?.startsWith("latex=")) {
    try {
      const latex = normalizeLatex({
        source: decodeURIComponent(modifier.slice("latex=".length)),
      });
      const tall = latex.source.includes("\\\\");
      return {
        ...element,
        t: "img",
        latex,
        physics: undefined,
        learning: undefined,
        w: 800,
        h: tall ? 360 : 240,
      };
    } catch {
      return element;
    }
  }
  if (modifier?.startsWith("physics=")) {
    const physicsKind = modifier.slice("physics=".length);
    try {
      const physics = normalizePhysics({ kind: physicsKind } as never);
      return { ...element, t: "img", physics, learning: undefined, latex: undefined };
    } catch {
      return element;
    }
  }
  if (modifier?.startsWith("learning=")) {
    const learningKind = modifier.slice("learning=".length);
    try {
      const learning = normalizeLearning({ kind: learningKind } as never);
      return { ...element, t: "img", learning, physics: undefined, latex: undefined };
    } catch {
      return element;
    }
  }
  return element;
}

export function buildElementForItem(item: ElementLibraryItem): Element {
  return makeElementFromDragValue(elementDragValue(item));
}

const latexPreviewCache = new Map<string, string>();

function LatexPreview({ source, fallback }: { source: string; fallback: string }) {
  const [src, setSrc] = useState<string | undefined>(() =>
    latexPreviewCache.get(source),
  );
  useEffect(() => {
    let live = true;
    const cached = latexPreviewCache.get(source);
    if (cached) {
      setSrc(cached);
      return;
    }
    setSrc(undefined);
    void import("./latex-renderer.mjs")
      .then(({ renderLatex }) => renderLatex({ source }, "#2b3a8f"))
      .then((rendered) => {
        latexPreviewCache.set(source, rendered.src);
        if (live) setSrc(rendered.src);
      })
      .catch(() => {
        if (live) setSrc(undefined);
      });
    return () => {
      live = false;
    };
  }, [source]);
  if (!src) {
    return (
      <span
        style={{
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          fontWeight: 700,
          fontSize: fallback.length > 12 ? 14 : 18,
          color: "#2b3a8f",
          textAlign: "center",
          lineHeight: 1.25,
          padding: "0 8px",
        }}
      >
        {fallback}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

function ElementPreview({ item }: { item: ElementLibraryItem }) {
  if (item.previewSrc) {
    return (
      <img src={item.previewSrc} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    );
  }
  const ink = "#2b3a8f";
  switch (item.kind) {
    case "Text":
      return <span style={{ fontWeight: 800, fontSize: 26, color: ink }}>T</span>;
    case "Heading":
      return <span style={{ fontWeight: 800, fontSize: 24, color: ink }}>H1</span>;
    case "Paragraph":
      return (
        <span style={{ display: "grid", gap: 4, width: 56 }}>
          {[22, 34, 26].map((w, i) => (
            <span key={i} style={{ height: 6, width: w, borderRadius: 3, background: ink, opacity: 0.75 }} />
          ))}
        </span>
      );
    case "Curved text":
      return <Icon name="arc" size={30} />;
    case "Box":
      return <span style={{ width: 36, height: 36, border: `2.5px solid ${ink}`, borderRadius: 4 }} />;
    case "Rounded box":
      return <span style={{ width: 52, height: 30, border: `2.5px solid ${ink}`, borderRadius: 10 }} />;
    case "Circle":
      return <span style={{ width: 36, height: 36, border: `2.5px solid ${ink}`, borderRadius: "50%" }} />;
    case "Line":
      return (
        <svg width="52" height="28" viewBox="0 0 52 28" aria-hidden="true">
          <line x1="8" y1="22" x2="44" y2="6" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "Curve":
      return (
        <svg width="52" height="28" viewBox="0 0 52 28" aria-hidden="true">
          <path d="M8 22 Q26 22 30 12 T44 6" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "Pen":
      return (
        <svg width="56" height="24" viewBox="0 0 56 24" aria-hidden="true">
          <path d="M6 18 Q28 18 50 8" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "Pencil":
      return (
        <svg width="56" height="24" viewBox="0 0 56 24" aria-hidden="true">
          <path d="M6 18 Q28 18 50 8" fill="none" stroke={ink} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        </svg>
      );
    case "Brush":
      return (
        <svg width="56" height="28" viewBox="0 0 56 28" aria-hidden="true">
          <path d="M6 20 Q28 20 50 8" fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round" />
        </svg>
      );
    case "Image slot":
      return <Icon name="image" size={30} />;
    case "Video":
      return <Icon name="video" size={30} />;
    case "LaTeX equation":
      if (item.latexSource)
        return (
          <LatexPreview source={item.latexSource} fallback={item.previewText || "a⁄b = √c"} />
        );
      return (
        <span
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontWeight: 700,
            fontSize: item.previewText && item.previewText.length > 12 ? 14 : 18,
            color: ink,
            textAlign: "center",
            lineHeight: 1.25,
            padding: "0 8px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.previewText || "a⁄b = √c"}
        </span>
      );
    default:
      return <Icon name="box" size={30} />;
  }
}

export function ElementLibrary({
  items,
  onSelect,
  searchPlaceholder = "Search elements",
  searchLabel = "Search elements",
}: {
  items: ElementLibraryItem[];
  onSelect: (item: ElementLibraryItem) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const groups = useMemo(() => [...new Set(items.map((item) => item.group))], [items]);
  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "All" || item.group === category) &&
          (!query || query.split(/\s+/).every((word) => item.keywords.includes(word))),
      ),
    [items, category, query],
  );
  const grouped = useMemo(
    () =>
      groups
        .map((group) => ({ group, items: filtered.filter((item) => item.group === group) }))
        .filter((entry) => entry.items.length > 0),
    [groups, filtered],
  );
  const showGroups = category === "All" && !query;
  function card(item: ElementLibraryItem) {
    return (
      <article className="asset-card" key={item.key}>
        <Button
          type="button"
          className="asset-use"
          draggable
          title={item.label}
          aria-label={item.label}
          onClick={() => onSelect(item)}
          onDragStart={(event) => {
            event.dataTransfer.setData("genie/element", elementDragValue(item));
            event.dataTransfer.effectAllowed = "copy";
          }}
        >
          <span className="asset-thumbnail">
            <ElementPreview item={item} />
          </span>
          <span className="asset-name">{item.label}</span>
        </Button>
      </article>
    );
  }
  return (
    <section className="element-library" aria-label="Element library">
      <div className="asset-browser-head">
        <Label className="asset-search">
          <Icon name="search" size={16} />
          <Input
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <Button type="button" aria-label="Clear element search" onClick={() => setSearch("")}>
              <Icon name="close" size={13} />
            </Button>
          )}
        </Label>
        <SelectField
          label="Element group"
          value={category}
          onChange={setCategory}
          options={[
            { value: "All", label: `All (${items.length})` },
            ...groups.map((group) => ({
              value: group,
              label: `${group} (${items.filter((item) => item.group === group).length})`,
            })),
          ]}
        />
      </div>
      <div className="asset-scroll">
        {filtered.length ? (
          showGroups ? (
            grouped.map(({ group, items: groupItems }) => (
              <div key={group}>
                <h3 className="element-group-title">
                  {group} <small>{groupItems.length}</small>
                </h3>
                <div className="element-library-grid">{groupItems.map(card)}</div>
              </div>
            ))
          ) : (
            <div className="element-library-grid">{filtered.map(card)}</div>
          )
        ) : (
          <div className="assets-empty">
            <Icon name="search" size={24} />
            <strong>No matching elements</strong>
            <p>Try another name or group.</p>
            <Button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
