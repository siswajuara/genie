import type { Element, Preset } from "./model";
export function sceneSafeArea(w: number, h: number): { x: number; y: number; w: number; h: number };
export function brandingRole(o: Element): Element["brandRole"] | undefined;
export function headerBranding(objects: Element[], w: number, h: number): Element[];
export function isSceneSurface(o: Element, w: number, h: number): boolean;
export function withSceneSafeLayout(preset: Preset): Preset;
