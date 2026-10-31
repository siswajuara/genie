import assert from "node:assert/strict";
import {
  buildScriptPrompt,
  parseGenerationResult,
} from "../sidecar/generate.mjs";
import { parseComposition } from "../sidecar/scene-composition.mjs";

const scene = {
  useCase: "content",
  tone: "warm",
  seconds: 6,
  narrate: true,
  note: "Show the process",
  slots: [],
  composition: {
    width: 1080,
    height: 1920,
    assets: [
      {
        ref: "asset-1",
        name: "Reading owl",
        description: "Owl reading a book",
        kind: "image",
      },
    ],
  },
};
const request = {
  content: "Teach parents how to discuss a story with their child.",
  language: "en",
  narration: true,
  scenes: [scene],
};
const story = {
  idea: "Ask about a story",
  format: "Question and resolution",
  device: "A book becomes a question",
  look: "Blue ink and warm paper",
  palette: ["#ffffff", "#0757ec", "#1b2a7a"],
};
const composition = {
  background: "#ffffff",
  transition: { type: "crossfade", duration: 0.4 },
  layers: [
    {
      type: "text",
      name: "Question",
      role: "headline",
      text: "What happens next?",
      x: 0,
      y: 0,
      w: 100,
      h: 20,
      fontSize: 6,
      weight: 800,
      align: "left",
      color: "#1b2a7a",
    },
    {
      type: "asset",
      name: "Reading owl",
      assetRef: "asset-1",
      x: 30,
      y: 30,
      w: 40,
      h: 40,
      animation: {
        start: 0.5,
        enter: "pop",
        duration: 0.4,
        motion: "breathe",
        amount: 2,
        keyframes: [
          { time: 0, dx: -10, dy: 0, scale: 0.8, opacity: 1 },
          { time: 3, dx: 10, dy: 0, scale: 1, opacity: 1 },
        ],
      },
    },
    {
      type: "learning",
      name: "Fraction",
      x: 0,
      y: 72,
      w: 35,
      h: 25,
      settings: { kind: "fraction" },
    },
  ],
};
const frame = {
  useCase: "content",
  title: "Discuss the story",
  texts: [],
  narration: "[warm] Read together and ask your child what might happen next.",
  motionPlan: "build",
  composition,
  direction: {
    action: "The owl moves from reading to a question.",
    framing: "medium",
    bridge: "Hold the question before the answer.",
  },
};
const result = {
  post: { name: "Read together", caption: "Ask about the story." },
  story,
  frames: [frame],
};
const parsed = parseGenerationResult(result, request);
assert.equal(parsed.frames[0].composition.layers[1].assetRef, "asset-1");
assert.equal(
  parsed.frames[0].composition.layers[1].animation.keyframes[1].dx,
  10,
);
assert.deepEqual(parsed.story, story);
assert.equal(parsed.frames[0].direction.framing, "medium");
const prompt = buildScriptPrompt({
  ...request,
  scenes: [scene, { ...scene, useCase: "answer" }],
});
const user = JSON.parse(prompt.user);
assert.equal(user.assetCatalogs.length, 1);
assert.equal(user.scenes[0].composition.assetCatalog, 0);
assert.equal(user.scenes[1].composition.assetCatalog, 0);
assert.equal(user.scenes[0].composition.assets, undefined);
assert.ok(user.teachingCatalog.learning);
for (const rule of [
  /Animate workflow/,
  /storyboard/,
  /keyframes/,
  /siswajuara\.com/,
  /generic gradient/,
  /text-only/,
])
  assert.match(prompt.system, rule);

for (const mutate of [
  (c) => {
    c.layers[0].x = -1;
  },
  (c) => {
    c.layers[0].w = 101;
  },
  (c) => {
    c.layers[0].h = NaN;
  },
  (c) => {
    c.layers[0].fontSize = 0.1;
  },
  (c) => {
    c.layers[0].id = "invented-id";
  },
  (c) => {
    c.layers[0].src = "https://example.test/image.png";
  },
  (c) => {
    c.layers[1].assetRef = "invented-asset";
  },
  (c) => {
    c.layers[1].animation.enter = "javascript";
  },
  (c) => {
    c.layers[1].animation.start = 6;
  },
  (c) => {
    c.layers[1].animation.keyframes[1].time = 6;
  },
  (c) => {
    c.layers[1].animation.keyframes[1].time = 0;
  },
  (c) => {
    c.layers[1].animation.keyframes[1].dx = 80;
  },
  (c) => {
    c.layers[1].animation.keyframes[1].code = "evil()";
  },
  (c) => {
    c.layers[2].settings = { kind: "invented-model" };
  },
  (c) => {
    c.layers = [];
  },
  (c) => {
    c.layers = Array(25).fill(c.layers[0]);
  },
  (c) => {
    c.transition.type = "script";
  },
]) {
  const invalid = structuredClone(composition);
  mutate(invalid);
  assert.throws(() => parseComposition(invalid, scene));
}
for (const field of ["story", "composition", "direction"]) {
  const invalid = structuredClone(result);
  if (field === "story") delete invalid.story;
  else delete invalid.frames[0][field];
  assert.throws(() => parseGenerationResult(invalid, request));
}
const closingRequest = {
  ...request,
  scenes: [{ ...scene, useCase: "closing" }],
};
const closing = structuredClone(result);
closing.frames[0].useCase = "closing";
assert.throws(
  () => parseGenerationResult(closing, closingRequest),
  /siswajuara\.com/,
);
closing.frames[0].composition.layers[0].text = "Continue at siswajuara.com";
assert.throws(
  () => parseGenerationResult(closing, closingRequest),
  /siswajuara dot com/,
);
closing.frames[0].narration =
  "[warm] Keep exploring the story together and continue at siswajuara dot com.";
assert.equal(
  parseGenerationResult(closing, closingRequest).frames[0].useCase,
  "closing",
);
assert.equal(
  parseGenerationResult(closing, { ...closingRequest, narration: false })
    .frames[0].narration,
  "",
);
const invalidAsset = structuredClone(request);
invalidAsset.scenes[0].composition.assets[0].src = "private/file.png";
assert.throws(() => buildScriptPrompt(invalidAsset), /declarative fields/);
assert.throws(
  () =>
    buildScriptPrompt({
      ...request,
      scenes: [
        {
          ...scene,
          slots: [
            { id: "text", label: "Title", example: "Sample", maxChars: 30 },
          ],
        },
      ],
    }),
  /cannot include template slots/,
);
console.log(
  "PASS: blank-scene composition, shared metadata catalogs, Animate story/direction, typed layers, bounded motion, strict asset references, closing CTA, and malformed output rejection.",
);
