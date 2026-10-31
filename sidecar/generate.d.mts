import type { FrameContext } from "./frame-context.mjs";
import type { LearningSpec } from "./learning.mjs";
import type { PhysicsSpec } from "./science.mjs";
import type {
  CompositionScene,
  SceneComposition,
  CompositionStory,
  SceneDirection,
} from "./scene-composition.mjs";
export type GenerationScene = {
  useCase: string;
  tone: string;
  seconds: number;
  narrate: boolean;
  note: string;
  composition?: CompositionScene;
  listItemCount?: number;
  slots: {
    id: string;
    label: string;
    example: string;
    maxChars: number;
    role?: "headline" | "content" | "latex";
  }[];
  allowVisual?: boolean;
  learning?: { id: string; example: LearningSpec }[];
  diagrams?: { id: string; example: PhysicsSpec }[];
};
export type GenerationRequest = {
  content: string;
  language: string;
  narration: boolean;
  scenes: GenerationScene[];
  confirmed?: boolean;
  frameContext?: FrameContext;
};
export type TeachingVisual =
  | { type: "learning"; settings: LearningSpec }
  | { type: "physics"; settings: PhysicsSpec }
  | { type: "latex"; source: string };
export type GeneratedFrame = {
  composition?: SceneComposition;
  direction?: SceneDirection;
  motionPlan?: "hold" | "build" | "focus" | "compare" | "resolve";
  useCase: string;
  title: string;
  texts: { id: string; text: string }[];
  narration: string;
  physics?: { id: string; settings: PhysicsSpec }[];
  learning?: { id: string; settings: LearningSpec }[];
  visual?: TeachingVisual;
};
export type GenerationResult = {
  story?: CompositionStory;
  model?: { providerID: string; id: string };
  post: { name: string; caption: string };
  frames: GeneratedFrame[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  repaired?: string[];
};
export function validateGenerationRequest(
  request: GenerationRequest,
): GenerationRequest;
export const sceneRoles: Record<string, string>;
export function buildScriptPrompt(request: GenerationRequest): {
  system: string;
  user: string;
};
export function parseGenerationResult(
  value: unknown,
  request: GenerationRequest,
): Pick<GenerationResult, "frames" | "post" | "story"> & { repaired: string[] };
