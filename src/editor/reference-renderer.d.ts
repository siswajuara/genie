import type { Element } from "./model";
export function drawElement(
  ctx: CanvasRenderingContext2D,
  object: Element & { img?: HTMLImageElement },
  exporting?: boolean,
): void;
