import type { LearningSpec } from "./learning.mjs";
import type { PhysicsSpec } from "./science.mjs";
export type CompositionAsset = {
  ref: string;
  name: string;
  description: string;
  kind: "image" | "video" | "element";
};
export type CompositionScene = {
  width: number;
  height: number;
  assets: CompositionAsset[];
};
export type CompositionAnimation = {
  start: number;
  enter: "fade" | "reveal-up" | "reveal-left" | "reveal-right" | "zoom" | "pop";
  duration: number;
  motion: "none" | "float" | "pulse" | "breathe" | "sway";
  amount: number;
  keyframes?: {
    time: number;
    dx: number;
    dy: number;
    scale: number;
    opacity: number;
  }[];
};
export type CompositionStory = {
  idea: string;
  format: string;
  device: string;
  look: string;
  palette: string[];
};
export type SceneDirection = {
  action: string;
  framing: "wide" | "medium" | "close";
  bridge: string;
};
type Box = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  animation?: CompositionAnimation;
};
export type CompositionLayer = Box &
  (
    | {
        type: "text";
        text: string;
        fontSize: number;
        weight: number;
        align: "left" | "center" | "right";
        color?: string;
        role?: "headline" | "body" | "cta";
      }
    | {
        type: "rect" | "ellipse" | "line";
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        radius?: number;
      }
    | { type: "asset"; assetRef: string }
    | { type: "learning"; settings: LearningSpec; color?: string }
    | { type: "physics"; settings: PhysicsSpec; color?: string }
    | { type: "latex"; source: string; color?: string }
  );
export type SceneComposition = {
  background: string;
  layers: CompositionLayer[];
  transition?: {
    type: "cut" | "crossfade" | "wipe" | "slide-left" | "zoom";
    duration: number;
  };
};
export const compositionDirection: string;
export const compositionEffects: string[];
export const compositionMotions: string[];
export const compositionTransitions: string[];
export function validateCompositionScene(scene: {
  composition: CompositionScene;
}): void;
export function parseComposition(
  value: unknown,
  scene: { composition: CompositionScene; seconds: number; useCase: string },
): SceneComposition;
export function parseStory(value: unknown): CompositionStory;
export function parseDirection(value: unknown): SceneDirection;
