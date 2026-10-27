import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const svgSource = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Reconstruct the surface beneath a cutout from surrounding pixels. This is an
// authoring approximation where the supplied flattened reference hides the surface.
export function heal(data, W, H, cutout) {
  const { x, y, w, h, mask } = cutout;
  const pixel = (xx, yy) => {
    const a =
      (Math.max(0, Math.min(H - 1, yy)) * W +
        Math.max(0, Math.min(W - 1, xx))) *
      3;
    return [...data.subarray(a, a + 3)];
  };
  const left = new Int32Array(w * h),
    right = new Int32Array(w * h),
    top = new Int32Array(w * h),
    bottom = new Int32Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    let l = -1,
      r = w;
    for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx;
      if (!mask[i]) l = xx;
      left[i] = l;
    }
    for (let xx = w - 1; xx >= 0; xx--) {
      const i = yy * w + xx;
      if (!mask[i]) r = xx;
      right[i] = r;
    }
  }
  for (let xx = 0; xx < w; xx++) {
    let t = -1,
      b = h;
    for (let yy = 0; yy < h; yy++) {
      const i = yy * w + xx;
      if (!mask[i]) t = yy;
      top[i] = t;
    }
    for (let yy = h - 1; yy >= 0; yy--) {
      const i = yy * w + xx;
      if (!mask[i]) b = yy;
      bottom[i] = b;
    }
  }
  const result = Buffer.from(data);
  for (let yy = 0; yy < h; yy++)
    for (let xx = 0; xx < w; xx++) {
      const i = yy * w + xx;
      if (!mask[i]) continue;
      const l = pixel(x + left[i], y + yy),
        r = pixel(x + right[i], y + yy),
        t = pixel(x + xx, y + top[i]),
        b = pixel(x + xx, y + bottom[i]);
      const horizontal = distance(l, r),
        vertical = distance(t, b);
      let c;
      if (Math.min(horizontal, vertical) < 70) {
        const a = horizontal < vertical ? l : t,
          z = horizontal < vertical ? r : b;
        const p =
          horizontal < vertical
            ? (xx - left[i]) / (right[i] - left[i])
            : (yy - top[i]) / (bottom[i] - top[i]);
        c = a.map((v, k) => Math.round(v * (1 - p) + z[k] * p));
      } else {
        c = [
          [xx - left[i], l],
          [right[i] - xx, r],
          [yy - top[i], t],
          [bottom[i] - yy, b],
        ].sort((a, b) => a[0] - b[0])[0][1];
      }
      result.set(c, ((y + yy) * W + x + xx) * 3);
    }
  data.set(result);
}

// VTracer separates the remaining flat surfaces into vector paths. Unlike a
// screenshot, every path/ornament has its own tight bounds and independent layer.
export async function traceSurfaces(data, W, H) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "genie-preset-layers-"));
  try {
    await sharp(data, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toFile(path.join(temp, "input.png"));
    await run(process.env.GENIE_VTRACER || "vtracer", [
      "--input",
      path.join(temp, "input.png"),
      "--output",
      path.join(temp, "output.svg"),
      "--filter_speckle",
      "16",
      "--color_precision",
      "5",
      "--gradient_step",
      "64",
      "--mode",
      "spline",
      "--path_precision",
      "1",
    ]);
    const source = await fs.readFile(path.join(temp, "output.svg"), "utf8");
    const paths = [...source.matchAll(/<path\b[^>]*\/>/g)].map(([tag]) => {
      const d = /\bd="([^"]+)"/.exec(tag)[1];
      const pairs = [
        ...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g),
      ].map((m) => [+m[1], +m[2]]);
      const translate = /translate\(([-\d.]+),([-\d.]+)\)/.exec(tag);
      const tx = +(translate?.[1] || 0),
        ty = +(translate?.[2] || 0);
      const x = Math.floor(Math.min(...pairs.map((p) => p[0])) + tx),
        y = Math.floor(Math.min(...pairs.map((p) => p[1])) + ty);
      const w = Math.max(
          1,
          Math.ceil(Math.max(...pairs.map((p) => p[0])) + tx) - x,
        ),
        h = Math.max(
          1,
          Math.ceil(Math.max(...pairs.map((p) => p[1])) + ty) - y,
        );
      return { tag, x, y, w, h, fill: /fill="([^"]+)"/.exec(tag)[1] };
    });
    // Merge only adjacent shading paths. Moving a later path into an earlier
    // surface would change painter order (for example filling the counters of B).
    const layers = [];
    for (const p of paths) {
      const l = layers.at(-1);
      const adjacentShade =
        l &&
        l.w * l.h < W * H * 0.7 &&
        p.w * p.h < l.w * l.h * 0.5 &&
        p.x >= l.x &&
        p.y >= l.y &&
        p.x + p.w <= l.x + l.w &&
        p.y + p.h <= l.y + l.h &&
        distance(rgb(p.fill), rgb(l.fill)) < 55;
      if (adjacentShade) l.paths.push(p.tag);
      else layers.push({ ...p, paths: [p.tag] });
    }
    return Promise.all(
      layers
        .filter((p) => p.w * p.h >= 30)
        .map(async (p, i) => {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="${p.x} ${p.y} ${p.w} ${p.h}">${p.paths.join("")}</svg>`;
          const primitive =
            p.paths.length === 1 && p.w >= 12 && p.h >= 12
              ? await identifyPrimitive(svg, p.w, p.h)
              : undefined;
          if (primitive)
            return {
              ...primitive,
              n: i === 0 ? "Background" : `Panel ${i + 1}`,
              identifier: `surface-${i + 1}`,
              x: p.x,
              y: p.y,
              w: p.w,
              h: p.h,
              fill: p.fill,
              lw: 0,
            };
          return {
            t: "img",
            n:
              p.w > W * 0.8 && p.h > H * 0.8
                ? "Background surface"
                : p.w > 200 && p.h > 65
                  ? `Panel ${i + 1}`
                  : `Ornament ${i + 1}`,
            identifier: `surface-${i + 1}`,
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h,
            fit: "contain",
            src: svgSource(svg),
          };
        }),
    );
  } catch (e) {
    if (e.code === "ENOENT")
      throw Error(
        "Preset preparation needs the local VTracer CLI (GENIE_VTRACER can specify its path).",
      );
    throw e;
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
function rgb(color) {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
}

async function identifyPrimitive(svg, w, h) {
  const N = 40;
  const data = await sharp(Buffer.from(svg))
    .resize(N, N, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const candidates = [
    { t: "ellipse" },
    ...[0, 0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5].map((n) => ({
      t: "rect",
      r: Math.min(w, h) * n,
    })),
  ];
  let best,
    error = 0.015;
  for (const candidate of candidates) {
    let sum = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const xx = ((x + 0.5) * w) / N,
          yy = ((y + 0.5) * h) / N;
        const r = candidate.r || 0;
        const inside =
          candidate.t === "ellipse"
            ? ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2 <= 1
            : r === 0 ||
              Math.hypot(
                Math.max(r - xx, 0, xx - (w - r)),
                Math.max(r - yy, 0, yy - (h - r)),
              ) <= r;
        sum += Math.abs(data[(y * N + x) * 4 + 3] / 255 - (inside ? 1 : 0));
      }
    if (sum / (N * N) < error) {
      error = sum / (N * N);
      best = candidate;
    }
  }
  return best;
}
