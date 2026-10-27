import { extraPhysicsModels } from "../../sidecar/physics-extra.mjs";
import { focusColor, focusWeight } from "./teaching-motion.mjs";
const n = (v) => Number(v.toFixed(3)).toLocaleString("id-ID");
export function drawExtraPhysics(d, p, s) {
  if (!extraPhysicsModels[p.kind]) return false;
  const { line, path, rect, ellipse, label, arrow, color, ink, soft } = d,
    t = s.time;
  if (p.kind === "accelerated-motion") {
    line(70, 330, 830, 330);
    const x = 85 + (720 * s.x) / p.distance;
    rect(x - 23, 245, 46, 80, color);
    arrow(
      x,
      220,
      20 + (50 * s.speed) / (p.initialVelocity + p.acceleration * s.duration),
      0,
    );
    label(
      `v₀ = ${n(p.initialVelocity)} m/s; a = ${n(p.acceleration)} m/s²`,
      35,
      85,
      24,
    );
    label(`t = ${n(t)} s; s = ${n(s.x)} m; v = ${n(s.speed)} m/s`, 35, 435, 24);
    label("Percepatan tetap • s = v₀t + ½at²", 35, 475, 24);
  } else if (p.kind === "inclined-plane") {
    const angle = (p.angle * Math.PI) / 180,
      L = 420,
      x0 = 230,
      y0 = 140,
      dx = L * Math.cos(angle),
      dy = L * Math.sin(angle);
    path(
      [
        [x0, y0],
        [x0 + dx, y0 + dy],
        [x0, y0 + dy],
      ],
      ink,
      "#e7f0ff",
      true,
    );
    const x = x0 + (dx * s.x) / p.distance,
      y = y0 + (dy * s.x) / p.distance;
    ellipse(x, y - 18, 19, 19, color);
    arrow(x, y - 20, 65 * Math.cos(angle), 65 * Math.sin(angle));
    label(`θ = ${p.angle}°; m = ${n(p.mass)} kg`, 35, 85, 24);
    label(
      `a = ${n(s.acceleration)} m/s²; F sejajar = ${n(s.parallel)} N`,
      35,
      440,
      23,
    );
    label(`Normal = ${n(s.normal)} N • tanpa gesekan`, 35, 475, 23);
  } else if (p.kind === "friction") {
    line(90, 300, 820, 300);
    const x = 150 + (600 * s.x) / p.distance;
    rect(x - 35, 230, 70, 70, color);
    arrow(x - 40, 265, -65, 0);
    arrow(x + 40, 265, 65, 0);
    label(
      `μ = ${n(p.coefficient)}; m = ${n(p.mass)} kg; v tetap = ${n(p.velocity)} m/s`,
      35,
      90,
      23,
    );
    label(`F gesek = F tarik = ${n(s.friction)} N`, 35, 410, 27);
    label(
      `Usaha melawan gesekan ≈ ${n(s.work)} J pada s = ${n(s.x)} m`,
      35,
      465,
      23,
    );
  } else if (p.kind === "hydraulic") {
    rect(170, 185, 160, 180, "#d4e5ff");
    rect(500, 185, 230, 180, "#d4e5ff");
    rect(310, 315, 210, 50, "#d4e5ff");
    rect(155, 170, 190, 18, focusColor(0, 2, t));
    rect(485, 170, 260, 18, focusColor(1, 2, t));
    arrow(250, 95, 0, 70);
    arrow(615, 165, 0, -70);
    label(`A₁ = ${n(p.area1)} m²`, 150, 410, 24);
    label(`A₂ = ${n(p.area2)} m²`, 500, 410, 24);
    label(
      `F₁ = ${n(p.force)} N; F₂ = ${n(s.outputForce)} N; p = ${n(s.pressure)} Pa`,
      35,
      465,
      24,
    );
  } else if (p.kind === "hydrostatic-pressure") {
    rect(260, 120, 380, 260, "#e7f0ff");
    line(260, 120, 640, 120, color);
    const y = 155 + 190 * focusWeight(0, 1, t);
    ellipse(450, 345, 10, 10, color);
    line(660, 120, 660, 345, ink, true);
    label(`h = ${n(p.depth)} m`, 680, 250, 23);
    arrow(450, 345, 55, 0);
    line(280, y, 620, y, soft);
    label(
      `ρ = ${n(p.fluidDensity)} kg/m³; g = ${n(p.gravity)} m/s²`,
      35,
      85,
      23,
    );
    label(`p = ρgh = ${n(s.pressure)} Pa`, 35, 435, 28);
    label("Tekanan ukur pada titik • atmosfer tidak dijumlahkan", 35, 475, 22);
  } else if (p.kind === "refraction") {
    rect(100, 245, 700, 150, "#e7f0ff", soft);
    line(100, 245, 800, 245);
    line(450, 65, 450, 410, soft, true);
    const a = (p.angle * Math.PI) / 180,
      from = [450 - 175 * Math.sin(a), 245 - 175 * Math.cos(a)];
    arrow(...from, 450 - from[0], 245 - from[1]);
    let end;
    if (s.totalReflection) {
      end = [450 + 175 * Math.sin(a), 245 - 175 * Math.cos(a)];
    } else {
      const r = (s.refraction * Math.PI) / 180;
      end = [450 + 150 * Math.sin(r), 245 + 150 * Math.cos(r)];
    }
    arrow(450, 245, end[0] - 450, end[1] - 245);
    const phase = p.loop ? (t % 3) / 3 : Math.min(1, t / 3);
    if (phase < 0.5)
      ellipse(
        from[0] + (450 - from[0]) * phase * 2,
        from[1] + (245 - from[1]) * phase * 2,
        7,
        7,
        color,
      );
    else
      ellipse(
        450 + (end[0] - 450) * (phase - 0.5) * 2,
        245 + (end[1] - 245) * (phase - 0.5) * 2,
        7,
        7,
        color,
      );
    label(`n₁ = ${n(p.index1)}`, 120, 100, 25);
    label(`n₂ = ${n(p.index2)}`, 120, 350, 25);
    label(
      s.totalReflection
        ? `i = ${p.angle}° • pantulan internal total`
        : `i = ${p.angle}°; r ≈ ${n(s.refraction)}°`,
      35,
      450,
      27,
    );
    label(
      "Sudut diukur terhadap normal; skema tidak menyatakan intensitas.",
      35,
      485,
      20,
    );
  } else if (p.kind === "longitudinal-wave") {
    const span = Math.max(6, 1.5 * p.wavelength),
      scale = 740 / span;
    for (let i = 0; i < 49; i++) {
      const x = (span * i) / 48,
        displacement =
          p.amplitude *
          Math.sin(2 * Math.PI * (x / p.wavelength - p.frequency * t)),
        px = 80 + (x + displacement) * scale;
      ellipse(
        px,
        245,
        i === 24 ? 9 : 5,
        i === 24 ? 9 : 5,
        i === 24 ? "#d89300" : color,
      );
      if (i === 24) {
        line(80 + x * scale, 205, 80 + x * scale, 285, soft, true);
        arrow(
          px,
          310,
          -35 * Math.cos(2 * Math.PI * (x / p.wavelength - p.frequency * t)),
          0,
        );
      }
    }
    arrow(170, 130, 500, 0);
    label("Arah rambat gelombang", 280, 100, 25);
    label(
      `A = ${n(p.amplitude)} m; λ = ${n(p.wavelength)} m; f = ${n(p.frequency)} Hz`,
      35,
      420,
      23,
    );
    label(
      `v = λf = ${n(s.speed)} m/s • partikel bergetar di tempat`,
      35,
      470,
      24,
    );
  } else if (p.kind === "series-circuit") {
    line(210, 150, 330, 150);
    line(440, 150, 490, 150);
    line(600, 150, 740, 150);
    line(740, 150, 740, 350);
    line(740, 350, 210, 350);
    line(210, 350, 210, 265);
    line(210, 150, 210, 220);
    line(180, 220, 240, 220);
    line(195, 250, 225, 250);
    line(210, 250, 210, 265);
    rect(330, 125, 110, 50, focusColor(0, 2, t));
    rect(490, 125, 110, 50, focusColor(1, 2, t));
    label(`R₁=${n(p.resistance1)} Ω`, 300, 95, 24);
    label(`R₂=${n(p.resistance2)} Ω`, 490, 95, 24);
    label(`${n(p.voltage)} V`, 95, 245, 24);
    arrow(620, 150, 50, 0);
    const route = [
        [250, 150],
        [740, 150],
        [740, 350],
        [210, 350],
        [210, 150],
        [250, 150],
      ],
      progress = p.loop ? (t % 4) / 4 : Math.min(1, t / 4),
      at = Math.min(4, Math.floor(progress * 5)),
      part = progress * 5 - at;
    ellipse(
      route[at][0] + (route[at + 1][0] - route[at][0]) * part,
      route[at][1] + (route[at + 1][1] - route[at][1]) * part,
      8,
      8,
      color,
    );
    label(`R total = ${n(s.resistance)} Ω; I = ${n(s.current)} A`, 35, 425, 26);
    label(
      `U₁ = ${n(s.voltage1)} V; U₂ = ${n(s.voltage2)} V • U₁+U₂ = U`,
      35,
      470,
      23,
    );
  }
  return true;
}
