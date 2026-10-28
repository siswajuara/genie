import assert from "node:assert/strict";
import {
  normalizePhysics,
  normalizeLatex,
  physicsState,
  detectLatexSource,
} from "../sidecar/science.mjs";
import { textToEquation } from "../src/editor/science.ts";
import { renderLatex } from "../src/editor/latex-renderer.mjs";
import {
  buildScriptPrompt,
  parseGenerationResult,
} from "../sidecar/generate.mjs";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const spring = {
  kind: "spring",
  mass: 2,
  springConstant: 8,
  amplitude: 0.4,
  damping: 0,
};
close(physicsState(spring, 0).x, 0.4);
close(physicsState(spring, Math.PI / 4).x, 0);
close(physicsState(spring, Math.PI).x, 0.4);
for (const damping of [0.1, 2, 3]) {
  const x = physicsState({ ...spring, damping }, 30).x;
  assert.ok(Math.abs(x) < 0.021);
}
for (const time of [0, 0.25, 1, 2, 5]) {
  const state = physicsState({ kind: "pendulum", length: 2, angle: 20 }, time);
  close(Math.hypot(state.x, state.y), 2);
}
const projectile = {
  kind: "projectile",
  velocity: 10,
  angle: 30,
  gravity: 10,
  loop: false,
};
const launch = physicsState(projectile, 0),
  land = physicsState(projectile, 100);
close(launch.flight, 1);
close(land.y, 0);
close(land.x, 5 * Math.sqrt(3));
close(physicsState(projectile, 0.5).y, 1.25);
const quarter = physicsState({ kind: "orbit", radius: 2, period: 4 }, 1);
close(quarter.x, 0);
close(quarter.y, 2);
close(quarter.speed, Math.PI);
for (const bad of [
  { kind: "constructor" },
  { kind: "orbit", period: 0 },
  { kind: "spring", mass: -1 },
  { kind: "pendulum", angle: 45 },
  { kind: "projectile", gravity: NaN },
  { kind: "spring", code: "run()" },
])
  assert.throws(() => normalizePhysics(bad));
assert.equal(normalizeLatex({ source: "$$\\frac12$$" }).source, "\\frac12");
for (const source of [
  "\\input{x}",
  "\\href{https://x}{x}",
  "\\require{html}",
  "",
])
  assert.throws(() => normalizeLatex({ source }));
for (const source of [
  "\\frac12+\\frac14=\\frac34",
  "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",
  "\\int_0^1 x^2\\,dx",
  "\\begin{aligned}2x+3&=11\\\\x&=4\\end{aligned}",
]) {
  const rendered = await renderLatex({ source });
  const svg = decodeURIComponent(rendered.src.split(",").slice(1).join(","));
  assert.match(svg, /<path/);
  assert.match(svg, /viewBox=/);
  assert.ok(!/<script|<foreignObject|href=["']https?:/i.test(svg));
  assert.ok(rendered.width > 0 && rendered.height > 0);
}
await assert.rejects(renderLatex({ source: "\\notACommand{x}" }));
const request = {
  content:
    "Explain projectile flight time using ten metres per second, thirty degrees, and gravity ten.",
  language: "en",
  narration: false,
  scenes: [
    {
      useCase: "answer",
      tone: "calm",
      seconds: 6,
      narrate: false,
      note: "Solve the same question.",
      slots: [
        {
          id: "eq",
          label: "LaTeX equation",
          role: "latex",
          example: "t=1",
          maxChars: 200,
        },
      ],
      diagrams: [{ id: "diagram", example: projectile }],
    },
  ],
};
const result = {
  post: { name: "Flight time", caption: "Resolve vertical motion." },
  frames: [
    {
      useCase: "answer",
      title: "One second",
      texts: [{ id: "eq", text: "t=\\frac{2(10)\\sin30^\\circ}{10}=1" }],
      narration: "",
      physics: [{ id: "diagram", settings: projectile }],
    },
  ],
};
const prompt = buildScriptPrompt(request);
assert.match(prompt.system, /math-only LaTeX/);
assert.match(prompt.system, /SI units/);
assert.match(prompt.system, /same question/);
assert.match(prompt.user, /"gravity":\[0.1,30\]/);
assert.equal(
  parseGenerationResult(result, request).frames[0].physics[0].settings.velocity,
  10,
);
for (const physics of [
  [{ id: "unknown", settings: projectile }],
  [{ id: "diagram", settings: { kind: "orbit" } }],
  [{ id: "diagram", settings: { ...projectile, velocity: -1 } }],
]) {
  assert.throws(() =>
    parseGenerationResult(
      { ...result, frames: [{ ...result.frames[0], physics }] },
      request,
    ),
  );
}
// An omitted echo is repaired from the template instead of failing.
const repaired = parseGenerationResult(
  { ...result, frames: [{ ...result.frames[0], physics: [] }] },
  request,
);
assert.equal(repaired.frames[0].physics[0].settings.velocity, 10);
assert.match(repaired.repaired.join(" "), /Scene 1.*physics/);
// Plain-text math detection for the Convert to equation flow.
assert.equal(detectLatexSource("A_n = A_0 e^{-knT}"), "A_n = A_0 e^{-knT}");
assert.equal(detectLatexSource("Lihat \\frac12 dari kue"), "Lihat \\frac12 dari kue");
assert.equal(detectLatexSource("$x$"), "x");
assert.equal(detectLatexSource("$$a^2+b^2$$"), "a^2+b^2");
assert.equal(detectLatexSource("\\(\\int_0^1 x\\,dx\\)"), "\\int_0^1 x\\,dx");
assert.equal(detectLatexSource("Halo apa kabar?"), null);
assert.equal(detectLatexSource("file_name test"), null);
assert.equal(detectLatexSource("costs $5 and $6 total"), null);
assert.equal(detectLatexSource(""), null);
assert.equal(detectLatexSource("C:\\new folder"), null);
const converted = await textToEquation(
  { id: "t", t: "text", n: "T", x: 0, y: 0, w: 600, h: 130, text: "A_n" },
  detectLatexSource("Diketahui A_n = A_0 e^{-knT}."),
);
assert.equal(converted.t, "img");
assert.equal(converted.text, "");
assert.equal(converted.latex.source, "Diketahui A_n = A_0 e^{-knT}.");
assert.match(converted.src, /^data:image\/svg\+xml/);
console.log(
  "PASS: analytical physics, SI parameter bounds, local LaTeX SVG, invalid math, and science generation contracts; no provider calls.",
);
