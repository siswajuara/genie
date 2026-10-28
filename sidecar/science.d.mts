export type PhysicsKind =
  | "pendulum"
  | "spring"
  | "projectile"
  | "orbit"
  | "linear-motion"
  | "free-fall"
  | "lever"
  | "pulley"
  | "buoyancy"
  | "wave"
  | "circuit"
  | "reflection"
  | "accelerated-motion"
  | "inclined-plane"
  | "friction"
  | "hydraulic"
  | "hydrostatic-pressure"
  | "refraction"
  | "longitudinal-wave"
  | "series-circuit"
  | "sound-travel"
  | "heating"
  | "energy-conservation"
  | "parallel-circuit"
  | "elastic-collision"
  | "thermal-expansion";
export type PhysicsSpec = {
  kind: PhysicsKind;
  gravity?: number;
  length?: number;
  angle?: number;
  damping?: number;
  mass?: number;
  springConstant?: number;
  amplitude?: number;
  velocity?: number;
  radius?: number;
  period?: number;
  loop?: boolean;
  trail?: boolean;
  distance?: number;
  height?: number;
  loadMass?: number;
  loadArm?: number;
  effortArm?: number;
  supportingRopes?: number;
  objectDensity?: number;
  fluidDensity?: number;
  volume?: number;
  wavelength?: number;
  frequency?: number;
  voltage?: number;
  resistance?: number;
  initialVelocity?: number;
  acceleration?: number;
  coefficient?: number;
  force?: number;
  area1?: number;
  area2?: number;
  depth?: number;
  index1?: number;
  index2?: number;
  resistance1?: number;
  resistance2?: number;
  soundSpeed?: number;
  specificHeat?: number;
  power?: number;
  initialTemperature?: number;
  temperatureRise?: number;
  mass1?: number;
  mass2?: number;
  velocity1?: number;
  velocity2?: number;
  expansionCoefficient?: number;
};
export type LatexSpec = { source: string; displayMode?: boolean };
export const physicsModels: Record<
  PhysicsKind,
  {
    label: string;
    defaults: Record<string, number>;
    integers?: string[];
    description?: string;
    ranges: Record<string, [number, number]>;
  }
>;
export function normalizePhysics(raw: unknown): PhysicsSpec;
export function normalizeLatex(raw: unknown): Required<LatexSpec>;
export function detectLatexSource(text: unknown): string | null;
export function physicsState(
  raw: PhysicsSpec,
  seconds: number,
): {
  x: number;
  y: number;
  angle?: number;
  period?: number;
  time: number;
  flight?: number;
  range?: number;
  height?: number;
  speed?: number;
  vx?: number;
  vy?: number;
  [key: string]: number | boolean | undefined;
};
