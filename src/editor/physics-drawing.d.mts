import type { PhysicsSpec } from "../../sidecar/science.mjs";
import type { Element } from "./model";
export function physicsSvg(spec: PhysicsSpec, color?: string): string;
export function drawPhysics(
  ctx: CanvasRenderingContext2D,
  element: Element,
  seconds?: number,
): void;
