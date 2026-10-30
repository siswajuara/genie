// A small Canvas-path recorder keeps the scene geometry shared between live
// rendering and standalone SVG snapshots. No DOM or raster dependency is needed.
const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const n = (value) => {
  if (!Number.isFinite(value)) throw Error("Invalid 3D drawing coordinate.");
  return String(Math.round(value * 1000) / 1000);
};

export function svgContext() {
  const output = [], stack = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let path = [], point;
  let state = {
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1,
    lineJoin: "round", lineCap: "round", dash: [],
    font: "13px Helvetica, Arial, sans-serif", textAlign: "center", textBaseline: "middle", x: 0, y: 0,
  };
  const ctx = {};
  for (const key of Object.keys(state))
    Object.defineProperty(ctx, key, { get: () => state[key], set: (value) => { state[key] = value; } });
  const include = (x, y) => {
    minX = Math.min(minX, x + state.x); minY = Math.min(minY, y + state.y);
    maxX = Math.max(maxX, x + state.x); maxY = Math.max(maxY, y + state.y);
  };
  const xy = (x, y) => { include(x, y); return `${n(x + state.x)} ${n(y + state.y)}`; };
  const move = (x, y) => { path.push(`M${xy(x, y)}`); point = [x, y]; };
  const line = (x, y) => { if (!point) move(x, y); else { path.push(`L${xy(x, y)}`); point = [x, y]; } };
  const style = (stroke) => stroke
    ? `fill="none" stroke="${esc(state.strokeStyle)}" stroke-width="${n(state.lineWidth)}" stroke-linejoin="${esc(state.lineJoin)}" stroke-linecap="${esc(state.lineCap)}"${state.dash.length ? ` stroke-dasharray="${state.dash.map(n).join(" ")}"` : ""}`
    : `fill="${esc(state.fillStyle)}"`;
  const text = (value, x, y, stroke) => {
    const anchor = state.textAlign === "center" ? "middle" : state.textAlign === "right" ? "end" : "start";
    const size = parseFloat(state.font) || 13;
    const width = String(value).length * size * 0.6;
    const left = state.textAlign === "center" ? x - width / 2 : state.textAlign === "right" ? x - width : x;
    include(left, y - size); include(left + width, y + size);
    // Canvas 'middle' aligns at the em midpoint; dy gives matching SVG baselines.
    output.push(`<text x="${n(x + state.x)}" y="${n(y + state.y)}" dy="${state.textBaseline === "middle" ? ".35em" : "0"}" text-anchor="${anchor}" font-family="Helvetica,Arial,sans-serif" font-size="${n(size)}" ${style(stroke)}>${esc(value)}</text>`);
  };
  Object.assign(ctx, {
    save() { stack.push({ ...state, dash: [...state.dash] }); },
    restore() { if (stack.length) state = stack.pop(); },
    translate(x, y) { state.x += x; state.y += y; },
    setLineDash(dash) { state.dash = dash; },
    beginPath() { path = []; point = undefined; },
    moveTo: move,
    lineTo: line,
    closePath() { path.push("Z"); },
    arc(cx, cy, radius, start, end, ccw = false) {
      this.ellipse(cx, cy, radius, radius, 0, start, end, ccw);
    },
    ellipse(cx, cy, rx, ry, rotation, start, end, ccw = false) {
      include(cx - rx, cy - ry); include(cx + rx, cy + ry);
      const tau = 2 * Math.PI;
      let delta = end - start;
      if (!ccw && delta >= tau) delta = tau;
      else if (ccw && -delta >= tau) delta = -tau;
      else { delta %= tau; if (!ccw && delta < 0) delta += tau; if (ccw && delta > 0) delta -= tau; }
      const at = (a) => [cx + rx * Math.cos(a) * Math.cos(rotation) - ry * Math.sin(a) * Math.sin(rotation), cy + rx * Math.cos(a) * Math.sin(rotation) + ry * Math.sin(a) * Math.cos(rotation)];
      const first = at(start);
      if (!point) move(...first); else line(...first);
      const count = Math.ceil(Math.abs(delta) / Math.PI);
      for (let i = 1; i <= count; i++) {
        const p = at(start + delta * i / count);
        if (rx < 1e-8 || ry < 1e-8) line(...p);
        else { path.push(`A${n(rx)} ${n(ry)} ${n(rotation * 180 / Math.PI)} 0 ${ccw ? 0 : 1} ${xy(...p)}`); point = p; }
      }
    },
    fill() { if (path.length) output.push(`<path d="${path.join(" ")}" ${style(false)}/>`); },
    stroke() { if (path.length) output.push(`<path d="${path.join(" ")}" ${style(true)}/>`); },
    fillText(value, x, y) { text(value, x, y, false); },
    strokeText(value, x, y) { text(value, x, y, true); },
    viewBox(pad = 20) { return `${n(minX - pad)} ${n(minY - pad)} ${n(maxX - minX + 2 * pad)} ${n(maxY - minY + 2 * pad)}`; },
    svg(width, height, viewBox = `0 0 ${width} ${height}`) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${output.join("")}</svg>`; },
  });
  return ctx;
}
