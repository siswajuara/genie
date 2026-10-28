import {
  extraLearningModels,
  extraLearningMetrics,
} from "../../sidecar/learning-extra.mjs";
import { focusColor, focusWeight } from "./teaching-motion.mjs";
const num = (v) => {
  const rounded = Number(v.toFixed(2));
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString("id-ID");
};
export function drawExtraLearning(d, p, time) {
  if (!extraLearningModels[p.kind]) return false;
  const { line, path, rect, ellipse, label, arrow, wrapped, color, ink, soft } =
      d,
    m = extraLearningMetrics(p);
  const box = (i, count, x, y, w, h) =>
    rect(x, y, w, h, focusColor(i, count, time));
  if (p.kind === "equal-sharing") {
    const width = 800 / p.groups;
    for (let group = 0; group < p.groups; group++) {
      const x = 50 + group * width;
      rect(x + 5, 130, width - 10, 220, focusColor(group, p.groups, time));
      for (let i = 0; i < p.perGroup; i++)
        ellipse(x + width * (i % 2 ? 0.7 : 0.3), 165 + Math.floor(i / 2) * 45, 11, 11, color);
      label(group + 1, x + width / 2, 390, 23, ink, "center");
    }
    label(`${m.total} ÷ ${p.groups} = ${m.quotient} benda tiap kelompok`, 450, 455, 28, ink, "center");
  } else if (p.kind === "equivalent-fractions") {
    for (let row = 0; row < 2; row++) {
      const count = row ? m.denominator : p.denominator, filled = row ? m.numerator : p.numerator;
      for (let i = 0; i < count; i++)
        rect(90 + i * 720 / count, 120 + row * 155, 720 / count, 85,
          i < filled ? focusColor(row, 2, time, "#98bcff", "#ffcf25") : "#ffffff", color, 0);
      label(`${filled}/${count}`, 450, 245 + row * 155, 27, ink, "center");
    }
    label(`Pembilang dan penyebut × ${p.multiplier}: nilainya tetap sama`, 450, 465, 25, ink, "center");
  } else if (p.kind === "pythagoras") {
    const scale = Math.min(520 / p.legA, 260 / p.legB), x = 190, y = 365,
      w = p.legA * scale, h = p.legB * scale;
    path([[x, y], [x + w, y], [x, y - h]], color, "#e7f0ff", true);
    const pts = [[x, y], [x + w, y], [x, y - h]];
    pts.forEach((pt, i) => line(...pt, ...pts[(i + 1) % 3], focusColor(i, 3, time, color, "#d89300")));
    path([[x, y - 22], [x + 22, y - 22], [x + 22, y]], ink);
    label(`a = ${num(p.legA)} cm`, x + w / 2, 402, 24, ink, "center");
    label(`b = ${num(p.legB)}`, 35, y - h / 2, 23);
    label(`c ≈ ${num(m.hypotenuse)} cm`, x + w / 2 + 40, y - h / 2 - 20, 25);
    label(`c² = a² + b² = ${num(p.legA ** 2)} + ${num(p.legB ** 2)}`, 450, 470, 28, ink, "center");
  } else if (["linear-function", "quadratic-function"].includes(p.kind)) {
    const quadratic = p.kind === "quadratic-function",
      xmin = quadratic ? p.vertexX - 3 : -4, xmax = quadratic ? p.vertexX + 3 : 4,
      f = (x) => quadratic ? p.quadraticA * (x - p.vertexX) ** 2 + p.vertexY : p.slope * x + p.intercept,
      ymin = Math.min(0, f(xmin), f(xmax), quadratic ? p.vertexY : 0) - 1,
      ymax = Math.max(0, f(xmin), f(xmax), quadratic ? p.vertexY : 0) + 1,
      X = (x) => 110 + 680 * (x - xmin) / (xmax - xmin),
      Y = (y) => 365 - 250 * (y - ymin) / (ymax - ymin);
    for (let i = 0; i <= 4; i++) {
      const x = xmin + (xmax - xmin) * i / 4, y = ymin + (ymax - ymin) * i / 4;
      line(X(x), 115, X(x), 365, soft);
      line(110, Y(y), 790, Y(y), soft);
      label(num(x), X(x), 395, 18, ink, "center");
      label(num(y), 35, Y(y) + 6, 18);
    }
    line(110, Y(0), 805, Y(0)); line(X(0), 100, X(0), 365);
    label("x", 820, Y(0) + 8, 20); label("y", X(0) + 12, 96, 20);
    path(Array.from({ length: 121 }, (_, i) => { const x = xmin + (xmax - xmin) * i / 120; return [X(x), Y(f(x))]; }), color);
    const progress = (1 - Math.cos(time * Math.PI / 2.6)) / 2, x = xmin + (xmax - xmin) * progress;
    ellipse(X(x), Y(f(x)), 8, 8, "#ffcf25");
    if (quadratic) {
      ellipse(X(p.vertexX), Y(p.vertexY), 6, 6, color);
      label(`y = ${num(p.quadraticA)}(x − (${num(p.vertexX)}))² + (${num(p.vertexY)})`, 450, 440, 25, ink, "center");
      label(`Puncak (${num(p.vertexX)}, ${num(p.vertexY)}); sumbu x = ${num(p.vertexX)}`, 450, 480, 24, ink, "center");
    } else {
      label(`y = ${num(p.slope)}x + (${num(p.intercept)})`, 450, 440, 28, ink, "center");
      label(`Gradien = ${num(p.slope)}; titik potong y = ${num(p.intercept)}`, 450, 480, 24, ink, "center");
    }
  } else if (p.kind === "unit-circle") {
    const cx = 320, cy = 255, r = 150, a = p.degrees * Math.PI / 180,
      x = cx + r * m.cosine, y = cy - r * m.sine;
    ellipse(cx, cy, r, r); line(140, cy, 500, cy, soft); line(cx, 75, cx, 425, soft);
    label("1", 478, cy + 25, 20); label("−1", 140, cy + 25, 20); label("1", cx + 10, 98, 20);
    line(cx, cy, x, y, color); line(x, cy, x, y, "#d89300"); line(cx, cy, x, cy, "#d89300");
    path(Array.from({ length: 65 }, (_, i) => [cx + 55 * Math.cos(a * i / 64), cy - 55 * Math.sin(a * i / 64)]), soft);
    const sweep = a * (1 - Math.cos(time * Math.PI / 2.6)) / 2;
    ellipse(cx + 55 * Math.cos(sweep), cy - 55 * Math.sin(sweep), 7, 7, "#ffcf25");
    ellipse(x, y, 8, 8, color);
    label(`θ = ${num(p.degrees)}°`, 560, 160, 28);
    label(`cos θ ≈ ${num(m.cosine)}`, 560, 225, 27);
    label(`sin θ ≈ ${num(m.sine)}`, 560, 285, 27);
    label("x² + y² = 1", 560, 350, 27);
    label("Titik pada lingkaran: (cos θ, sin θ)", 450, 475, 27, ink, "center");
  } else if (p.kind === "probability-bag") {
    for (let i = 0; i < p.total; i++) {
      const x = 90 + (i % 10) * 80, y = 170 + Math.floor(i / 10) * 110;
      ellipse(x, y, 25, 25, i < p.favorable ? "#ffcf25" : "#98bcff");
      ellipse(x, y, 33, 33, "none", focusColor(i, p.total, time, soft, ink));
    }
    label(`P(kuning) = ${p.favorable}/${p.total} ≈ ${num(m.probability * 100)}%`, 450, 410, 29, ink, "center");
    label("Setiap bola punya kesempatan sama; sorotan bukan undian.", 450, 465, 24, ink, "center");
  } else if (p.kind === "vector-addition") {
    const extent = Math.max(1, Math.abs(p.vectorAX), Math.abs(p.vectorAY), Math.abs(m.resultX), Math.abs(m.resultY)),
      scale = 125 / extent, X = (x) => 435 + scale * x, Y = (y) => 245 - scale * y;
    line(230, 245, 640, 245, soft); line(435, 90, 435, 400, soft);
    if (p.vectorAX || p.vectorAY)
      arrow(X(0), Y(0), p.vectorAX * scale, -p.vectorAY * scale, focusColor(0, 3, time, color, "#d89300"));
    if (p.vectorBX || p.vectorBY)
      arrow(X(p.vectorAX), Y(p.vectorAY), p.vectorBX * scale, -p.vectorBY * scale, focusColor(1, 3, time, "#269475", "#d89300"));
    if (m.resultX || m.resultY)
      arrow(X(0), Y(0), m.resultX * scale, -m.resultY * scale, focusColor(2, 3, time, ink, "#d89300"));
    label("A", X(p.vectorAX / 2) + 12, Y(p.vectorAY / 2) + 24, 23, color);
    label("B", X(p.vectorAX + p.vectorBX / 2) + 12, Y(p.vectorAY + p.vectorBY / 2), 23, "#269475");
    label("R", X(m.resultX / 2) - 25, Y(m.resultY / 2), 23, ink);
    label(`A = (${num(p.vectorAX)}, ${num(p.vectorAY)}); B = (${num(p.vectorBX)}, ${num(p.vectorBY)})`, 450, 70, 24, ink, "center");
    label(`R = (${num(m.resultX)}, ${num(m.resultY)}); |R| ≈ ${num(m.magnitude)}`, 450, 440, 28, ink, "center");
    label(`Skala: 1 satuan = ${num(scale)} px • ujung ke pangkal`, 450, 480, 23, ink, "center");
  } else if (p.kind === "angle") {
    const a = (p.degrees * Math.PI) / 180,
      cx = 300,
      cy = 340,
      r = 230;
    // Visible emphasis sweep: a bright dot travels along the arc, ping-pong
    // every 1.3 s. Deterministic in time so scrubbing and export agree.
    const pingpong = 1 - Math.abs(1 - 2 * ((time / 1.3) % 1)),
      sa = a * pingpong;
    arrow(cx, cy, r, 0);
    arrow(cx, cy, r * Math.cos(a), -r * Math.sin(a));
    path(
      Array.from({ length: 65 }, (_, i) => [
        cx + 70 * Math.cos((a * i) / 64),
        cy - 70 * Math.sin((a * i) / 64),
      ]),
      "#d89300",
    );
    if (p.animate)
      ellipse(
        cx + 70 * Math.cos(sa),
        cy - 70 * Math.sin(sa),
        10,
        10,
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
