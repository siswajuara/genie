import {
  learningModels,
  normalizeLearning,
  learningMetrics,
} from "../../sidecar/learning.mjs";
import { drawExtraLearning } from "./learning-extra-drawing.mjs";
import { focusColor, focusWeight } from "./teaching-motion.mjs";
import {
  diagramBuilder,
  diagramSvg,
  drawDiagram,
} from "./diagram-primitives.mjs";
const n = (value) => Number(value.toFixed(2)).toLocaleString("id-ID");
export function learningDrawing(raw, seconds = 0, color = "#0757ec") {
  const p = normalizeLearning(raw),
    model = learningModels[p.kind],
    d = diagramBuilder(color);
  const {
    shapes,
    line,
    path,
    rect,
    ellipse,
    label,
    arrow,
    wrapped,
    soft,
    ink,
  } = d;
  const time = p.animate
    ? Math.max(0, Number.isFinite(seconds) ? seconds : 0)
    : 0;
  const active = (count) => Math.floor(time / 1.3) % count;
  label(model.label, 35, 35, 26);
  if (drawExtraLearning(d, p, time)) return shapes;
  const m = learningMetrics(p);
  if (m.area !== undefined) {
    let points, width, height;
    if (["square", "rectangle"].includes(p.kind)) {
      width = p.side || p.width;
      height = p.side || p.height;
      points = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
      ];
    } else if (p.kind === "triangle") {
      width = p.base;
      height = p.height;
      points = [
        [0, height],
        [width, height],
        [0, 0],
      ];
    } else if (p.kind === "parallelogram") {
      width = p.base + p.offset;
      height = p.height;
      points = [
        [0, height],
        [p.base, height],
        [width, 0],
        [p.offset, 0],
      ];
    } else if (p.kind === "trapezoid") {
      width = p.base;
      height = p.height;
      const a = (p.base - p.top) / 2;
      points = [
        [0, height],
        [width, height],
        [a + p.top, 0],
        [a, 0],
      ];
    } else if (["rhombus", "kite"].includes(p.kind)) {
      width = p.diagonal2;
      height = p.diagonal1;
      const y = p.kind === "kite" ? height / 3 : height / 2;
      points = [
        [width / 2, 0],
        [width, y],
        [width / 2, height],
        [0, y],
      ];
    } else {
      width = height = 2 * p.radius;
    }
    const scale = Math.min(470 / width, 260 / height),
      x = 450 - (width * scale) / 2,
      y = 240 - (height * scale) / 2;
    const pt = ([a, b]) => [x + a * scale, y + b * scale];
    if (points) {
      path(points.map(pt), color, "#e7f0ff", true);
      if (p.animate) {
        points.forEach((point, i) => {
          line(
            ...pt(point),
            ...pt(points[(i + 1) % points.length]),
            focusColor(i, points.length, time, color, "#d89300"),
          );
        });
      }
    } else {
      ellipse(450, 240, p.radius * scale, p.radius * scale, "#e7f0ff");
      line(450, 240, 450 + p.radius * scale, 240);
      label(`r = ${n(p.radius)} cm`, 465, 224);
      if (p.animate)
        line(
          450,
          240,
          450 + p.radius * scale * Math.cos(time * 0.7),
          240 - p.radius * scale * Math.sin(time * 0.7),
          "#d89300",
        );
    }
    if (["square", "rectangle"].includes(p.kind)) {
      label(`${n(width)} cm`, 450, y + height * scale + 32, 22, ink, "center");
      label(`${n(height)} cm`, x + width * scale + 15, 245);
    }
    if (["triangle", "parallelogram", "trapezoid"].includes(p.kind)) {
      const hx =
        p.kind === "parallelogram"
          ? p.offset
          : p.kind === "trapezoid"
            ? (p.base - p.top) / 2
            : 0;
      line(...pt([hx, 0]), ...pt([hx, height]), ink, true);
      label(
        `alas = ${n(p.base)} cm`,
        450,
        y + height * scale + 30,
        22,
        ink,
        "center",
      );
      label(`tinggi = ${n(height)} cm`, 40, 95);
      if (p.kind === "trapezoid")
        label(`atas = ${n(p.top)} cm`, 450, y - 15, 22, ink, "center");
      if (p.kind === "parallelogram")
        label(`geser = ${n(p.offset)} cm`, 40, 125, 20);
      const [rx, ry] = pt([hx, height]);
      line(rx, ry - 12, rx + 12, ry - 12);
      line(rx + 12, ry - 12, rx + 12, ry);
    }
    if (["rhombus", "kite"].includes(p.kind)) {
      const yy = p.kind === "kite" ? height / 3 : height / 2;
      line(...pt([width / 2, 0]), ...pt([width / 2, height]), ink, true);
      line(...pt([0, yy]), ...pt([width, yy]), ink, true);
      label(
        `d₁ = ${n(height)} cm; d₂ = ${n(width)} cm`,
        450,
        410,
        22,
        ink,
        "center",
      );
    }
    label(
      `Luas ≈ ${n(m.area)} cm²     Keliling ≈ ${n(m.perimeter)} cm`,
      40,
      475,
      24,
    );
  } else if (m.volume !== undefined) {
    if (["cube", "cuboid"].includes(p.kind)) {
      const w = p.side || p.width,
        h = p.side || p.height,
        z = p.side || p.depth,
        s = Math.min(450 / (w + z * 0.5), 280 / (h + z * 0.35));
      const x = 450 - ((w + z * 0.5) * s) / 2,
        y = 110 + z * 0.35 * s,
        ww = w * s,
        hh = h * s,
        dx = z * 0.5 * s,
        dy = -z * 0.35 * s;
      path(
        [
          [x, y],
          [x + dx, y + dy],
          [x + ww + dx, y + dy],
          [x + ww, y],
        ],
        color,
        focusColor(0, 3, time),
        true,
      );
      path(
        [
          [x + ww, y],
          [x + ww + dx, y + dy],
          [x + ww + dx, y + dy + hh],
          [x + ww, y + hh],
        ],
        color,
        focusColor(1, 3, time, "#d4e5ff"),
        true,
      );
      rect(x, y, ww, hh, focusColor(2, 3, time), color, 0);
      line(x, y + hh, x + dx, y + dy + hh, soft, true);
      line(x + dx, y + dy, x + dx, y + dy + hh, soft, true);
      line(x + dx, y + dy + hh, x + dx + ww, y + dy + hh, soft, true);
      label(`p = ${n(w)}; l = ${n(z)}; t = ${n(h)} cm`, 40, 420);
    } else if (["cylinder", "cone"].includes(p.kind)) {
      const scale = Math.min(160 / p.radius, 250 / p.height),
        r = p.radius * scale,
        h = p.height * scale,
        top = 105,
        bottom = top + h;
      if (p.kind === "cylinder") {
        path(
          [
            [450 - r, top],
            [450 - r, bottom],
            [450 + r, bottom],
            [450 + r, top],
          ],
          color,
          "#e7f0ff",
          true,
        );
        ellipse(450, top, r, r * 0.23, "#d4e5ff");
        ellipse(450, bottom, r, r * 0.23, "none", color, true);
      } else {
        path(
          [
            [450, top],
            [450 - r, bottom],
            [450 + r, bottom],
          ],
          color,
          "#e7f0ff",
          true,
        );
        ellipse(450, bottom, r, r * 0.23, "none", color, true);
      }
      line(450, top, 450, bottom, ink, true);
      line(450, bottom, 450 + r, bottom);
      label(`r = ${n(p.radius)} cm; t = ${n(p.height)} cm`, 40, 420);
    } else if (p.kind === "sphere") {
      ellipse(450, 245, 135, 135, "#e7f0ff");
      ellipse(450, 245, 135, 35, "none", soft, true);
      line(450, 245, 585, 245);
      label(`r = ${n(p.radius)} cm`, 470, 227);
    } else if (p.kind === "triangular-prism") {
      const s = Math.min(
          380 / (p.base + p.depth * 0.5),
          250 / (p.height + p.depth * 0.3),
        ),
        x = 260,
        y = 365,
        w = p.base * s,
        h = p.height * s,
        dx = p.depth * 0.5 * s,
        dy = -p.depth * 0.3 * s;
      path(
        [
          [x, y - h],
          [x + dx, y - h + dy],
          [x + w + dx, y + dy],
          [x + w, y],
        ],
        color,
        "#d4e5ff",
        true,
      );
      path(
        [
          [x, y - h],
          [x + w, y],
          [x, y],
        ],
        color,
        "#e7f0ff",
        true,
      );
      line(x, y, x + dx, y + dy, soft, true);
      line(x + dx, y + dy, x + w + dx, y + dy, soft, true);
      line(x + dx, y + dy, x + dx, y - h + dy, soft, true);
      label(
        `alas = ${n(p.base)}; tinggi segitiga = ${n(p.height)}; panjang = ${n(p.depth)} cm`,
        35,
        420,
        20,
      );
    } else {
      const s = Math.min(
          480 / (p.side * 1.4),
          280 / (p.height + p.side * 0.25),
        ),
        cy = 110 + p.height * s,
        dx = p.side * s * 0.7,
        dy = p.side * s * 0.25;
      const left = [450 - dx, cy],
        front = [450 - dx * 0.12, cy + dy],
        right = [450 + dx, cy],
        back = [450 + dx * 0.12, cy - dy],
        top = [450, 110];
      path([left, front, right, back], color, "#d4e5ff", true);
      path([left, top, front], color, "#e7f0ff", true);
      path([front, top, right], color, "#d4e5ff", true);
      line(...top, 450, cy, ink, true);
      line(...top, ...back, soft, true);
      line(...left, ...back, soft, true);
      line(...back, ...right, soft, true);
      label(
        `sisi = ${n(p.side)} cm; tinggi tegak = ${n(p.height)} cm`,
        35,
        420,
      );
    }
    label(
      `Volume ≈ ${n(m.volume)} cm³     Luas permukaan ≈ ${n(m.surface)} cm²`,
      35,
      475,
      23,
      p.animate ? focusColor(0, 2, time, ink, color) : ink,
    );
    label("Proyeksi ilustratif; gunakan ukuran tertulis.", 35, 65, 17);
  } else if (p.kind === "fraction") {
    const w = 720 / p.denominator;
    for (let i = 0; i < p.denominator; i++)
      rect(
        90 + i * w,
        170,
        w,
        150,
        i < p.numerator
          ? focusColor(i, Math.max(1, p.numerator), time, "#98bcff", "#0757ec")
          : "#ffffff",
        color,
        0,
      );
    label(
      `${p.numerator} dari ${p.denominator} bagian sama besar`,
      450,
      385,
      30,
      ink,
      "center",
    );
    label(
      `${p.numerator}/${p.denominator} ≈ ${n(p.numerator / p.denominator)}`,
      450,
      440,
      30,
      ink,
      "center",
    );
  } else if (p.kind === "number-line") {
    arrow(60, 260, 780, 0, ink);
    const step = 720 / (p.maximum - p.minimum);
    for (let v = p.minimum; v <= p.maximum; v++) {
      const x = 90 + (v - p.minimum) * step;
      line(x, 245, x, 275);
      label(v, x, 310, 20, ink, "center");
    }
    const x = 90 + (p.value - p.minimum) * step;
    ellipse(
      x,
      260,
      12 + (p.animate ? 2 * Math.sin(time * 3) : 0),
      12,
      "#0757ec",
    );
    label(`Nilai: ${p.value}`, 450, 400, 30, ink, "center");
  } else if (p.kind === "coordinates") {
    const s = 28,
      cx = 450,
      cy = 250;
    for (let v = -5; v <= 5; v++) {
      line(cx - 5 * s, cy + v * s, cx + 5 * s, cy + v * s, soft);
      line(cx + v * s, cy - 5 * s, cx + v * s, cy + 5 * s, soft);
      if (v) {
        label(v, cx + v * s, cy + 20, 16, ink, "center");
        label(v, cx - 25, cy - v * s + 5, 16);
      }
    }
    arrow(cx - 165, cy, 340, 0, ink);
    arrow(cx, cy + 165, 0, -340, ink);
    const x = cx + p.pointX * s,
      y = cy - p.pointY * s;
    line(x, cy, x, y, color, true);
    line(cx, y, x, y, color, true);
    ellipse(
      x,
      y,
      8 + (p.animate ? 2 * Math.sin(time * 3) : 0),
      8 + (p.animate ? 2 * Math.sin(time * 3) : 0),
      color,
    );
    label(`(${p.pointX}, ${p.pointY})`, x + 12, y - 12);
    label("x", cx + 185, cy + 6);
    label("y", cx - 5, cy - 188);
    label("Urutan pasangan: (x, y)", 40, 465, 26);
  } else if (p.kind === "bar-chart") {
    const max = Math.max(1, ...p.values),
      w = 650 / p.values.length;
    line(110, 380, 820, 380, ink);
    line(110, 380, 110, 90, ink);
    for (let i = 0; i <= 4; i++) {
      const y = 380 - i * 65;
      line(110, y, 820, y, soft);
      label(n((max * i) / 4), 55, y + 7, 18);
    }
    p.values.forEach((value, i) => {
      const h = (value / max) * 260;
      rect(
        135 + i * w,
        380 - h,
        w * 0.65,
        h,
        focusColor(i, p.values.length, time, "#98bcff", "#0757ec"),
      );
      label(n(value), 135 + i * w + w * 0.325, 365 - h, 22, ink, "center");
      label(p.labels[i], 135 + i * w + w * 0.325, 415, 18, ink, "center");
    });
    label("Contoh data • sumbu dimulai dari 0", 40, 475, 22);
  } else if (p.kind === "sentence") {
    const roles = ["Subjek", "Predikat", "Objek", "Keterangan"];
    p.parts.forEach((value, i) => {
      const x = 30 + i * 220;
      rect(x, 160, 205, 195, focusColor(i, 4, time));
      label(roles[i], x + 15, 205, 23);
      wrapped(value, x + 15, 255, 175, 24);
    });
    label(
      "Contoh kalimat transitif: siapa → melakukan apa → apa → di mana/kapan",
      30,
      435,
      21,
    );
  } else if (p.kind === "syllables" || p.kind === "word-family") {
    const words = p.parts || p.words,
      w = 790 / words.length;
    words.forEach((value, i) => {
      const x = 55 + i * w;
      rect(x, 175, w - 12, 125, focusColor(i, words.length, time));
      wrapped(value, x + 12, 235, w - 36, 24);
    });
    label(p.word || p.relation, 450, 390, 32, ink, "center");
    label(
      p.kind === "syllables"
        ? "Gabungkan suku kata menjadi kata."
        : "Perhatikan hubungan makna dan konteks pemakaian.",
      40,
      465,
      23,
    );
  } else if (p.kind === "story-sequence") {
    p.parts.forEach((value, i) => {
      const y = 80 + i * 73;
      rect(55, y, 790, 63, focusColor(i, p.parts.length, time));
      label(`${i + 1}.`, 72, y + 39, 24);
      wrapped(value, 120, y + 26, 695, 20);
    });
  } else if (p.kind === "main-idea") {
    rect(110, 85, 680, 80, "#fff1b3");
    wrapped(p.idea, 135, 115, 630, 25);
    p.details.forEach((value, i) => {
      const y = 195 + i * 62;
      line(450, 165, 450, y, soft);
      rect(
        110,
        y,
        680,
        54,
        focusColor(i, p.details.length, time, "#e7f0ff", "#98bcff"),
      );
      wrapped(value, 130, y + 23, 640, 19);
    });
  }
  return shapes;
}
export function learningSvg(spec, color = "#0757ec") {
  return diagramSvg(
    learningDrawing(spec, 0, color),
    learningModels[spec.kind].label,
    color,
  );
}
export function drawLearning(ctx, element, seconds = 0) {
  drawDiagram(
    ctx,
    element,
    learningDrawing(element.learning, seconds, element.color || "#0757ec"),
  );
}
