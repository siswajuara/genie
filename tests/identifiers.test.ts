import { expect, test } from "bun:test";
import {
  identifierFromAssetFile,
  matchAssetIdentifier,
  parseAssetIdentifier,
  slugify,
} from "../src/editor/identifiers";
import manifest from "../src/assets/generated/elements/manifest.json";
import { presets } from "../src/editor/model";
const assets = manifest.assets.map((asset) => ({
  ...asset,
  identifier: identifierFromAssetFile(asset.file),
}));
test("identifiers normalize text and preserve mixed colors and facing", () => {
  expect(slugify("  Café Laptop / Blue Front! ")).toBe(
    "cafe-laptop-blue-front",
  );
  expect(
    identifierFromAssetFile(
      "owl-student-mascot-blue-yellow-front-0-multiple-reading-together-happy.png",
    ),
  ).toBe("owl-student-mascot-reading-together-happy-blue-yellow-front");
  expect(
    parseAssetIdentifier(
      "owl-student-mascot-reading-together-happy-blue-yellow-front",
    ),
  ).toEqual({
    name: "owl-student-mascot-reading-together-happy",
    color: "blue-yellow",
    facing: "front",
  });
});
test("asset matching respects actions, color and facing without unrelated fallback", () => {
  expect(
    matchAssetIdentifier(
      "owl-student-mascot-using-laptop-focused-yellow-front",
      assets,
    )?.file,
  ).toBe("owl-student-mascot-yellow-front-0-single-using-laptop-focused.png");
  expect(
    matchAssetIdentifier("cursor-pointer-arrow-blue-up", assets)?.file,
  ).toBe("cursor-pointer-arrow-blue-up-330-single.png");
  expect(
    matchAssetIdentifier("social-instagram-blue-front", assets),
  ).toBeUndefined();
});
test("every built-in slot has a valid semantic identifier and every template has matching artwork", () => {
  for (const preset of presets) {
    expect(preset.identifier).toBe(slugify(preset.identifier!));
    for (const object of preset.objects) {
      expect(object.identifier).toBe(slugify(object.identifier!));
      if (object.t === "img")
        expect(parseAssetIdentifier(object.identifier!)).toBeDefined();
    }
    if (preset.kind === "template")
      expect(
        preset.objects.some(
          (o) => o.t === "img" && matchAssetIdentifier(o.identifier!, assets),
        ),
      ).toBe(true);
  }
});
