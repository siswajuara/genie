import { describe, expect, test } from "bun:test";
import {
  applyPreset,
  initialDocument,
  parseDocument,
  parsePresets,
  presets,
} from "../src/editor/model";
describe("canvas document contract", () => {
  test("all reference templates validate and retain their frame relationships", () => {
    expect(presets.filter((p) => p.kind === "template")).toHaveLength(13);
    expect(presets.length).toBeGreaterThanOrEqual(13);
    for (const p of presets) {
      const initial = initialDocument();
      const doc = applyPreset(initial, p, initial.elements[0].id);
      expect(() => parseDocument(doc)).not.toThrow();
      expect(new Set(doc.elements.map((o) => o.id)).size).toBe(
        doc.elements.length,
      );
    }
  });
  test("replacement preserves the chosen frame id and removes its previous children", () => {
    const doc = initialDocument(),
      frame = doc.elements[0];
    const other = applyPreset(doc, presets[1]);
    const oldChildren = doc.elements.slice(1).map((o) => o.id);
    const next = applyPreset(other, presets[2], frame.id, true);
    expect(next.elements.filter((o) => o.t === "frame")).toHaveLength(2);
    expect(next.elements.find((o) => o.id === frame.id)?.n).toBe(
      presets[2].name,
    );
    expect(next.elements.some((o) => oldChildren.includes(o.id))).toBe(false);
    expect(
      next.elements.filter(
        (o) => o.fid === other.elements.findLast((o) => o.t === "frame")!.id,
      ),
    ).toHaveLength(presets[1].objects.length);
  });
  test("import rejects invalid geometry, duplicate ids, missing frames and invalid styles", () => {
    const doc = initialDocument();
    const cases = [
      { ...doc, elements: [{ ...doc.elements[0], w: -10 }] },
      { ...doc, elements: [doc.elements[0], doc.elements[0]] },
      { ...doc, elements: [{ ...doc.elements[1], fid: "missing" }] },
      { ...doc, elements: [{ ...doc.elements[0], fill: "not-a-color" }] },
      { ...doc, elements: [{ ...doc.elements[1], r: -10 }] },
      { ...doc, version: 2 },
    ];
    for (const value of cases) expect(() => parseDocument(value)).toThrow();
  });
  test("legacy reference presets receive IDs and reject oversized frames", () => {
    expect(parsePresets(presets[0])[0].objects.every((o) => o.id)).toBe(true);
    expect(() => parsePresets({ ...presets[0], W: 20000 })).toThrow();
  });
});
