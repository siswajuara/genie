import type { Element } from "./model";
import { clamp, ease, timing, type Easing } from "./animation";

export const textEffects = [
  "none",
  "typewriter",
  "word-by-word",
  "line-by-line",
  "character-fade",
  "character-rise",
  "word-rise",
  "word-pop",
  "wave",
] as const;
export type TextAnimation = {
  preset: (typeof textEffects)[number];
  duration: number;
  delay: number;
  easing: Easing;
  reverse?: boolean;
};
export type GlyphStyle = {
  opacity: number;
  y: number;
  scale: number;
  rotation: number;
};
export type GlyphAnimation = (index: number) => GlyphStyle;
const graphemeSegmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;
const graphemeCache = new Map<string, string[]>();
export function graphemes(value: string): string[] {
  const hit = graphemeCache.get(value);
  if (hit) return hit;
  const result = graphemeSegmenter
    ? [...graphemeSegmenter.segment(value)].map((part) => part.segment)
    : Array.from(value);
  graphemeCache.set(value, result);
  if (graphemeCache.size > 256)
    graphemeCache.delete(graphemeCache.keys().next().value!);
  return result;
}
const wordSegmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : undefined;
type TextUnits = {
  words: number[];
  lines: number[];
  wordCount: number;
  lineCount: number;
  count: number;
};
const unitCache = new Map<string, TextUnits>();
export function textUnits(text: string): TextUnits {
  const cached = unitCache.get(text);
  if (cached) return cached;
  const plain = text.replace(/\[c=#[\da-f]{3,8}\]|\[\/c\]/gi, "");
  const words: number[] = [],
    lines: number[] = [];
  let word = -1;
  const rows = plain.split("\n");
  for (const [line, row] of rows.entries()) {
    const segments = wordSegmenter
      ? [...wordSegmenter.segment(row)]
      : (row.match(/\S+|\s+/gu) ?? []).map((segment) => ({
          segment,
          isWordLike: /\S/u.test(segment),
        }));
    for (const part of segments) {
      if (part.isWordLike || (word < 0 && /\S/u.test(part.segment))) word++;
      for (let index = 0; index < graphemes(part.segment).length; index++) {
        words.push(Math.max(0, word));
        lines.push(line);
      }
    }
  }
  const result = {
    words,
    lines,
    wordCount: Math.max(1, word + 1),
    lineCount: rows.length,
    count: words.length,
  };
  unitCache.set(text, result);
  if (unitCache.size > 128) unitCache.delete(unitCache.keys().next().value!);
  return result;
}
export function textGlyphStyle(
  effect: TextAnimation,
  units: TextUnits,
  index: number,
  progress: number,
  fontSize: number,
): GlyphStyle {
  const style: GlyphStyle = { opacity: 1, y: 0, scale: 1, rotation: 0 };
  if (effect.preset === "none" || progress >= 1) return style;
  const byWord = effect.preset.startsWith("word-"),
    byLine = effect.preset === "line-by-line";
  const count = byWord
    ? units.wordCount
    : byLine
      ? units.lineCount
      : units.count;
  let unit = byWord ? units.words[index] : byLine ? units.lines[index] : index;
  if (effect.reverse) unit = count - 1 - unit;
  const p = clamp(progress);
  if (["typewriter", "word-by-word", "line-by-line"].includes(effect.preset)) {
    style.opacity = unit < Math.floor(p * count + 1e-8) ? 1 : 0;
    return style;
  }
  const window = count > 1 ? 0.35 : 1,
    delay = count > 1 ? (unit / (count - 1)) * (1 - window) : 0;
  const local = clamp((p - delay) / window),
    eased = ease(local, effect.easing);
  style.opacity = clamp(eased);
  if (effect.preset === "character-rise" || effect.preset === "word-rise")
    style.y = (1 - eased) * fontSize * 0.55;
  if (effect.preset === "word-pop")
    style.scale = 0.65 + ease(local, "back-out") * 0.35;
  if (effect.preset === "wave") {
    style.y =
      Math.sin(unit * 0.7 + local * Math.PI) * (1 - local) * fontSize * 0.35;
    style.rotation = Math.sin(local * Math.PI) * (1 - local) * 0.1;
  }
  return style;
}
export function createTextAnimation(
  element: Element,
  time: number | undefined,
  duration: number,
  reduced = false,
): GlyphAnimation | undefined {
  const effect = element.animation?.text;
  if (
    element.t !== "text" ||
    time === undefined ||
    reduced ||
    !effect ||
    effect.preset === "none"
  )
    return;
  const { start, end } = timing(element, duration),
    delay = Math.min(effect.delay, end - start - 0.05);
  const span = Math.min(effect.duration, end - start - delay),
    progress = clamp((time - start - delay) / span);
  if (progress >= 1) return;
  const units = textUnits(element.text ?? "");
  return (index) =>
    textGlyphStyle(effect, units, index, progress, element.size ?? 24);
}
