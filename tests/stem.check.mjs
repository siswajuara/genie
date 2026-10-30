import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { learningModels, normalizeLearning, learningMetrics } from "../sidecar/learning.mjs";
import { physicsModels, normalizePhysics, physicsState } from "../sidecar/science.mjs";
import { learningDrawing, learningSvg } from "../src/editor/learning-drawing.mjs";
import { physicsDrawing, physicsSvg } from "../src/editor/physics-drawing.mjs";
import { buildScriptPrompt } from "../sidecar/generate.mjs";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const finite = (value) => {
  if (typeof value === "number") assert.ok(Number.isFinite(value));
  else if (typeof value === "string") assert.ok(!/NaN|Infinity/.test(value));
  else if (value && typeof value === "object") Object.values(value).forEach(finite);
};
close(learningMetrics({ kind: "equal-sharing", groups: 5, perGroup: 4 }).total, 20);
assert.deepEqual(learningMetrics({ kind: "equivalent-fractions", numerator: 2, denominator: 3, multiplier: 4 }), { numerator: 8, denominator: 12 });
close(learningMetrics({ kind: "pythagoras", legA: 5, legB: 12 }).hypotenuse, 13);
close(learningMetrics({ kind: "unit-circle", degrees: 60 }).cosine, 0.5);
close(learningMetrics({ kind: "unit-circle", degrees: 270 }).sine, -1);
close(learningMetrics({ kind: "probability-bag", favorable: 3, total: 8 }).probability, 0.375);
close(learningMetrics({ kind: "probability-bag", favorable: 0 }).probability, 0);
close(learningMetrics({ kind: "probability-bag", favorable: 8 }).probability, 1);
const vector = learningMetrics({ kind: "vector-addition", vectorAX: 3, vectorAY: 1, vectorBX: -1, vectorBY: 2 });
close(vector.resultX, 2); close(vector.resultY, 3); close(vector.magnitude, Math.sqrt(13));
for (const raw of [
  { kind: "equal-sharing", groups: 1.5 },
  { kind: "equivalent-fractions", numerator: 4, denominator: 3 },
  { kind: "quadratic-function", quadraticA: 0 },
  { kind: "quadratic-function", quadraticA: -0.01 },
  { kind: "probability-bag", favorable: 9, total: 8 },
]) assert.throws(() => normalizeLearning(raw));

close(physicsState({ kind: "sound-travel", loop: false }, 100).time, 2);
close(physicsState({ kind: "sound-travel", loop: false }, 100).x, 680);
close(physicsState({ kind: "heating", loop: false }, 3).heat, 3000);
close(physicsState({ kind: "heating", loop: false }, 3).temperature, 26);
close(physicsState({ kind: "heating", loop: false }, 100).temperature, 40);
const expansion = physicsState({ kind: "thermal-expansion", loop: false }, 6);
close(expansion.expansion, 0.0006);
close(expansion.temperatureRise, 50);
const circuit = physicsState({ kind: "parallel-circuit" }, 0);
close(circuit.current1, 2); close(circuit.current2, 1);
close(circuit.current, 3); close(circuit.resistance, 2); close(circuit.power, 18);
for (const time of [0, 0.1, 0.5, 0.9, 1, 20]) {
  const s = physicsState({ kind: "energy-conservation", loop: false }, time);
  close(s.potential + s.kinetic, 50);
}
const end = physicsState({ kind: "energy-conservation", loop: false }, 100);
close(end.y, 0); close(end.kinetic, 50);
for (const masses of [[1, 1], [1, 2], [10, 0.1], [0.1, 10]])
  for (const [velocity1, velocity2] of [[2, 0], [3, -2], [0.1, -10]]) {
    const p = { kind: "elastic-collision", mass1: masses[0], mass2: masses[1], velocity1, velocity2, loop: false };
    const initial = physicsState(p, 0);
    for (const time of [initial.collisionTime - 1e-9, initial.collisionTime, initial.collisionTime + 1e-9, 100]) {
      const s = physicsState(p, time);
      close(s.momentum, initial.momentum); close(s.kinetic, initial.kinetic);
      assert.ok(s.x <= s.x2 + 1e-8, "Colliding masses must separate after impact.");
    }
  }
const collision = physicsState({ kind: "elastic-collision", loop: false }, 3);
close(collision.v1, 0); close(collision.v2, 2);

// Newton 1: balanced forces preserve both rest and uniform motion.
for (const initialVelocity of [0, 2, 20])
  for (const force of [0, 10, 100]) {
    const p = { kind: "newton-first", initialVelocity, force, loop: false };
    for (const time of [0, 0.5, 100]) {
      const s = physicsState(p, time);
      close(s.netForce, 0); close(s.acceleration, 0); close(s.speed, initialVelocity);
      close(s.x, initialVelocity * s.time);
    }
  }
const second = physicsState({ kind: "newton-second", mass: 2, force: 6, loop: false }, 2);
close(second.acceleration, 3); close(second.speed, 6); close(second.x, 6);
close(physicsState({ kind: "newton-second", mass: 4, force: 6 }, 0).acceleration, 1.5);
close(physicsState({ kind: "newton-second", mass: 2, force: 12 }, 0).acceleration, 6);
for (const initialVelocity of [0, 2]) {
  const p = { kind: "newton-second", force: 0, initialVelocity, loop: false };
  const s = physicsState(p, 100);
  finite(s); close(s.acceleration, 0); close(s.speed, initialVelocity);
  close(s.x, initialVelocity * s.time);
}
// Newton 3: equal opposite forces, unequal accelerations, no external impulse.
for (const [mass1, mass2] of [[2, 4], [0.1, 20], [20, 0.1]])
  for (const time of [0, 0.5, 100]) {
    const s = physicsState({ kind: "newton-third", mass1, mass2, force: 4, loop: false }, time);
    close(s.force1, -s.force2);
    close(s.acceleration1 * mass1, -4); close(s.acceleration2 * mass2, 4);
    close(s.momentum, 0); close(mass1 * s.x + mass2 * s.x2, 0);
    assert.ok(s.x <= 0 && s.x2 >= 0);
    if (time === 100) close(s.x2 - s.x, 12);
  }
for (const [time, stage] of [[0, 0], [2, 1], [4, 2], [6, 3], [100, 3]]) {
  const s = physicsState({ kind: "photosynthesis", period: 8, loop: false }, time);
  close(s.stage, stage);
  assert.ok(s.progress >= 0 && s.progress <= 1);
}
assert.equal(physicsModels.photosynthesis.subject, "biology");
const photoLabels = physicsDrawing({ kind: "photosynthesis" }, 6).filter(s => s.t === "text").map(s => s.value).join(" ");
assert.match(photoLabels, /6CO₂ \+ 6H₂O → C₆H₁₂O₆ \+ 6O₂/);
assert.match(photoLabels, /O₂ berasal dari air/);

const source = JSON.parse(await fs.readFile(new URL("../design-references/stem-presets.json", import.meta.url)));
const schema = JSON.parse(await fs.readFile(new URL("../sidecar/canvas.schema.json", import.meta.url)));
assert.equal(source.length, 24);
assert.equal(new Set(source.map(s => s.identifier)).size, 24);
const learningKinds = [...new Set(source.filter(s => s.learning).map(s => s.learning.kind))];
const physicsKinds = [...new Set(source.filter(s => s.physics).map(s => s.physics.kind))];
assert.equal(learningKinds.length, 8); assert.equal(physicsKinds.length, 10);
for (const [kinds, models, normalize, drawing, svg, schemaKey] of [
  [learningKinds, learningModels, normalizeLearning, learningDrawing, learningSvg, "learningSpec"],
  [physicsKinds, physicsModels, normalizePhysics, physicsDrawing, physicsSvg, "physicsSpec"],
]) for (const kind of kinds) {
  const model = models[kind];
  const contract = schema.$defs[schemaKey].oneOf.find(s => s.properties.kind.const === kind);
  assert.ok(contract, `${kind} missing backup schema`);
  for (const [key, [minimum, maximum]] of Object.entries(model.ranges)) {
    assert.equal(contract.properties[key].minimum, minimum);
    assert.equal(contract.properties[key].maximum, maximum);
    for (const value of [minimum, maximum]) {
      let p;
      try { p = normalize({ kind, [key]: value }); } catch { continue; } // Cross-field constraints checked above.
      for (const t of [0, 1.7, 100]) {
        finite(drawing(p, t));
        assert.ok(!/NaN|Infinity/.test(decodeURIComponent(svg(p))));
      }
    }
  }
  if (schemaKey === "physicsSpec") {
    const p = { kind, loop: false }, first = physicsState(p, 1.7);
    assert.deepEqual(first, physicsState(p, 1.7));
    if (first.duration) {
      assert.deepEqual(physicsState(p, first.duration), physicsState(p, first.duration + 100));
      close(physicsState({ kind, loop: true }, first.duration).time, 0);
    }
  }
}
// Supported models must be discoverable to generation without a provider request.
const prompt = buildScriptPrompt({ content: "SMA trigonometri dan tumbukan lenting sempurna.", language: "id", narration: false, scenes: [{ useCase: "content", tone: "warm", seconds: 8, narrate: false, note: "", allowVisual: true, slots: [{ id: "h", label: "Headline", example: "Konsep", maxChars: 100 }] }] });
const catalog = JSON.parse(prompt.user).teachingCatalog;
for (const kind of learningKinds) assert.ok(catalog.learning[kind]);
for (const kind of physicsKinds) assert.ok(catalog.physics[kind]);
console.log("PASS: 18 STEM models, 24 level-tagged lessons, known answers, conservation laws, endpoints, parameter boundaries, backup schema and generation catalog; no provider calls.");
