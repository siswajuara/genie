import { describe, expect, test } from "bun:test";
import {
  buildSequence,
  defaultEffect,
  evaluateAnimation,
  identity,
  keyframePose,
  sceneDuration,
  timing,
  type Keyframe,
} from "../src/editor/animation";
import {
  applyPreset,
  parseDocument,
  parsePresets,
  presets,
  validateElements,
  type CanvasDocument,
  type Element,
} from "../src/editor/model";
import { sequenceAt } from "../src/editor/animationRenderer";
import { videoBitrate, videoDimensions } from "../src/editor/mediaExport";

const frame = (id: string, duration = 5): Element => ({
  id,
  t: "frame",
  n: id,
  x: 300,
  y: 200,
  w: 400,
  h: 300,
  fill: "#ffffff",
  scene: { duration },
});
const layer = (): Element => ({
  id: "layer",
  fid: "one",
  t: "rect",
  n: "Layer",
  x: 320,
  y: 240,
  w: 100,
  h: 70,
  fill: "#ff0000",
});
const key = (time: number, x: number): Keyframe => ({
  ...identity,
  time,
  x,
  easing: "linear",
});

describe("animation timing and interpolation", () => {
  test("legacy elements stay visible and editable without animation data", () => {
    const o = layer();
    expect(evaluateAnimation(o, 2, 5)).toEqual(identity);
    expect(timing(o, 5)).toEqual({ start: 0, end: 5 });
    expect(sceneDuration({ ...frame("one"), scene: undefined })).toBe(5);
  });
  test("lifetime gates visibility, entrance and exit settle exactly, and base geometry never changes", () => {
    const o = {
        ...layer(),
        animation: {
          start: 1,
          end: 4,
          enter: defaultEffect(),
          exit: defaultEffect(),
        },
      },
      before = JSON.stringify(o);
    expect(evaluateAnimation(o, 0, 5).opacity).toBe(0);
    expect(evaluateAnimation(o, 1, 5).opacity).toBe(0);
    expect(evaluateAnimation(o, 2, 5).opacity).toBe(1);
    expect(evaluateAnimation(o, 4, 5).opacity).toBe(0);
    expect(evaluateAnimation(o, 4.1, 5).opacity).toBe(0);
    expect(JSON.stringify(o)).toBe(before);
  });
  test("short scenes and later duration changes clamp clips and avoid conflicting fades", () => {
    const o = {
      ...layer(),
      animation: {
        start: 10,
        end: 12,
        enter: defaultEffect(),
        exit: defaultEffect(),
      },
    };
    expect(timing(o, 0.1)).toEqual({ start: 0.05, end: 0.1 });
    expect(evaluateAnimation(o, 0.075, 0.1).opacity).toBeCloseTo(1);
  });
  test("keyframes use relative offsets, hold endpoints, and interpolate all pose channels", () => {
    const keys = [
      key(0, 0),
      {
        ...key(2, 100),
        scale: 2,
        rotation: 90,
        opacity: 0.5,
        rotateY: 60,
        z: 200,
      },
    ];
    expect(keyframePose(keys, -1).x).toBe(0);
    expect(keyframePose(keys, 5).x).toBe(100);
    const pose = keyframePose(keys, 1);
    expect(pose).toMatchObject({
      x: 50,
      scale: 1.5,
      rotation: 45,
      opacity: 0.75,
      rotateY: 30,
      z: 100,
    });
    expect(
      evaluateAnimation(
        { ...layer(), animation: { start: 1, end: 5, keyframes: keys } },
        2,
        5,
      ),
    ).toEqual(pose);
  });
  test("reduced motion keeps layer lifetimes but removes transforms and fades", () => {
    const o = {
      ...layer(),
      animation: {
        start: 1,
        end: 4,
        enter: defaultEffect("zoom-3d"),
        motion: {
          preset: "float" as const,
          amount: 80,
          easing: "linear" as const,
        },
        keyframes: [key(0, 50)],
      },
    };
    expect(evaluateAnimation(o, 1, 5, true)).toEqual(identity);
    expect(evaluateAnimation(o, 0, 5, true).opacity).toBe(0);
    expect(evaluateAnimation(o, 1, 5).rotateY).toBe(45);
  });
});
describe("scene composition", () => {
  test("outgoing transitions overlap selected frames without shortening a final scene", () => {
    const a = frame("a", 4),
      b = frame("b", 3),
      c = frame("c", 2);
    a.scene!.transition = { type: "crossfade", duration: 1 };
    b.scene!.transition = { type: "slide-left", duration: 0.5 };
    const sequence = buildSequence([a, b, c]);
    expect(
      sequence.map(({ start, end, overlap }) => ({ start, end, overlap })),
    ).toEqual([
      { start: 0, end: 4, overlap: 0 },
      { start: 3, end: 6, overlap: 1 },
      { start: 5.5, end: 7.5, overlap: 0.5 },
    ]);
    expect(sequenceAt(sequence, 3.5).map((e) => e.frame.id)).toEqual([
      "a",
      "b",
    ]);
    expect(sequenceAt(sequence, 4).map((e) => e.frame.id)).toEqual(["b"]);
    expect(sequenceAt(sequence, 7.5).map((e) => e.frame.id)).toEqual(["c"]);
    expect(buildSequence([c, a])[1].overlap).toBe(0);
  });
  test("oversized transitions cannot create three simultaneous scenes", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      ...frame(String(i), 0.1),
      scene: {
        duration: 0.1,
        transition: { type: "zoom" as const, duration: 10 },
      },
    }));
    const sequence = buildSequence(items);
    for (let t = 0; t < 0.3; t += 0.001)
      expect(sequenceAt(sequence, t).length).toBeLessThanOrEqual(2);
    expect(sequence[1].overlap).toBe(0.05);
  });
});
describe("document and export safety", () => {
  test("all 13 built-in templates have six-second scenes with staged editable animation", () => {
    expect(presets).toHaveLength(13);
    const empty: CanvasDocument = {
      version: 1,
      metadata: { name: "Template", updatedAt: "" },
      elements: [],
    };
    for (const preset of presets) {
      expect(preset.scene?.duration).toBe(6);
      expect(preset.scene?.transition?.type).toBe("cut");
      expect(
        preset.objects.every((o) => o.animation && o.animation.end === 6),
      ).toBe(true);
      expect(preset.objects.some((o) => o.animation!.start! > 0)).toBe(true);
      expect(
        Math.max(
          ...preset.objects.map(
            (o) =>
              (o.animation?.start ?? 0) + (o.animation?.enter?.duration ?? 0),
          ),
        ),
      ).toBeLessThan(2);
      const doc = applyPreset(empty, preset);
      expect(() => parseDocument(doc)).not.toThrow();
      expect(sceneDuration(doc.elements[0])).toBe(6);
      const replaced = applyPreset(doc, preset, doc.elements[0].id, true);
      expect(sceneDuration(replaced.elements[0])).toBe(6);
      expect(replaced.elements[0].id).toBe(doc.elements[0].id);
      const roundtrip = parsePresets(JSON.parse(JSON.stringify(preset)))[0];
      expect(roundtrip.scene).toEqual(preset.scene);
      expect(roundtrip.objects.map((o) => o.animation)).toEqual(
        preset.objects.map((o) => o.animation),
      );
      expect(
        preset.objects.every(
          (o, i) =>
            o.text === doc.elements[i + 1].text &&
            o.t === doc.elements[i + 1].t,
        ),
      ).toBe(true);
    }
  });
  test("legacy saved templates gain six-second animation while customized timing is preserved", () => {
    const legacy = {
      ...presets[0],
      scene: undefined,
      objects: presets[0].objects.map((o) => ({ ...o, animation: undefined })),
    };
    expect(parsePresets(legacy)[0].scene?.duration).toBe(6);
    const custom = { ...legacy, scene: { duration: 0.1 } };
    const migrated = parsePresets(custom)[0];
    expect(migrated.scene?.duration).toBe(0.1);
    expect(() =>
      parseDocument(
        applyPreset(
          {
            version: 1,
            metadata: { name: "Short", updatedAt: "" },
            elements: [],
          },
          migrated,
        ),
      ),
    ).not.toThrow();
  });
  test("animation survives validated canvas round trips", () => {
    const o = {
      ...layer(),
      animation: {
        start: 1,
        end: 4,
        depth: 100,
        enter: defaultEffect("zoom-3d"),
        keyframes: [key(0, 0), key(1, 90)],
      },
    };
    const doc: CanvasDocument = {
      version: 1,
      metadata: { name: "Animation", updatedAt: "" },
      elements: [frame("one"), o],
    };
    expect(parseDocument(JSON.parse(JSON.stringify(doc))).elements).toEqual(
      doc.elements,
    );
  });
  test("malformed animation from imports or assistants is rejected before rendering", () => {
    for (const animation of [
      null,
      [],
      { start: NaN },
      { start: 4, end: 3 },
      { enter: { ...defaultEffect(), duration: 0 } },
      { motion: { preset: "evil", amount: 1, easing: "linear" } },
      { keyframes: [key(1, 0), key(1, 2)] },
      { keyframes: [{ ...key(0, 0), scale: -1 }] },
      { keyframes: Array.from({ length: 101 }, (_, i) => key(i, i)) },
    ]) {
      expect(() =>
        validateElements([frame("one"), { ...layer(), animation }]),
      ).toThrow();
    }
    expect(() =>
      validateElements([{ ...frame("one"), scene: { duration: Infinity } }]),
    ).toThrow();
    expect(() =>
      validateElements([{ ...frame("one"), animation: {} }]),
    ).toThrow();
    expect(() =>
      validateElements([frame("one"), { ...layer(), scene: { duration: 2 } }]),
    ).toThrow();
  });
  test("MP4 dimensions stay even, preserve aspect ratio, and do not upscale", () => {
    expect(videoDimensions(frame("one"), 720)).toEqual({
      width: 400,
      height: 300,
    });
    expect(
      videoDimensions({ ...frame("one"), w: 1080, h: 1350 }, 1080),
    ).toEqual({ width: 864, height: 1080 });
    const output = videoDimensions({ ...frame("one"), w: 403, h: 301 }, 720);
    expect(output.width % 2).toBe(0);
    expect(output.height % 2).toBe(0);
    expect(videoBitrate(864, 1080, 30, "high")).toBeGreaterThan(
      videoBitrate(864, 1080, 30, "standard"),
    );
  });
});
