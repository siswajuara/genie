import assert from "node:assert/strict";
import {
  restoreCaptionDots,
  wordsToCues,
  alignmentToWords,
  validateSubtitles,
  defaultSubtitleStyle,
} from "../src/editor/subtitles.ts";

assert.equal(restoreCaptionDots("kunjungi siswajuara(dot)com ya"), "kunjungi siswajuara.com ya");
assert.equal(restoreCaptionDots("buka situs ( dot ) kami"), "buka situs. kami");
assert.equal(
  restoreCaptionDots("Halo . apa kabar ?"),
  "Halo. apa kabar?",
);
assert.equal(restoreCaptionDots("Biasa saja."), "Biasa saja.");
assert.equal(restoreCaptionDots("[warm] Hai."), "[warm] Hai.");

const words = (text, start = 0, step = 0.4) =>
  text.split(" ").map((word, i) => ({
    text: word,
    start: start + i * step,
    end: start + (i + 1) * step,
  }));
const cues = wordsToCues(words("kunjungi siswajuara(dot)com ya"));
assert.equal(cues.length, 1);
assert.equal(cues[0].text, "kunjungi siswajuara.com ya");
assert.equal(cues[0].words.length, 3);
assert.deepEqual(
  cues[0].words.map((word) => word.text),
  ["kunjungi", "siswajuara.com", "ya"],
);
assert.ok(cues[0].words.every((word) => word.end > word.start));
// A restored domain period never splits the domain across cues.
const split = wordsToCues(words("lihat . lanjut"));
assert.ok(split.every((cue) => !cue.text.endsWith(" .")));
assert.equal(
  wordsToCues(words("Halo. apa kabar?")).length,
  2,
  "real sentence ends still break cues",
);
// Audio tags stay out of captions end to end.
const chars = "[warm] hai semua".split("");
const tagged = wordsToCues(
  alignmentToWords(
    {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
    },
    true,
  ),
);
assert.ok(tagged.length > 0);
assert.ok(tagged.every((cue) => !cue.text.includes("[warm]")));

const frame = (patch = {}) => ({
  t: "frame",
  subtitles: [
    {
      id: "c1",
      start: 0,
      end: 2,
      text: "hai",
      words: [{ text: "hai", start: 0, end: 0.4 }],
    },
  ],
  subtitleStyle: { ...defaultSubtitleStyle, ...patch },
});
validateSubtitles(frame());
validateSubtitles(frame({ animation: "karaoke" }));
validateSubtitles(frame({ animation: "pop", outlineWidth: 0.14 }));
validateSubtitles({ t: "frame" });
for (const style of [
  { animation: "bounce" },
  { outlineWidth: -0.1 },
  { outlineWidth: 2 },
  { highlight: "yellow" },
  { outline: "#gggggg" },
  { size: 99 },
])
  assert.throws(() => validateSubtitles(frame(style)), /Invalid subtitle style/);
for (const subtitles of [
  [{ id: "c1", start: 0, end: 1, text: "hai", words: "nope" }],
  [
    {
      id: "c1",
      start: 0,
      end: 1,
      text: "hai",
      words: [{ text: "", start: 0, end: 0.5 }],
    },
  ],
  [
    {
      id: "c1",
      start: 0,
      end: 1,
      text: "hai",
      words: [{ text: "hai", start: 0.5, end: 0.5 }],
    },
  ],
])
  assert.throws(
    () => validateSubtitles({ t: "frame", subtitles }),
    /words/,
  );
console.log(
  "PASS: (dot) domains restore to periods, cues keep word timings, and extended caption styles validate. No provider calls.",
);
