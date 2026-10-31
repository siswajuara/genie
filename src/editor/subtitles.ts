import type { Element } from "./model";

export type SubtitleCue = {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: TimedWord[];
};
export type SubtitleAnimation = "none" | "karaoke" | "pop";
export type SubtitleStyle = {
  size: number;
  color: string;
  background: string;
  position: "bottom" | "center" | "top";
  animation: SubtitleAnimation;
  highlight: string;
  outline: string;
  outlineWidth: number;
  /** Max words shown on one caption line. Display-only; generation chunks at 4. */
  wordsPerLine?: number;
  /** Peak word scale for the pop animation. */
  popScale?: number;
  /** Vertical nudge in percent of frame height. */
  offsetY?: number;
};
export const defaultSubtitleStyle: SubtitleStyle = {
  size: 5.5,
  color: "#1b2a7a",
  background: "#ffffffd9",
  position: "bottom",
  animation: "karaoke",
  highlight: "#ffe14d",
  outline: "#1b2a7a",
  outlineWidth: 0.06,
  wordsPerLine: 4,
  popScale: 1.18,
  offsetY: 0,
};
// Narration spells web domains with (dot) so speech reads each part;
// captions show the real period again.
export function restoreCaptionDots(text: string): string {
  return text
    .replace(/\(\s*dot\s*\)/gi, ".")
    .replace(/\s*dot\s*/gi, ".")
    .replace(/\s+([.,!?;:])/g, "$1");
}

export function validateSubtitles(frame: Element) {
  if (frame.subtitles !== undefined) {
    if (
      frame.t !== "frame" ||
      !Array.isArray(frame.subtitles) ||
      frame.subtitles.length > 2000
    )
      throw Error("Use at most 2,000 subtitle cues per frame.");
    const ids = new Set<string>();
    for (const cue of frame.subtitles) {
      if (
        !cue ||
        typeof cue.id !== "string" ||
        !cue.id ||
        ids.has(cue.id) ||
        !Number.isFinite(cue.start) ||
        !Number.isFinite(cue.end) ||
        cue.start < 0 ||
        cue.end <= cue.start ||
        cue.end > 600 ||
        typeof cue.text !== "string" ||
        !cue.text.trim() ||
        cue.text.length > 2000
      )
        throw Error(
          "Subtitle cues need text and valid times between 0 and 600 seconds.",
        );
      ids.add(cue.id);
      if (
        cue.words !== undefined &&
        (!Array.isArray(cue.words) ||
          cue.words.length > 500 ||
          cue.words.some(
            (word) =>
              !word ||
              typeof word.text !== "string" ||
              !word.text ||
              word.text.length > 2000 ||
              !Number.isFinite(word.start) ||
              !Number.isFinite(word.end) ||
              word.end <= word.start,
          ))
      )
        throw Error(
          "Subtitle cue words need text and valid times between 0 and 600 seconds.",
        );
    }
  }
  if (frame.subtitleStyle !== undefined) {
    const s = frame.subtitleStyle;
    if (
      frame.t !== "frame" ||
      !s ||
      !Number.isFinite(s.size) ||
      s.size < 1 ||
      s.size > 15 ||
      ![s.color, s.background, s.highlight ?? "#ffffff", s.outline ?? "#000000"].every(
        (v) =>
          typeof v === "string" && /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v),
      ) ||
      !["bottom", "center", "top"].includes(s.position) ||
      (s.animation !== undefined &&
        !["none", "karaoke", "pop"].includes(s.animation)) ||
      (s.outlineWidth !== undefined &&
        (!Number.isFinite(s.outlineWidth) ||
          s.outlineWidth < 0 ||
          s.outlineWidth > 1)) ||
      (s.wordsPerLine !== undefined &&
        (!Number.isInteger(s.wordsPerLine) ||
          s.wordsPerLine < 1 ||
          s.wordsPerLine > 6)) ||
      (s.popScale !== undefined &&
        (!Number.isFinite(s.popScale) ||
          s.popScale < 1 ||
          s.popScale > 1.6)) ||
      (s.offsetY !== undefined &&
        (!Number.isFinite(s.offsetY) || s.offsetY < -15 || s.offsetY > 15))
    )
      throw Error("Invalid subtitle style.");
  }
}
function timestamp(raw: string) {
  const match = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(raw);
  if (!match) throw Error(`Invalid SRT timestamp: ${raw}`);
  return (
    Number(match[1]) * 3600 +
    Number(match[2]) * 60 +
    Number(match[3]) +
    Number(match[4]) / 1000
  );
}
export function parseSrt(raw: string): SubtitleCue[] {
  if (raw.length > 2_000_000) throw Error("Choose an SRT file under 2 MB.");
  const blocks = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  if (!raw.trim() || blocks.length > 2000)
    throw Error("The SRT must contain 1–2,000 cues.");
  return blocks
    .map((block, i) => {
      const lines = block.split("\n");
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const times = /^(\S+)\s+-->\s+(\S+)\s*$/.exec(
        lines.shift()?.trim() ?? "",
      );
      if (!times) throw Error(`SRT cue ${i + 1} needs a timestamp range.`);
      const start = timestamp(times[1]),
        end = timestamp(times[2]);
      const text = lines
        .join("\n")
        .replace(/<[^>]*>/g, "")
        .trim();
      if (start >= end || end > 600 || !text || text.length > 2000)
        throw Error(
          `SRT cue ${i + 1} needs text and increasing times within 10 minutes.`,
        );
      return { id: crypto.randomUUID(), start, end, text };
    })
    .sort((a, b) => a.start - b.start);
}
function srtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
export function toSrt(cues: SubtitleCue[]) {
  return (
    [...cues]
      .sort((a, b) => a.start - b.start)
      .map(
        (cue, i) =>
          `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}`,
      )
      .join("\n\n") + "\n"
  );
}
export type TimedWord = {
  text: string;
  start: number;
  end: number;
  type?: string;
};
// TikTok-style pacing: at most this many words share one cue so playback
// shows a single short line instead of a wrapping paragraph.
export const MAX_WORDS_PER_CUE = 4;
export function wordsToCues(words: TimedWord[]): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let current: SubtitleCue | undefined;
  let currentWords = 0;
  let dotPending = false;
  const pushWord = (cue: SubtitleCue, text: string, word: TimedWord) => {
    (cue.words ??= []).push({ text, start: word.start, end: word.end });
  };
  for (const word of words) {
    if (
      (word.type && word.type !== "word") ||
      !word.text.trim() ||
      !Number.isFinite(word.start) ||
      !Number.isFinite(word.end) ||
      word.start < 0 ||
      word.end <= word.start
    )
      continue;
    // The cue-break check runs on the raw token so a restored domain period
    // never splits siswajuara.com across two cues.
    const raw = word.text.trim();
    const breaks = /[.!?。！？]$/.test(raw);
    // Speech timing spells the domain dot as its own token ("siswajuara dot
    // com"), while the script holds it as one "(dot)" token. Merge the
    // spoken dot back into a single domain word so captions and karaoke
    // read siswajuara.com instead of "siswajuara . com".
    const entries = current?.words ?? [];
    const lastEntry = entries[entries.length - 1];
    if (
      /^(dot|\(dot\))$/i.test(raw) &&
      current &&
      lastEntry &&
      !lastEntry.text.endsWith(".")
    ) {
      current.text += ".";
      lastEntry.text += ".";
      lastEntry.end = word.end;
      current.end = word.end;
      dotPending = true;
    } else {
      const display = restoreCaptionDots(raw);
      if (
        !current ||
        currentWords >= MAX_WORDS_PER_CUE ||
        word.start - current.end > 0.7 ||
        word.end - current.start > 3.5 ||
        current.text.length + display.length > 70
      ) {
        dotPending = false;
        current = {
          id: crypto.randomUUID(),
          start: word.start,
          end: word.end,
          text: display,
        };
        currentWords = 1;
        pushWord(current, display, word);
        cues.push(current);
      } else if (dotPending) {
        dotPending = false;
        current.text += display;
        current.end = word.end;
        currentWords += 1;
        const owned = current.words ?? [];
        const ownedLast = owned[owned.length - 1];
        if (ownedLast) {
          ownedLast.text += display;
          ownedLast.end = word.end;
        } else {
          pushWord(current, display, word);
        }
      } else {
        current.text = restoreCaptionDots(`${current.text} ${display}`);
        current.end = word.end;
        currentWords += 1;
        pushWord(current, display, word);
      }
    }
    if (breaks) {
      current = undefined;
      currentWords = 0;
      dotPending = false;
    }
  }
  return cues;
}
export function alignmentToWords(
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  },
  omitAudioTags = false,
): TimedWord[] {
  const words: TimedWord[] = [];
  let word: TimedWord | undefined;
  const text = alignment.characters.join("");
  const tags = omitAudioTags ? [...text.matchAll(/\[[^\]\n]+\]/g)] : [];
  let offset = 0;
  alignment.characters.forEach((chunk, i) => {
    for (const char of chunk) {
      const position = offset;
      offset += char.length;
      if (
        tags.some(
          (tag) =>
            position >= tag.index! && position < tag.index! + tag[0].length,
        )
      ) {
        word = undefined;
        continue;
      }
      if (/\s/.test(char)) {
        word = undefined;
        continue;
      }
      if (!word) {
        word = {
          text: char,
          start: alignment.character_start_times_seconds[i],
          end: alignment.character_end_times_seconds[i],
        };
        words.push(word);
      } else {
        word.text += char;
        word.end = alignment.character_end_times_seconds[i];
      }
    }
  });
  return words;
}

type CaptionWord = { text: string; start: number; end: number };
function backgroundAlpha(background: string): number {
  if (/^#[0-9a-f]{8}$/i.test(background))
    return parseInt(background.slice(7), 16) / 255;
  return 1;
}
/** Rebuild an 8-digit hex color with a new 0–1 alpha, preserving RGB. */
export function withBackgroundAlpha(background: string, alpha: number): string {
  const rgb = background.slice(0, 7);
  const clamped = Math.min(1, Math.max(0, alpha));
  return `${rgb}${Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
export function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  frame: Element,
  time = 0,
) {
  const cues = frame.subtitles?.filter(
    (cue) => time >= cue.start && time < cue.end,
  );
  if (!cues?.length) return;
  const style = { ...defaultSubtitleStyle, ...(frame.subtitleStyle ?? {}) };
  const animated = style.animation !== "none";
  const baseSize = (frame.w * style.size) / 100;
  const maxWidth = frame.w * 0.86;
  // Words keep their own timings for karaoke; plain-text cues fall back to
  // evenly spread timings so highlighting still works approximately.
  const words: CaptionWord[] = [];
  for (const cue of cues) {
    if (cue.words?.length) {
      for (const word of cue.words)
        words.push({ text: word.text, start: word.start, end: word.end });
    } else {
      const parts = cue.text.split(/\s+/).filter(Boolean);
      parts.forEach((text, i) =>
        words.push({
          text,
          start: cue.start + ((cue.end - cue.start) * i) / parts.length,
          end: cue.start + ((cue.end - cue.start) * (i + 1)) / parts.length,
        }),
      );
    }
  }
  if (!words.length) return;
  // TikTok-style pagination: show only the short phrase around the current
  // word so captions stay on one animated line instead of wrapping into a
  // paragraph. Legacy long cues are windowed the same way. The page follows
  // the next upcoming word through inter-word gaps so it never snaps back
  // to the first phrase mid-sentence (the visible "glitch").
  const perLine = Math.min(
    6,
    Math.max(1, Math.round(style.wordsPerLine ?? MAX_WORDS_PER_CUE)),
  );
  let activeIndex = words.findIndex(
    (word) => time >= word.start && time < word.end,
  );
  if (activeIndex < 0) {
    const upcoming = words.findIndex((word) => word.end > time);
    activeIndex = upcoming >= 0 ? upcoming : words.length - 1;
  }
  const page = Math.floor(activeIndex / perLine);
  const pageStart = page * perLine;
  const row = words.slice(pageStart, pageStart + perLine);
  if (!row.length) return;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // Shrink this line to fit so even four long words stay on one line.
  let size = baseSize;
  const setFont = () => {
    ctx.font = `800 ${size}px Nunito, sans-serif`;
  };
  setFont();
  let space = ctx.measureText(" ").width;
  let widths = row.map((word) => ctx.measureText(word.text).width);
  let total =
    widths.reduce((a, b) => a + b, 0) + space * Math.max(0, row.length - 1);
  while (total > maxWidth && size > baseSize * 0.4) {
    size *= 0.9;
    setFont();
    space = ctx.measureText(" ").width;
    widths = row.map((word) => ctx.measureText(word.text).width);
    total =
      widths.reduce((a, b) => a + b, 0) + space * Math.max(0, row.length - 1);
  }
  const padding = size * 0.4,
    lineHeight = size * 1.25;
  const height = lineHeight + padding * 2;
  const baseTop =
    style.position === "top"
      ? frame.h * 0.08
      : style.position === "center"
        ? (frame.h - height) / 2
        : frame.h * 0.9 - height;
  const top = baseTop + ((style.offsetY ?? 0) / 100) * frame.h;
  if (backgroundAlpha(style.background) > 0) {
    ctx.fillStyle = style.background;
    ctx.fillRect(frame.w * 0.05, top, frame.w * 0.9, height);
  }
  {
    let x = frame.w / 2 - total / 2;
    const y = top + padding + lineHeight * 0.5;
    const popPeak = style.popScale ?? 1.18;
    row.forEach((word, j) => {
      // Hold the highlight through the gap until the next word starts so
      // the active word never blinks off between fast words.
      const holdEnd = words[pageStart + j + 1]?.start ?? word.end;
      const active = animated && time >= word.start && time < holdEnd;
      // Ease the pop scale in over ~120 ms instead of snapping 1x ↔ peak,
      // which reads as a glitch at 30 fps exports.
      let pop = 1;
      if (style.animation === "pop" && time >= word.start && time < holdEnd) {
        const attack = Math.min(
          0.12,
          Math.max(0.03, (holdEnd - word.start) / 3),
        );
        const progress = clamp01((time - word.start) / attack);
        pop = 1 + (popPeak - 1) * (1 - Math.pow(1 - progress, 3));
      }
      ctx.save();
      if (pop !== 1) {
        const cx = x + widths[j] / 2;
        ctx.translate(cx, y);
        ctx.scale(pop, pop);
        ctx.translate(-cx, -y);
      }
      if (style.outlineWidth > 0) {
        ctx.lineWidth = Math.max(1, size * style.outlineWidth);
        ctx.strokeStyle = style.outline;
        ctx.lineJoin = "round";
        ctx.strokeText(word.text, x, y, maxWidth);
      }
      ctx.fillStyle = active ? style.highlight : style.color;
      ctx.fillText(word.text, x, y, maxWidth);
      ctx.restore();
      x += widths[j] + space;
    });
  }
  ctx.restore();
}
