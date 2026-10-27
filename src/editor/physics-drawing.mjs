import {
  normalizePhysics,
  physicsModels,
  physicsState,
} from "../../sidecar/science.mjs";
import { drawExtraPhysics } from "./physics-extra-drawing.mjs";
import {
  diagramBuilder,
  diagramSvg,
  drawDiagram,
} from "./diagram-primitives.mjs";
export function physicsDrawing(raw, seconds = 0, color = "#0757ec") {
  const p = normalizePhysics(raw),
    state = physicsState(p, seconds),
    shapes = [];
  const line = (x1, y1, x2, y2, stroke = "#112866", dash = false) =>
    shapes.push({ t: "line", x1, y1, x2, y2, stroke, dash });
  const circle = (cx, cy, r, fill, stroke = fill, dash = false) =>
    shapes.push({ t: "circle", cx, cy, r, fill, stroke, dash });
  const path = (points, stroke = color, dash = false) =>
    shapes.push({
      t: "path",
      d: points
        .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`)
        .join(" "),
      stroke,
      dash,
    });
  const label = (value, x, y, size = 22) =>
    shapes.push({ t: "text", value, x, y, size, fill: "#112866" });
  const arrow = (x, y, dx, dy) => {
    line(x, y, x + dx, y + dy, color);
    const a = Math.atan2(dy, dx);
    for (const side of [-1, 1])
      line(
        x + dx,
        y + dy,
        x + dx - 13 * Math.cos(a + side * 0.4),
        y + dy - 13 * Math.sin(a + side * 0.4),
        color,
      );
  };
  label(physicsModels[p.kind].label, 40, 35, 20);
  const extraDrawing = diagramBuilder(color);
  if (drawExtraPhysics(extraDrawing, p, state))
    return [...shapes, ...extraDrawing.shapes];
  if (p.kind === "pendulum") {
    const length = 325,
      cx = 450,
      cy = 80,
      x = cx + (state.x / p.length) * length,
      y = cy + (state.y / p.length) * length;
    line(385, cy, 515, cy);
    line(cx, cy, cx, cy + length, "#bfd3f4", true);
    if (p.trail)
      path(
        Array.from({ length: 61 }, (_, i) => {
          const a = ((-p.angle + (p.angle * 2 * i) / 60) * Math.PI) / 180;
          return [cx + Math.sin(a) * length, cy + Math.cos(a) * length];
        }),
        "#bfd3f4",
        true,
      );
    line(cx, cy, x, y);
    circle(cx, cy, 7, "#112866");
    circle(x, y, 24, color);
    label(
      `L = ${p.length} m   g = ${p.gravity} m/s²   T ≈ ${state.period.toFixed(2)} s`,
      40,
      455,
    );
    label(
      `t = ${state.time.toFixed(2)} s   θ = ${((state.angle * 180) / Math.PI).toFixed(1)}°`,
      40,
      485,
      20,
    );
  } else if (p.kind === "spring") {
    const x = 510 + (state.x / p.amplitude) * 210;
    line(90, 115, 90, 355);
    line(90, 300, 825, 300, "#bfd3f4");
    for (let y = 125; y < 350; y += 20) line(70, y - 10, 90, y, "#bfd3f4");
    if (p.trail) line(300, 340, 720, 340, "#bfd3f4", true);
    path(
      Array.from({ length: 27 }, (_, i) => [
        100 + ((x - 142) * i) / 26,
        i === 0 || i === 26 ? 250 : 250 + (i % 2 ? 15 : -15),
      ]),
    );
    shapes.push({ t: "rect", x: x - 32, y: 218, w: 64, h: 64, fill: color });
    label(
      `m = ${p.mass} kg   k = ${p.springConstant} N/m   damping = ${p.damping} s⁻¹`,
      40,
      455,
    );
    label(
      `t = ${state.time.toFixed(2)} s   x = ${state.x.toFixed(3)} m`,
      40,
      485,
      20,
    );
  } else if (p.kind === "projectile") {
    const scale = Math.min(720 / state.range, 290 / state.height),
      x0 = 80,
      y0 = 400;
    line(x0, y0, 835, y0, "#112866");
    line(x0, y0, x0, 85, "#bfd3f4");
    if (p.trail)
      path(
        Array.from({ length: 61 }, (_, i) => {
          const t = (state.flight * i) / 60,
            vy = p.velocity * Math.sin((p.angle * Math.PI) / 180);
          return [
            x0 + state.vx * t * scale,
            y0 - (vy * t - 0.5 * p.gravity * t * t) * scale,
          ];
        }),
        "#bfd3f4",
        true,
      );
    const x = x0 + state.x * scale,
      y = y0 - state.y * scale;
    circle(x, y, 17, color);
    arrow(x, y, (state.vx / p.velocity) * 65, (-state.vy / p.velocity) * 65);
    label(
      `v₀ = ${p.velocity} m/s   θ = ${p.angle}°   g = ${p.gravity} m/s²`,
      40,
      455,
    );
    label(
      `t = ${state.time.toFixed(2)} s   x = ${state.x.toFixed(2)} m   y = ${state.y.toFixed(2)} m`,
      40,
      485,
      20,
    );
  } else if (p.kind === "orbit") {
    const r = 165,
      x = 450 + (state.x / p.radius) * r,
      y = 245 - (state.y / p.radius) * r;
    if (p.trail) circle(450, 245, r, "transparent", "#bfd3f4", true);
    circle(450, 245, 14, "#ffcf25");
    line(450, 245, x, y, "#bfd3f4");
    circle(x, y, 22, color);
    arrow(x, y, -Math.sin(state.angle) * 65, -Math.cos(state.angle) * 65);
    label(
      `r = ${p.radius} m   T = ${p.period} s   v = ${state.speed.toFixed(2)} m/s`,
      40,
      455,
    );
    label(`t = ${state.time.toFixed(2)} s   uniform speed`, 40, 485, 20);
  } else {
    const d = diagramBuilder(color),
      {
        line: l,
        path: pth,
        rect,
        ellipse,
        label: txt,
        arrow: arr,
        soft,
        ink,
      } = d;
    if (p.kind === "linear-motion") {
      l(70, 320, 830, 320, ink);
      if (p.trail)
        for (let i = 0; i <= 5; i++) {
          l(80 + i * 144, 310, 80 + i * 144, 330, soft);
          txt(`${((p.distance * i) / 5).toFixed(1)} m`, 65 + i * 144, 360, 18);
        }
      const x = 80 + (state.x / p.distance) * 720;
      rect(x - 24, 240, 48, 65, color);
      arr(x, 220, 60, 0);
      txt(`s = ${state.x.toFixed(2)} m; v = ${p.velocity} m/s`, 40, 430);
      txt(`t = ${state.time.toFixed(2)} s; s = v × t`, 40, 475);
    } else if (p.kind === "free-fall") {
      l(320, 385, 580, 385, ink);
      if (p.trail) l(300, 90, 300, 385, soft, true);
      const y = 385 - (state.y / p.height) * 285;
      ellipse(450, y, 20, 20, color);
      arr(500, y, 0, 45);
      txt(`h₀ = ${p.height} m; g = ${p.gravity} m/s²`, 40, 435);
      txt(
        `t = ${state.time.toFixed(2)} s; h = ${state.y.toFixed(2)} m; v = ${state.speed.toFixed(2)} m/s`,
        40,
        475,
        20,
      );
    } else if (p.kind === "lever") {
      const scale = 650 / (p.loadArm + p.effortArm),
        cx = 110 + p.loadArm * scale;
      l(110, 240, 760, 240, ink);
      pth(
        [
          [cx, 245],
          [cx - 30, 300],
          [cx + 30, 300],
        ],
        ink,
        "#d4e5ff",
        true,
      );
      rect(80, 180, 60, 60, color);
      arr(110, 245, 0, 70);
      arr(760, 170, 0, 70);
      txt(`l beban = ${p.loadArm} m`, 90, 345);
      txt(`l kuasa = ${p.effortArm} m`, 460, 345);
      txt(
        `W = ${state.load.toFixed(2)} N; F = ${state.effort.toFixed(2)} N`,
        40,
        435,
      );
      txt("Tuas seimbang: F × l kuasa = W × l beban", 40, 475, 21);
    } else if (p.kind === "pulley") {
      const count = p.supportingRopes;
      l(250, 100, 650, 100, ink);
      rect(330, 300, 240, 80, color);
      for (let i = 0; i < count; i++) {
        const x = 350 + ((i + 0.5) * 200) / count;
        l(x, 100, x, 300, ink);
        arr(x, 270, 0, -70);
        ellipse(x, 110, 18, 18, "#e7f0ff");
      }
      arr(450, 380, 0, 45);
      txt(`${count} ruas tali menahan beban`, 40, 65, 22);
      txt(
        `W = ${state.load.toFixed(2)} N; F tiap ruas = ${state.effort.toFixed(2)} N`,
        40,
        455,
        21,
      );
      txt(
        "Skema gaya tali ideal • tanpa gesekan dan massa katrol",
        40,
        485,
        18,
      );
    } else if (p.kind === "buoyancy") {
      rect(260, 200, 380, 205, "#e7f0ff", soft);
      l(260, 120, 260, 410, ink);
      l(640, 120, 640, 410, ink);
      l(260, 410, 640, 410, ink);
      l(260, 200, 640, 200, color);
      const y =
        state.floating || state.neutral
          ? 200 - (1 - state.submerged) * 120
          : 285;
      rect(390, y, 120, 120, "#ffcf25");
      arr(540, y + 60, 0, -60);
      arr(365, y + 60, 0, 60);
      txt(
        `ρ benda = ${p.objectDensity}; ρ cairan = ${p.fluidDensity} kg/m³`,
        40,
        65,
        20,
      );
      txt(
        `W = ${state.weight.toFixed(2)} N; F apung = ${state.buoyantForce.toFixed(2)} N`,
        40,
        450,
        21,
      );
      txt(
        state.floating
          ? "Terapung setimbang: gaya apung = berat"
          : state.neutral
            ? "Melayang ideal: massa jenis sama"
            : "Terendam penuh: berat lebih besar dari gaya apung",
        40,
        485,
        18,
      );
    } else if (p.kind === "wave") {
      const span = Math.max(6, p.wavelength * 1.5),
        scale = 720 / span;
      l(70, 260, 810, 260, soft);
      pth(
        Array.from({ length: 241 }, (_, i) => {
          const x = (span * i) / 240;
          return [
            80 + x * scale,
            260 -
              p.amplitude *
                160 *
                Math.sin(
                  2 * Math.PI * (x / p.wavelength - p.frequency * state.time),
                ),
          ];
        }),
      );
      const marker =
        -p.amplitude * 160 * Math.sin(-2 * Math.PI * p.frequency * state.time);
      ellipse(80, 260 + marker, 8, 8, color);
      l(80, 390, 80 + p.wavelength * scale, 390, ink);
      txt(`λ = ${p.wavelength} m`, 100, 420);
      txt(
        `A = ${p.amplitude} m; f = ${p.frequency} Hz; v = λf = ${state.speed.toFixed(2)} m/s`,
        40,
        475,
        22,
      );
    } else if (p.kind === "circuit") {
      l(220, 160, 390, 160, ink);
      l(510, 160, 730, 160, ink);
      l(730, 160, 730, 350, ink);
      l(730, 350, 220, 350, ink);
      l(220, 350, 220, 280, ink);
      l(220, 160, 220, 220, ink);
      l(190, 220, 250, 220, ink);
      l(202, 250, 238, 250, ink);
      l(220, 250, 220, 280, ink);
      rect(390, 135, 120, 50, "#e7f0ff");
      txt(`R = ${p.resistance} Ω`, 385, 110);
      txt(`${p.voltage} V`, 90, 245);
      txt("+", 265, 225, 20);
      txt("−", 265, 255, 20);
      const phase = (state.time % 4) / 4,
        points = [
          [260, 160],
          [650, 160],
          [730, 250],
          [650, 350],
          [300, 350],
          [220, 285],
        ];
      const k = Math.floor(phase * points.length);
      ellipse(points[k][0], points[k][1], 10, 10, color);
      arr(560, 160, 60, 0);
      txt(
        `I = U/R = ${state.current.toFixed(2)} A; P = UI = ${state.power.toFixed(2)} W`,
        40,
        455,
        22,
      );
      txt(
        "Arus konvensional di luar sumber: kutub + ke − (ilustrasi)",
        40,
        485,
        18,
      );
    } else if (p.kind === "reflection") {
      const a = (p.angle * Math.PI) / 180,
        dx = Math.sin(a) * 240,
        dy = Math.cos(a) * 240;
      l(180, 360, 720, 360, ink);
      l(450, 65, 450, 375, soft, true);
      arr(450 - dx, 360 - dy, dx, dy);
      arr(450, 360, dx, -dy);
      txt("Garis normal", 465, 80, 20);
      txt(`Sudut datang = sudut pantul = ${p.angle}°`, 40, 435);
      txt("Sudut diukur terhadap garis normal, bukan permukaan.", 40, 475, 21);
    }
    shapes.push(...d.shapes);
  }
  return shapes;
}
export function physicsSvg(spec, color = "#0757ec") {
  return diagramSvg(
    physicsDrawing(spec, 0, color),
    physicsModels[spec.kind].label,
    color,
  );
}
export function drawPhysics(ctx, element, seconds = 0) {
  drawDiagram(
    ctx,
    element,
    physicsDrawing(element.physics, seconds, element.color || "#0757ec"),
  );
}
