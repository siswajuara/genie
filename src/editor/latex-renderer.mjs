import { normalizeLatex } from "../../sidecar/science.mjs";
const cache = new Map();
export async function renderLatex(latex, color = "#112866") {
  const normalized = normalizeLatex(latex);
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color))
    throw Error("Choose a hex equation color.");
  const key = JSON.stringify([normalized, color]);
  if (!cache.has(key)) {
    const promise = import("./latex-engine.mjs").then(({ typeset }) =>
      typeset(normalized.source, normalized.displayMode, color),
    );
    cache.set(key, promise);
    void promise.catch(() => cache.delete(key));
    if (cache.size > 100) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}
