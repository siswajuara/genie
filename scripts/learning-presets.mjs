import fs from "node:fs/promises";
import path from "node:path";
import { learningSvg } from "../src/editor/learning-drawing.mjs";
import { physicsSvg } from "../src/editor/physics-drawing.mjs";
export async function learningPresets(root) {
  const source = JSON.parse(
    await fs.readFile(
      path.join(root, "design-references/learning-presets.json"),
      "utf8",
    ),
  ).concat(JSON.parse(await fs.readFile(path.join(root, "design-references/stem-presets.json"), "utf8")));
  return source.map((s) => {
    const wrap = (value, width, size) => {
      const limit = Math.floor(width / (size * 0.6)),
        lines = [];
      let line = "";
      for (const word of value.split(/\s+/)) {
        if (line.length + word.length + 1 > limit) {
          lines.push(line);
          line = word;
        } else line += (line ? " " : "") + word;
      }
      if (line) lines.push(line);
      return lines.join("\n");
    };
    const text = (id, n, value, x, y, w, h, size, extra = {}) => ({
      id,
      identifier: id,
      t: "text",
      n,
      text: wrap(value, w, size),
      x,
      y,
      w,
      h,
      size,
      font: "Nunito",
      weight: 800,
      color: "#112866",
      align: "left",
      lh: 1.2,
      generationRole: "editable",
      ...extra,
    });
    const objects = [
      {
        id: "paper",
        t: "rect",
        n: "Warm paper",
        x: 0,
        y: 0,
        w: 1122,
        h: 1402,
        fill: "#fffdf4",
        lw: 0,
      },
      {
        id: "rule",
        t: "rect",
        n: "Golden rule",
        x: 0,
        y: 150,
        w: 12,
        h: 1080,
        fill: "#ffcf25",
        lw: 0,
      },
      text(
        "series",
        "Series label",
        s.level
          ? `${s.subject === "biology" ? "BIOLOGI" : s.physics ? "FISIKA" : "MATEMATIKA"} • ${s.level.toUpperCase()}`
          : s.subject === "indonesian"
          ? "BAHASA INDONESIA • SD–SMP"
          : s.physics
            ? "FISIKA • SD–SMP"
            : "BELAJAR BERSAMA • SD–SMP",
        250,
        45,
        650,
        48,
        22,
        { color: "#0757ec", generationRole: "fixed" },
      ),
      text("number", "Page number", "1/1", 980, 45, 90, 48, 24, {
        generationRole: "page-number",
        align: "right",
      }),
      text("headline", "Headline", s.headline, 64, 160, 994, 175, 64, {
        font: "Baloo 2",
        generationGroup: "headline-1",
      }),
      text("body", "Explanation or question", s.body, 64, 365, 994, 130, 28),
      {
        id: "card",
        t: "rect",
        n: "Teaching card",
        x: 64,
        y: 525,
        w: 994,
        h: 570,
        fill: "#e7f0ff",
        r: 32,
        stroke: "#bfd3f4",
        lw: 2,
      },
      text("takeaway", "Takeaway", s.takeaway, 64, 1135, 994, 100, 30),
    ];
    if (s.learning || s.physics) {
      const property = s.learning ? "learning" : "physics",
        settings = s[property];
      objects.push({
        id: "teaching-diagram",
        identifier: "teaching-diagram",
        t: "img",
        n: s.name,
        x: 84,
        y: 540,
        w: 954,
        h: 530,
        [property]: settings,
        src: s.learning ? learningSvg(settings) : physicsSvg(settings),
        color: "#0757ec",
        fit: "contain",
        generationRole: "editable",
        animation: { start: 0, end: 8 },
      });
    } else
      objects.push(
        text(
          "visual-placeholder",
          "Visual prompt",
          "Amati • Bandingkan • Jelaskan",
          170,
          755,
          780,
          105,
          36,
          {
            identifier: "teaching-visual-placeholder",
            generationRole: "fixed",
            align: "center",
            color: "#0757ec",
          },
        ),
      );
    return {
      schemaVersion: 2,
      identifier: s.identifier,
      name: s.name,
      kind: "template",
      W: 1122,
      H: 1402,
      branding: "siswa-juara",
      motion: "auto",
      collection: s.level ? "STEM SD–SMA" : "SD & SMP",
      scene: { duration: 8, transition: { type: "cut", duration: 0.4 } },
      useCases: [s.useCase],
      tags: ["education", "science", ...(s.level ? [s.level, "animation"] : ["SD", "SMP"]), ...(s.tags || [])],
      description: s.description || s.body,
      ...(!s.learning && !s.physics
        ? { teachingArea: { x: 84, y: 540, w: 954, h: 530 } }
        : {}),
      objects,
    };
  });
}
