import assert from "node:assert/strict";
import {
  learningModels,
  normalizeLearning,
  learningMetrics,
} from "../sidecar/learning.mjs";
import {
  physicsModels,
  physicsState,
  normalizePhysics,
} from "../sidecar/science.mjs";
import {
  learningDrawing,
  learningSvg,
} from "../src/editor/learning-drawing.mjs";
import { physicsDrawing, physicsSvg } from "../src/editor/physics-drawing.mjs";
import {
  buildScriptPrompt,
  parseGenerationResult,
} from "../sidecar/generate.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
for (const [kind, params, area, perimeter] of [
  ["square", { side: 3 }, 9, 12],
  ["rectangle", { width: 6, height: 4 }, 24, 20],
  ["triangle", { base: 3, height: 4 }, 6, 12],
  ["rhombus", { diagonal1: 8, diagonal2: 6 }, 24, 20],
]) {
  const m = learningMetrics({ kind, ...params });
  close(m.area, area);
  close(m.perimeter, perimeter);
}
for (const [kind, params, volume, surface] of [
  ["cube", { side: 4 }, 64, 96],
  ["cuboid", { width: 2, height: 3, depth: 4 }, 24, 52],
  ["cone", { radius: 3, height: 4 }, 12 * Math.PI, 24 * Math.PI],
  ["cylinder", { radius: 3, height: 5 }, 45 * Math.PI, 48 * Math.PI],
  ["sphere", { radius: 3 }, 36 * Math.PI, 36 * Math.PI],
  ["triangular-prism", { base: 3, height: 4, depth: 5 }, 30, 72],
  ["square-pyramid", { side: 6, height: 4 }, 48, 96],
]) {
  const m = learningMetrics({ kind, ...params });
  close(m.volume, volume);
  close(m.surface, surface);
}
close(
  physicsState(
    { kind: "linear-motion", velocity: 2, distance: 10, loop: false },
    3,
  ).x,
  6,
);
close(
  physicsState(
    { kind: "linear-motion", velocity: 2, distance: 10, loop: false },
    20,
  ).x,
  10,
);
close(
  physicsState({ kind: "free-fall", height: 5, gravity: 10, loop: false }, 0.5)
    .y,
  3.75,
);
close(
  physicsState({ kind: "free-fall", height: 5, gravity: 10, loop: false }, 20)
    .speed,
  10,
);
close(
  physicsState(
    { kind: "lever", loadMass: 6, loadArm: 1, effortArm: 3, gravity: 10 },
    0,
  ).effort,
  20,
);
close(
  physicsState(
    { kind: "pulley", loadMass: 4, supportingRopes: 4, gravity: 10 },
    0,
  ).effort,
  10,
);
const floating = physicsState(
  {
    kind: "buoyancy",
    objectDensity: 600,
    fluidDensity: 1000,
    volume: 0.002,
    gravity: 10,
  },
  0,
);
close(floating.weight, 12);
close(floating.buoyantForce, 12);
close(floating.submerged, 0.6);
const sinking = physicsState(
  {
    kind: "buoyancy",
    objectDensity: 1200,
    fluidDensity: 1000,
    volume: 0.002,
    gravity: 10,
  },
  0,
);
close(sinking.weight, 24);
close(sinking.buoyantForce, 20);
close(physicsState({ kind: "wave", wavelength: 2, frequency: 3 }, 0).speed, 6);
close(
  physicsState({ kind: "circuit", voltage: 6, resistance: 3 }, 0).current,
  2,
);
close(
  physicsState({ kind: "circuit", voltage: 6, resistance: 3 }, 0).power,
  12,
);
close(physicsState({ kind: "reflection", angle: 35 }, 0).reflected, 35);
for (const bad of [
  { kind: "cube", side: 0 },
  { kind: "fraction", numerator: 5, denominator: 4 },
  { kind: "number-line", minimum: 5, maximum: 3 },
  { kind: "number-line", minimum: 0, maximum: 10, value: -2 },
  { kind: "trapezoid", base: 2, top: 4 },
  { kind: "syllables", word: "kelapa", parts: ["ke", "la"] },
  { kind: "sentence", parts: ["Siti", "membaca"] },
  { kind: "bar-chart", labels: ["A", "B"], values: [-1, 2] },
  { kind: "word-family", relation: "random" },
  { kind: "sphere", code: "run()" },
])
  assert.throws(() => normalizeLearning(bad));
assert.throws(() => normalizePhysics({ kind: "pulley", supportingRopes: 2.5 }));
function finite(value) {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === "object")
    Object.values(value).forEach(finite);
}
for (const kind of Object.keys(learningModels)) {
  const spec = { kind };
  finite(learningDrawing(spec, 0));
  finite(learningDrawing(spec, 1.7));
  assert.notDeepEqual(
    learningDrawing(spec, 0),
    learningDrawing(spec, 1.7),
    `${kind} should animate emphasis`,
  );
  assert.deepEqual(learningDrawing(spec, 1.7), learningDrawing(spec, 1.7));
  assert.deepEqual(
    learningDrawing({ kind, animate: false }, 0),
    learningDrawing({ kind, animate: false }, 9),
  );
  const svg = decodeURIComponent(
    learningSvg(spec).split(",").slice(1).join(","),
  );
  assert.match(svg, /<title>/);
  assert.ok(
    !/NaN|Infinity|<script|<foreignObject|https?:\/\/(?!www.w3.org)/.test(svg),
  );
}
for (const kind of Object.keys(physicsModels)) {
  finite(physicsDrawing({ kind }, 1.7));
  assert.ok(physicsSvg({ kind }).startsWith("data:image/svg+xml;"));
}
const escaped = decodeURIComponent(
  learningSvg({
    kind: "main-idea",
    idea: "<script>alert(1)</script>",
    details: ["A & B", "C > D"],
  })
    .split(",")
    .slice(1)
    .join(","),
);
assert.ok(!escaped.includes("<script>"));
assert.match(escaped, /&lt;script>/);
const request = {
  content: "Ajarkan volume kubus kepada anak kelas 6 SD.",
  language: "id",
  narration: false,
  scenes: [
    {
      useCase: "content",
      tone: "warm",
      seconds: 6,
      narrate: false,
      note: "Gunakan visual bila membantu.",
      allowVisual: true,
      slots: [
        { id: "head", label: "Headline", example: "Kubus", maxChars: 80 },
      ],
    },
  ],
};
const result = {
  post: {
    name: "Volume kubus",
    caption: "Hitung volume dan periksa hasilnya.",
  },
  frames: [
    {
      useCase: "content",
      title: "Volume kubus",
      texts: [{ id: "head", text: "Volume kubus sisi empat" }],
      narration: "",
      visual: { type: "learning", settings: { kind: "cube", side: 4 } },
    },
  ],
};
const prompt = buildScriptPrompt(request);
assert.match(prompt.system, /NEW editable element/);
assert.match(prompt.system, /S-P-O-K/);
assert.equal(
  Object.keys(JSON.parse(prompt.user).teachingCatalog.learning).length,
  48,
);
assert.deepEqual(
  JSON.parse(prompt.user).teachingCatalog.learning["word-family"].fields
    .relation.enum,
  ["Sinonim", "Antonim", "Imbuhan"],
);
assert.equal(
  JSON.parse(prompt.user).teachingCatalog.learning.sentence.fields.parts
    .maxItems,
  4,
);
assert.equal(
  parseGenerationResult(result, request).frames[0].visual.settings.side,
  4,
);
for (const visual of [
  { type: "learning", settings: { kind: "cube", side: -1 } },
  { type: "learning", settings: { kind: "unknown" } },
  { type: "learning", settings: { kind: "cube" }, x: 0 },
  { type: "javascript", source: "run()" },
])
  assert.throws(() =>
    parseGenerationResult(
      { ...result, frames: [{ ...result.frames[0], visual }] },
      request,
    ),
  );
assert.throws(
  () =>
    parseGenerationResult(result, {
      ...request,
      scenes: [{ ...request.scenes[0], allowVisual: false }],
    }),
  /unrequested/,
);
const withSlot = {
  ...request,
  scenes: [
    {
      ...request.scenes[0],
      learning: [{ id: "lesson", example: { kind: "sentence" } }],
    },
  ],
};
// Omitted diagram echoes are repaired from the template instead of
// discarding the whole sequence.
const repaired = parseGenerationResult(result, withSlot);
assert.equal(repaired.frames[0].learning.length, 1);
assert.equal(repaired.frames[0].learning[0].id, "lesson");
assert.equal(repaired.frames[0].learning[0].settings.kind, "sentence");
assert.match(repaired.repaired.join(" "), /Scene 1.*learning/);
// Corrupt echoes still fail loudly.
for (const learning of [
  [{ id: "lesson", settings: { kind: "cube" } }],
  [{ id: "other", settings: { kind: "sentence" } }],
  "not-an-array",
  [
    { id: "lesson", settings: { kind: "sentence" } },
    { id: "lesson", settings: { kind: "sentence" } },
  ],
])
  assert.throws(
    () =>
      parseGenerationResult(
        { ...result, frames: [{ ...result.frames[0], learning }] },
        withSlot,
      ),
    /AI changed|invalid learning/,
  );
assert.equal(
  parseGenerationResult(
    {
      ...result,
      frames: [
        {
          ...result.frames[0],
          learning: [{ id: "lesson", settings: { kind: "sentence" } }],
        },
      ],
    },
    withSlot,
  ).frames[0].learning[0].settings.parts[0],
  "Siti",
);
console.log(
  "PASS: 78 teaching models, known numeric answers, bounds, safe SVG, deterministic emphasis, and AI-added visual permissions. No provider calls.",
);
