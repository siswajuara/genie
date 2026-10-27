import type { Element } from "./model";
import { normalizeLatex, normalizePhysics } from "../../sidecar/science.mjs";
import { renderLatex } from "./latex-renderer.mjs";
import { normalizeLearning } from "../../sidecar/learning.mjs";
import { learningSvg } from "./learning-drawing.mjs";
import { physicsSvg } from "./physics-drawing.mjs";
export async function prepareScienceElement(
  element: Element,
): Promise<Element> {
  if (element.latex) {
    const latex = normalizeLatex(element.latex);
    const rendered = await renderLatex(latex, element.color || "#112866");
    return { ...element, latex, src: rendered.src, fit: "contain" };
  }
  if (element.learning) {
    const learning = normalizeLearning(element.learning);
    return {
      ...element,
      learning,
      src: learningSvg(learning, element.color || "#0757ec"),
      fit: "contain",
    };
  }
  if (element.physics) {
    const physics = normalizePhysics(element.physics);
    return {
      ...element,
      physics,
      src: physicsSvg(physics, element.color || "#0757ec"),
      fit: "contain",
    };
  }
  return element;
}
