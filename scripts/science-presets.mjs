import fs from "node:fs/promises";
import path from "node:path";
import { renderLatex } from "../src/editor/latex-renderer.mjs";
import { physicsSvg } from "../src/editor/physics-drawing.mjs";
import { normalizePhysics } from "../sidecar/science.mjs";

export async function sciencePresets(root) {
  const sources = JSON.parse(
    await fs.readFile(
      path.join(root, "design-references/science-presets.json"),
      "utf8",
    ),
  );
  return Promise.all(
    sources.map(async (s) => {
      const text = (n, value, x, y, w, h, size, extra = {}) => ({
        t: "text",
        n,
        text: value,
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
          t: "rect",
          n: "Golden side rule",
          x: 0,
          y: 150,
          w: 12,
          h: 1080,
          fill: "#ffcf25",
          lw: 0,
        },
        text(
          "Series label",
          s.physics
            ? "FISIKA • AMATI DAN JELASKAN"
            : "MATEMATIKA • LANGKAH DEMI LANGKAH",
          250,
          45,
          650,
          48,
          22,
          { color: "#0757ec", generationRole: "fixed" },
        ),
        text("Page number", "1/1", 980, 45, 90, 48, 24, {
          generationRole: "page-number",
          align: "right",
        }),
        text("Headline", s.headline, 64, 175, 994, 180, 70, {
          font: "Baloo 2",
          generationGroup: "headline-1",
        }),
        text("Explanation or given values", s.body, 64, 385, 994, 115, 30),
        {
          t: "rect",
          n: "Science card",
          x: 64,
          y: 530,
          w: 994,
          h: s.physics ? 535 : 555,
          fill: s.physics ? "#e7f0ff" : "#ffffff",
          r: 32,
          stroke: "#bfd3f4",
          lw: 2,
        },
      ];
      if (s.physics) {
        const physics = normalizePhysics(s.physics);
        objects.push({
          t: "img",
          n: "Physics diagram",
          identifier: `${s.identifier}-diagram`,
          physics,
          src: physicsSvg(physics),
          x: 84,
          y: 540,
          w: 954,
          h: 515,
          fit: "contain",
          color: "#0757ec",
          generationRole: "editable",
          animation: { start: 0, end: 6 },
        });
      }
      for (const [i, source] of s.equations.entries()) {
        const latex = { source, displayMode: true },
          rendered = await renderLatex(latex);
        const steps = s.equations.length > 1;
        objects.push({
          t: "img",
          n: steps ? `LaTeX step ${i + 1}` : "LaTeX equation",
          identifier: `${s.identifier}-equation-${i + 1}`,
          latex,
          src: rendered.src,
          x: 100,
          y: s.physics ? 1090 : steps ? 560 + i * 163 : 585,
          w: 922,
          h: s.physics ? 140 : steps ? 130 : 410,
          fit: "contain",
          color: "#112866",
          generationRole: "editable",
          animation: {
            start: steps ? 0.2 + i * 1.6 : 0.3,
            end: 6,
            enter: {
              preset: "reveal-left",
              duration: steps ? 0.9 : 1.4,
              easing: "ease-in-out",
              amount: 0,
            },
          },
        });
      }
      if (!s.physics)
        objects.push(
          text(
            "Call to action",
            "Periksa langkahnya. Jelaskan dengan kata-katamu.",
            70,
            1165,
            980,
            65,
            28,
            { generationRole: "fixed" },
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
        scene: { duration: 6, transition: { type: "cut", duration: 0.4 } },
        collection: "Math & Physics",
        useCases: [s.useCase],
        tags: ["science", "latex", "math", "matematika", ...s.tags],
        description: s.physics
          ? `Editable ${s.physics.kind} physics demonstration with SI parameters, LaTeX, and local timeline animation. ${s.body.replaceAll("\n", " ")}`
          : "Editable math-only LaTeX equations with vector reveal animations. Sample content; change the subject, equations, and explanation together.",
        objects,
      };
    }),
  );
}
