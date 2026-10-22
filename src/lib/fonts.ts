import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/baloo-2/800.css";
import type { Element } from "../editor/model";

const bundled = new Set(["Nunito", "Baloo 2"]);
const system = new Set([
  "Arial",
  "Georgia",
  "Courier New",
  "Impact",
  "Trebuchet MS",
  "sans-serif",
  "serif",
  "monospace",
  "system-ui",
]);
const sheets = new Map<string, Promise<void>>(),
  loading = new Map<string, Promise<void>>();
function stylesheet(family: string, weight?: number) {
  const key = `${family}:${weight ?? "regular"}`;
  if (!sheets.has(key))
    sheets.set(
      key,
      new Promise<void>((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}${weight ? `:wght@${weight}` : ""}&display=block`;
        const timer = window.setTimeout(() => {
          link.remove();
          reject(
            new Error(`Loading ${family} timed out. Check your connection.`),
          );
        }, 15000);
        link.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        link.onerror = () => {
          clearTimeout(timer);
          link.remove();
          reject(new Error(`Could not load ${family}. Check your connection.`));
        };
        document.head.appendChild(link);
      }).catch((err) => {
        sheets.delete(key);
        throw err;
      }),
    );
  return sheets.get(key)!;
}
export function ensureFont(family = "Nunito", weight = 800): Promise<void> {
  const key = `${family}:${weight}`;
  if (!loading.has(key))
    loading.set(
      key,
      (async () => {
        if (!bundled.has(family) && !system.has(family)) {
          try {
            await stylesheet(
              family,
              Math.max(100, Math.min(900, Math.round(weight / 100) * 100)),
            );
          } catch {
            await stylesheet(family);
          }
        }
        const faces = await document.fonts.load(
          `${weight} 32px ${JSON.stringify(family)}`,
        );
        if (!faces.length && !system.has(family))
          throw new Error(`Font ${family} is unavailable.`);
      })().catch((err) => {
        loading.delete(key);
        throw err;
      }),
    );
  return loading.get(key)!;
}
export function ensureDocumentFonts(elements: Element[]) {
  return Promise.all(
    elements
      .filter((o) => o.t === "text")
      .map((o) => ensureFont(o.font, o.weight)),
  );
}
