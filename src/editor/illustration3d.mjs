import { illustration3DScenes, paintIllustration3D } from "./illustration3d-scenes.mjs";
import { svgContext } from "./illustration3d-svg.mjs";

const aliases = {
  kubus: "cube solid volume surface area",
  balok: "cuboid rectangular prism volume surface area",
  prisma: "triangular prism volume surface area",
  limas: "rectangular pyramid volume surface area",
  tabung: "cylinder volume surface area",
  kerucut: "cone volume surface area",
  bola: "sphere volume surface area",
  jaring: "cube net folding jaring jaring kubus",
  putar: "solid revolution rotation cone benda putar",
  piston: "gas pressure compression boyle tekanan",
  bandul: "pendulum oscillation period frequency",
  pegas: "spring oscillation mass hooke period frequency",
  gelombang: "wave wavelength amplitude frequency",
  parabola: "projectile motion launch gravity trajectory",
  miring: "inclined plane slope force gravity frictionless",
  listrik: "electric circuit current voltage resistance ohm",
  tuas: "lever torque equilibrium balance",
  cahaya: "light reflection refraction snell optics",
  surya: "solar system planets earth moon orbit astronomy",
  atom: "bohr atom atomic number electron proton chemistry",
  siklus: "water cycle rain evaporation condensation",
  bulan: "moon phases lunar astronomy synodic",
  molekul: "molecule chemistry water carbon dioxide methane h2o co2 ch4",
};

export const illustration3DModels = Object.fromEntries(
  Object.entries(illustration3DScenes).map(([key, scene]) => [key, {
    label: scene.name,
    group: scene.group,
    keywords: `${scene.name} ${scene.group} ${aliases[key]} 3d illustration ilustrasi`.toLowerCase(),
    description: scene.note,
    formula: scene.formula,
    animated: !!scene.anim,
    dimensions: !!scene.dim,
    progressLabel: scene.scrub?.label,
    parameters: scene.sliders,
  }]),
);

export function normalizeIllustration3D(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw Error("Invalid 3D illustration settings.");
  const scene = raw.scene === undefined ? "kubus" : raw.scene;
  if (typeof scene !== "string" || !Object.hasOwn(illustration3DScenes, scene)) throw Error("Unknown 3D illustration.");
  const allowed = new Set(["scene", "parameters", "yaw", "pitch", "zoom", "progress", "gasHeight", "animate", "showTitle", "showDimensions", "showResults", "showFormula"]);
  if (Object.keys(raw).some((key) => !allowed.has(key)))
    throw Error("Unsupported 3D illustration setting.");
  const model = illustration3DScenes[scene];
  const input = raw.parameters === undefined ? {} : raw.parameters;
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !Object.hasOwn(model.def, key)))
    throw Error("Invalid 3D illustration parameters.");
  const number = (value, fallback, min, max, label) => {
    const n = value === undefined ? fallback : value;
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      throw Error(`${label} must be between ${min} and ${max}.`);
    return n;
  };
  const parameters = Object.fromEntries(model.sliders.map(({ k, label, min, max }) => {
    const n = number(input[k], model.def[k], min, max, label);
    if (["Z", "k"].includes(k) && !Number.isInteger(n))
      throw Error(`${label} must be a whole number.`);
    return [k, n];
  }));
  const flag = (key, fallback) => {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean")
      throw Error(`Invalid ${key} setting.`);
    return raw[key] ?? fallback;
  };
  return {
    scene, parameters,
    yaw: number(raw.yaw, -30, -180, 180, "Rotation"),
    pitch: number(raw.pitch, 30, 20, 83, "Tilt"),
    zoom: number(raw.zoom, 1, 0.5, 3, "Zoom"),
    progress: number(raw.progress, scene === "bulan" ? 0.25 : 0.55, 0, 1, "Progress"),
    gasHeight: number(raw.gasHeight, 5, 1.5, 7, "Gas height"),
    animate: flag("animate", !!model.anim),
    showTitle: flag("showTitle", true),
    showDimensions: flag("showDimensions", true),
    showResults: flag("showResults", true),
    showFormula: flag("showFormula", true),
  };
}

// The embedded SVG is a portable snapshot; editor playback draws the same scene
// directly into Canvas at the requested timeline time, including MP4 exports.
export function illustration3DSvg(raw) {
  const spec = normalizeIllustration3D(raw), ctx = svgContext();
  paintIllustration3D(ctx, spec, 0);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ctx.svg(900, 620))}`;
}

export function illustration3DThumbnail(raw) {
  const spec = normalizeIllustration3D({ ...raw, showDimensions: false }), ctx = svgContext();
  paintIllustration3D(ctx, spec, 0, true);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ctx.svg(320, 220, ctx.viewBox()))}`;
}

export function drawIllustration3D(ctx, element, seconds = 0) {
  const spec = normalizeIllustration3D(element.illustration3d);
  const scale = Math.min(element.w / 900, element.h / 620);
  ctx.save();
  ctx.beginPath(); ctx.rect(element.x, element.y, element.w, element.h); ctx.clip();
  ctx.translate(element.x + (element.w - 900 * scale) / 2, element.y + (element.h - 620 * scale) / 2);
  ctx.scale(scale, scale);
  paintIllustration3D(ctx, spec, seconds);
  ctx.restore();
}
