// Smooth, scene-local focus. No timers or randomness: scrubbing and export agree.
export function focusWeight(index, count, seconds) {
  const cycle = Math.max(1, count) * 1.3;
  const phase =
    2 * Math.PI * (Math.max(0, seconds) / cycle - index / Math.max(1, count));
  return ((1 + Math.cos(phase)) / 2) ** 2;
}
export function blendColor(from, to, amount) {
  const expand = (hex) => {
    let s = hex.slice(1);
    if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join("");
    return s;
  };
  const a = expand(from),
    b = expand(to),
    alpha = a.length === 8 || b.length === 8,
    t = Math.max(0, Math.min(1, amount));
  return (
    "#" +
    (alpha ? [0, 2, 4, 6] : [0, 2, 4])
      .map((i) =>
        Math.round(
          parseInt((a + "ff").slice(i, i + 2), 16) * (1 - t) +
            parseInt((b + "ff").slice(i, i + 2), 16) * t,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export const focusColor = (
  index,
  count,
  time,
  base = "#e7f0ff",
  highlight = "#ffed9a",
) => blendColor(base, highlight, focusWeight(index, count, time));
