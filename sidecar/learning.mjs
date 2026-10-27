import {
  extraLearningModels,
  validateExtraLearning,
  extraLearningMetrics,
} from "./learning-extra.mjs";
// Typed, local teaching diagrams. Geometry uses centimetres; no executable AI code.
const range = [0.1, 100];
const geometry = (label, defaults, description) => ({
  label,
  subject: "mathematics",
  defaults,
  ranges: Object.fromEntries(Object.keys(defaults).map((key) => [key, range])),
  description,
});
const language = (label, defaults, description) => ({
  label,
  subject: "indonesian",
  defaults,
  ranges: {},
  description,
});
export const learningModels = {
  ...extraLearningModels,
  square: geometry(
    "Persegi",
    { side: 4 },
    "Empat sisi sama panjang; luas s² dan keliling 4s.",
  ),
  rectangle: geometry(
    "Persegi panjang",
    { width: 6, height: 4 },
    "Empat sudut siku-siku; luas p×l dan keliling 2(p+l).",
  ),
  triangle: geometry(
    "Segitiga siku-siku",
    { base: 6, height: 4 },
    "Segitiga siku-siku; alas dan tinggi tegak lurus, sisi miring dihitung dengan Pythagoras.",
  ),
  circle: geometry(
    "Lingkaran",
    { radius: 3 },
    "Luas πr², keliling 2πr; π memakai Math.PI, hasil ditandai pendekatan.",
  ),
  parallelogram: geometry(
    "Jajar genjang",
    { base: 6, height: 4, offset: 2 },
    "Tinggi tegak lurus alas, bukan panjang sisi miring.",
  ),
  trapezoid: geometry(
    "Trapesium sama kaki",
    { base: 8, top: 4, height: 3 },
    "Dua sisi sejajar; luas (a+b)t/2. Alas bawah harus lebih panjang dari atas.",
  ),
  rhombus: geometry(
    "Belah ketupat",
    { diagonal1: 8, diagonal2: 6 },
    "Dua diagonal tegak lurus saling membagi dua; luas d₁d₂/2.",
  ),
  kite: geometry(
    "Layang-layang",
    { diagonal1: 8, diagonal2: 6 },
    "Diagonal simetri dibagi dengan perbandingan 1:2 oleh diagonal kedua; luas d₁d₂/2.",
  ),
  cube: geometry(
    "Kubus",
    { side: 4 },
    "Proyeksi ilustratif, bukan perspektif berskala. Volume s³; luas permukaan 6s².",
  ),
  cuboid: geometry(
    "Balok",
    { width: 6, height: 4, depth: 3 },
    "Volume p×l×t; luas permukaan 2(pl+pt+lt).",
  ),
  cylinder: geometry(
    "Tabung",
    { radius: 3, height: 5 },
    "Tabung tertutup; volume πr²t dan luas permukaan 2πr(r+t).",
  ),
  cone: geometry(
    "Kerucut",
    { radius: 3, height: 4 },
    "Tinggi tegak lurus alas; garis pelukis √(r²+t²), volume πr²t/3.",
  ),
  sphere: geometry(
    "Bola",
    { radius: 3 },
    "Volume 4πr³/3; luas permukaan 4πr².",
  ),
  "triangular-prism": geometry(
    "Prisma segitiga siku-siku",
    { base: 6, height: 4, depth: 5 },
    "Alas segitiga siku-siku; volume at×panjang prisma/2.",
  ),
  "square-pyramid": geometry(
    "Limas persegi",
    { side: 6, height: 4 },
    "Limas tegak; puncak tepat di atas pusat alas. Volume s²t/3.",
  ),
  fraction: {
    label: "Pecahan senilai",
    subject: "mathematics",
    defaults: { numerator: 3, denominator: 4 },
    ranges: { numerator: [0, 12], denominator: [1, 12] },
    integers: ["numerator", "denominator"],
    description:
      "Pecahan 0–1 dengan bagian sama besar; pembilang tidak melebihi penyebut.",
  },
  "number-line": {
    label: "Garis bilangan",
    subject: "mathematics",
    defaults: { minimum: -5, maximum: 5, value: 2 },
    ranges: { minimum: [-100, 99], maximum: [-99, 100], value: [-100, 100] },
    integers: ["minimum", "maximum", "value"],
    description:
      "Titik berada dalam rentang; maksimal 20 interval agar label terbaca.",
  },
  coordinates: {
    label: "Koordinat Kartesius",
    subject: "mathematics",
    defaults: { pointX: 3, pointY: 2 },
    ranges: { pointX: [-5, 5], pointY: [-5, 5] },
    integers: ["pointX", "pointY"],
    description:
      "Empat kuadran dengan skala tetap −5 sampai 5; pasangan berurutan (x,y).",
  },
  "bar-chart": {
    label: "Diagram batang",
    subject: "mathematics",
    defaults: { labels: ["Buku", "Pensil", "Penggaris"], values: [4, 6, 3] },
    ranges: {},
    description:
      "2–6 kategori; nilai 0–100; sumbu dimulai dari nol. Contoh data, bukan statistik nyata.",
  },
  sentence: language(
    "Struktur kalimat S–P–O–K",
    { parts: ["Siti", "membaca", "buku", "di perpustakaan"] },
    "Empat frasa berurutan: subjek, predikat, objek, keterangan. Gunakan kalimat transitif yang sesuai; bukan semua kalimat wajib memiliki objek.",
  ),
  syllables: language(
    "Suku kata",
    { word: "kelapa", parts: ["ke", "la", "pa"] },
    "Suku kata harus menyatu menjadi kata yang diberikan; contoh mengikuti ejaan bahasa Indonesia.",
  ),
  "word-family": language(
    "Kosakata dan makna",
    { words: ["gembira", "senang", "riang"], relation: "Sinonim" },
    "Kelompok sinonim, antonim, atau kata berimbuhan. Pilih kata sesuai konteks; makna tidak selalu saling menggantikan.",
  ),
  "story-sequence": language(
    "Urutan cerita",
    {
      parts: ["Rani menanam biji.", "Rani menyiramnya.", "Tunas mulai tumbuh."],
    },
    "3–5 kejadian pendek dalam urutan logis: awal, perkembangan, akhir.",
  ),
  "main-idea": language(
    "Ide pokok dan pendukung",
    {
      idea: "Menjaga kebersihan kelas",
      details: [
        "Menyapu lantai setiap pagi.",
        "Membuang sampah pada tempatnya.",
        "Merapikan meja setelah belajar.",
      ],
    },
    "Satu ide pokok dengan 2–4 rincian yang mendukung gagasan yang sama.",
  ),
};
// Expose text/list limits to the generation prompt as well as the editor.
const strings = (minItems, maxItems, maxLength) => ({
  type: "array",
  minItems,
  maxItems,
  items: { type: "string", minLength: 1, maxLength },
});
learningModels["bar-chart"].fields = {
  labels: strings(2, 6, 14),
  values: {
    type: "array",
    minItems: 2,
    maxItems: 6,
    items: { type: "number", minimum: 0, maximum: 100 },
  },
};
learningModels.sentence.fields = { parts: strings(4, 4, 36) };
learningModels.syllables.fields = {
  word: { type: "string", minLength: 1, maxLength: 40 },
  parts: strings(1, 8, 12),
};
learningModels["word-family"].fields = {
  words: strings(2, 5, 26),
  relation: { enum: ["Sinonim", "Antonim", "Imbuhan"] },
};
learningModels["story-sequence"].fields = { parts: strings(3, 5, 64) };
learningModels["main-idea"].fields = {
  idea: { type: "string", minLength: 1, maxLength: 64 },
  details: strings(2, 4, 64),
};
const text = (value, max) =>
  typeof value === "string" &&
  value.trim() &&
  value.length <= max &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value);
export function normalizeLearning(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    !Object.hasOwn(learningModels, raw.kind)
  )
    throw Error("Choose a supported learning model.");
  const model = learningModels[raw.kind];
  if (
    Object.keys(raw).some(
      (key) =>
        !["kind", "animate", ...Object.keys(model.defaults)].includes(key),
    )
  )
    throw Error("Unsupported learning parameter.");
  const p = structuredClone({
    kind: raw.kind,
    animate: true,
    ...model.defaults,
    ...raw,
  });
  if (typeof p.animate !== "boolean")
    throw Error("Learning animation must be boolean.");
  for (const [key, [min, max]] of Object.entries(model.ranges))
    if (
      typeof p[key] !== "number" ||
      !Number.isFinite(p[key]) ||
      p[key] < min ||
      p[key] > max ||
      (model.integers?.includes(key) && !Number.isInteger(p[key]))
    )
      throw Error(`${key} is outside the learning model's range.`);
  if (p.kind === "trapezoid" && p.base <= p.top)
    throw Error("The trapezoid lower base must be longer than its top.");
  if (p.kind === "fraction" && p.numerator > p.denominator)
    throw Error("Use a fraction between zero and one.");
  if (
    p.kind === "number-line" &&
    (p.maximum <= p.minimum ||
      p.maximum - p.minimum > 20 ||
      p.value < p.minimum ||
      p.value > p.maximum)
  )
    throw Error("Use 1–20 number-line intervals and a point inside the range.");
  const list = (key) => {
    const field = model.fields[key],
      min = field.minItems,
      max = field.maxItems,
      chars = field.items.maxLength;
    if (
      !Array.isArray(p[key]) ||
      p[key].length < min ||
      p[key].length > max ||
      p[key].some((s) => !text(s, chars))
    )
      throw Error(`Invalid ${key} for the learning diagram.`);
    p[key] = p[key].map((s) => s.trim());
  };
  if (p.kind === "bar-chart") {
    list("labels");
    if (
      !Array.isArray(p.values) ||
      p.values.length !== p.labels.length ||
      p.values.some(
        (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100,
      )
    )
      throw Error("Use one value from 0–100 per chart category.");
  }
  if (p.kind === "sentence") list("parts");
  if (p.kind === "syllables") {
    list("parts");
    if (
      !text(p.word, model.fields.word.maxLength) ||
      p.parts.join("").toLocaleLowerCase("id") !==
        p.word.trim().toLocaleLowerCase("id")
    )
      throw Error("Syllables must form the supplied word.");
    p.word = p.word.trim();
  }
  if (p.kind === "word-family") {
    list("words");
    if (!model.fields.relation.enum.includes(p.relation))
      throw Error("Choose Sinonim, Antonim, or Imbuhan.");
  }
  if (p.kind === "story-sequence") list("parts");
  if (p.kind === "main-idea") {
    list("details");
    if (!text(p.idea, model.fields.idea.maxLength))
      throw Error("Use a main idea of at most 64 characters.");
    p.idea = p.idea.trim();
  }
  validateExtraLearning(p);
  return p;
}
export function learningMetrics(raw) {
  const p = normalizeLearning(raw);
  switch (p.kind) {
    case "square":
      return { area: p.side ** 2, perimeter: 4 * p.side };
    case "rectangle":
      return { area: p.width * p.height, perimeter: 2 * (p.width + p.height) };
    case "triangle":
      return {
        area: (p.base * p.height) / 2,
        perimeter: p.base + p.height + Math.hypot(p.base, p.height),
      };
    case "circle":
      return {
        area: Math.PI * p.radius ** 2,
        perimeter: 2 * Math.PI * p.radius,
      };
    case "parallelogram":
      return {
        area: p.base * p.height,
        perimeter: 2 * (p.base + Math.hypot(p.height, p.offset)),
      };
    case "trapezoid":
      return {
        area: ((p.base + p.top) * p.height) / 2,
        perimeter:
          p.base + p.top + 2 * Math.hypot((p.base - p.top) / 2, p.height),
      };
    case "rhombus":
      return {
        area: (p.diagonal1 * p.diagonal2) / 2,
        perimeter: 2 * Math.hypot(p.diagonal1, p.diagonal2),
      };
    case "kite":
      return {
        area: (p.diagonal1 * p.diagonal2) / 2,
        perimeter:
          2 *
          (Math.hypot(p.diagonal1 / 3, p.diagonal2 / 2) +
            Math.hypot((2 * p.diagonal1) / 3, p.diagonal2 / 2)),
      };
    case "cube":
      return { volume: p.side ** 3, surface: 6 * p.side ** 2 };
    case "cuboid":
      return {
        volume: p.width * p.height * p.depth,
        surface:
          2 * (p.width * p.height + p.width * p.depth + p.height * p.depth),
      };
    case "cylinder":
      return {
        volume: Math.PI * p.radius ** 2 * p.height,
        surface: 2 * Math.PI * p.radius * (p.radius + p.height),
      };
    case "cone":
      return {
        volume: (Math.PI * p.radius ** 2 * p.height) / 3,
        surface:
          Math.PI * p.radius * (p.radius + Math.hypot(p.radius, p.height)),
      };
    case "sphere":
      return {
        volume: (4 * Math.PI * p.radius ** 3) / 3,
        surface: 4 * Math.PI * p.radius ** 2,
      };
    case "triangular-prism":
      return {
        volume: (p.base * p.height * p.depth) / 2,
        surface:
          p.base * p.height +
          (p.base + p.height + Math.hypot(p.base, p.height)) * p.depth,
      };
    case "square-pyramid":
      return {
        volume: (p.side ** 2 * p.height) / 3,
        surface: p.side ** 2 + 2 * p.side * Math.hypot(p.height, p.side / 2),
      };
    default:
      return extraLearningMetrics(p);
  }
}
