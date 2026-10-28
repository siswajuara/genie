import fs from "node:fs/promises";
import path from "node:path";

const C = {
  paper: "#fffdf4",
  navy: "#112866",
  blue: "#0757ec",
  sky: "#e7f0ff",
  gold: "#ffcf25",
  pale: "#fff2b6",
  white: "#ffffff",
  line: "#bfd3f4",
};
const art = {
  pair: "owl-reading-together-happy-blue-yellow-front",
  reader: "owl-reading-book-happy-blue-front",
  "yellow-reader": "owl-reading-book-happy-yellow-front",
  thinker: "owl-thinking-curious-blue-front",
  collaboration: "owl-collaborating-curious-blue-yellow-front",
  teacher: "owl-teaching-pointer-happy-yellow-front",
  idea: "owl-having-idea-excited-blue-front",
  celebrate: "owl-celebrating-excited-yellow-front",
};
const rect = (n, x, y, w, h, fill, r = 28, stroke) => ({
  t: "rect",
  n,
  x,
  y,
  w,
  h,
  fill,
  r,
  ...(stroke ? { stroke, lw: 2 } : { lw: 0 }),
});
const circle = (n, x, y, size, fill) => ({
  t: "ellipse",
  n,
  x,
  y,
  w: size,
  h: size,
  fill,
  lw: 0,
});
const text = (n, value, x, y, w, h, size = 34, extra = {}) => ({
  t: "text",
  n,
  text: value,
  x,
  y,
  w,
  h,
  size,
  font: "Nunito",
  weight: 800,
  color: C.navy,
  align: "left",
  lh: 1.2,
  generationRole: "editable",
  ...extra,
});
const fixed = (n, value, x, y, w, h, size = 24, extra = {}) =>
  text(n, value, x, y, w, h, size, { generationRole: "fixed", ...extra });
const headline = (value, extra = {}) =>
  text("Headline", value, 64, 180, 994, 220, 78, {
    font: "Baloo 2",
    generationGroup: "headline-1",
    ...extra,
  });
const mascot = (key, x, y, w, h) => ({
  t: "img",
  n: `Owl ${key}`,
  identifier: art[key],
  x,
  y,
  w,
  h,
  fit: "contain",
});
const photo = (x, y, w, h) => ({
  t: "img",
  n: "Your photo",
  identifier: "studio-user-photo-original-front",
  label: "Add your photo",
  x,
  y,
  w,
  h,
  fit: "cover",
});
const cta = (value = "Baca bersama. Dengarkan ceritanya.") =>
  fixed("Call to action", value, 70, 1200, 980, 44, 28);

export async function studioPresets(root) {
  const references = path.join(root, "design-references");
  const sources = JSON.parse(
    await fs.readFile(path.join(references, "studio-presets.json"), "utf8"),
  );
  const ornaments = Object.fromEntries(
    await Promise.all(
      ["spark", "open-book", "loop-arrow", "checkmark"].map(async (name) => [
        name,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await fs.readFile(path.join(references, "ornaments", `${name}.svg`), "utf8"))}`,
      ]),
    ),
  );
  const ornament = (name, x, y, w, h) => ({
    t: "img",
    n: `${name} ornament`,
    src: ornaments[name],
    x,
    y,
    w,
    h,
    fit: "contain",
  });
  return sources.map((s) => {
    const objects = [
      rect("Warm paper", 0, 0, 1122, 1402, C.paper, 0),
      rect("Blue side rule", 0, 150, 12, 1080, C.blue, 0),
      rect("Series badge", 250, 42, 650, 52, C.sky, 26),
      fixed("Series label", s.eyebrow, 274, 53, 605, 34, 22),
      fixed("Page number", "1/1", 970, 48, 100, 40, 24, {
        generationRole: "page-number",
        align: "right",
      }),
      ornament("spark", 988, 115, 68, 68),
    ];
    const add = (...layers) => objects.push(...layers);
    switch (s.layout) {
      case "hero":
        add(
          headline(s.headline, { size: 86, h: 230 }),
          text("Introduction", s.body, 70, 450, 950, 120, 36),
          rect("Reading stage", 64, 640, 994, 490, C.sky, 48),
          circle("Golden spotlight", 650, 665, 330, C.gold),
          mascot(s.art, 180, 570, 760, 630),
          cta(),
        );
        break;
      case "contrast":
        add(
          rect("Navy headline panel", 64, 170, 994, 280, C.navy, 36),
          headline(s.headline, {
            x: 100,
            y: 198,
            w: 920,
            size: 78,
            color: C.white,
          }),
          rect("Golden underline", 70, 488, 210, 12, C.gold, 6),
          text("Introduction", s.body, 70, 545, 950, 140, 36),
          rect("Reflection card", 64, 775, 600, 330, C.sky, 36),
          text("Reflection", s.detail, 102, 855, 520, 180, 36),
          mascot(s.art, 708, 720, 340, 450),
          cta(),
        );
        break;
      case "story":
        add(
          headline(s.headline, { size: 74 }),
          rect("Story card", 64, 465, 994, 475, C.white, 36, C.line),
          rect("Story accent", 64, 500, 10, 400, C.gold, 5),
          text("Story", s.body, 106, 530, 910, 340, 42),
          rect("Discussion prompt", 64, 980, 680, 200, C.sky),
          text("Discussion", s.detail, 98, 1025, 610, 110, 32),
          mascot(s.art, 800, 940, 250, 275),
          cta("Baca pelan. Bahas bersama."),
        );
        break;
      case "conversation":
        add(
          headline(s.headline),
          rect("Conversation card", 64, 465, 994, 450, C.sky, 48),
          fixed("Opening quotation", "“", 100, 480, 100, 110, 100, {
            color: C.blue,
            font: "Baloo 2",
          }),
          text("Conversation starter", s.body, 165, 555, 800, 260, 48),
          text("Parent note", s.detail, 70, 995, 700, 145, 32),
          mascot(s.art, 790, 940, 265, 270),
          cta(),
        );
        break;
      case "photo-wide":
        add(
          headline(s.headline),
          rect("Photo border", 64, 450, 994, 555, C.sky, 32),
          photo(86, 472, 950, 511),
          text("Photo caption", s.body, 70, 1040, 760, 115, 32),
          mascot(s.art, 850, 1010, 195, 200),
          cta("Pilih satu detail, lalu ceritakan."),
        );
        break;
      case "photo-column":
        add(
          headline(s.headline, { size: 74 }),
          rect("Photo border", 64, 450, 570, 715, C.sky, 32),
          photo(86, 472, 526, 671),
          rect("Observation card", 670, 450, 388, 715, C.pale, 32),
          fixed("Observation label", "AMATI BERSAMA", 704, 490, 315, 42, 22),
          text("Observation prompts", s.body, 704, 570, 315, 190, 32),
          mascot(s.art, 708, 815, 310, 325),
          cta("Lihat satu detail. Ceritakan dengan kata-katamu."),
        );
        break;
      case "choices":
        add(
          headline(s.headline, { size: 74 }),
          rect("Question card", 64, 455, 994, 245, C.sky, 36),
          text("Question", s.body, 100, 505, 920, 150, 42),
        );
        s.items.forEach((item, i) => {
          const x = i ? 580 : 64;
          add(
            rect(`Choice ${i + 1} card`, x, 750, 478, 160, C.white, 28, C.line),
            fixed(
              `Choice ${i + 1} label`,
              i ? "B" : "A",
              x + 34,
              800,
              65,
              64,
              42,
              { color: C.blue },
            ),
            text(`Choice ${i + 1}`, item, x + 120, 797, 320, 82, 36),
          );
        });
        add(
          text("Hint", s.detail, 70, 1010, 700, 130, 32),
          mascot(s.art, 805, 960, 245, 250),
          cta("Pilih jawaban, lalu ceritakan alasanmu."),
        );
        break;
      case "question-card":
        add(
          headline(s.headline),
          rect("Navy question panel", 64, 455, 780, 375, C.navy, 36),
          text("Question", s.body, 106, 515, 690, 260, 46, { color: C.white }),
          circle("Question badge", 860, 470, 190, C.gold),
          fixed("Question mark", "?", 910, 495, 95, 120, 96, {
            font: "Baloo 2",
          }),
          fixed("Hint label", "CARI PETUNJUK", 70, 900, 650, 40, 22, {
            color: C.blue,
          }),
          text("Hint", s.detail, 70, 970, 700, 150, 32),
          mascot(s.art, 810, 850, 250, 345),
          cta("Ceritakan alasanmu, bukan hanya pilihanmu."),
        );
        break;
      case "answer-reveal":
        add(
          headline(s.headline, { size: 74 }),
          rect("Answer card", 64, 455, 994, 255, C.gold, 36),
          fixed("Answer label", "JAWABAN", 100, 490, 850, 40, 22),
          text("Answer", s.body, 100, 552, 920, 100, 56),
          rect("Reason card", 64, 760, 700, 360, C.white, 36, C.line),
          text("Reason", s.detail, 100, 815, 620, 260, 34),
          mascot(s.art, 790, 795, 260, 375),
          cta("Temukan jawabannya. Tunjukkan petunjuknya."),
        );
        break;
      case "answer-evidence":
        add(
          headline(s.headline, { size: 74 }),
          rect("Choice badge", 64, 455, 150, 165, C.navy),
          fixed("Choice label", "A", 107, 500, 80, 90, 64, { color: C.white }),
          rect("Answer card", 244, 455, 814, 165, C.sky),
          text("Answer", s.body, 278, 500, 740, 90, 38),
          rect("Evidence card", 64, 680, 994, 420, C.white, 36, C.line),
          fixed("Evidence label", "BUKTI DALAM CERITA", 100, 725, 890, 40, 22, {
            color: C.blue,
          }),
          text("Evidence", s.detail, 100, 800, 920, 230, 36),
          mascot(s.art, 850, 1065, 185, 150),
          cta("Cocokkan jawaban dengan isi bacaan."),
        );
        break;
      case "steps":
        add(headline(s.headline, { size: 74 }));
        s.items.forEach((item, i) => {
          const y = 455 + i * 305;
          add(
            rect(`Step ${i + 1} card`, 64, y, 994, 260, i ? C.pale : C.sky, 36),
            circle(`Step ${i + 1} badge`, 100, y + 45, 82, C.white),
            fixed(
              `Step ${i + 1} number`,
              `0${i + 1}`,
              112,
              y + 64,
              65,
              50,
              30,
              { color: C.blue },
            ),
            text(`Step ${i + 1}`, item, 220, y + 48, 790, 175, 34),
          );
        });
        add(
          mascot(s.art, 850, 1030, 190, 175),
          cta("Baca petunjuknya. Jelaskan hubungan keduanya."),
        );
        break;
      case "compare":
        add(headline(s.headline));
        s.items.forEach((item, i) => {
          const x = i ? 588 : 64;
          add(
            rect(
              `Idea ${i + 1} card`,
              x,
              455,
              470,
              555,
              i ? C.pale : C.sky,
              36,
            ),
            fixed(
              `Idea ${i + 1} label`,
              i ? "KESIMPULAN" : "DI BACAAN",
              x + 38,
              510,
              390,
              40,
              22,
              { color: C.blue },
            ),
            text(`Idea ${i + 1}`, item, x + 38, 600, 395, 280, 34),
          );
        });
        add(
          ornament("loop-arrow", 516, 780, 90, 76),
          text("Reasoning note", s.detail, 70, 1060, 710, 110, 32),
          mascot(s.art, 830, 1020, 220, 190),
          cta("Kesimpulanmu perlu petunjuk dari bacaan."),
        );
        break;
      case "list-cards":
        add(headline(s.headline));
        s.items.forEach((item, i) => {
          const y = 455 + i * 220;
          add(
            rect(
              `Item ${i + 1} card`,
              64,
              y,
              994,
              195,
              i === 1 ? C.pale : C.sky,
              32,
            ),
            circle(`Item ${i + 1} badge`, 100, y + 50, 82, C.white),
            fixed(
              `Item ${i + 1} number`,
              `0${i + 1}`,
              111,
              y + 70,
              65,
              50,
              30,
              { color: C.blue },
            ),
            text(`Item ${i + 1}`, item, 220, y + 45, 790, 120, 34),
          );
        });
        add(
          mascot(s.art, 900, 1090, 140, 120),
          cta("Ulangi dengan bacaan lain yang anak sukai."),
        );
        break;
      case "checklist":
        add(
          headline(s.headline, { size: 74 }),
          rect("Checklist card", 64, 455, 625, 710, C.white, 36, C.line),
        );
        s.items.forEach((item, i) => {
          const y = 515 + i * 205;
          add(
            rect(`Check ${i + 1} box`, 98, y + 10, 64, 64, C.sky, 16),
            ornament("checkmark", 98, y + 10, 64, 64),
            fixed(
              `Item ${i + 1} number`,
              `0${i + 1}`,
              114,
              y + 100,
              55,
              35,
              20,
              { color: C.blue },
            ),
            text(`Item ${i + 1}`, item, 205, y, 450, 140, 32),
          );
        });
        add(
          circle("Golden spotlight", 740, 490, 290, C.gold),
          mascot(s.art, 740, 535, 290, 400),
          rect("Starting note", 725, 990, 333, 175, C.pale),
          text("Starting note", s.body, 754, 1025, 280, 115, 28),
          cta("Siapkan bacaan. Nikmati percakapannya."),
        );
        break;
      case "closing":
        add(
          headline(s.headline, { size: 72, h: 300 }),
          text("Encouragement", s.body, 70, 520, 980, 130, 34),
          rect("CTA card", 64, 680, 994, 300, C.navy, 36),
          text("Call to action", s.detail, 100, 740, 920, 180, 46, {
            color: C.white,
            align: "center",
          }),
          mascot(s.art, 331, 1010, 460, 350),
        );
        break;
      case "closing-next":
        add(
          rect("CTA panel", 64, 170, 994, 400, C.gold, 36),
          headline(s.headline, {
            x: 100,
            y: 210,
            w: 920,
            h: 220,
            size: 72,
          }),
          text("Encouragement", s.body, 70, 610, 980, 130, 34),
          rect("Link card", 64, 780, 994, 220, C.navy, 36),
          text("Call to action", s.detail, 100, 820, 920, 140, 44, {
            color: C.white,
            align: "center",
          }),
          mascot(s.art, 391, 1030, 340, 330),
        );
        break;
      default:
        throw Error(`Unknown Studio layout: ${s.layout}`);
    }
    return {
      schemaVersion: 2,
      identifier: s.identifier,
      name: s.name,
      kind: "template",
      W: 1122,
      H: 1402,
      collection: "Studio",
      useCases: [s.useCase],
      tags: [
        "studio",
        "reading",
        "parenting",
        "editable",
        s.useCase,
        "siswa juara",
      ],
      description: s.description,
      branding: "siswa-juara",
      motion: "auto",
      requiredAssets: [art[s.art]],
      objects,
    };
  });
}
