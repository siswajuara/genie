import assert from "node:assert/strict";
import fs from "node:fs/promises";
import sharp from "sharp";
import { illustration3DModels, normalizeIllustration3D, illustration3DSvg, illustration3DThumbnail } from "../src/editor/illustration3d.mjs";
import { illustration3DScenes, paintIllustration3D } from "../src/editor/illustration3d-scenes.mjs";
import { svgContext } from "../src/editor/illustration3d-svg.mjs";
import { buildFrameContext, readableFrameText } from "../sidecar/frame-context.mjs";

const reference = await fs.readFile(new URL("../3d-illustration.tsx", import.meta.url), "utf8");
const names = [...reference.matchAll(/group: "[^"]+", name: "([^"]+)"/g)].map((m) => m[1]);
assert.equal(names.length, 23);
assert.deepEqual(Object.values(illustration3DModels).map((m) => m.label), names);
const at = (spec, t) => {
  const ctx = svgContext();
  paintIllustration3D(ctx, normalizeIllustration3D(spec), t);
  return ctx.svg(900, 620);
};

for (const [scene, model] of Object.entries(illustration3DModels)) {
  const spec = normalizeIllustration3D({ scene });
  const snapshot = decodeURIComponent(illustration3DSvg(spec).split(",")[1]);
  assert.equal(snapshot, at(spec, 0));
  assert.ok(snapshot.includes(model.label));
  assert.doesNotMatch(snapshot, /NaN|Infinity|undefined/);
  // Decode each actual standalone SVG as an image, not just its source string.
  const raster = await sharp(Buffer.from(snapshot)).png().toBuffer();
  assert.ok(raster.length > 1000, scene);
  const thumb = await sharp(Buffer.from(decodeURIComponent(illustration3DThumbnail({ scene }).split(",")[1]))).png().toBuffer();
  assert.ok(thumb.length > 500, `Thumbnail: ${scene}`);
  const later = at(spec, 1.6);
  at(spec, 12); at({ scene: "piston" }, 4);
  assert.equal(later, at(spec, 1.6), `Deterministic seeking: ${scene}`);
  if (model.animated) assert.notEqual(later, snapshot, `Motion: ${scene}`);
  else assert.equal(later, snapshot, `Static: ${scene}`);
  assert.equal(at({ ...spec, animate: false }, 1.6), at({ ...spec, animate: false }, 0));
  for (const endpoint of ["min", "max"])
    for (const yaw of [-180, 0, 180]) {
      const parameters = Object.fromEntries(model.parameters.map((p) => [p.k, p[endpoint]]));
      const edge = at({ scene, parameters, yaw, pitch: endpoint === "min" ? 20 : 83 }, 2);
      assert.doesNotMatch(edge, /NaN|Infinity|undefined/, `${scene} ${endpoint} ${yaw}`);
    }
  assert.notEqual(at({ ...spec, yaw: 90 }, 0), snapshot, `Orbit: ${scene}`);
}

for (const bad of [null, [], { scene: "constructor" }, { scene: "toString" }, { scene: 1 }, { zoom: NaN }, { yaw: Infinity }, { pitch: 0 }, { animate: "true" }, { parameters: { code: "run()" } }, { scene: "bandul", parameters: { a: 60 } }, { scene: "atom", parameters: { Z: 1.5 } }, { scene: "molekul", parameters: { k: 2.5 } }])
  assert.throws(() => normalizeIllustration3D(bad));

const cube = normalizeIllustration3D({ scene: "kubus", parameters: { s: 5 } });
const svg = decodeURIComponent(illustration3DSvg(cube));
assert.match(svg, /125/); assert.match(svg, /150/);
const scene = illustration3DScenes;
assert.match(scene.bulan.results({}, 5, 0).join(" "), /Bulan baru/);
assert.match(scene.bulan.results({}, 5, 0.5).join(" "), /Purnama/);
assert.match(scene.piston.results({}, 3.5).join(" "), /2 × tekanan awal/);
const context = buildFrameContext({ metadata: {}, elements: [
  { id: "f", t: "frame", n: "Lesson", x: 0, y: 0, w: 1000, h: 1000 },
  { id: "cube", fid: "f", t: "img", n: "Kubus · 3D", x: 0, y: 0, w: 900, h: 620, illustration3d: cube, src: illustration3DSvg(cube) },
] });
assert.equal(context.frames[0].layers[0].teaching.model, "Kubus · 3D");
assert.match(readableFrameText(context), /125/);
assert.doesNotMatch(JSON.stringify(context), /data:image/);
console.log("23 reference scenes: SVG decoding, parameter bounds, deterministic motion, orbit, formulas, and semantic context passed.");
