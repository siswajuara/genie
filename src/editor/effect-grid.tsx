import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { effectLabel } from "./animation";
import { Icon } from "../components/ui/icon";

export type GridKind = "effect" | "motion" | "text" | "transition";

type Category = {
  id: string;
  label: string;
  test: (preset: string) => boolean;
};

const effectCategories: Category[] = [
  {
    id: "basic",
    label: "Basic",
    test: (p) => ["none", "fade", "pop", "rise", "drop"].includes(p),
  },
  {
    id: "slide",
    label: "Slide",
    test: (p) => p.startsWith("slide-") || p.startsWith("reveal-"),
  },
  {
    id: "zoom",
    label: "Zoom",
    test: (p) => p.startsWith("zoom") || p === "flip",
  },
  {
    id: "playful",
    label: "Playful",
    test: (p) =>
      ["bounce", "elastic", "spin", "swing", "rotate-in"].includes(p),
  },
];

const motionCategories: Category[] = [
  {
    id: "drift",
    label: "Drift",
    test: (p) =>
      [
        "float",
        "sway",
        "orbit",
        "breathe",
        "pan-left",
        "pan-right",
        "pan-up",
        "pan-down",
      ].includes(p),
  },
  {
    id: "zoom",
    label: "Zoom",
    test: (p) =>
      ["zoom-in", "zoom-out", "dolly-in", "dolly-out", "pulse"].includes(p),
  },
  {
    id: "spin",
    label: "Spin",
    test: (p) =>
      ["rock", "rotate-clockwise", "rotate-counterclockwise"].includes(p),
  },
];

const transitionCategories: Category[] = [
  {
    id: "fade",
    label: "Fade",
    test: (p) =>
      ["cut", "crossfade", "fade-through-black", "fade-through-white"].includes(
        p,
      ),
  },
  {
    id: "slide",
    label: "Slide",
    test: (p) => p.startsWith("slide-") || p.startsWith("push-"),
  },
  {
    id: "wipe",
    label: "Wipe",
    test: (p) => p === "wipe" || p.startsWith("wipe-") || p === "blinds",
  },
  {
    id: "zoom",
    label: "Zoom",
    test: (p) =>
      p.startsWith("zoom") ||
      p.startsWith("circle-") ||
      p === "diamond" ||
      p === "spin",
  },
];

function categoriesFor(kind: GridKind, count: number): Category[] | undefined {
  if (count <= 15) return undefined;
  if (kind === "effect") return effectCategories;
  if (kind === "motion") return motionCategories;
  if (kind === "transition") return transitionCategories;
  return undefined;
}

// Distinctive mini-glyph per preset so tiles don't all look identical.
function glyphFor(preset: string): string | undefined {
  if (preset === "none") return undefined;
  if (preset === "cut") return "✂";
  const arrows: Record<string, string> = {
    "pan-left": "←",
    "pan-right": "→",
    "pan-up": "↑",
    "pan-down": "↓",
    "slide-left": "←",
    "slide-right": "→",
    "slide-up": "↑",
    "slide-down": "↓",
    "push-left": "←",
    "push-right": "→",
    "push-up": "↑",
    "push-down": "↓",
    "reveal-left": "←",
    "reveal-right": "→",
    "reveal-up": "↑",
    "reveal-down": "↓",
    sway: "↔",
    float: "〜",
    orbit: "⟳",
    rock: "⟲",
    "rotate-clockwise": "↻",
    "rotate-counterclockwise": "↺",
    spin: "↻",
    "rotate-in": "↻",
    "zoom-in": "+",
    "zoom-out": "−",
    zoom: "+",
    "zoom-3d": "⬔",
    "dolly-in": "⤢",
    "dolly-out": "⤡",
    pulse: "◉",
    breathe: "○",
    flip: "⇄",
    pop: "✦",
    bounce: "⤒",
    elastic: "∿",
    rise: "⤴",
    drop: "⤵",
    swing: "➰",
    fade: "◐",
    crossfade: "◐",
    "fade-through-black": "◑",
    "fade-through-white": "◐",
    wipe: "▥",
    "wipe-right": "→",
    "wipe-up": "↑",
    "wipe-down": "↓",
    "circle-in": "●",
    "circle-out": "○",
    diamond: "◆",
    blinds: "☰",
  };
  return arrows[preset];
}

export function EffectGrid({
  options,
  value,
  onSelect,
  kind,
  reduced,
}: {
  options: readonly string[];
  value: string;
  onSelect: (preset: string) => void;
  kind: GridKind;
  reduced?: boolean;
}) {
  const categories = categoriesFor(kind, options.length);
  const [category, setCategory] = useState("all");
  const visible = useMemo(() => {
    if (!categories || category === "all") return options;
    const active = categories.find((c) => c.id === category);
    if (!active) return options;
    // Always keep "none" visible as the first tile.
    return options.filter((p) => p === "none" || active.test(p));
  }, [options, categories, category]);
  const activeCount = categories
    ? visible.filter((p) => p !== "none").length
    : visible.length;
  return (
    <div className="fx-picker" data-reduced={reduced ? "true" : undefined}>
      {categories && (
        <div className="fx-filter-row">
          <ScrollArea orientation="horizontal" className="fx-chips-scroll">
            <div className="fx-chips" role="group" aria-label="Filter effects">
              {[
                { id: "all", label: "All", test: () => true },
                ...categories,
              ].map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  className={category === c.id ? "is-active" : ""}
                  aria-pressed={category === c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
          <span
            className="fx-count"
            aria-live="polite"
            title={`${activeCount} effects`}
          >
            {activeCount}
          </span>
        </div>
      )}
      <div className="fx-grid" role="listbox" aria-label="Choose effect">
        {visible.map((preset) => {
          const selected = value === preset;
          const glyph = glyphFor(preset);
          return (
            <Button
              key={preset}
              type="button"
              role="option"
              aria-selected={selected}
              title={preset === "none" ? "No effect" : effectLabel(preset)}
              className={`fx-tile${selected ? " is-active" : ""}`}
              onClick={() => onSelect(preset)}
            >
              {selected && (
                <span className="fx-check" aria-hidden="true">
                  <Icon name="check" size={11} />
                </span>
              )}
              <span
                className="fx-thumb"
                data-preset={preset}
                data-kind={kind}
                aria-hidden="true"
              >
                {preset === "none" ? (
                  <span className="fx-none">∅</span>
                ) : kind === "text" ? (
                  <span className="fx-shape fx-aa">Aa</span>
                ) : (
                  <span className="fx-shape" />
                )}
                {glyph && <span className="fx-glyph">{glyph}</span>}
              </span>
              <span className="fx-label">
                {preset === "none" ? "None" : effectLabel(preset)}
              </span>
            </Button>
          );
        })}
      </div>
      {categories && visible.length <= 1 && (
        <p className="hint">No effects in this group.</p>
      )}
    </div>
  );
}
