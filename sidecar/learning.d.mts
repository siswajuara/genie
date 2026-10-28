export type LearningKind =
  | "square"
  | "rectangle"
  | "triangle"
  | "circle"
  | "parallelogram"
  | "trapezoid"
  | "rhombus"
  | "kite"
  | "cube"
  | "cuboid"
  | "cylinder"
  | "cone"
  | "sphere"
  | "triangular-prism"
  | "square-pyramid"
  | "fraction"
  | "number-line"
  | "coordinates"
  | "bar-chart"
  | "sentence"
  | "syllables"
  | "word-family"
  | "story-sequence"
  | "main-idea"
  | "angle"
  | "regular-polygon"
  | "cube-net"
  | "multiplication-array"
  | "place-value"
  | "fraction-addition"
  | "pie-chart"
  | "line-chart"
  | "analog-clock"
  | "balance-equation"
  | "venn"
  | "ratio"
  | "punctuation"
  | "affix"
  | "cause-effect"
  | "story-map"
  | "equal-sharing"
  | "equivalent-fractions"
  | "pythagoras"
  | "linear-function"
  | "quadratic-function"
  | "unit-circle"
  | "probability-bag"
  | "vector-addition";
export type LearningSpec = {
  kind: LearningKind;
  animate?: boolean;
  [key: string]: string | number | boolean | string[] | number[] | undefined;
};
export const learningModels: Record<
  LearningKind,
  {
    label: string;
    subject: "mathematics" | "indonesian";
    defaults: Record<string, string | number | string[] | number[]>;
    ranges: Record<string, [number, number]>;
    integers?: string[];
    fields?: Record<string, Record<string, unknown>>;
    description: string;
  }
>;
export function normalizeLearning(raw: unknown): LearningSpec;
export function learningMetrics(raw: LearningSpec): Record<string, number>;
