import type { CanvasDocument } from "../src/editor/model";
export type FrameContext = {
  version: 1;
  canvasName: string;
  sampleTime: number;
  coordinateUnits: string;
  frames: {
    id: string;
    name: string;
    geometry: Record<string, number>;
    description: string;
    hidden: boolean;
    scene: Record<string, unknown>;
    layers: Record<string, any>[];
    subtitles: { text: string; [key: string]: unknown }[];
    narration: string;
    audio: Record<string, any>[];
  }[];
};
export const FRAME_CONTEXT_LIMIT: number;
export function buildFrameContext(
  document: CanvasDocument,
  selectedIds?: string[],
  options?: { time?: number },
): FrameContext;
export function validateFrameContext(raw: unknown): FrameContext;
export function readableFrameText(context: FrameContext): string;
export function contextCoverage(context: FrameContext): {
  frames: number;
  layers: number;
  mediaNeedingDescription: { id: string; name: string }[];
  audioNeedingTranscript: { id: string; name: string }[];
  characters: number;
};
