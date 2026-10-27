import type { Element } from "./model";
import type { GlyphAnimation } from "./text-animation";
export function drawElement(
  ctx: CanvasRenderingContext2D,
  object: Element & {
    img?: HTMLImageElement | HTMLCanvasElement;
    scienceTime?: number;
  },
  exporting?: boolean,
  glyphAnimation?: GlyphAnimation,
): void;
