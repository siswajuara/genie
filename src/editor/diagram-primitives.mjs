const xml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function diagramBuilder(color = "#0757ec") {
  const shapes = [],
    ink = "#112866",
    soft = "#bfd3f4";
  const line = (x1, y1, x2, y2, stroke = ink, dash = false) =>
    shapes.push({ t: "line", x1, y1, x2, y2, stroke, dash });
  const path = (
    points,
    stroke = color,
    fill = "none",
    close = false,
    dash = false,
  ) =>
    shapes.push({
      t: "path",
      d:
        points
          .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`)
          .join(" ") + (close ? " Z" : ""),
      stroke,
      fill,
      dash,
    });
  const rect = (x, y, w, h, fill = "#e7f0ff", stroke = color, r = 10) =>
    shapes.push({ t: "rect", x, y, w, h, fill, stroke, r });
  const ellipse = (
    cx,
    cy,
    rx,
    ry,
    fill = "none",
    stroke = color,
    dash = false,
  ) => shapes.push({ t: "ellipse", cx, cy, rx, ry, fill, stroke, dash });
  const label = (value, x, y, size = 22, fill = ink, align = "left") =>
    shapes.push({ t: "text", value, x, y, size, fill, align });
  const arrow = (x, y, dx, dy, stroke = color) => {
    line(x, y, x + dx, y + dy, stroke);
    const a = Math.atan2(dy, dx);
    for (const side of [-1, 1])
      line(
        x + dx,
        y + dy,
        x + dx - 13 * Math.cos(a + side * 0.4),
        y + dy - 13 * Math.sin(a + side * 0.4),
        stroke,
      );
  };
  const wrapped = (value, x, y, width, size = 22, fill = ink) => {
    const limit = Math.max(1, Math.floor(width / (size * 0.58))),
      words = value
        .split(/\s+/)
        .flatMap((word) =>
          word.length > limit
            ? word.match(new RegExp(`.{1,${limit}}`, "gu"))
            : word,
        );
    let row = "",
      at = y;
    for (const word of words) {
      if (row && row.length + word.length + 1 > limit) {
        label(row, x, at, size, fill);
        row = word;
        at += size * 1.3;
      } else row += (row ? " " : "") + word;
    }
    if (row) label(row, x, at, size, fill);
  };
  return {
    shapes,
    line,
    path,
    rect,
    ellipse,
    label,
    arrow,
    wrapped,
    ink,
    soft,
    color,
  };
}
export function diagramSvg(shapes, title, color = "#0757ec") {
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color))
    throw Error("Choose a hex diagram color.");
  const content = shapes
    .map((s) => {
      const style = `stroke="${s.stroke || "none"}" stroke-width="3"${s.dash ? ' stroke-dasharray="6 7"' : ""}`;
      if (s.t === "line")
        return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" ${style}/>`;
      if (s.t === "circle")
        return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill}" ${style}/>`;
      if (s.t === "ellipse")
        return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${s.fill}" ${style}/>`;
      if (s.t === "rect")
        return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r ?? 10}" fill="${s.fill}" ${style}/>`;
      if (s.t === "path")
        return `<path d="${s.d}" fill="${s.fill || "none"}" ${style}/>`;
      return `<text x="${s.x}" y="${s.y}" font-family="Arial,sans-serif" font-size="${s.size}" fill="${s.fill}" text-anchor="${s.align === "center" ? "middle" : "start"}">${xml(s.value)}</text>`;
    })
    .join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 900 500" width="900" height="500"><title>${xml(title)}</title>${content}</svg>`)}`;
}
export function drawDiagram(ctx, element, shapes) {
  const scale = Math.min(element.w / 900, element.h / 500);
  ctx.save();
  ctx.translate(
    element.x + (element.w - 900 * scale) / 2,
    element.y + (element.h - 500 * scale) / 2,
  );
  ctx.scale(scale, scale);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of shapes) {
    ctx.setLineDash(s.dash ? [6, 7] : []);
    ctx.strokeStyle = s.stroke || "transparent";
    ctx.fillStyle = !s.fill || s.fill === "none" ? "transparent" : s.fill;
    ctx.beginPath();
    if (s.t === "line") {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    } else if (s.t === "circle" || s.t === "ellipse") {
      ctx.ellipse(s.cx, s.cy, s.rx ?? s.r, s.ry ?? s.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (s.t === "rect") {
      ctx.roundRect(s.x, s.y, s.w, s.h, s.r ?? 10);
      ctx.fill();
      ctx.stroke();
    } else if (s.t === "path") {
      const path = new Path2D(s.d);
      if (s.fill && s.fill !== "none") ctx.fill(path);
      ctx.stroke(path);
    } else {
      ctx.font = `400 ${s.size}px Arial,sans-serif`;
      ctx.textAlign = s.align || "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(s.value, s.x, s.y);
    }
  }
  ctx.restore();
}
