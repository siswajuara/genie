// Native 3D scene geometry adapted from the project reference 3d-illustration.tsx.
// Rendering is stateless: the same parameters and timeline time produce the same frame.
/* Design tokens taken from the reference illustration */
const C = {
  ink: "#1B2A6B", line: "#2F55D4", ghost: "#C5D0F0",
  front: "#E8EEF9", side: "#DAE4F7", top: "#FCEEA7", result: "#2563FF",
};
const FONT = "Helvetica, Arial, sans-serif";
const PI = Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = (n, d = 0) => n.toLocaleString("id-ID", { maximumFractionDigits: d });

/* ---------- tiny 3D engine: orbit rotation + orthographic projection ---------- */
// y is up. Returns [screenX, screenY, depth]; larger depth = closer to the viewer.
const proj = (W, H, yaw, pitch, s) => {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (x, y, z) => {
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    return [W / 2 + x1 * s, H / 2 - (y * cp - z1 * sp) * s, y * sp + z1 * cp];
  };
};
const sh = (v, dx, dy, dz) => (x, y, z) => v(x + dx, y + dy, z + dz); // move the model origin

const poly = (ctx, pts, fill, stroke) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
};
const path3 = (ctx, pts, color, dash = [], wd = 2) => {
  ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke(); ctx.restore();
};
const ball = (ctx, v, s, pos, r, fill = C.front, stroke = C.line) => {
  const p = v(...pos);
  ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(2.5, r * s), 0, PI * 2);
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.stroke();
};
const plate = (ctx, v, x0, x1, z0, z1, y) =>
  poly(ctx, [v(x0, y, z0), v(x1, y, z0), v(x1, y, z1), v(x0, y, z1)], "rgba(252,238,167,0.55)", C.ghost);
// draw balls back-to-front
const drawBalls = (ctx, v, s, list) =>
  list.map((b) => ({ ...b, d: v(...b.p)[2] })).sort((a, b) => a.d - b.d)
    .forEach((b) => ball(ctx, v, s, b.p, b.r, b.fill, b.stroke));

const arrow = (ctx, v, a, b, color) => {
  const p = v(...a), q = v(...b), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
  path3(ctx, [p, q], color, [], 2.5);
  ctx.beginPath(); ctx.moveTo(q[0], q[1]);
  ctx.lineTo(q[0] - 9 * Math.cos(ang - 0.4), q[1] - 9 * Math.sin(ang - 0.4));
  ctx.lineTo(q[0] - 9 * Math.cos(ang + 0.4), q[1] - 9 * Math.sin(ang + 0.4));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
};
// text with a white halo so it stays readable over lines and fills
const txt = (ctx, x, y, text, color = C.ink) => {
  ctx.save(); ctx.font = `13px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
};
const tag = (ctx, v, p, text) => { const q = v(...p); txt(ctx, q[0], q[1], text); };
// measurements: for each dimension, highlight the candidate edge nearest the viewer and label it
const drawDims = (ctx, v, list) => {
  const c0 = v(0, 0, 0);
  list.forEach(({ c, t }) => {
    let best = c[0], bd = -Infinity;
    c.forEach((e) => { const d = v(...e[0])[2] + v(...e[1])[2]; if (d > bd) { bd = d; best = e; } });
    const a = v(...best[0]), b = v(...best[1]);
    path3(ctx, [a, b], C.result, [], 3.5);
    [a, b].forEach((p) => { ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, PI * 2); ctx.fillStyle = C.result; ctx.fill(); });
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = mx - c0[0], dy = my - c0[1], L = Math.hypot(dx, dy) || 1;
    txt(ctx, mx + (dx / L) * 18, my + (dy / L) * 18, t, C.result);
  });
};

const hull = (pts) => {
  pts = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const h = [];
  for (const p of pts) {
    while (h.length >= 2 && cr(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
    h.push(p);
  }
  const t = h.length + 1;
  for (let i = pts.length - 2; i >= 0; i--) {
    const p = pts[i];
    while (h.length >= t && cr(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
    h.push(p);
  }
  h.pop();
  return h;
};

const ring = (v, r, y, N = 56) =>
  Array.from({ length: N }, (_, i) => v(r * Math.cos((i / N) * PI * 2), y, r * Math.sin((i / N) * PI * 2)));

const hiddenArc = (ctx, pts, cd) => {
  ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = C.ghost; ctx.beginPath();
  let on = false;
  pts.forEach((p) => {
    if (p[2] < cd) { on ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); on = true; } else on = false;
  });
  ctx.stroke(); ctx.restore();
};

/* generic polyhedron: normals are derived, so any convex mesh works */
function drawMesh(ctx, v, V, F) {
  const P = V.map((p) => v(...p)), o = v(0, 0, 0);
  const cen = V.reduce((a, p) => a.map((x, i) => x + p[i] / V.length), [0, 0, 0]);
  const edges = {};
  F.forEach((f) => {
    const [a, b, c] = f.map((i) => V[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const fc = f.reduce((s, i) => s.map((x, k) => x + V[i][k] / f.length), [0, 0, 0]);
    if (n[0] * (fc[0] - cen[0]) + n[1] * (fc[1] - cen[1]) + n[2] * (fc[2] - cen[2]) < 0) n = n.map((x) => -x);
    const len = Math.hypot(...n); n = n.map((x) => x / len);
    const nv = v(...n), vis = nv[2] - o[2] > 1e-9;
    if (vis) poly(ctx, f.map((i) => P[i]), n[1] > 0.5 ? C.top : nv[0] - o[0] > 0 ? C.side : C.front);
    f.forEach((a, k) => {
      const b = f[(k + 1) % f.length], key = Math.min(a, b) + "-" + Math.max(a, b);
      edges[key] = { a, b, vis: edges[key]?.vis || vis };
    });
  });
  const stroke = (vis, color, dash) => {
    ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.beginPath();
    Object.values(edges).filter((e) => e.vis === vis).forEach((e) => {
      ctx.moveTo(P[e.a][0], P[e.a][1]); ctx.lineTo(P[e.b][0], P[e.b][1]);
    });
    ctx.stroke(); ctx.restore();
  };
  stroke(false, C.ghost, [5, 5]);
  stroke(true, C.line, []);
}

const BOX_F = [[4, 5, 7, 6], [0, 1, 3, 2], [1, 5, 7, 3], [0, 4, 6, 2], [2, 3, 7, 6], [0, 1, 5, 4]];
const boxMesh = (w, h, d) => [
  Array.from({ length: 8 }, (_, i) => [i & 1 ? w / 2 : -w / 2, (i & 2 ? h : 0) - h / 2, i & 4 ? d / 2 : -d / 2]), BOX_F];
const prismMesh = (b, a, L) => [[
  [-b / 2, -a / 2, L / 2], [b / 2, -a / 2, L / 2], [0, a / 2, L / 2],
  [-b / 2, -a / 2, -L / 2], [b / 2, -a / 2, -L / 2], [0, a / 2, -L / 2]],
  [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]];
const pyramidMesh = (p, l, t) => [[
  [-p / 2, -t / 2, -l / 2], [p / 2, -t / 2, -l / 2], [p / 2, -t / 2, l / 2], [-p / 2, -t / 2, l / 2], [0, t / 2, 0]],
  [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]];
const shift = ([V, F], dx, dy, dz) => [V.map((p) => [p[0] + dx, p[1] + dy, p[2] + dz]), F];

function drawCyl(ctx, v, r, y0, y1, o = {}) {
  const A = ring(v, r, y0), B = ring(v, r, y1), ln = o.line === false ? null : C.line;
  poly(ctx, hull([...A, ...B]), o.fill, ln);
  if (ln) hiddenArc(ctx, A, v(0, y0, 0)[2]);
  if (o.top || ln) poly(ctx, B, o.top, ln);
}

function drawCone(ctx, v, r, t) {
  const A = ring(v, r, -t / 2), apex = v(0, t / 2, 0);
  poly(ctx, hull([...A, apex]), C.front, C.line);
  hiddenArc(ctx, A, v(0, -t / 2, 0)[2]);
}

function drawSphere(ctx, v0, s, r, c = [0, 0, 0]) {
  const v = sh(v0, c[0], c[1], c[2]), o = v(0, 0, 0);
  const arc = (pts, front) => {
    ctx.save(); ctx.setLineDash(front ? [] : [5, 5]);
    ctx.strokeStyle = front ? C.line : C.ghost; ctx.lineWidth = front ? 1.5 : 2; ctx.beginPath();
    let on = false;
    pts.forEach((p) => {
      if ((p[2] > o[2]) === front) { on ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); on = true; } else on = false;
    });
    ctx.stroke(); ctx.restore();
  };
  ctx.beginPath(); ctx.arc(o[0], o[1], r * s, 0, PI * 2);
  ctx.fillStyle = C.front; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
  const lat = (72 * PI) / 180;
  poly(ctx, ring(v, r * Math.cos(lat), r * Math.sin(lat)), C.top, C.line);
  const eq = ring(v, r, 0).concat([ring(v, r, 0)[0]]);
  const mer = Array.from({ length: 57 }, (_, i) => v(r * Math.cos((i / 56) * PI * 2), r * Math.sin((i / 56) * PI * 2), 0));
  [eq, mer].forEach((pts) => arc(pts, false));
  [eq, mer].forEach((pts) => arc(pts, true));
}

/* ---------- piston constants ---------- */
const BARREL_R = 3, BARREL_H = 8, H_MIN = 1.5, H_MAX = 7;
/* ---------- net folding helpers (jaring-jaring kubus) ---------- */
const rotZ = (p, ox, a) => { const x = p[0] - ox, y = p[1]; return [ox + x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), p[2]]; };
const rotX = (p, oz, a) => { const z = p[2] - oz, y = p[1]; return [p[0], y * Math.cos(a) - z * Math.sin(a), oz + y * Math.sin(a) + z * Math.cos(a)]; };
const sq = (x0, x1, z0, z1) => [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]];

/* ---------- scenes ---------- */
// R = bounding-sphere radius at the largest slider values: the scale stays fixed while
// orbiting, so the shape never leaves the canvas at 100% zoom.
const sl = (k, label, min, max, unit = "cm", step = 1) => ({ k, label, min, max, unit, step });
const NOTE = "Proyeksi ilustratif; gunakan ukuran tertulis.";
const ELEMEN = ["Hidrogen", "Helium", "Litium", "Berilium", "Boron", "Karbon", "Nitrogen", "Oksigen", "Fluor", "Neon"];

export const illustration3DScenes = {
  kubus: {
    group: "Matematika", name: "Kubus", note: NOTE, R: 6.93, def: { s: 4 }, sliders: [sl("s", "Sisi s", 1, 8)],
    draw: (c, v, P) => drawMesh(c, v, ...boxMesh(P.s, P.s, P.s)),
    dims: (P) => `p = ${P.s}; l = ${P.s}; t = ${P.s} cm`,
    results: (P) => [`Volume ≈ ${fmt(P.s ** 3)} cm³`, `Luas permukaan ≈ ${fmt(6 * P.s ** 2)} cm²`],
    formula: "V = s × s × s;  L = 6 × s × s",
  },
  balok: {
    group: "Matematika", name: "Balok", note: NOTE, R: 6.93, def: { p: 6, l: 4, t: 3 },
    sliders: [sl("p", "Panjang p", 1, 8), sl("l", "Lebar l", 1, 8), sl("t", "Tinggi t", 1, 8)],
    draw: (c, v, P) => drawMesh(c, v, ...boxMesh(P.p, P.t, P.l)),
    dims: (P) => `p = ${P.p}; l = ${P.l}; t = ${P.t} cm`,
    results: (P) => [`Volume ≈ ${fmt(P.p * P.l * P.t)} cm³`,
      `Luas permukaan ≈ ${fmt(2 * (P.p * P.l + P.p * P.t + P.l * P.t))} cm²`],
    formula: "V = p × l × t;  L = 2(pl + pt + lt)",
  },
  prisma: {
    group: "Matematika", name: "Prisma segitiga", note: NOTE, R: 6.93, def: { b: 6, a: 4, L: 6 },
    sliders: [sl("b", "Alas segitiga b", 1, 8), sl("a", "Tinggi segitiga a", 1, 8), sl("L", "Panjang prisma L", 1, 8)],
    draw: (c, v, P) => drawMesh(c, v, ...prismMesh(P.b, P.a, P.L)),
    dims: (P) => `b = ${P.b}; a = ${P.a}; L = ${P.L} cm`,
    results: (P) => [`Volume ≈ ${fmt((P.b * P.a * P.L) / 2, 1)} cm³`,
      `Luas permukaan ≈ ${fmt(P.b * P.a + P.L * (P.b + 2 * Math.hypot(P.b / 2, P.a)), 1)} cm²`],
    formula: "V = ½ × b × a × L;  L = b·a + L(b + 2s), s = √((b/2)² + a²)",
  },
  limas: {
    group: "Matematika", name: "Limas segiempat", note: NOTE, R: 6.93, def: { p: 6, l: 6, t: 6 },
    sliders: [sl("p", "Panjang alas p", 1, 8), sl("l", "Lebar alas l", 1, 8), sl("t", "Tinggi t", 1, 8)],
    draw: (c, v, P) => drawMesh(c, v, ...pyramidMesh(P.p, P.l, P.t)),
    dims: (P) => `p = ${P.p}; l = ${P.l}; t = ${P.t} cm`,
    results: (P) => [`Volume ≈ ${fmt((P.p * P.l * P.t) / 3, 1)} cm³`,
      `Luas permukaan ≈ ${fmt(P.p * P.l + P.p * Math.hypot(P.t, P.l / 2) + P.l * Math.hypot(P.t, P.p / 2), 1)} cm²`],
    formula: "V = ⅓ × p × l × t;  L = alas + 4 sisi segitiga",
  },
  tabung: {
    group: "Matematika", name: "Tabung", note: NOTE, R: 5.66, def: { r: 3, tt: 6 },
    sliders: [sl("r", "Jari-jari r", 1, 4), sl("tt", "Tinggi t", 1, 8)],
    draw: (c, v, P) => drawCyl(c, v, P.r, -P.tt / 2, P.tt / 2, { fill: C.front, top: C.top }),
    dims: (P) => `r = ${P.r}; t = ${P.tt} cm`,
    results: (P) => [`Volume ≈ ${fmt(PI * P.r ** 2 * P.tt)} cm³`, `Luas permukaan ≈ ${fmt(2 * PI * P.r * (P.r + P.tt))} cm²`],
    formula: "V = π × r² × t;  L = 2πr(r + t)",
  },
  kerucut: {
    group: "Matematika", name: "Kerucut", note: NOTE, R: 5.66, def: { r: 3, tt: 6 },
    sliders: [sl("r", "Jari-jari r", 1, 4), sl("tt", "Tinggi t", 1, 8)],
    draw: (c, v, P) => drawCone(c, v, P.r, P.tt),
    dims: (P) => `r = ${P.r}; t = ${P.tt} cm`,
    results: (P) => [`Volume ≈ ${fmt((PI * P.r ** 2 * P.tt) / 3)} cm³`,
      `Luas permukaan ≈ ${fmt(PI * P.r * (P.r + Math.hypot(P.r, P.tt)))} cm²`],
    formula: "V = ⅓ × π × r² × t;  L = πr(r + s), s = √(r² + t²)",
  },
  bola: {
    group: "Matematika", name: "Bola", note: NOTE, R: 5, def: { r: 3 }, sliders: [sl("r", "Jari-jari r", 1, 5)],
    draw: (c, v, P, s) => drawSphere(c, v, s, P.r),
    dims: (P) => `r = ${P.r} cm`,
    results: (P) => [`Volume ≈ ${fmt((4 / 3) * PI * P.r ** 3)} cm³`, `Luas permukaan ≈ ${fmt(4 * PI * P.r ** 2)} cm²`],
    formula: "V = 4/3 × π × r³;  L = 4 × π × r²",
  },
  jaring: {
    group: "Matematika", name: "Jaring-jaring kubus", anim: true, scrub: { label: "Lipatan", fmt: (u) => `${Math.round(u * 100)}%` },
    note: "Lipat enam persegi menjadi kubus. Putar tampilan untuk melihat tiap sisi.",
    R: 7.6, def: { s: 2 }, sliders: [sl("s", "Sisi s", 1, 3, "cm", 0.5)],
    draw: (c, v0, P, s, { u }) => {
      const h = P.s / 2, th = (u * PI) / 2;
      const v = sh(v0, -h * (1 - u), -(P.s * u) / 2, 0);
      const F = [
        { q: sq(-h, h, -h, h), t: C.front },
        { q: sq(h, 3 * h, -h, h).map((p) => rotZ(p, h, th)), t: C.side },
        { q: sq(-3 * h, -h, -h, h).map((p) => rotZ(p, -h, -th)), t: C.side },
        { q: sq(-h, h, h, 3 * h).map((p) => rotX(p, h, -th)), t: C.front },
        { q: sq(-h, h, -3 * h, -h).map((p) => rotX(p, -h, th)), t: C.front },
        { q: sq(3 * h, 5 * h, -h, h).map((p) => rotZ(rotZ(p, 3 * h, th), h, th)), t: C.top },
      ].map((f) => { const pp = f.q.map((p) => v(...p)); return { ...f, pp, d: pp.reduce((a, p) => a + p[2], 0) }; });
      F.sort((a, b) => a.d - b.d).forEach((f) => poly(c, f.pp, f.t, C.line));
    },
    dims: (P) => `s = ${P.s} cm; 6 persegi sama besar`,
    results: (P) => [`Luas permukaan ≈ ${fmt(6 * P.s ** 2, 1)} cm²`, `Volume ≈ ${fmt(P.s ** 3, 1)} cm³`],
    formula: "L = 6 × s × s;  V = s × s × s",
  },
  putar: {
    group: "Matematika", name: "Benda putar", anim: true, scrub: { label: "Sudut putar", fmt: (u) => `${Math.round(u * 360)}°` },
    note: "Segitiga siku-siku diputar mengelilingi sisi tegaknya hingga membentuk kerucut.",
    R: 5.66, def: { r: 3, tt: 6 }, sliders: [sl("r", "Jari-jari r", 1, 4), sl("tt", "Tinggi t", 2, 8)],
    draw: (c, v, P, s, { u }) => {
      const { r, tt } = P, phi = u * 2 * PI, y0 = -tt / 2, apex = [0, tt / 2, 0];
      const bp = (a) => [r * Math.cos(a), y0, r * Math.sin(a)];
      const n = Math.max(1, Math.ceil(phi / (PI / 18)));
      for (let i = 0; i < n; i++) poly(c, [v(...apex), v(...bp((phi * i) / n)), v(...bp((phi * (i + 1)) / n))], "rgba(37,99,255,0.14)", null);
      path3(c, Array.from({ length: n + 1 }, (_, i) => v(...bp((phi * i) / n))), C.line);
      path3(c, [v(0, y0 - 0.8, 0), v(0, tt / 2 + 0.8, 0)], C.ink, [6, 4], 1.5);
      poly(c, [v(0, y0, 0), v(...bp(phi)), v(...apex)], "rgba(252,238,167,0.9)", C.line);
    },
    dims: (P) => `r = ${P.r}; t = ${P.tt} cm`,
    results: (P, h, u) => [`Sudut putar ≈ ${Math.round(u * 360)}°`, `Volume kerucut ≈ ${fmt((PI * P.r ** 2 * P.tt) / 3)} cm³`],
    formula: "V = ⅓ × π × r² × t",
  },
  piston: {
    group: "Fisika", name: "Piston", anim: true, R: 6.4, def: {}, sliders: [],
    note: "Dorong pendorong ke bawah: gas termampatkan, tumbukan ke dinding makin sering.",
    dims: (P, h) => `r = ${BARREL_R}; tinggi gas h = ${fmt(h, 1)} cm`,
    results: (P, h) => [`Volume gas ≈ ${fmt(PI * BARREL_R ** 2 * h)} cm³`, `Tekanan ≈ ${fmt(H_MAX / h, 1)} × tekanan awal`],
    formula: "V = π × r² × h;  P × V = tetap (hukum Boyle)",
  },
  bandul: {
    group: "Fisika", name: "Bandul", anim: true,
    note: "Ayunan kecil: periode hanya bergantung pada panjang tali, bukan massa beban.",
    R: 5.5, def: { L: 2, a: 30 }, sliders: [sl("L", "Panjang tali L", 0.5, 3, "m", 0.5), sl("a", "Sudut awal θ", 5, 30, "°", 5)],
    draw: (c, v0, P, s, { t }) => {
      const v = sh(v0, 0, -0.9, 0), Lv = P.L * 1.5, th0 = (P.a * PI) / 180, T = 2 * PI * Math.sqrt(P.L / 9.8);
      const th = th0 * Math.cos((2 * PI * t) / T);
      drawMesh(c, v, ...shift(boxMesh(4, 0.3, 1), 0, 3.15, 0));
      path3(c, Array.from({ length: 41 }, (_, i) => { const a = -th0 + (2 * th0 * i) / 40; return v(Lv * Math.sin(a), 3 - Lv * Math.cos(a), 0); }), C.ghost, [5, 5]);
      const b = [Lv * Math.sin(th), 3 - Lv * Math.cos(th), 0];
      path3(c, [v(0, 3, 0), v(...b)], C.ink, [], 1.5);
      drawSphere(c, v, s, 0.5, b);
    },
    dims: (P) => `L = ${fmt(P.L, 1)} m; θ = ${P.a}°`,
    results: (P) => { const T = 2 * PI * Math.sqrt(P.L / 9.8); return [`Periode T ≈ ${fmt(T, 2)} s`, `Frekuensi f ≈ ${fmt(1 / T, 2)} Hz`]; },
    formula: "T = 2π × √(L / g);  f = 1 / T;  g ≈ 9,8 m/s²",
  },
  pegas: {
    group: "Fisika", name: "Pegas", anim: true,
    note: "Beban bergetar naik turun. Massa besar membuat getaran lebih lambat, pegas kaku lebih cepat.",
    R: 5, def: { m: 1, k: 40 }, sliders: [sl("m", "Massa m", 0.5, 5, "kg", 0.5), sl("k", "Konstanta pegas k", 20, 100, "N/m", 10)],
    draw: (c, v0, P, s, { t }) => {
      const v = sh(v0, 0, -1.3, 0), T = 2 * PI * Math.sqrt(P.m / P.k), y = 0.5 + 1.4 * Math.cos((2 * PI * t) / T);
      drawMesh(c, v, ...shift(boxMesh(3, 0.3, 3), 0, 4.65, 0));
      const top = 4.5, bot = y + 0.7, N = 140, coils = 9;
      path3(c, Array.from({ length: N + 1 }, (_, i) => { const u = i / N; return v(0.7 * Math.cos(u * coils * 2 * PI), top + (bot - top) * u, 0.7 * Math.sin(u * coils * 2 * PI)); }), C.line);
      path3(c, [v(-1.8, 0.5, 0), v(1.8, 0.5, 0)], C.ghost, [5, 5], 1.5);
      drawMesh(c, v, ...shift(boxMesh(2, 1.4, 2), 0, y, 0));
    },
    dims: (P) => `m = ${fmt(P.m, 1)} kg; k = ${P.k} N/m`,
    results: (P) => { const T = 2 * PI * Math.sqrt(P.m / P.k); return [`Periode T ≈ ${fmt(T, 2)} s`, `Frekuensi f ≈ ${fmt(1 / T, 2)} Hz`]; },
    formula: "T = 2π × √(m / k);  f = 1 / T",
  },
  gelombang: {
    group: "Fisika", name: "Gelombang", anim: true,
    note: "Titik-titik hanya naik turun di tempatnya; bentuk gelombang yang merambat ke kanan.",
    R: 7, def: { A: 1, lam: 4, f: 1 },
    sliders: [sl("A", "Amplitudo A", 0.5, 2, "cm", 0.5), sl("lam", "Panjang gelombang λ", 2, 8, "cm"), sl("f", "Frekuensi f", 0.5, 2, "Hz", 0.5)],
    draw: (c, v, P, s, { t }) => {
      const k = (2 * PI) / P.lam, w = 2 * PI * P.f, y = (x) => P.A * Math.sin(k * x - w * t);
      plate(c, v, -6.5, 6.5, -2.5, 2.5, -2.4);
      [-2, -1, 1, 2].forEach((z) => path3(c, Array.from({ length: 61 }, (_, i) => { const x = -6 + i * 0.2; return v(x, y(x), z); }), C.ghost, [], 1.5));
      path3(c, Array.from({ length: 61 }, (_, i) => { const x = -6 + i * 0.2; return v(x, y(x), 0); }), C.line, [], 2.5);
      const dots = Array.from({ length: 13 }, (_, i) => ({ p: [-6 + i, y(-6 + i), 0], r: 0.2, fill: C.top, stroke: C.line }));
      dots.forEach((d) => path3(c, [v(d.p[0], -2.4, 0), v(...d.p)], C.ghost, [3, 3], 1.5));
      drawBalls(c, v, s, dots);
    },
    dims: (P) => `A = ${fmt(P.A, 1)} cm; λ = ${P.lam} cm; f = ${fmt(P.f, 1)} Hz`,
    results: (P) => [`Cepat rambat v ≈ ${fmt(P.lam * P.f, 1)} cm/s`, `Periode T ≈ ${fmt(1 / P.f, 1)} s`],
    formula: "v = λ × f;  T = 1 / f",
  },
  parabola: {
    group: "Fisika", name: "Gerak parabola", anim: true,
    note: "Bola ditembakkan miring. Coba sudut 45° untuk jarak terjauh.",
    R: 8, def: { v: 20, a: 45 }, sliders: [sl("v", "Kecepatan awal v₀", 10, 30, "m/s", 5), sl("a", "Sudut θ", 15, 75, "°", 5)],
    draw: (c, v, P, s, { t }) => {
      const th = (P.a * PI) / 180, g = 9.8, vx = P.v * Math.cos(th), vy = P.v * Math.sin(th), T = (2 * vy) / g, k = Math.min(0.12, 11 / (vx * T));
      const X0 = -5.5, Y0 = -2.4, at = (tt) => [X0 + vx * tt * k, Y0 + (vy * tt - 0.5 * g * tt * tt) * k, 0];
      const tt = Math.min(T, (t * 0.8) % (T + 1));
      plate(c, v, -7, 7, -1.5, 1.5, Y0);
      drawMesh(c, v, ...shift(boxMesh(0.8, 0.5, 0.8), X0, Y0 + 0.25, 0));
      path3(c, Array.from({ length: 41 }, (_, i) => v(...at((T * i) / 40))), C.ghost, [5, 5]);
      path3(c, Array.from({ length: 41 }, (_, i) => v(...at((tt * i) / 40))), C.line);
      const b = at(tt);
      drawBalls(c, v, s, [{ p: [b[0], Y0, 0], r: 0.18, fill: C.ghost, stroke: C.ghost }, { p: b, r: 0.35, fill: C.top, stroke: C.line }]);
    },
    dims: (P) => `v₀ = ${P.v} m/s; θ = ${P.a}°`,
    results: (P) => {
      const th = (P.a * PI) / 180;
      return [`Jarak ≈ ${fmt((P.v ** 2 * Math.sin(2 * th)) / 9.8, 1)} m`, `Tinggi maks ≈ ${fmt((P.v * Math.sin(th)) ** 2 / 19.6, 1)} m`, `Waktu ≈ ${fmt((2 * P.v * Math.sin(th)) / 9.8, 1)} s`];
    },
    formula: "jarak = v₀² sin 2θ / g;  tinggi maks = (v₀ sin θ)² / 2g;  g ≈ 9,8 m/s²",
  },
  miring: {
    group: "Fisika", name: "Bidang miring", anim: true,
    note: "Balok meluncur tanpa gesekan. Panah: berat (ke bawah), gaya normal (tegak lurus bidang), gaya sejajar bidang.",
    R: 5.6, def: { m: 2, a: 30 }, sliders: [sl("m", "Massa m", 1, 5, "kg"), sl("a", "Sudut bidang θ", 10, 50, "°", 5)],
    draw: (c, v, P, s, { t }) => {
      const th = (P.a * PI) / 180, cs = Math.cos(th), sn = Math.sin(th), acc = 9.8 * sn;
      const A = [-4 * cs, -4 * sn];
      drawMesh(c, v, [[A[0], A[1], 1.5], [4 * cs, A[1], 1.5], [4 * cs, 4 * sn, 1.5], [A[0], A[1], -1.5], [4 * cs, A[1], -1.5], [4 * cs, 4 * sn, -1.5]],
        [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]);
      const Ts = Math.sqrt(12 / acc), tl = Math.min(Ts, (t * 0.8) % (Ts + 0.8)), d = 1 + 0.5 * acc * tl * tl;
      const sz = 0.9 + P.m * 0.1, [bv, bf] = boxMesh(sz * 1.6, sz, sz * 1.6);
      const ctr = [A[0] + (8 - d) * cs - (sz / 2) * sn, A[1] + (8 - d) * sn + (sz / 2) * cs, 0];
      drawMesh(c, v, bv.map((p) => { const r = rotZ(p, 0, th); return [r[0] + ctr[0], r[1] + ctr[1], r[2]]; }), bf);
      const k = 0.05, W = P.m * 9.8;
      arrow(c, v, ctr, [ctr[0], ctr[1] - W * k, 0], C.ink);
      arrow(c, v, ctr, [ctr[0] - sn * W * cs * k, ctr[1] + cs * W * cs * k, 0], C.line);
      arrow(c, v, ctr, [ctr[0] - cs * W * sn * k, ctr[1] - sn * W * sn * k, 0], C.result);
    },
    dims: (P) => `m = ${P.m} kg; θ = ${P.a}°`,
    results: (P) => { const th = (P.a * PI) / 180; return [`Percepatan a ≈ ${fmt(9.8 * Math.sin(th), 1)} m/s²`, `Gaya sejajar bidang ≈ ${fmt(P.m * 9.8 * Math.sin(th), 1)} N`, `Gaya normal ≈ ${fmt(P.m * 9.8 * Math.cos(th), 1)} N`]; },
    formula: "a = g sin θ;  F = m g sin θ;  N = m g cos θ",
  },
  listrik: {
    group: "Fisika", name: "Rangkaian listrik", anim: true,
    note: "Arus konvensional mengalir dari kutub + ke −; elektron bergerak ke arah sebaliknya. Lampu makin terang jika arus besar.",
    R: 5.4, def: { V: 6, R: 4 }, sliders: [sl("V", "Tegangan V", 3, 12, "V", 1.5), sl("R", "Hambatan R", 2, 10, "Ω")],
    draw: (c, v, P, s, { t }) => {
      const I = P.V / P.R, W = 4, Hh = 2.2, Lp = 2 * (2 * W + 2 * Hh);
      const segs = [[[-W, Hh], [-W, -Hh]], [[-W, -Hh], [W, -Hh]], [[W, -Hh], [W, Hh]], [[W, Hh], [-W, Hh]]], lens = [2 * Hh, 2 * W, 2 * Hh, 2 * W];
      const at = (d) => { d = ((d % Lp) + Lp) % Lp; let i = 0; while (d > lens[i]) { d -= lens[i]; i++; } const [a, b] = segs[i], f = d / lens[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0]; };
      path3(c, [[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh], [-W, -Hh]].map(([x, y]) => v(x, y, 0)), C.line, [], 3);
      drawMesh(c, v, ...shift(boxMesh(1, 1.8, 1), -W, 0, 0));
      tag(c, v, [-W, 1.5, 0], "+"); tag(c, v, [-W, -1.5, 0], "−");
      const b = clamp(I / 6, 0.15, 1);
      ball(c, v, s, [W, 0, 0], 0.8, `rgba(252,238,167,${0.25 + 0.75 * b})`, C.line);
      drawBalls(c, v, s, Array.from({ length: 14 }, (_, i) => ({ p: at(t * I * 0.6 + (i * Lp) / 14), r: 0.16, fill: C.line, stroke: C.ink })));
    },
    dims: (P) => `V = ${fmt(P.V, 1)} V; R = ${P.R} Ω`,
    results: (P) => [`Kuat arus I ≈ ${fmt(P.V / P.R, 2)} A`, `Daya P ≈ ${fmt((P.V * P.V) / P.R, 1)} W`],
    formula: "I = V / R;  P = V × I",
  },
  tuas: {
    group: "Fisika", name: "Tuas", anim: true,
    note: "Tuas seimbang jika torsi kiri sama dengan torsi kanan. Ubah beban dan panjang lengan.",
    R: 6.2, def: { m1: 2, d1: 3, m2: 3, d2: 2 },
    sliders: [sl("m1", "Beban kiri", 1, 5, "kg"), sl("d1", "Lengan kiri", 1, 4, "m"), sl("m2", "Beban kanan", 1, 5, "kg"), sl("d2", "Lengan kanan", 1, 4, "m")],
    draw: (c, v, P, s, { t, st }) => {
      const tq = P.m2 * P.d2 - P.m1 * P.d1, target = clamp(-tq * 0.05, -0.35, 0.35) + 0.015 * Math.sin(2 * t);
      st.tilt = target;
      const a = st.tilt, rot = ([V, F], o = [0, 0, 0]) => [V.map((p) => { const r = rotZ(p, 0, a); return [r[0] + o[0], r[1] + o[1], r[2] + o[2]]; }), F];
      plate(c, v, -6, 6, -2, 2, -1.65);
      drawMesh(c, v, ...shift(prismMesh(1.6, 1.5, 2), 0, -0.9, 0));
      drawMesh(c, v, ...rot(boxMesh(10, 0.3, 1.2)));
      [[-P.d1 * 1.2, P.m1], [P.d2 * 1.2, P.m2]].forEach(([x, m]) => {
        const sz = 0.7 + 0.12 * m, base = rotZ([x, 0, 0], 0, a), n = [-Math.sin(a), Math.cos(a)], h = 0.15 + sz / 2;
        drawMesh(c, v, ...rot(boxMesh(sz, sz, sz), [base[0] + n[0] * h, base[1] + n[1] * h, 0]));
      });
    },
    dims: (P) => `m₁ = ${P.m1} kg, d₁ = ${P.d1} m; m₂ = ${P.m2} kg, d₂ = ${P.d2} m`,
    results: (P) => { const L = P.m1 * 9.8 * P.d1, R = P.m2 * 9.8 * P.d2; return [`Torsi kiri ≈ ${fmt(L)} N·m`, `Torsi kanan ≈ ${fmt(R)} N·m`, L === R ? "Seimbang" : R > L ? "Sisi kanan turun" : "Sisi kiri turun"]; },
    formula: "Seimbang jika m₁ × d₁ = m₂ × d₂",
  },
  cahaya: {
    group: "Fisika", name: "Cahaya", anim: true,
    note: "Sinar dari udara ke air: sebagian dipantulkan (sudut sama), sebagian dibiaskan mendekati garis normal.",
    R: 6.4, def: { a: 45, n: 1.3 }, sliders: [sl("a", "Sudut datang i", 10, 80, "°", 5), sl("n", "Indeks bias air n", 1, 2, "", 0.1)],
    draw: (c, v, P, s, { t }) => {
      const i = (P.a * PI) / 180, r = Math.asin(Math.sin(i) / P.n);
      const Pi = [-5 * Math.sin(i), 5 * Math.cos(i), 0], Pr = [5 * Math.sin(i), 5 * Math.cos(i), 0], Pt = [4 * Math.sin(r), -4 * Math.cos(r), 0];
      poly(c, [v(-5.5, -3.5, -2.5), v(5.5, -3.5, -2.5), v(5.5, -3.5, 2.5), v(-5.5, -3.5, 2.5)], "rgba(37,99,255,0.12)", C.ghost);
      [[-5.5, -2.5], [5.5, -2.5], [5.5, 2.5], [-5.5, 2.5]].forEach(([x, z]) => path3(c, [v(x, 0, z), v(x, -3.5, z)], C.ghost, [4, 4], 1.5));
      plate(c, v, -5.5, 5.5, -2.5, 2.5, 0);
      path3(c, [v(0, -4, 0), v(0, 5, 0)], C.ink, [4, 4], 1.2);
      path3(c, [v(...Pi), v(0, 0, 0)], C.result, [], 3);
      path3(c, [v(0, 0, 0), v(...Pr)], C.line, [], 1.8);
      path3(c, [v(0, 0, 0), v(...Pt)], C.result, [], 3);
      const tau = (t * 0.5) % 1, pos = tau < 0.5 ? Pi.map((x) => x * (1 - 2 * tau)) : Pt.map((x) => x * (tau - 0.5) * 2);
      ball(c, v, s, pos, 0.2, C.top, C.line);
      tag(c, v, [-5, 0.7, 2.5], "Udara"); tag(c, v, [-5, -0.7, 2.5], "Air"); tag(c, v, [0.5, 5.3, 0], "normal");
    },
    dims: (P) => `i = ${P.a}°; n = ${fmt(P.n, 1)}`,
    results: (P) => [`Sudut pantul = ${P.a}°`, `Sudut bias r ≈ ${fmt((Math.asin(Math.sin((P.a * PI) / 180) / P.n) * 180) / PI, 1)}°`],
    formula: "sudut pantul = sudut datang;  sin i / sin r = n",
  },
  surya: {
    group: "IPA", name: "Tata surya", anim: true,
    note: "Planet mengelilingi Matahari. Jarak dan ukuran tidak sesuai skala.",
    R: 6.2, def: { sp: 1 }, sliders: [sl("sp", "Kecepatan waktu", 1, 4, "×")],
    draw: (c, v, P, s, { t }) => {
      const PL = [[2.2, 0.25, 0.24, C.side], [3.2, 0.35, 0.62, C.side], [4.3, 0.4, 1, "#7FA0F0"], [5.4, 0.3, 1.88, C.side]];
      const ang = (per) => (2 * PI * t * P.sp) / (6 * per);
      PL.forEach(([r]) => path3(c, ring(v, r, 0).concat([ring(v, r, 0)[0]]), C.ghost, [], 1.5));
      const bumi = [4.3 * Math.cos(ang(1)), 0, 4.3 * Math.sin(ang(1))];
      path3(c, ring(sh(v, ...bumi), 0.8, 0).concat([ring(sh(v, ...bumi), 0.8, 0)[0]]), C.ghost, [3, 3], 1);
      const m = ang(0.074);
      drawBalls(c, v, s, [
        { p: [0, 0, 0], r: 1.1, fill: C.top, stroke: C.line },
        ...PL.map(([r, rr, per, fill]) => ({ p: [r * Math.cos(ang(per)), 0, r * Math.sin(ang(per))], r: rr, fill, stroke: C.line })),
        { p: [bumi[0] + 0.8 * Math.cos(m), 0, bumi[2] + 0.8 * Math.sin(m)], r: 0.14, fill: "#fff", stroke: C.line },
      ]);
    },
    dims: (P) => `Kecepatan waktu ${P.sp}×`,
    results: () => ["Bumi: 1 revolusi ≈ 365 hari", "Bulan: 1 revolusi ≈ 27 hari", "Merkurius ≈ 88 hari; Mars ≈ 687 hari"],
    formula: "Revolusi = satu kali mengelilingi pusat putarannya",
  },
  atom: {
    group: "IPA", name: "Model atom", anim: true,
    note: "Model Bohr: elektron mengelilingi inti pada kulit-kulitnya.",
    R: 4.8, def: { Z: 6 }, sliders: [sl("Z", "Nomor atom Z", 1, 10, "")],
    draw: (c, v, P, s, { t }) => {
      const n = [Math.min(P.Z, 2), Math.max(0, P.Z - 2)], rad = [2.2, 4], tilt = [0.45, -0.55], om = [1.6, 0.9];
      const pos = (k, phi) => { const z0 = rad[k] * Math.sin(phi), a = tilt[k]; return [rad[k] * Math.cos(phi), -z0 * Math.sin(a), z0 * Math.cos(a)]; };
      [0, 1].forEach((k) => path3(c, Array.from({ length: 65 }, (_, i) => v(...pos(k, (i / 64) * 2 * PI))), C.ghost, [], 1.5));
      const el = [];
      [0, 1].forEach((k) => { for (let j = 0; j < n[k]; j++) el.push({ p: pos(k, om[k] * t + (j * 2 * PI) / n[k]), r: 0.26, fill: C.line, stroke: C.ink }); });
      drawBalls(c, v, s, [{ p: [0, 0, 0], r: 0.9, fill: C.top, stroke: C.line }, ...el]);
    },
    dims: (P) => `Z = ${P.Z}`,
    results: (P) => [`${ELEMEN[P.Z - 1]}: ${P.Z} proton, ${P.Z} elektron`, `Susunan elektron: ${Math.min(P.Z, 2)}${P.Z > 2 ? `, ${P.Z - 2}` : ""}`],
    formula: "Kulit 1 menampung maksimal 2 elektron; kulit 2 maksimal 8",
  },
  siklus: {
    group: "IPA", name: "Siklus air", anim: true,
    note: "Air laut menguap, membentuk awan, turun sebagai hujan, lalu mengalir kembali ke laut.",
    R: 7.5, def: { e: 2 }, sliders: [sl("e", "Panas Matahari", 1, 3, "×")],
    draw: (c, v0, P, s, { t }) => {
      const v = sh(v0, 0, -1.2, 0), sp = 0.12 * P.e;
      poly(c, [v(-6, -2, -2.5), v(-1, -2, -2.5), v(-1, -2, 2.5), v(-6, -2, 2.5)], "rgba(37,99,255,0.2)", C.ghost);
      plate(c, v, -1, 6, -2.5, 2.5, -2);
      drawMesh(c, v, ...shift(pyramidMesh(4, 3, 2.4), 3.5, -0.8, 0));
      const ph = (k, n, m = 1) => (t * sp * m + k / n) % 1, L = (a, b, f) => a + (b - a) * f;
      const parts = [{ p: [-4.5, 3.6, 0], r: 0.9, fill: C.top }, { p: [1, 3.2, 0], r: 0.8, fill: "#fff" }, { p: [1.9, 3.5, 0.3], r: 0.95, fill: "#fff" }, { p: [2.8, 3.2, 0], r: 0.8, fill: "#fff" }];
      for (let i = 0; i < 12; i++) { const xs = -5 + ((i * 37) % 35) / 10, f = ph(i, 12); parts.push({ p: [L(xs, 1, f), L(-2, 3, f), ((i * 7) % 5 - 2) * 0.8], r: 0.13, fill: C.ghost }); }
      for (let j = 0; j < 10; j++) { const f = ph(j, 10, 1.3); parts.push({ p: [0.8 + ((j * 17) % 25) / 10, L(2.8, -1.9, f), ((j * 5) % 5 - 2) * 0.5], r: 0.1, fill: C.line }); }
      for (let k = 0; k < 7; k++) { const f = ph(k, 7); parts.push({ p: [L(2, -1, f), -1.9, 2 - k * 0.1], r: 0.1, fill: C.result }); }
      drawBalls(c, v, s, parts);
      tag(c, v, [-3.5, 0.2, 0], "Penguapan"); tag(c, v, [1.9, 4.8, 0], "Awan"); tag(c, v, [3.9, 1, 0], "Hujan"); tag(c, v, [0.7, -2.8, 2.5], "Aliran sungai");
    },
    dims: (P) => `Panas Matahari ${P.e}×`,
    results: () => ["Penguapan, pengembunan, lalu hujan", "Makin panas Matahari, makin cepat penguapan"],
    formula: "Air laut → uap air → awan → hujan → sungai → laut",
  },
  bulan: {
    group: "IPA", name: "Fase Bulan", anim: true, loop: 0.04,
    scrub: { label: "Hari ke", fmt: (u) => fmt(u * 29.5, 0) },
    note: "Fase Bulan berulang dalam sekitar 29,5 hari (bulan sinodis). Kotak di kiri atas: Bulan seperti terlihat dari Bumi.",
    R: 6.4, def: { sp: 1 }, sliders: [sl("sp", "Kecepatan waktu", 1, 4, "×")],
    draw: (c, v, P, s, { u }) => {
      const ang = u * 2 * PI, mp = [4 * Math.cos(ang), 0, -4 * Math.sin(ang)];
      path3(c, ring(v, 4, 0).concat([ring(v, 4, 0)[0]]), C.ghost, [], 1.5);
      path3(c, [v(0, 0, 0), v(...mp)], C.ghost, [4, 4], 1.2);
      [-1.5, 0, 1.5].forEach((z) => arrow(c, v, [7, 0, z], [5.6, 0, z], C.line));
      tag(c, v, [6.3, 0.9, 0], "Sinar Matahari");
      drawBalls(c, v, s, [{ p: [0, 0, 0], r: 1, fill: "#7FA0F0" }, { p: mp, r: 0.45, fill: C.front }]);
      const cx = 62, cy = 70, r = 30, k = Math.cos(ang), waxing = ang < PI;
      c.beginPath(); c.arc(cx, cy, r, 0, PI * 2); c.fillStyle = C.ink; c.fill();
      const side = waxing ? 1 : -1;
      const lit = Array.from({ length: 49 }, (_, j) => {
        const a = -PI / 2 + PI * j / 48;
        return [cx + side * r * Math.cos(a), cy + r * Math.sin(a)];
      }).concat(Array.from({ length: 49 }, (_, j) => {
        const a = PI / 2 - PI * j / 48;
        return [cx + side * k * r * Math.cos(a), cy + r * Math.sin(a)];
      }));
      poly(c, lit, C.top);
      c.beginPath(); c.arc(cx, cy, r, 0, PI * 2); c.strokeStyle = C.line; c.stroke();
    },
    dims: () => "Satu bulan sinodis ≈ 29,5 hari",
    results: (P, h, u) => {
      const n = u < 0.03 || u > 0.97 ? "Bulan baru" : u < 0.22 ? "Sabit (membesar)" : u < 0.28 ? "Kuartal pertama" : u < 0.47 ? "Cembung (membesar)" : u < 0.53 ? "Purnama"
        : u < 0.72 ? "Cembung (mengecil)" : u < 0.78 ? "Kuartal akhir" : "Sabit (mengecil)";
      return [`Hari ke-${fmt(u * 29.5, 0)}`, `Fase: ${n}`];
    },
    formula: "Bagian Bulan yang terang selalu menghadap Matahari",
  },
  molekul: {
    group: "IPA", name: "Molekul", anim: true,
    note: "Atom bergetar pada ikatannya. Biru: oksigen; putih: hidrogen; biru muda di tengah: karbon. Geser untuk memilih molekul.",
    R: 4.2, def: { k: 1 }, sliders: [sl("k", "Pilih molekul (1 sampai 3)", 1, 3, "")],
    draw: (c, v, P, s, { t }) => {
      const vib = (i) => 1 + 0.07 * Math.sin(3 * t + i * 1.7), O = "#7FA0F0";
      let atoms;
      if (P.k === 1) { const a = (104.5 / 2) * (PI / 180); atoms = [{ p: [0, 0, 0], r: 0.8, fill: O }, { p: [2 * Math.sin(a) * vib(1), -2 * Math.cos(a) * vib(1), 0], r: 0.45, fill: "#fff" }, { p: [-2 * Math.sin(a) * vib(2), -2 * Math.cos(a) * vib(2), 0], r: 0.45, fill: "#fff" }]; }
      else if (P.k === 2) atoms = [{ p: [0, 0, 0], r: 0.7, fill: C.side }, { p: [2.6 * vib(1), 0, 0], r: 0.8, fill: O }, { p: [-2.6 * vib(2), 0, 0], r: 0.8, fill: O }];
      else atoms = [{ p: [0, 0, 0], r: 0.7, fill: C.side }, ...[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((q, i) => ({ p: q.map((x) => x * 1.3 * vib(i)), r: 0.4, fill: "#fff" }))];
      atoms.slice(1).forEach((a) => path3(c, [v(0, 0, 0), v(...a.p)], C.ink, [], 3));
      drawBalls(c, v, s, atoms);
    },
    dims: (P) => ["H₂O (air)", "CO₂ (karbon dioksida)", "CH₄ (metana)"][P.k - 1],
    results: (P) => [["2 atom H + 1 atom O", "1 atom C + 2 atom O", "1 atom C + 4 atom H"][P.k - 1], ["Bentuk: menekuk, sudut ≈ 104,5°", "Bentuk: lurus, sudut 180°", "Bentuk: tetrahedral, sudut ≈ 109,5°"][P.k - 1]],
    formula: "Rumus kimia menunjukkan jumlah tiap atom dalam satu molekul",
  },
};

/* edge measurements for the math shapes: candidate edges per dimension (nearest one is labelled) */
const eX = (w, h, d) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [[-w / 2, (y * h) / 2, (z * d) / 2], [w / 2, (y * h) / 2, (z * d) / 2]]));
const eY = (w, h, d) => [-1, 1].flatMap((x) => [-1, 1].map((z) => [[(x * w) / 2, -h / 2, (z * d) / 2], [(x * w) / 2, h / 2, (z * d) / 2]]));
const eZ = (w, h, d) => [-1, 1].flatMap((x) => [-1, 1].map((y) => [[(x * w) / 2, (y * h) / 2, -d / 2], [(x * w) / 2, (y * h) / 2, d / 2]]));
const boxDim = (w, h, d, nx, ny, nz) => [{ c: eX(w, h, d), t: nx }, { c: eY(w, h, d), t: ny }, { c: eZ(w, h, d), t: nz }];
const circ = (r, y, n = 4) => Array.from({ length: n }, (_, i) => [r * Math.cos((i * 2 * PI) / n), y, r * Math.sin((i * 2 * PI) / n)]);
const DIMS = {
  kubus: (P) => boxDim(P.s, P.s, P.s, `p = ${P.s}`, `t = ${P.s}`, `l = ${P.s}`),
  balok: (P) => boxDim(P.p, P.t, P.l, `p = ${P.p}`, `t = ${P.t}`, `l = ${P.l}`),
  prisma: ({ b, a, L }) => [
    { c: [-1, 1].map((z) => [[-b / 2, -a / 2, (z * L) / 2], [b / 2, -a / 2, (z * L) / 2]]), t: `b = ${b}` },
    { c: [-1, 1].map((z) => [[0, -a / 2, (z * L) / 2], [0, a / 2, (z * L) / 2]]), t: `a = ${a}` },
    { c: [[-b / 2, -a / 2], [b / 2, -a / 2], [0, a / 2]].map(([x, y]) => [[x, y, -L / 2], [x, y, L / 2]]), t: `L = ${L}` }],
  limas: ({ p, l, t }) => [
    { c: [-1, 1].map((z) => [[-p / 2, -t / 2, (z * l) / 2], [p / 2, -t / 2, (z * l) / 2]]), t: `p = ${p}` },
    { c: [-1, 1].map((x) => [[(x * p) / 2, -t / 2, -l / 2], [(x * p) / 2, -t / 2, l / 2]]), t: `l = ${l}` },
    { c: [[[0, -t / 2, 0], [0, t / 2, 0]]], t: `t = ${t}` }],
  tabung: ({ r, tt }) => [
    { c: circ(r, tt / 2).map((p) => [[0, tt / 2, 0], p]), t: `r = ${r}` },
    { c: circ(r, 0, 8).map((p) => [[p[0], -tt / 2, p[2]], [p[0], tt / 2, p[2]]]), t: `t = ${tt}` }],
  kerucut: ({ r, tt }) => [
    { c: circ(r, -tt / 2).map((p) => [[0, -tt / 2, 0], p]), t: `r = ${r}` },
    { c: [[[0, -tt / 2, 0], [0, tt / 2, 0]]], t: `t = ${tt}` },
    { c: circ(r, -tt / 2, 8).map((p) => [p, [0, tt / 2, 0]]), t: `s = ${fmt(Math.hypot(r, tt), 1)}` }],
  bola: ({ r }) => [{ c: circ(r, 0).map((p) => [[0, 0, 0], p]), t: `r = ${r}` }],
  jaring: (P, u) => {
    const h = P.s / 2, dx = -h * (1 - u), dy = -(P.s * u) / 2, o = (p) => [p[0] + dx, p[1] + dy, p[2]];
    return [{ c: [[[-h, 0, -h], [h, 0, -h]], [[-h, 0, h], [h, 0, h]], [[-h, 0, -h], [-h, 0, h]], [[h, 0, -h], [h, 0, h]]].map((e) => e.map(o)), t: `s = ${P.s}` }];
  },
  putar: ({ r, tt }, u) => [
    { c: [[[0, -tt / 2, 0], [r * Math.cos(u * 2 * PI), -tt / 2, r * Math.sin(u * 2 * PI)]]], t: `r = ${r}` },
    { c: [[[0, -tt / 2, 0], [0, tt / 2, 0]]], t: `t = ${tt}` }],
};
Object.entries(DIMS).forEach(([k, f]) => { illustration3DScenes[k].dim = f; });


// Piston particles use a bounded analytic trajectory, independent of render order.
function drawPiston(ctx, v, h, t) {
  const w = sh(v, 0, -1.6, 0), floor = -BARREL_H / 2, hy = floor + h;
  drawCyl(ctx, w, BARREL_R, floor, floor + BARREL_H, { fill: "rgba(232,238,249,0.45)" });
  drawCyl(ctx, w, BARREL_R - 0.05, floor, hy, { fill: "rgba(37,99,255,0.12)", line: false });
  ctx.fillStyle = C.line;
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996 + t * (i % 2 ? 1.1 : -1.3);
    const radius = 0.5 + (i % 6) * 0.4;
    const y = floor + 0.25 + (h - 0.5) * (0.5 + 0.5 * Math.sin(t * 4 / h + i * 1.7));
    const p = w(radius * Math.cos(a), y, radius * Math.sin(a));
    ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, PI * 2); ctx.fill();
  }
  drawCyl(ctx, w, BARREL_R - 0.25, hy, hy + 0.7, { fill: C.side, top: C.top });
  drawCyl(ctx, w, 0.35, hy + 0.7, hy + 3.7, { fill: C.front });
  drawCyl(ctx, w, 1.4, hy + 3.7, hy + 4.2, { fill: C.side, top: C.top });
  drawCyl(ctx, w, BARREL_R, floor, floor + BARREL_H, { fill: "rgba(232,238,249,0.22)" });
}

export function paintIllustration3D(ctx, spec, seconds = 0, thumbnail = false) {
  const scene = illustration3DScenes[spec.scene], P = spec.parameters;
  const t = spec.animate ? Math.max(0, Number.isFinite(seconds) ? seconds : 0) : 0;
  const start = spec.scene === "piston" ? (spec.gasHeight - H_MIN) / (H_MAX - H_MIN) : spec.progress;
  const phase = Math.acos(clamp(1 - 2 * start, -1, 1));
  const u = !t ? spec.progress : scene.loop
    ? (spec.progress + t * scene.loop * (P.sp || 1)) % 1
    : 0.5 - 0.5 * Math.cos(phase + t * 0.9);
  const h = spec.scene === "piston" && t ? H_MIN + (H_MAX - H_MIN) * u : spec.gasHeight;
  ctx.save();
  ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.font = `26px ${FONT}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  if (!thumbnail && spec.showTitle) { ctx.fillStyle = C.ink; ctx.fillText(scene.name, 35, 30); }
  ctx.save();
  ctx.translate(0, 60);
  const scale = 160 / scene.R * spec.zoom;
  const v = proj(900, 360, spec.yaw * PI / 180, spec.pitch * PI / 180, scale);
  if (spec.scene === "piston") drawPiston(ctx, v, h, t);
  else scene.draw(ctx, v, P, scale, { t, u, st: { tilt: 0 } });
  if (spec.showDimensions && scene.dim) drawDims(ctx, v, scene.dim(P, u));
  ctx.restore();
  if (thumbnail) { ctx.restore(); return; }
  ctx.font = `18px ${FONT}`; ctx.fillStyle = C.ink;
  if (spec.showDimensions) ctx.fillText(scene.dims(P, h), 35, 445);
  if (spec.showResults) {
    ctx.font = `21px ${FONT}`; ctx.fillStyle = C.result;
    scene.results(P, h, u).forEach((text, i) => ctx.fillText(text, 35, 480 + i * 28));
  }
  if (spec.showFormula) {
    ctx.font = `17px ${FONT}`; ctx.fillStyle = C.ink;
    const words = scene.formula.split(" ");
    let line = "", row = 0;
    for (const word of words) {
      if ((line + word).length > 88) { ctx.fillText(line, 35, 580 + row++ * 23); line = ""; }
      line += (line ? " " : "") + word;
    }
    if (line) ctx.fillText(line, 35, 580 + row * 23);
  }
  ctx.restore();
}
