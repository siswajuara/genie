import type { Element } from "./model";
import type { GlyphAnimation } from "./textAnimation";
export function drawElement(
  ctx: CanvasRenderingContext2D,
  object: Element & { img?: HTMLImageElement },
  exporting?: boolean,
  glyphAnimation?: GlyphAnimation,
): void;
