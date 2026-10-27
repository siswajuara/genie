import assert from "node:assert/strict";
import {
  learningModels,
  normalizeLearning,
  learningMetrics,
} from "../sidecar/learning.mjs";
import {
  physicsModels,
  normalizePhysics,
  physicsState,
} from "../sidecar/science.mjs";
import {
  learningDrawing,
  learningSvg,
} from "../src/editor/learning-drawing.mjs";
import { physicsDrawing } from "../src/editor/physics-drawing.mjs";
import { blendColor, focusColor } from "../src/editor/teaching-motion.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
assert.equal(Object.keys(learningModels).length, 40);
assert.equal(Object.keys(physicsModels).length, 20);
close(
  learningMetrics({ kind: "regular-polygon", sides: 4, side: 3 }).polygonArea,
  9,
);
close(
  learningMetrics({ kind: "regular-polygon", sides: 6, side: 2 }).interiorSum,
  720,
);
close(learningMetrics({ kind: "cube-net", side: 4 }).surface, 96);
assert.deepEqual(learningMetrics({ kind: "place-value", number: 2050 }), {
  thousands: 2,
  hundreds: 0,
  tens: 5,
  ones: 0,
});
close(
  learningMetrics({ kind: "multiplication-array", rows: 3, columns: 4 }).total,
  12,
);
assert.deepEqual(learningMetrics({ kind: "ratio", first: 6, second: 9 }), {
  first: 2,
  second: 3,
});
close(
  learningMetrics({
    kind: "balance-equation",
    coefficient: 2,
    constant: 3,
    answer: 4,
  }).rightSide,
  11,
);
close(
  physicsState(
    {
      kind: "accelerated-motion",
      initialVelocity: 0,
      acceleration: 2,
      distance: 20,
      loop: false,
    },
    2,
  ).x,
  4,
);
close(
  physicsState(
    {
      kind: "accelerated-motion",
      initialVelocity: 0,
      acceleration: 2,
      distance: 20,
      loop: false,
    },
    2,
  ).speed,
  4,
);
close(
  physicsState({ kind: "inclined-plane", mass: 2, angle: 30, gravity: 10 }, 0)
    .parallel,
  10,
);
close(
  physicsState({ kind: "hydraulic", force: 100, area1: 0.01, area2: 0.04 }, 0)
    .outputForce,
  400,
);
close(
  physicsState(
    { kind: "hydrostatic-pressure", fluidDensity: 1000, depth: 2, gravity: 10 },
    0,
  ).pressure,
  20000,
);
close(
  physicsState({ kind: "friction", mass: 2, coefficient: 0.3, gravity: 10 }, 0)
    .friction,
  6,
);
close(
  physicsState({ kind: "refraction", index1: 1, index2: 2, angle: 30 }, 0)
    .refraction,
  (Math.asin(0.25) * 180) / Math.PI,
);
assert.equal(
  physicsState({ kind: "refraction", index1: 1.5, index2: 1, angle: 60 }, 0)
    .totalReflection,
  true,
);
close(
  physicsState(
    { kind: "series-circuit", voltage: 6, resistance1: 2, resistance2: 4 },
    0,
  ).current,
  1,
);
close(
  physicsState({ kind: "series-circuit" }, 0).voltage1 +
    physicsState({ kind: "series-circuit" }, 0).voltage2,
  6,
);
for (const p of [
  { kind: "fraction-addition", first: 3, second: 3, denominator: 4 },
  { kind: "pie-chart", values: [0, 0], labels: ["A", "B"] },
  { kind: "pie-chart", values: [1, 2], labels: ["A", "A"] },
  { kind: "affix", root: "baca", prefix: "mem", suffix: "", result: "salah" },
  { kind: "venn", leftOnly: ["kucing"], both: ["kucing"] },
])
  assert.throws(() => normalizeLearning(p));
assert.throws(() =>
  normalizePhysics({
    kind: "longitudinal-wave",
    amplitude: 0.3,
    wavelength: 1,
  }),
);
function finite(o) {
  if (typeof o === "number") assert.ok(Number.isFinite(o));
  else if (Array.isArray(o)) o.forEach(finite);
  else if (o && typeof o === "object") Object.values(o).forEach(finite);
}
for (const kind of Object.keys(learningModels)) {
  const start = learningDrawing({ kind }, 0),
    words = start.filter((s) => s.t === "text").map((s) => s.value);
  for (const t of [0, 0.01, 0.5, 1.29, 1.3, 1.31, 2.6, 7.8, 13]) {
    const shapes = learningDrawing({ kind }, t);
    finite(shapes);
    assert.equal(shapes.length, start.length, kind);
    assert.deepEqual(
      shapes.filter((s) => s.t === "text").map((s) => s.value),
      words,
      `${kind} changed its lesson data while animating`,
    );
  }
  assert.notDeepEqual(start, learningDrawing({ kind }, 1.7), kind);
  assert.deepEqual(
    learningDrawing({ kind, animate: false }, 0),
    learningDrawing({ kind, animate: false }, 100),
  );
  for (const color of ["#abc", "#1234", "#112866", "#11286680"])
    assert.ok(
      !/NaN|Infinity/.test(decodeURIComponent(learningSvg({ kind }, color))),
    );
}
for (const kind of Object.keys(physicsModels))
  for (const t of [0, 0.01, 1.3, 6, 100]) finite(physicsDrawing({ kind }, t));
assert.equal(blendColor("#abc", "#ffffff", 0), "#aabbcc");
assert.match(blendColor("#1234", "#ffffff", 0.5), /^#[\da-f]{8}$/);
assert.ok(
  focusColor(0, 3, 1.299) !== focusColor(0, 3, 1.301) ||
    focusColor(0, 3, 1.29) === focusColor(0, 3, 1.31),
);

const pieAt0 = learningDrawing({ kind: "pie-chart" }, 0),
  pieAt1 = learningDrawing({ kind: "pie-chart" }, 1.7);
const sectors = (shapes) =>
  shapes.filter((s) => s.t === "path").map((s) => s.fill);
assert.deepEqual(sectors(pieAt0), ["#98bcff", "#ffe58d", "#9ed8c0"]);
assert.deepEqual(sectors(pieAt0), sectors(pieAt1));
const particleArrow = physicsDrawing({ kind: "longitudinal-wave" }, 0).find(
  (s) => s.t === "line" && s.y1 === 310 && s.y2 === 310,
);
assert.ok(
  particleArrow.x2 > particleArrow.x1,
  "Central particle initially moves right, as the analytical displacement increases.",
);
const chargeAt1 = physicsDrawing({ kind: "series-circuit" }, 1.7).find(
    (s) => s.t === "ellipse",
  ),
  chargeAt2 = physicsDrawing({ kind: "series-circuit" }, 1.8).find(
    (s) => s.t === "ellipse",
  );
assert.equal(chargeAt1.cy, 350);
assert.ok(
  chargeAt2.cx < chargeAt1.cx,
  "Conventional current flows left along the bottom return wire.",
);

console.log(
  "PASS: 60 models, known expanded-model answers, invariant lesson data, deterministic continuous emphasis, static mode, safe colors and time samples.",
);
