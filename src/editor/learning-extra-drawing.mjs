import {
  extraLearningModels,
  extraLearningMetrics,
} from "../../sidecar/learning-extra.mjs";
import { focusColor, focusWeight } from "./teaching-motion.mjs";
const num = (v) => Number(v.toFixed(2)).toLocaleString("id-ID");
export function drawExtraLearning(d, p, time) {
  if (!extraLearningModels[p.kind]) return false;
  const { line, path, rect, ellipse, label, arrow, wrapped, color, ink, soft } =
      d,
    m = extraLearningMetrics(p);
  const box = (i, count, x, y, w, h) =>
    rect(x, y, w, h, focusColor(i, count, time));
  if (p.kind === "angle") {
    const a = (p.degrees * Math.PI) / 180,
      cx = 300,
      cy = 340,
      r = 230;
    arrow(cx, cy, r, 0);
    arrow(cx, cy, r * Math.cos(a), -r * Math.sin(a));
    path(
      Array.from({ length: 65 }, (_, i) => [
        cx + 70 * Math.cos((a * i) / 64),
        cy - 70 * Math.sin((a * i) / 64),
      ]),
      "#d89300",
    );
    ellipse(
      cx + r * Math.cos(a),
      cy - r * Math.sin(a),
      7 + 2 * focusWeight(0, 1, time),
      7 + 2 * focusWeight(0, 1, time),
      color,
    );
    label(
      `${num(p.degrees)}°`,
      cx + 85 * Math.cos(a / 2),
      cy - 85 * Math.sin(a / 2) - 12,
      28,
    );
    label(
      p.degrees === 0
        ? "Sudut nol"
        : p.degrees < 90
          ? "Sudut lancip"
          : p.degrees === 90
            ? "Sudut siku-siku"
            : p.degrees < 180
              ? "Sudut tumpul"
              : "Sudut lurus",
      520,
      150,
      28,
    );
    label("Sudut diukur dari sinar mendatar.", 40, 460, 25);
  } else if (p.kind === "regular-polygon") {
    const pts = Array.from({ length: p.sides }, (_, i) => [
      450 + 145 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / p.sides),
      240 + 145 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / p.sides),
    ]);
    path(pts, color, "#e7f0ff", true);
    pts.forEach((pt, i) => {
      line(
        ...pt,
        ...pts[(i + 1) % pts.length],
        focusColor(i, p.sides, time, color, "#d89300"),
      );
      label(
        i + 1,
        450 + (pt[0] - 450) * 1.2,
        245 + (pt[1] - 240) * 1.2,
        19,
        ink,
        "center",
      );
    });
    label(
      `n = ${p.sides}; sisi = ${num(p.side)} cm; jumlah sudut = ${m.interiorSum}°`,
      35,
      435,
      23,
    );
    label(
      `Keliling = ${num(m.perimeter)} cm; luas ≈ ${num(m.polygonArea)} cm²`,
      35,
      475,
      24,
    );
  } else if (p.kind === "cube-net") {
    const s = 85,
      x = 270,
      y = 195,
      positions = [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [1, -1],
        [1, 1],
      ];
    positions.forEach(([a, b], i) => {
      rect(x + a * s, y + b * s, s, s, focusColor(i, 6, time), color, 0);
      label(i + 1, x + a * s + s / 2, y + b * s + s / 2 + 8, 27, ink, "center");
    });
    label(`Enam persegi; sisi = ${num(p.side)} cm`, 40, 435, 25);
    label(`Luas seluruh sisi = 6 × s² = ${num(m.surface)} cm²`, 40, 475, 25);
  } else if (p.kind === "multiplication-array") {
    const gap = Math.min(65, 650 / p.columns, 290 / p.rows),
      x = 450 - ((p.columns - 1) * gap) / 2,
      y = 95;
    for (let row = 0; row < p.rows; row++)
      for (let col = 0; col < p.columns; col++)
        ellipse(
          x + col * gap,
          y + row * gap,
          gap * 0.27,
          gap * 0.27,
          focusColor(row, p.rows, time, "#98bcff", "#ffcf25"),
        );
    label(
      `${p.rows} baris × ${p.columns} kolom = ${m.total} benda`,
      450,
      450,
      30,
      ink,
      "center",
    );
  } else if (p.kind === "place-value") {
    const digits = [m.thousands, m.hundreds, m.tens, m.ones],
      names = ["Ribuan", "Ratusan", "Puluhan", "Satuan"];
    digits.forEach((v, i) => {
      const x = 30 + i * 220;
      box(i, 4, x, 125, 205, 205);
      label(names[i], x + 15, 170, 25);
      label(v, x + 100, 240, 48, ink, "center");
      label(`${v} × ${10 ** (3 - i)}`, x + 100, 295, 25, ink, "center");
    });
    label(
      `${p.number} = ${m.thousands * 1000} + ${m.hundreds * 100} + ${m.tens * 10} + ${m.ones}`,
      450,
      435,
      30,
      ink,
      "center",
    );
  } else if (p.kind === "fraction-addition") {
    const cell = 720 / p.denominator;
    for (let i = 0; i < p.denominator; i++)
      rect(
        90 + i * cell,
        170,
        cell,
        135,
        i < p.first
          ? focusColor(0, 2, time, "#98bcff", "#3978d9")
          : i < p.first + p.second
            ? focusColor(1, 2, time, "#ffe58d", "#ffcf25")
            : "#ffffff",
        color,
        0,
      );
    label(
      `${p.first}/${p.denominator} + ${p.second}/${p.denominator} = ${m.numerator}/${p.denominator}`,
      450,
      400,
      34,
      ink,
      "center",
    );
    label("Penyebut sama: jumlahkan pembilangnya.", 40, 470, 26);
  } else if (p.kind === "pie-chart") {
    let start = -Math.PI / 2;
    const palette = [
      "#98bcff",
      "#ffe58d",
      "#9ed8c0",
      "#ecb5dc",
      "#b7b1ee",
      "#f4bc91",
    ];
    p.values.forEach((v, i) => {
      const span = (v / m.total) * 2 * Math.PI;
      if (v > 0) {
        path(
          [
            [300, 245],
            ...Array.from(
              { length: Math.max(2, Math.ceil(span * 24)) },
              (_, k) => [
                300 +
                  145 *
                    Math.cos(
                      start +
                        (span * k) / Math.max(1, Math.ceil(span * 24) - 1),
                    ),
                245 +
                  145 *
                    Math.sin(
                      start +
                        (span * k) / Math.max(1, Math.ceil(span * 24) - 1),
                    ),
              ],
            ),
          ],
          focusColor(i, p.values.length, time, ink, "#d89300"),
          palette[i],
          true,
        );
      }
      rect(515, 100 + i * 47, 22, 22, palette[i]);
      label(
        `${p.labels[i]}: ${num(v)} (${num((v / m.total) * 100)}%)`,
        550,
        119 + i * 47,
        21,
      );
      start += span;
    });
    label(`Total = ${num(m.total)} • contoh data`, 40, 465, 25);
  } else if (p.kind === "line-chart") {
    const max = Math.max(1, ...p.values),
      step = 660 / (p.values.length - 1);
    line(115, 370, 815, 370);
    line(115, 370, 115, 85);
    for (let i = 0; i <= 4; i++) {
      const y = 370 - i * 65;
      line(115, y, 815, y, soft);
      label(num((max * i) / 4), 55, y + 6, 19);
    }
    const pts = p.values.map((v, i) => [130 + i * step, 370 - (v / max) * 260]);
    path(pts);
    pts.forEach(([x, y], i) => {
      ellipse(
        x,
        y,
        7 + 3 * focusWeight(i, pts.length, time),
        7 + 3 * focusWeight(i, pts.length, time),
        color,
      );
      label(num(p.values[i]), x, y - 17, 22, ink, "center");
      wrapped(p.labels[i], x - 37, 408, 80, 17);
    });
    label("Urutan data berjarak sama • contoh data", 35, 475, 24);
  } else if (p.kind === "analog-clock") {
    ellipse(450, 245, 155, 155, "#ffffff");
    for (let i = 1; i <= 12; i++) {
      const a = (i * Math.PI) / 6;
      label(
        i,
        450 + 127 * Math.sin(a),
        254 - 127 * Math.cos(a),
        25,
        ink,
        "center",
      );
    }
    const minute = (p.minute * Math.PI) / 30,
      hour = (((p.hour % 12) + p.minute / 60) * Math.PI) / 6;
    line(
      450,
      245,
      450 + 110 * Math.sin(minute),
      245 - 110 * Math.cos(minute),
      focusColor(0, 2, time, color, "#d89300"),
    );
    line(
      450,
      245,
      450 + 75 * Math.sin(hour),
      245 - 75 * Math.cos(hour),
      focusColor(1, 2, time, ink, "#d89300"),
    );
    ellipse(450, 245, 7, 7, ink);
    label(
      `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
      450,
      450,
      34,
      ink,
      "center",
    );
  } else if (p.kind === "balance-equation") {
    const steps = [
      `${p.coefficient}x + ${p.constant} = ${m.rightSide}`,
      `${p.coefficient}x = ${m.rightSide} − ${p.constant}`,
      `x = ${m.rightSide - p.constant} ÷ ${p.coefficient} = ${p.answer}`,
    ];
    steps.forEach((v, i) => {
      box(i, 3, 130, 95 + i * 105, 640, 82);
      label(v, 450, 147 + i * 105, 36, ink, "center");
    });
  } else if (p.kind === "venn") {
    ellipse(330, 250, 190, 145, "#e7f0ff");
    ellipse(570, 250, 190, 145, "none");
    wrapped(p.left, 110, 70, 300, 22);
    wrapped(p.right, 505, 70, 300, 22);
    [p.leftOnly, p.both, p.rightOnly].forEach((values, i) => {
      const x = [220, 450, 680][i];
      values.forEach((v, j) =>
        label(
          v,
          x,
          215 + j * 45,
          23,
          focusColor(i, 3, time, ink, "#0757ec"),
          "center",
        ),
      );
    });
    label("Kiri saja", 220, 425, 21, ink, "center");
    label("Irisan", 450, 425, 21, ink, "center");
    label("Kanan saja", 680, 425, 21, ink, "center");
  } else if (p.kind === "ratio") {
    [p.first, p.second].forEach((count, row) => {
      for (let i = 0; i < count; i++)
        ellipse(
          100 + i * 70,
          180 + row * 120,
          21,
          21,
          focusColor(row, 2, time, row ? "#ffe58d" : "#98bcff", "#ffcf25"),
        );
    });
    label(
      `${p.first} : ${p.second} = ${m.first} : ${m.second}`,
      450,
      440,
      34,
      ink,
      "center",
    );
  } else if (p.kind === "punctuation") {
    p.parts.forEach((v, i) => {
      box(i, 3, 55, 95 + i * 110, 790, 90);
      wrapped(`${v}${p.marks[i]}`, 80, 132 + i * 110, 720, 26);
    });
  } else if (p.kind === "affix") {
    const parts = [
      p.prefix || "(tanpa awalan)",
      p.root,
      p.suffix || "(tanpa akhiran)",
    ];
    parts.forEach((v, i) => {
      box(i, 3, 40 + i * 290, 140, 260, 130);
      wrapped(v, 60 + i * 290, 200, 220, 27);
    });
    label(`Hasil: ${p.result}`, 450, 385, 34, ink, "center");
    label("Penggabungan langsung, tanpa perubahan bunyi.", 35, 465, 23);
  } else if (p.kind === "cause-effect") {
    box(0, 2, 45, 145, 350, 200);
    box(1, 2, 505, 145, 350, 200);
    label("Sebab", 65, 185, 27);
    label("Akibat", 525, 185, 27);
    wrapped(p.cause, 65, 235, 305, 25);
    wrapped(p.effect, 525, 235, 305, 25);
    arrow(410, 245, 75, 0);
    label(p.connector, 450, 390, 30, ink, "center");
  } else if (p.kind === "story-map") {
    const names = ["Tokoh", "Latar", "Masalah", "Penyelesaian"],
      values = [p.character, p.setting, p.problem, p.solution];
    values.forEach((v, i) => {
      const x = 35 + (i % 2) * 440,
        y = 75 + Math.floor(i / 2) * 195;
      box(i, 4, x, y, 420, 190);
      label(names[i], x + 20, y + 42, 27);
      wrapped(v, x + 20, y + 90, 375, 24);
    });
  }
  return true;
}
