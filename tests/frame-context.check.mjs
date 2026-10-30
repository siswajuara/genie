import assert from "node:assert/strict";
import {
  buildFrameContext,
  validateFrameContext,
  readableFrameText,
  contextCoverage,
} from "../sidecar/frame-context.mjs";
import { buildScriptPrompt } from "../sidecar/generate.mjs";
import { buildNarrationPrompt } from "../sidecar/opencode-narration.mjs";
const svg =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg"><title>Diagram pohon</title><text>Akar &amp; batang</text><text>&#x64; &#97;</text></svg>',
  );
const frame = {
  id: "f",
  t: "frame",
  n: "Pelajaran",
  x: 0,
  y: 0,
  w: 1122,
  h: 1402,
  fill: "#ffffff",
  aiDescription: "Penjelasan bagian tumbuhan.",
  scene: { duration: 6 },
  voiceoverDraft: {
    script: "Draf lama.",
    accountId: "PRIVATE-ACCOUNT",
    voiceId: "private-voice",
  },
  subtitles: [{ id: "cue", start: 0, end: 2, text: "Akar menyerap air." }],
  audioTracks: [
    {
      id: "music",
      name: "Musik pengiring",
      role: "music",
      src: "data:audio/mpeg;base64,PRIVATE-AUDIO",
      start: 0,
      end: 6,
    },
  ],
};
const layers = [
  {
    id: "text",
    t: "text",
    n: "Kalimat",
    fid: "f",
    x: 20,
    y: 20,
    w: 500,
    h: 100,
    text: "[c=#f00]Bagian tumbuhan[/c]",
    lock: true,
  },
  {
    id: "hidden",
    t: "text",
    n: "Catatan tersembunyi",
    fid: "f",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    text: "Akar, batang, daun.",
    hide: true,
    generationRole: "fixed",
  },
  {
    id: "eq",
    t: "img",
    n: "Persamaan",
    fid: "f",
    x: 0,
    y: 120,
    w: 500,
    h: 100,
    latex: { source: "V=s^3" },
    src: "data:image/svg+xml,private-paths",
  },
  {
    id: "learning",
    t: "img",
    n: "Kubus",
    fid: "f",
    x: 0,
    y: 250,
    w: 500,
    h: 300,
    learning: { kind: "cube", side: 4 },
    animation: { start: 1, end: 6 },
  },
  {
    id: "physics",
    t: "img",
    n: "Listrik",
    fid: "f",
    x: 0,
    y: 600,
    w: 500,
    h: 300,
    physics: { kind: "series-circuit" },
  },
  {
    id: "svg",
    t: "img",
    n: "Diagram SVG",
    fid: "f",
    x: 10,
    y: 10,
    w: 100,
    h: 100,
    src: svg,
  },
  {
    id: "photo",
    t: "img",
    n: "Foto",
    fid: "f",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    src: "data:image/png;base64,PRIVATE-PIXELS",
    label: "foto-rahasia.png",
  },
  {
    id: "video",
    t: "video",
    n: "Pertumbuhan",
    fid: "f",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    src: "data:video/mp4;base64,PRIVATE-VIDEO",
    aiDescription: "Video tunas tumbuh dari biji.",
    videoStart: 2,
    videoLoop: true,
  },
  {
    id: "shape",
    t: "rect",
    n: "Kotak",
    fid: "f",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    fill: "#ffcf25",
  },
  {
    id: "line",
    t: "line",
    n: "Panah",
    fid: "f",
    x: 0,
    y: 0,
    w: 100,
    h: 0,
    stroke: "#000000",
  },
  {
    id: "ellipse",
    t: "ellipse",
    n: "Lingkaran",
    fid: "f",
    x: 0,
    y: 0,
    w: 100,
    h: 100,
  },
];
const doc = {
  version: 1,
  metadata: { name: "Canvas tanaman", updatedAt: "" },
  elements: [
    frame,
    ...layers,
    {
      ...frame,
      id: "other",
      n: "Frame lain",
      audioTracks: [],
      voiceoverDraft: undefined,
      subtitles: [],
    },
  ],
};
layers[0].text += " • Contoh literal data:image/svg+xml tanpa byte media.";
const ctx = buildFrameContext(doc, ["text"]);
assert.equal(ctx.frames.length, 1);
assert.equal(ctx.frames[0].layers.length, 11);
assert.equal(ctx.frames[0].appearance.fill, "#ffffff");
assert.equal(ctx.frames[0].layers.find((l) => l.id === "hidden").hide, true);
assert.equal(ctx.frames[0].layers.find((l) => l.id === "text").lock, true);
assert.equal(
  ctx.frames[0].layers.find((l) => l.id === "learning").teaching.metrics.volume,
  64,
);
assert.equal(
  ctx.frames[0].layers.find((l) => l.id === "physics").teaching.stateAtSample
    .current,
  1,
);
assert.deepEqual(
  ctx.frames[0].layers.find((l) => l.id === "svg").media.vectorText,
  ["Diagram pohon", "Akar & batang", "d a"],
);
assert.equal(
  ctx.frames[0].layers.find((l) => l.id === "photo").media.contentStatus,
  "needs-description",
);
assert.equal(
  ctx.frames[0].layers.find((l) => l.id === "video").media.contentStatus,
  "described",
);
for (const secret of [
  "PRIVATE-PIXELS",
  "PRIVATE-AUDIO",
  "PRIVATE-VIDEO",
  "PRIVATE-ACCOUNT",
  "private-voice",
])
  assert.ok(!JSON.stringify(ctx).includes(secret));
assert.match(readableFrameText(ctx), /Akar menyerap air/);
assert.match(readableFrameText(ctx), /Video tunas/);
assert.match(readableFrameText(ctx), /Kotak/);
assert.ok(
  !readableFrameText(ctx).includes("belum dideskripsikan"),
  "undescribed media falls back to sibling visible text, not a placeholder",
);
assert.ok(
  contextCoverage(ctx).mediaNeedingDescription.some((m) => m.id === "photo"),
);
const req = {
  content: "Buat pelajaran bagian tumbuhan untuk kelas empat.",
  language: "id",
  narration: false,
  frameContext: ctx,
  scenes: [
    {
      useCase: "content",
      tone: "warm",
      seconds: 6,
      narrate: false,
      note: "",
      slots: [
        { id: "head", label: "Judul", example: "Tumbuhan", maxChars: 80 },
      ],
    },
  ],
};
assert.equal(
  JSON.parse(buildScriptPrompt(req).user).frameContext.frames[0].layers.length,
  11,
);
assert.equal(
  JSON.parse(
    buildNarrationPrompt({
      texts: "Bagian tumbuhan",
      language: "id",
      seconds: 6,
      frameContext: ctx,
    }).user,
  ).frameContext.frames[0].layers.length,
  11,
);
assert.throws(
  () =>
    validateFrameContext({
      ...ctx,
      frames: [{ ...ctx.frames[0], narration: "x".repeat(130000) }],
    }),
  /no content was silently dropped/,
);
assert.equal(buildFrameContext(doc, []).frames.length, 2);
const biologyContext = buildFrameContext({ elements: [frame, {
  id: "photosynthesis", t: "img", n: "Fotosintesis", fid: frame.id,
  x: 0, y: 0, w: 900, h: 500, physics: { kind: "photosynthesis" },
}] }, [frame.id]);
assert.equal(biologyContext.frames[0].layers[0].teaching.subject, "biology");
assert.match(biologyContext.frames[0].layers[0].teaching.rules, /O₂ berasal dari pemecahan air/);
console.log(
  "PASS: all layer types, hidden/locked content, calculated values, SVG text, captions/media metadata, privacy, and full AI request context.",
);
