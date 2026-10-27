import type { LatexSpec } from "../../sidecar/science.mjs";
export function renderLatex(
  latex: LatexSpec,
  color?: string,
): Promise<{ src: string; width: number; height: number }>;
