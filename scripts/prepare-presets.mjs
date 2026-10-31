import { withSceneSafeLayout } from "../src/editor/scene-safe-layout.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { indexPackPresets } from "./preset-pack.mjs";
import {
  standardBranding,
  withoutLegacyBranding,
  brandRole,
} from "./preset-branding.mjs";
import { withGenerationSlots } from "../src/editor/template-slots.mjs";
import { studioPresets } from "./studio-presets.mjs";
import { learningPresets } from "./learning-presets.mjs";
import { sciencePresets } from "./science-presets.mjs";

// Deterministic local preparation: no generation, model calls, or network access.
const root = path.resolve(import.meta.dirname, "..");
const references = path.join(root, "design-references");
const output = path.join(root, "asset-packs/siswa-juara/pack/presets");
const pack = path.join(root, "asset-packs/siswa-juara/pack");
const slug = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const xml = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const svgSource = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
await fs.mkdir(path.join(output, "previews"), { recursive: true });
await fs.mkdir(path.join(output, "classic"), { recursive: true });
await fs.mkdir(path.join(output, "essentials"), { recursive: true });
await fs.mkdir(path.join(output, "studio"), { recursive: true });
await fs.mkdir(path.join(output, "science"), { recursive: true });
await fs.mkdir(path.join(output, "learning"), { recursive: true });
await fs.mkdir(path.join(pack, "images"), { recursive: true });
await fs.mkdir(path.join(pack, "thumbnails"), { recursive: true });
const manifest = JSON.parse(
  await fs.readFile(path.join(pack, "manifest.json"), "utf8"),
);
manifest.assets = manifest.assets.filter(
  (a) => !a.id.startsWith("design-reference-"),
);
const catalog = [];
const standard = JSON.parse(
  await fs.readFile(
    process.env.GENIE_STANDARD_FRAME ||
      path.join(root, "contoh-frame-standar.json"),
    "utf8",
  ),
);
const branding = standardBranding(standard);
await fs.mkdir(path.join(output, "shared"), { recursive: true });
await fs.writeFile(
  path.join(output, "shared/branding.json"),
  JSON.stringify(branding, null, 2) + "\n",
);
const ornaments = Object.fromEntries(
  await Promise.all(
    ["spark", "open-book", "conversation", "corner"].map(async (name) => [
      name,
      svgSource(
        await fs.readFile(
          path.join(references, "ornaments", name + ".svg"),
          "utf8",
        ),
      ),
    ]),
  ),
);
function metadata(preset, collection, useCases, tags, description) {
  return {
    ...preset,
    schemaVersion: 2,
    collection,
    useCases,
    tags,
    description,
  };
}
async function save(preset, folder, preview) {
  preset.objects = preset.objects.map((o, i) => ({
    ...o,
    id: `layer-${i + 1}`,
    identifier: o.identifier || slug(o.n),
  }));
  preset = withGenerationSlots(withSceneSafeLayout(preset));
  const file = `${folder}/${preset.identifier}.json`,
    thumbnail = `previews/${preset.identifier}.webp`;
  await fs.writeFile(
    path.join(output, file),
    JSON.stringify(preset, null, 2) + "\n",
  );
  if (preview)
    await sharp(preview)
      .resize(320, 400, { fit: "contain", background: "#eef2fa" })
      .webp({ quality: 85 })
      .toFile(path.join(output, thumbnail));
  const { objects, ...summary } = preset;
  const hasPreview =
    !!preview ||
    (await fs.access(path.join(output, thumbnail)).then(
      () => true,
      () => false,
    ));
  catalog.push({
    ...summary,
    file,
    ...(hasPreview ? { thumbnail } : {}),
    elementCount:
      objects.length + (preset.branding ? branding.objects.length : 0),
  });
}
const legacy = JSON.parse(
  await fs.readFile(path.join(references, "legacy-presets.json"), "utf8"),
);
const legacyCases = [
  ["cover", "content"],
  ["explanation", "answer"],
  ["content", "image"],
  ["cover", "content"],
  ["list", "explanation"],
  ["question", "answer"],
  ["cover"],
  ["list"],
  ["list", "question"],
  ["content", "image"],
];
for (let i = 0; i < legacy.length; i++) {
  const p = legacy[i];
  delete p.b;
  p.motion = "auto";
  p.branding = "siswa-juara";
  p.objects = withoutLegacyBranding(p.objects);
  // Retain every established identifier and editable layer for old designs.
  await save(
    metadata(
      p,
      "Classic",
      legacyCases[i],
      ["reading", "parenting", "siswa juara"],
      "The original Siswa Juara layout, with editable text, shapes, artwork slots, and animation.",
    ),
    "classic",
  );
}
async function registerAsset(id, name, buffer, width, height) {
  const file = `${id}.webp`,
    image = `images/${file}`,
    thumbnail = `thumbnails/${file}`;
  await fs.writeFile(path.join(pack, image), buffer);
  await sharp(buffer)
    .resize({ width: 192, height: 192, fit: "inside" })
    .webp({ quality: 80 })
    .toFile(path.join(pack, thumbnail));
  manifest.assets.push({
    id,
    type: "image",
    file,
    name,
    category: "Design references",
    tags: ["design", "reference", "reading"],
    path: image,
    thumbnail,
    mime: "image/webp",
    width,
    height,
    bytes: buffer.length,
  });
  return `${id}-original-front`;
}
const rect = (n, x, y, w, h, fill, r = 0) => ({
  t: "rect",
  n,
  x,
  y,
  w,
  h,
  fill,
  r,
  lw: 0,
});
const text = (
  n,
  value,
  x,
  y,
  w,
  h,
  size = 60,
  color = "#112866",
  font = "Nunito",
) => ({
  t: "text",
  n,
  text: value,
  x,
  y,
  w,
  h,
  size,
  color,
  font,
  weight: 800,
  align: "left",
});
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
const essentials = [
  [
    "cover",
    "Mulai dari satu bacaan",
    "BACA BERSAMA.\nTEMUKAN CERITANYA.",
    "Satu bacaan kecil untuk memulai\npercakapan yang bermakna.",
    "open-book",
  ],
  [
    "list",
    "Tiga langkah membaca",
    "TIGA LANGKAH\nMEMAHAMI CERITA.",
    "01  Baca perlahan.\n02  Cari petunjuknya.\n03  Ceritakan kembali.",
    "spark",
  ],
  [
    "content",
    "Cerita hari ini",
    "BACA CERITANYA.\nBICARAKAN BERSAMA.",
    "Pagi ini, Rani membawa buku ke taman.\nIa duduk di bawah pohon dan membaca\ncerita tentang persahabatan.",
    "open-book",
  ],
  [
    "image",
    "Cerita dalam gambar",
    "LIHAT GAMBARNYA.\nAPA CERITANYA?",
    "Tambahkan fotomu, lalu ajak anak\nmenceritakan apa yang ia lihat.",
    "corner",
  ],
  [
    "question",
    "Satu pertanyaan kecil",
    "APA YANG\nTERJADI KEMUDIAN?",
    "Rani selesai membaca bukunya.\nApa yang mungkin ia lakukan?",
    "conversation",
  ],
  [
    "answer",
    "Temukan jawabannya",
    "JAWABANMU\nPUNYA PETUNJUK.",
    "Ceritakan kembali alasan pilihanmu.\nBagian mana dari bacaan\nyang membantu menemukan jawaban?",
    "spark",
  ],
  [
    "explanation",
    "Jelaskan dengan ceritamu",
    "BAGAIMANA KAMU\nMENEMUKANNYA?",
    "Hubungkan informasi dalam bacaan.\nTunjukkan petunjuk yang kamu pakai.\nJelaskan dengan kata-katamu sendiri.",
    "conversation",
  ],
];
for (const [useCase, name, headline, body, icon] of essentials) {
  const objects = [
    rect("Paper", 0, 0, 1122, 1402, "#fffdf4"),
    rect("Golden side rule", 0, 0, 22, 1402, "#ffcf25"),
    text("Brand", "SISWA JUARA", 65, 46, 650, 45, 24),
    ornament("spark", 930, 70, 110, 110),
    text("Use case", useCase.toUpperCase(), 66, 144, 700, 55, 28, "#0757ec"),
    text("Headline", headline, 65, 235, 1000, 285, 83, "#112866", "Baloo 2"),
    rect("Golden underline", 66, 548, 230, 14, "#ffcf25", 7),
    rect("Content card", 65, 625, 990, 480, "#e7f0ff", 28),
    text("Content", body, 110, 665, 895, 380, 44),
    ornament(icon, 840, 1110, 160, 140),
    text(
      "Call to action",
      "Baca, temukan, lalu ceritakan. →",
      65,
      1200,
      790,
      60,
      30,
    ),
    rect("Footer rule", 65, 1310, 990, 2, "#a5c8ff"),
    text(
      "Footer",
      "@siswajuaraid  •  www.siswajuara.com",
      65,
      1326,
      990,
      36,
      19,
    ),
  ];
  if (useCase === "image") {
    objects.splice(8, 2, {
      t: "img",
      n: "Your photo",
      label: "Add your photo",
      x: 65,
      y: 625,
      w: 990,
      h: 480,
      fit: "cover",
      identifier: "your-photo-original-front",
    });
  }
  await save(
    metadata(
      {
        name,
        identifier: `essentials-${useCase}`,
        kind: "template",
        W: 1122,
        H: 1402,
        motion: "auto",
        branding: "siswa-juara",
        objects: withoutLegacyBranding(objects),
      },
      "Essentials",
      [useCase],
      ["reading", "editable", "svg", "siswa juara"],
      "An editable Siswa Juara layout with native text and shapes and reusable SVG ornaments.",
    ),
    "essentials",
  );
}
for (const preset of await studioPresets(root)) await save(preset, "studio");
for (const preset of await sciencePresets(root)) await save(preset, "science");
for (const preset of await learningPresets(root))
  await save(preset, "learning");

// The complete supplied standard is also a reusable template; detailed media stay
// in the external pack, while the shared kit contains just the logo and handle.
standard.objects = await Promise.all(
  standard.objects.map(async (o, i) => {
    const role = brandRole(o);
    if (role) return { ...o, brandRole: role, lock: false };
    if (o.t !== "img" || !o.src?.startsWith("data:image/webp;base64,"))
      return o;
    const buffer = Buffer.from(o.src.split(",")[1], "base64");
    const meta = await sharp(buffer).metadata();
    const identifier = await registerAsset(
      `design-reference-standard-${i}`,
      `Standard frame — ${o.n}`,
      buffer,
      meta.width,
      meta.height,
    );
    const { src, img, ...rest } = o;
    return { ...rest, identifier };
  }),
);
standard.collection = "Standard";
standard.description =
  "The supplied standard frame with editable logo, handle, artwork, and layout elements.";
standard.branding = "siswa-juara";
standard.objects = standard.objects.filter((o) => !brandRole(o));
standard.requiredAssets = standard.objects
  .filter((o) => o.t === "img" && !o.src)
  .map((o) => o.identifier);
await save(standard, "classic");
await fs.writeFile(
  path.join(pack, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.writeFile(
  path.join(output, "catalog.json"),
  JSON.stringify({ version: 1, presets: catalog }, null, 2) + "\n",
);
console.log(
  `Prepared ${catalog.length} presets and ${manifest.assets.length} external assets.`,
);
await indexPackPresets(pack);
