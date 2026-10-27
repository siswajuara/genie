import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { traceSurfaces } from "../scripts/preset-layers.mjs";

test("separated surfaces retain painter order and holes in foreground objects", async () => {
  const input = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#fff"/><rect x="38" y="38" width="180" height="180" rx="28" fill="#ffcf25"/><rect x="76" y="76" width="104" height="104" fill="#112866"/><circle cx="128" cy="128" r="26" fill="#ffcf25"/></svg>',
  );
  const data = await sharp(input).removeAlpha().raw().toBuffer();
  const layers = await traceSurfaces(data, 256, 256);
  assert.ok(layers.some((o) => o.t === "rect"));
  const svg = layers
    .map((o) => {
      if (o.src)
        return `<g transform="translate(${o.x} ${o.y})">${decodeURIComponent(o.src.slice(o.src.indexOf(",") + 1))}</g>`;
      if (o.t === "ellipse")
        return `<ellipse cx="${o.x + o.w / 2}" cy="${o.y + o.h / 2}" rx="${o.w / 2}" ry="${o.h / 2}" fill="${o.fill}"/>`;
      return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${o.r || 0}" fill="${o.fill}"/>`;
    })
    .join("");
  const rendered = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${svg}</svg>`,
    ),
  )
    .removeAlpha()
    .raw()
    .toBuffer();
  const pixel = (x, y) => [
    ...rendered.subarray((y * 256 + x) * 3, (y * 256 + x) * 3 + 3),
  ];
  const close = (actual, expected) =>
    assert.ok(
      actual.every((v, i) => Math.abs(v - expected[i]) <= 8),
      `${actual} differs from ${expected}`,
    );
  close(pixel(128, 128), [255, 207, 37]);
  close(pixel(85, 85), [17, 40, 102]);
});
