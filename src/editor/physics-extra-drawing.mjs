import { extraPhysicsModels } from "../../sidecar/physics-extra.mjs";
import { focusColor, focusWeight } from "./teaching-motion.mjs";
const n = (v) => Number(v.toFixed(3)).toLocaleString("id-ID");
export function drawExtraPhysics(d, p, s) {
  if (!extraPhysicsModels[p.kind]) return false;
  const { line, path, rect, ellipse, label, arrow, color, ink, soft } = d,
    t = s.time;
  if (p.kind === "sound-travel") {
    const x = 120 + 650 * s.progress;
    rect(65, 190, 55, 100, color); label("Sumber", 45, 335, 24);
    line(120, 240, 770, 240, soft, true);
    path(Array.from({ length: 41 }, (_, i) => { const a = -0.8 + 1.6 * i / 40; return [120 + 650 * s.progress * Math.cos(a), 240 + 150 * Math.sin(a)]; }), color);
    ellipse(x, 240, 9, 9, "#ffcf25");
    rect(770, 200, 45, 80, s.progress >= 1 ? "#ffcf25" : "#e7f0ff");
    label("Penerima", 725, 335, 23);
    label(`v = ${n(p.soundSpeed)} m/s; jarak = ${n(p.distance)} m`, 35, 85, 25);
    label(`t = ${n(t)} s; s = ${n(s.x)} m; tiba pada ${n(s.duration)} s`, 35, 430, 25);
    label("Muka gelombang merambat; medium tidak ikut berpindah.", 35, 475, 24);
  } else if (p.kind === "heating") {
    rect(150, 150, 340, 210, focusColor(0, 2, t, "#e7f0ff", "#ffe58d"));
    label("Zat satu fase", 320, 245, 29, ink, "center");
    rect(150, 365, 340, 20, "#d89300"); arrow(320, 440, 0, -45, "#d89300");
    rect(650, 130, 40, 255, "#ffffff");
    rect(654, 380 - 245 * s.progress, 32, 5 + 245 * s.progress, "#d89300", "#d89300", 0);
    label(`${n(s.temperature)} °C`, 600, 105, 28);
    label(`m = ${n(p.mass)} kg; c = ${n(p.specificHeat)} J/(kg·K)`, 35, 75, 24);
    label(`Q = Pt = mcΔT ≈ ${n(s.heat)} J`, 35, 435, 26);
    label(`P = ${n(p.power)} W; t = ${n(t)} s • tanpa perubahan fase`, 35, 480, 23);
  } else if (p.kind === "energy-conservation") {
    const y = 115 + 230 * (1 - s.y / p.height);
    line(80, 370, 330, 370); line(205, 90, 205, 350, soft, true);
    ellipse(205, y, 22, 22, color);
    label(`h = ${n(s.y)} m`, 75, 410, 24);
    const fractions = [s.potential / s.totalEnergy, s.kinetic / s.totalEnergy, 1],
      names = ["Ep", "Ek", "Ep + Ek"], colors = [color, "#d89300", "#269475"];
    fractions.forEach((f, i) => {
      rect(430 + i * 135, 115, 75, 250, "#ffffff", soft, 0);
      rect(430 + i * 135, 365 - 250 * f, 75, 250 * f, colors[i], colors[i], 0);
      label(names[i], 468 + i * 135, 400, 24, ink, "center");
    });
    label(`Ep ≈ ${n(s.potential)} J; Ek ≈ ${n(s.kinetic)} J`, 35, 450, 25);
    label(`Energi total = ${n(s.totalEnergy)} J • sebelum tumbukan`, 35, 485, 24);
  } else if (p.kind === "parallel-circuit") {
    line(140, 150, 140, 350); line(760, 150, 760, 350);
    for (let i = 0; i < 2; i++) {
      const y = 150 + i * 100, current = i ? s.current2 : s.current1;
      line(140, y, 405, y, color); line(495, y, 760, y, color);
      rect(405, y - 17, 90, 34, "#ffffff", color, 0);
      const phase = (t * current * 0.35) % 1;
      ellipse(140 + 620 * phase, y, 8, 8, "#ffcf25");
      arrow(250, y - 28, 70, 0);
      label(`R${i + 1} = ${n(i ? p.resistance2 : p.resistance1)} Ω; I${i + 1} = ${n(current)} A`, 315, y - 45, 23);
    }
    line(140, 350, 430, 350); line(470, 350, 760, 350);
    line(430, 320, 430, 380); line(470, 333, 470, 367);
    label("+", 400, 400, 24); label("−", 465, 400, 24);
    label(`U = ${n(p.voltage)} V pada setiap cabang`, 35, 75, 25);
    label(`I total = I₁ + I₂ = ${n(s.current)} A; R total ≈ ${n(s.resistance)} Ω`, 35, 450, 24);
    label("Arus konvensional: + → resistor → −", 35, 485, 23);
  } else if (p.kind === "elastic-collision") {
    const tc = s.collisionTime, hit = -p.distance / 2 + p.velocity1 * tc,
      endpoints = [-p.distance / 2, p.distance / 2, hit + s.finalVelocity1 * tc, hit + s.finalVelocity2 * tc],
      lo = Math.min(...endpoints), hi = Math.max(...endpoints),
      X = (x) => 120 + 660 * (x - lo) / (hi - lo),
      x1 = X(s.x) - 15, x2 = X(s.x2) + 15;
    line(70, 290, 835, 290); line(X(hit), 170, X(hit), 310, soft, true);
    ellipse(x1, 265, 14, 14, color); ellipse(x2, 265, 14, 14, "#d89300", "#d89300");
    if (Math.abs(s.v1) > 1e-10) arrow(x1, 215, 55 * Math.sign(s.v1), 0);
    if (Math.abs(s.v2) > 1e-10) arrow(x2, 335, 55 * Math.sign(s.v2), 0, "#d89300");
    label(`m₁ = ${n(p.mass1)} kg; m₂ = ${n(p.mass2)} kg`, 35, 85, 25);
    label(`v₁ = ${n(s.v1)} m/s; v₂ = ${n(s.v2)} m/s`, 35, 135, 25);
    label(`t = ${n(t)} s; tumbukan pada ${n(tc)} s`, 35, 395, 25);
    label(`Momentum = ${n(s.momentum)} kg·m/s; Ek = ${n(s.kinetic)} J`, 35, 440, 24);
    label("Dua massa titik • gaya luar nol • lenting sempurna", 35, 480, 23);
  } else if (p.kind === "thermal-expansion") {
    rect(100, 155, 540, 45, "#98bcff"); label("Panjang awal L₀", 100, 130, 24);
    rect(100, 290, 540, 45, "#98bcff");
    rect(640, 290, 150 * s.progress, 45, "#ffcf25", "#d89300", 0);
    line(640, 210, 640, 365, soft, true);
    label("ΔL diperbesar pada gambar", 100, 380, 24);
    label(`L₀ = ${n(p.length)} m; α = ${p.expansionCoefficient.toExponential(2)} K⁻¹`, 35, 75, 24);
    label(`ΔT = ${n(s.temperatureRise)} K; ΔL ≈ ${n(s.expansion * 1000)} mm`, 35, 435, 25);
    label("ΔL = αL₀ΔT • ramp suhu ilustratif selama 6 s", 35, 480, 24);
  } else if (p.kind === "accelerated-motion") {
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
