import { mathjax } from "@mathjax/src/js/mathjax.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "@mathjax/src/js/handlers/html.js";
import { MathJaxTexFont } from "@mathjax/mathjax-tex-font/js/svg.js";
import "@mathjax/src/js/input/tex/base/BaseConfiguration.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({
  packages: ["base", "ams", "newcommand"],
  maxBuffer: 10000,
  maxMacros: 1000,
  formatError: (_jax, error) => {
    throw Error(error.message);
  },
});
const output = new SVG({
  fontData: MathJaxTexFont,
  fontCache: "none",
  mtextInheritFont: false,
});
const doc = mathjax.document("", {
  InputJax: tex,
  OutputJax: output,
  compileError: (_doc, _math, error) => {
    throw Error(error.message);
  },
});
export function typeset(source, displayMode, color) {
  tex.reset();
  const node = doc.convert(source, {
    display: displayMode,
    em: 32,
    ex: 16,
    containerWidth: 1600,
  });
  const svg = adaptor.firstChild(node);
  const box = (adaptor.getAttribute(svg, "viewBox") || "")
    .split(/\s+/)
    .map(Number);
  if (
    box.length !== 4 ||
    !box.every(Number.isFinite) ||
    box[2] <= 0 ||
    box[3] <= 0
  )
    throw Error("The equation has no visible math.");
  const width = Math.max(1, Math.ceil(box[2] * 0.032)),
    height = Math.max(1, Math.ceil(box[3] * 0.032));
  adaptor.setAttribute(svg, "width", String(width));
  adaptor.setAttribute(svg, "height", String(height));
  const sourceSvg = adaptor.outerHTML(svg).replaceAll("currentColor", color);
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sourceSvg)}`,
    width,
    height,
  };
}
