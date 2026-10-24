import { describe, expect, test } from "bun:test";
import schema from "../sidecar/canvas.schema.json";
import {
  effects,
  motions,
  transitions,
  easings,
  evaluateAnimation,
  identity,
} from "../src/editor/animation";
import {
  createTextAnimation,
  graphemes,
  textEffects,
  textGlyphStyle,
  textUnits,
  type TextAnimation,
} from "../src/editor/textAnimation";
import {
  addTimelineKeyframe,
  moveTimelineClips,
  snapTimelineTime,
} from "../src/editor/timelineEditing";
import {
  parseDocument,
  validateElements,
  type CanvasDocument,
  type Element,
} from "../src/editor/model";

const text: Element = {
  id: "text",
  fid: "frame",
  t: "text",
  n: "Text",
  x: 20,
  y: 20,
  w: 300,
  h: 100,
  text: "Hello [c=#f00]world[/c]\nRead together",
  font: "Arial",
  size: 24,
};
const frame: Element = {
  id: "frame",
  t: "frame",
  n: "Scene",
  x: 0,
  y: 0,
  w: 400,
  h: 300,
  scene: { duration: 6 },
};
const reveal = (preset: TextAnimation["preset"]): TextAnimation => ({
  preset,
  duration: 2,
  delay: 0,
  easing: "linear",
});
describe("editable text animation", () => {
  test("Unicode segmentation keeps combining marks and emoji sequences intact", () => {
    expect(graphemes("A👨‍👩‍👧‍👦e\u0301")).toHaveLength(3);
    expect(graphemes("A👨‍👩‍👧‍👦e\u0301")[2]).toBe("e\u0301");
  });
  test("text units exclude formatting tags and preserve word/line boundaries", () => {
    const units = textUnits(text.text!);
    expect(units.count).toBe(graphemes("Hello worldRead together").length);
    expect(units.wordCount).toBe(4);
    expect(units.lineCount).toBe(2);
    expect(units.words[6]).toBe(1);
    expect(units.lines[11]).toBe(1);
  });
  test("typewriter and word reveals expose the expected units without changing the original text", () => {
    const original = JSON.stringify(text),
      units = textUnits("AB CD");
    expect(
      [0, 1, 2, 3, 4].map(
        (i) => textGlyphStyle(reveal("typewriter"), units, i, 0.4, 24).opacity,
      ),
    ).toEqual([1, 1, 0, 0, 0]);
    expect(
      textGlyphStyle(reveal("word-by-word"), units, 0, 0.5, 24).opacity,
    ).toBe(1);
    expect(
      textGlyphStyle(reveal("word-by-word"), units, 3, 0.5, 24).opacity,
    ).toBe(0);
    expect(
      textGlyphStyle(
        { ...reveal("typewriter"), reverse: true },
        units,
        4,
        0.2,
        24,
      ).opacity,
    ).toBe(1);
    expect(
      textGlyphStyle(reveal("line-by-line"), textUnits("one\ntwo"), 3, 0.5, 24)
        .opacity,
    ).toBe(0);
    expect(JSON.stringify(text)).toBe(original);
  });
  test("all text presets settle, remain finite, and support delay/reduced motion", () => {
    for (const preset of textEffects) {
      const animation = {
        ...text,
        animation: {
          start: 1,
          end: 5,
          text: { ...reveal(preset), delay: 0.5 },
        },
      };
      const initial = createTextAnimation(animation, 1.25, 6);
      if (preset !== "none") expect(initial!(0).opacity).toBe(0);
      expect(createTextAnimation(animation, 5, 6)).toBeUndefined();
      expect(createTextAnimation(animation, 1.5, 6, true)).toBeUndefined();
      for (const p of [0, 0.15, 0.5, 0.85, 1])
        for (let i = 0; i < 5; i++)
          expect(
            Object.values(
              textGlyphStyle(reveal(preset), textUnits("AB CD"), i, p, 24),
            ).every(Number.isFinite),
          ).toBe(true);
    }
  });
  test("new easing and entrance presets reach their final pose and keep finite values", () => {
    for (const preset of effects)
      for (const easing of easings) {
        const element = {
          ...text,
          animation: { enter: { preset, easing, amount: 80, duration: 0.6 } },
        };
        expect(evaluateAnimation(element, 2, 6)).toEqual(identity);
        expect(
          Object.values(evaluateAnimation(element, 0.25, 6)).every(
            Number.isFinite,
          ),
        ).toBe(true);
      }
  });
  test("assistant/import validation accepts text data and rejects invalid timing and wrong element types", () => {
    const doc: CanvasDocument = {
      version: 1,
      metadata: { name: "Text", updatedAt: "" },
      elements: [frame, { ...text, animation: { text: reveal("word-rise") } }],
    };
    expect(
      parseDocument(JSON.parse(JSON.stringify(doc))).elements[1].animation!
        .text,
    ).toEqual(reveal("word-rise"));
    for (const effect of [
      null,
      { ...reveal("typewriter"), duration: 0 },
      { ...reveal("typewriter"), delay: -1 },
      { ...reveal("typewriter"), reverse: "yes" },
      { ...reveal("typewriter"), preset: "fake" },
    ])
      expect(() =>
        validateElements([frame, { ...text, animation: { text: effect } }]),
      ).toThrow();
    expect(() =>
      validateElements([
        frame,
        { ...text, t: "rect", animation: { text: reveal("typewriter") } },
      ]),
    ).toThrow();
  });
  test("assistant schema enums stay synchronized with every UI/render preset", () => {
    expect(schema.$defs.effect.properties.preset.enum).toEqual(effects);
    expect(schema.$defs.motion.properties.preset.enum).toEqual(motions);
    expect(schema.$defs.easing.enum).toEqual(easings);
    expect(
      schema.$defs.scene.properties.transition.properties.type.enum,
    ).toEqual(transitions);
    expect(schema.$defs.textAnimation.properties.preset.enum).toEqual(
      textEffects,
    );
  });
});
describe("advanced timeline edits", () => {
  const doc: CanvasDocument = {
    version: 1,
    metadata: { name: "Tracks", updatedAt: "" },
    elements: [
      frame,
      { ...text, id: "a", animation: { start: 1, end: 3 } },
      { ...text, id: "b", animation: { start: 2, end: 5 } },
      { ...text, id: "locked", lock: true, animation: { start: 1, end: 4 } },
    ],
  };
  test("group movement retains offsets, clamps as a group, and leaves locked/unselected layers intact", () => {
    const moved = moveTimelineClips(doc, ["a", "b", "locked"], 2, 6);
    expect(moved.elements[1].animation).toMatchObject({ start: 2, end: 4 });
    expect(moved.elements[2].animation).toMatchObject({ start: 3, end: 6 });
    expect(moved.elements[3]).toBe(doc.elements[3]);
    expect(doc.elements[1].animation!.start).toBe(1);
    const left = moveTimelineClips(doc, ["a", "b"], -10, 6);
    expect(left.elements[1].animation!.start).toBe(0);
    expect(left.elements[2].animation!.start).toBe(1);
  });
  test("snapping uses the chosen frame grid and nearby boundaries while free movement keeps precision", () => {
    expect(snapTimelineTime(1.04, 30, true, [], 100)).toBeCloseTo(31 / 30, 6);
    expect(snapTimelineTime(1.04, 30, true, [1.05], 100)).toBe(1.05);
    expect(snapTimelineTime(1.041, 30, false, [1.05], 100)).toBe(1.041);
    expect(snapTimelineTime(1.04, 60, true, [], 100)).toBeCloseTo(62 / 60, 6);
  });
  test("adding keys preserves interpolation, creates a baseline, and avoids duplicate times", () => {
    const first = addTimelineKeyframe(doc.elements[1], 2, 6);
    expect(first.animation!.keyframes!.map((k) => k.time)).toEqual([0, 1]);
    const changed = {
      ...first,
      animation: {
        ...first.animation,
        keyframes: first.animation!.keyframes!.map((k) => ({
          ...k,
          x: k.time * 100,
        })),
      },
    };
    const middle = addTimelineKeyframe(changed, 1.5, 6);
    expect(middle.animation!.keyframes![1].x).toBe(50);
    expect(addTimelineKeyframe(middle, 1.5, 6)).toBe(middle);
    expect(middle.animation!.keyframes!.map((k) => k.time)).toEqual([
      0, 0.5, 1,
    ]);
  });
  test("frame locks protect group edits", () => {
    const locked = {
      ...doc,
      elements: doc.elements.map((o) =>
        o.id === "frame" ? { ...o, lock: true } : o,
      ),
    };
    expect(moveTimelineClips(locked, ["a", "b"], 1, 6)).toBe(locked);
  });
});
