import type { LearningSpec } from "../../sidecar/learning.mjs";
import type { Element } from "./model";
export function learningSvg(spec: LearningSpec, color?: string): string;
export function learningDrawing(
  spec: LearningSpec,
  seconds?: number,
  color?: string,
): unknown[];
export function drawLearning(
  ctx: CanvasRenderingContext2D,
  element: Element,
  seconds?: number,
): void;
