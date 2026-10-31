// Shared by pack preparation and the editor. Older canvases are never migrated.
export function sceneSafeArea(w, h) {
  const short = Math.min(w, h);
  const top = short * 0.18;
  // Default bottom captions end at 90% height. Include their padding, pop
  // animation and a gap, using the same width-relative font size as rendering.
  const bottom = h * 0.9 - w * 0.045 * 2.05 * 1.18 - short * 0.025;
  return { x: w * 0.05, y: top, w: w * 0.9, h: Math.max(1, bottom - top) };
}

export function brandingRole(o) {
  if (o.brandRole === "content") return undefined;
  if (o.brandRole) return o.brandRole;
  if (/^siswa-juara-logo-/.test(o.identifier || "")) return "logo";
  if (o.identifier === "handle") return "handle";
  if (/^(footer|website|divider-[12]|social-)/.test(o.identifier || ""))
    return "footer";
}

export function headerBranding(objects, w, h) {
  const logos = objects.filter((o) => brandingRole(o) === "logo");
  if (!logos.length) throw Error("The standard frame needs a Siswa Juara logo.");
  const short = Math.min(w, h), inset = short * 0.025;
  const left = Math.min(...logos.map((o) => o.x));
  const top = Math.min(...logos.map((o) => o.y));
  const width = Math.max(...logos.map((o) => o.x + o.w)) - left;
  const height = Math.max(...logos.map((o) => o.y + o.h)) - top;
  const k = Math.min(short * 0.23 / Math.max(1, width), short * 0.12 / Math.max(1, height));
  const clean = (o) => {
    const { fid, gid, animation, ...rest } = o;
    return { ...rest, lock: false, generationRole: "fixed" };
  };
  const source = objects.find((o) => o.t === "text" && o.identifier === "handle");
  return [
    ...logos.map((o) => ({
      ...clean(o), brandRole: "logo", x: inset + (o.x - left) * k,
      y: inset + (o.y - top) * k, w: o.w * k, h: o.h * k,
    })),
    {
      ...clean(source || {}), id: source?.id || "brand-handle", t: "text",
      n: "Handle", identifier: "handle", brandRole: "handle",
      text: source?.brandRole === "handle" ? source.text : "@siswajuaraofficial",
      x: w - inset - short * 0.42, y: inset + short * 0.03,
      w: short * 0.42, h: short * 0.06, size: short * 0.035,
      color: source?.color || "#1b2a7a", font: "Nunito", weight: 800,
      align: "right", lh: 1.15, rot: 0,
    },
  ];
}

export function isSceneSurface(o, w, h) {
  if (o.rot || !["rect", "img", "video", "line"].includes(o.t)) return false;
  const fullX = o.x <= 1 && o.x + o.w >= w - 1;
  const fullY = o.y <= 1 && o.y + o.h >= h - 1;
  return (fullX && fullY) ||
    (o.t === "rect" && ((fullY && o.w <= w * 0.03) || (fullX && o.h <= h * 0.03)));
}

const metrics = ["size", "lw", "r", "tsw", "sh", "shx", "shy", "ls", "bend", "dash"];
function box(o) {
  // Rotated ornaments must fit as well as upright text and cards.
  const a = (o.rot || 0) * Math.PI / 180;
  const w = Math.abs(o.w * Math.cos(a)) + Math.abs(o.h * Math.sin(a));
  const h = Math.abs(o.w * Math.sin(a)) + Math.abs(o.h * Math.cos(a));
  const pad = Math.max(o.lw || 0, o.tsw || 0, o.sh || 0);
  return { x: o.x + (o.w - w) / 2 - pad, y: o.y + (o.h - h) / 2 - pad,
    w: w + pad * 2, h: h + pad * 2 };
}
export function withSceneSafeLayout(preset) {
  if (preset.kind !== "template" || !preset.branding) return preset;
  const w = preset.W || 1122, h = preset.H || 1402;
  // Retire footer chrome and duplicate wordmarks. Series labels and page
  // numbers remain editable layers and move below the branding strip.
  const objects = preset.objects.filter((o) =>
    brandingRole(o) !== "footer" &&
    !(o.t === "text" && /^Brand$/i.test(o.n) && !brandingRole(o)) &&
    !/^Footer(?: rule)?$/i.test(o.n));
  const content = objects.filter((o) => !brandingRole(o) && !isSceneSurface(o, w, h));
  const boxes = content.map(box);
  if (preset.teachingArea) boxes.push(preset.teachingArea);
  if (!boxes.length) return { ...preset, objects };
  const area = sceneSafeArea(w, h);
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  const bw = Math.max(...boxes.map((b) => b.x + b.w)) - x;
  const bh = Math.max(...boxes.map((b) => b.y + b.h)) - y;
  const k = Math.min(1, area.w / Math.max(1, bw), area.h / Math.max(1, bh));
  const dx = Math.max(area.x, Math.min(x, area.x + area.w - bw * k)) - x * k;
  const dy = Math.max(area.y, Math.min(y, area.y + area.h - bh * k)) - y * k;
  const transform = (o) => {
    const next = { ...o, x: o.x * k + dx, y: o.y * k + dy, w: o.w * k, h: o.h * k };
    for (const key of metrics) if (o[key] !== undefined) next[key] = o[key] * k;
    return next;
  };
  // Authoring layers can lack IDs; object identity is authoritative here.
  const members = new Set(content);
  return { ...preset,
    objects: objects.map((o) => members.has(o) ? transform(o) : o),
    ...(preset.teachingArea ? { teachingArea: transform(preset.teachingArea) } : {}),
  };
}
