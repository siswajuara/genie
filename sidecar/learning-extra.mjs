const numeric = (label, defaults, ranges, description, integers = []) => ({
  label,
  subject: "mathematics",
  defaults,
  ranges,
  integers,
  description,
});
const strings = (minItems, maxItems, maxLength) => ({
  type: "array",
  minItems,
  maxItems,
  items: { type: "string", minLength: 1, maxLength },
});
const prose = (label, defaults, fields, description) => ({
  label,
  subject: "indonesian",
  defaults,
  ranges: {},
  fields,
  description,
});
export const extraLearningModels = {
  angle: numeric(
    "Sudut dan jenisnya",
    { degrees: 60 },
    { degrees: [0, 180] },
    "Sudut 0–180°, diukur berlawanan arah jarum jam dari sinar mendatar. Lancip <90°, siku-siku 90°, tumpul >90° dan <180°.",
  ),
  "regular-polygon": numeric(
    "Segi banyak beraturan",
    { sides: 6, side: 4 },
    { sides: [3, 10], side: [0.1, 20] },
    "Semua sisi dan sudut sama. Keliling n×s; luas ns²/(4 tan(π/n)); jumlah sudut dalam (n−2)×180°.",
    ["sides"],
  ),
  "cube-net": numeric(
    "Jaring-jaring kubus",
    { side: 4 },
    { side: [0.1, 20] },
    "Enam persegi kongruen: empat berjajar, satu di atas dan satu di bawah persegi kedua. Animasi menelusuri keenam sisi, bukan simulasi melipat 3D.",
  ),
  "multiplication-array": numeric(
    "Perkalian dalam baris dan kolom",
    { rows: 3, columns: 4 },
    { rows: [1, 8], columns: [1, 10] },
    "Banyak benda = baris × kolom. Semua benda tetap terlihat; animasi menyorot baris bergantian.",
    ["rows", "columns"],
  ),
  "place-value": numeric(
    "Nilai tempat bilangan",
    { number: 2345 },
    { number: [0, 9999] },
    "Bilangan bulat 0–9999 diuraikan menjadi ribuan, ratusan, puluhan, dan satuan; tidak menghilangkan angka nol.",
    ["number"],
  ),
  "fraction-addition": numeric(
    "Penjumlahan pecahan",
    { first: 1, second: 2, denominator: 4 },
    { first: [0, 12], second: [0, 12], denominator: [1, 12] },
    "Dua pecahan berpenyebut sama, jumlah maksimal satu utuh. Syarat first+second ≤ denominator; penyebut maksimal 12.",
    ["first", "second", "denominator"],
  ),
  "pie-chart": {
    label: "Diagram lingkaran",
    subject: "mathematics",
    defaults: {
      labels: ["Membaca", "Menggambar", "Bermain"],
      values: [4, 3, 3],
    },
    ranges: {},
    fields: {
      labels: strings(2, 6, 14),
      values: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: { type: "number", minimum: 0, maximum: 100 },
      },
    },
    description:
      "2–6 kategori bernilai 0–100 dengan total >0. Sudut sektor = nilai/total ×360°. Contoh data, bukan survei nyata.",
  },
  "line-chart": {
    label: "Diagram garis",
    subject: "mathematics",
    defaults: {
      labels: ["Senin", "Selasa", "Rabu", "Kamis"],
      values: [2, 4, 3, 6],
    },
    ranges: {},
    fields: {
      labels: strings(2, 8, 12),
      values: {
        type: "array",
        minItems: 2,
        maxItems: 8,
        items: { type: "number", minimum: 0, maximum: 100 },
      },
    },
    description:
      "2–8 data berurutan pada sumbu berjarak sama; nilai 0–100 dan sumbu y mulai nol. Garis menghubungkan pengamatan, bukan data tambahan.",
  },
  "analog-clock": numeric(
    "Jam analog",
    { hour: 3, minute: 30 },
    { hour: [0, 23], minute: [0, 59] },
    "Jam 12 angka; jarum pendek bergerak sesuai menit. Animasi hanya menyorot jarum, tidak mengubah waktu yang sedang diajarkan.",
    ["hour", "minute"],
  ),
  "balance-equation": numeric(
    "Persamaan satu variabel",
    { coefficient: 2, constant: 3, answer: 4 },
    { coefficient: [1, 9], constant: [0, 20], answer: [0, 12] },
    "Persamaan ax+b=c dengan c dihitung aplikasi dari solusi x. Animasi menjelaskan mengurangi b dan membagi a, tanpa mengubah persamaan.",
    ["coefficient", "constant", "answer"],
  ),
  venn: {
    label: "Diagram Venn dua himpunan",
    subject: "mathematics",
    defaults: {
      left: "Hewan berkaki empat",
      right: "Hewan peliharaan",
      leftOnly: ["singa"],
      both: ["kucing", "anjing"],
      rightOnly: ["ikan"],
    },
    ranges: {},
    fields: {
      left: { type: "string", minLength: 1, maxLength: 28 },
      right: { type: "string", minLength: 1, maxLength: 28 },
      leftOnly: strings(1, 3, 14),
      both: strings(1, 3, 14),
      rightOnly: strings(1, 3, 14),
    },
    description:
      "Dua himpunan dengan tiga daerah. Setiap anggota harus unik dan berada pada daerah yang tepat; contoh bukan klasifikasi universal semua hewan.",
  },
  ratio: numeric(
    "Perbandingan dua kelompok",
    { first: 2, second: 3 },
    { first: [1, 10], second: [1, 10] },
    "Dua kelompok benda dengan perbandingan bilangan bulat positif. Tampilkan rasio awal dan bentuk sederhananya.",
    ["first", "second"],
  ),
  punctuation: prose(
    "Tanda baca dalam kalimat",
    {
      parts: [
        "Siti membaca buku",
        "Buku apa yang dibaca Siti",
        "Ayo, kita membaca bersama",
      ],
      marks: [".", "?", "!"],
    },
    {
      parts: strings(3, 3, 56),
      marks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { enum: [".", "?", "!"] },
      },
    },
    "Tiga contoh untuk kalimat berita, tanya, dan seruan/perintah. parts tidak memuat tanda akhir; marks memberi tanda akhir yang sesuai.",
  ),
  affix: prose(
    "Kata dasar dan imbuhan",
    { root: "baca", prefix: "mem", suffix: "", result: "membaca" },
    {
      root: { type: "string", minLength: 1, maxLength: 18 },
      prefix: { type: "string", maxLength: 12 },
      suffix: { type: "string", maxLength: 12 },
      result: { type: "string", minLength: 1, maxLength: 32 },
    },
    "Rangkaian awalan + kata dasar + akhiran. Model ini hanya penggabungan langsung tanpa peluluhan/perubahan bunyi; prefix atau suffix boleh kosong tetapi tidak keduanya.",
  ),
  "cause-effect": prose(
    "Hubungan sebab dan akibat",
    {
      cause: "Hujan turun sepanjang sore.",
      effect: "Halaman sekolah menjadi basah.",
      connector: "sehingga",
    },
    {
      cause: { type: "string", minLength: 1, maxLength: 88 },
      effect: { type: "string", minLength: 1, maxLength: 88 },
      connector: { enum: ["sehingga", "karena", "akibatnya"] },
    },
    "Dua peristiwa dengan hubungan sebab-akibat yang masuk akal. Panah selalu dari sebab ke akibat; kata hubung tidak boleh membalik hubungan.",
  ),
  "story-map": prose(
    "Peta unsur cerita",
    {
      character: "Rani",
      setting: "Kebun sekolah pada pagi hari",
      problem: "Tanaman mulai layu.",
      solution: "Rani menyiram tanaman bersama teman.",
    },
    {
      character: { type: "string", minLength: 1, maxLength: 40 },
      setting: { type: "string", minLength: 1, maxLength: 64 },
      problem: { type: "string", minLength: 1, maxLength: 88 },
      solution: { type: "string", minLength: 1, maxLength: 88 },
    },
    "Empat unsur cerita: tokoh, latar, masalah, penyelesaian. Penyelesaian menjawab masalah yang sama; teks contoh fiksi.",
  ),
};
function fieldValue(value, schema) {
  if (schema.enum) return schema.enum.includes(value);
  if (schema.type === "string")
    return (
      typeof value === "string" &&
      value.length >= (schema.minLength || 0) &&
      value.length <= schema.maxLength &&
      !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)
    );
  if (schema.type === "number")
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= schema.minimum &&
      value <= schema.maximum
    );
  if (schema.type === "array")
    return (
      Array.isArray(value) &&
      value.length >= schema.minItems &&
      value.length <= schema.maxItems &&
      value.every((v) => fieldValue(v, schema.items))
    );
  return false;
}
export function validateExtraLearning(p) {
  const m = extraLearningModels[p.kind];
  if (!m) return;
  for (const [key, schema] of Object.entries(m.fields || {}))
    if (!fieldValue(p[key], schema))
      throw Error(`Invalid ${key} for ${m.label}.`);
  if (p.kind === "fraction-addition" && p.first + p.second > p.denominator)
    throw Error("The fraction sum must not exceed one whole.");
  if (
    ["pie-chart", "line-chart"].includes(p.kind) &&
    (p.values.length !== p.labels.length ||
      new Set(p.labels).size !== p.labels.length)
  )
    throw Error("Use one value per unique chart label.");
  if (p.kind === "pie-chart" && p.values.reduce((a, b) => a + b, 0) <= 0)
    throw Error("The pie chart needs a positive total.");
  if (p.kind === "venn") {
    const all = [...p.leftOnly, ...p.both, ...p.rightOnly].map((s) =>
      s.trim().toLocaleLowerCase("id"),
    );
    if (new Set(all).size !== all.length)
      throw Error("Venn members must be unique across regions.");
  }
  if (p.kind === "punctuation" && p.parts.some((s) => /[.!?]\s*$/.test(s)))
    throw Error("Leave the final punctuation in marks, not parts.");
  if (
    p.kind === "affix" &&
    ((!p.prefix && !p.suffix) || p.prefix + p.root + p.suffix !== p.result)
  )
    throw Error(
      "Use direct affix concatenation that forms the supplied result.",
    );
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function extraLearningMetrics(p) {
  switch (p.kind) {
    case "angle":
      return { degrees: p.degrees };
    case "regular-polygon":
      return {
        polygonArea:
          (p.sides * p.side ** 2) / (4 * Math.tan(Math.PI / p.sides)),
        perimeter: p.sides * p.side,
        interiorSum: (p.sides - 2) * 180,
      };
    case "cube-net":
      return { surface: 6 * p.side ** 2 };
    case "multiplication-array":
      return { total: p.rows * p.columns };
    case "place-value":
      return {
        thousands: Math.floor(p.number / 1000),
        hundreds: Math.floor(p.number / 100) % 10,
        tens: Math.floor(p.number / 10) % 10,
        ones: p.number % 10,
      };
    case "fraction-addition":
      return { numerator: p.first + p.second, denominator: p.denominator };
    case "pie-chart":
      return { total: p.values.reduce((a, b) => a + b, 0) };
    case "balance-equation":
      return {
        rightSide: p.coefficient * p.answer + p.constant,
        answer: p.answer,
      };
    case "ratio": {
      const g = gcd(p.first, p.second);
      return { first: p.first / g, second: p.second / g };
    }
    default:
      return {};
  }
}
