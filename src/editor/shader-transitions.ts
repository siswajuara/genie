/** Effect definitions from the supplied shaders-transition.tsx, applied to local frames. */
type Vec4 = [number, number, number, number];
type Vec3 = [number, number, number];
export type ShaderEasing = "cubic" | "linear" | "expo" | "bounce" | "back";
type EffectOptions = {
  p?: Vec4; p2?: Vec4; q?: Vec4; f?: Vec4; c?: Vec3;
  beat?: number; ease?: ShaderEasing; dur?: number;
};
export type ShaderTransition = {
  kind: string; P: Vec4; P2: Vec4; Q: Vec4; F: Vec4; C: Vec3;
  beat: number; ease: ShaderEasing; dur: number;
};
const R_ = 0, U_ = Math.PI / 2, L_ = Math.PI, D_ = -Math.PI / 2;
const TAU = Math.PI * 2;

// fx(kind, { p, p2, q, f, c, beat, ease, dur })
//  p/p2  kind parameters         q = [chroma, shakeAmp, shakeFreq, flash]
//  f = [glow, vignette, grain, sepia]   c = colour   beat = beat mode 0..5
const fx = (kind: string, o: EffectOptions = {}): ShaderTransition => ({
  kind,
  P: o.p || [0, 0, 0, 0],
  P2: o.p2 || [0, 0, 0, 0],
  Q: o.q || [0, 0, 0, 0],
  F: o.f || [0, 0, 0, 0],
  C: o.c || [1, 1, 1],
  beat: o.beat || 0,
  ease: o.ease || "cubic",
  dur: o.dur || 1,
});

const CATEGORIES = {
  "Basic / Standard": {
    "Fade": fx("fade"),
    "Dissolve": fx("dissolve", { p: [6, 0.18, 0, 0] }),
    "Cross Dissolve": fx("fade", { p: [1, 0, 0, 0], f: [0.3, 0, 0, 0] }),
    "Wipe Left": fx("wipe", { p: [L_, 0.06, 0, 0] }),
    "Wipe Right": fx("wipe", { p: [R_, 0.06, 0, 0] }),
    "Wipe Up": fx("wipe", { p: [U_, 0.06, 0, 0] }),
    "Wipe Down": fx("wipe", { p: [D_, 0.06, 0, 0] }),
    "Slide Left": fx("push", { p: [L_, 0, 0, 0], p2: [1, 0, 0, 0] }),
    "Slide Right": fx("push", { p: [R_, 0, 0, 0], p2: [1, 0, 0, 0] }),
    "Slide Up": fx("push", { p: [U_, 0, 0, 0], p2: [1, 0, 0, 0] }),
    "Slide Down": fx("push", { p: [D_, 0, 0, 0], p2: [1, 0, 0, 0] }),
    "Zoom In": fx("zoom", { p: [0.8, 0, 0, 0] }),
    "Zoom Out": fx("zoom", { p: [-0.8, 0, 0, 0] }),
    "Push": fx("push", { p: [L_, 1, 0.008, 0], p2: [0.6, 0, 0, 0] }),
    "Split": fx("split", { p: [0, 0, 0, 0] }),
    "Switch": fx("push", { p: [L_, 1, 0, 0.28], p2: [0.5, 0, 0, 0] }),
    "Flash White": fx("flash", { p: [4, 1, 0.03, 0], c: [1, 1, 1] }),
    "Flash Black": fx("flash", { p: [4, 1, 0.03, 0], c: [0, 0, 0] }),
  },
  "Camera / Motion": {
    "Spin": fx("spin", { p: [TAU, 0.7, 0, 0] }),
    "Spin In": fx("spin", { p: [Math.PI * 1.5, 0.8, 1, 0] }),
    "Spin Out": fx("spin", { p: [Math.PI * 1.5, 0.8, 2, 0] }),
    "Rotate": fx("spin", { p: [0.7, 0.25, 0, 0] }),
    "Whip Pan Left": fx("whip", { p: [L_, 1, 0, 0], p2: [0.55, 0, 0, 0], ease: "expo", dur: 0.8 }),
    "Whip Pan Right": fx("whip", { p: [R_, 1, 0, 0], p2: [0.55, 0, 0, 0], ease: "expo", dur: 0.8 }),
    "Pan Up": fx("whip", { p: [U_, 1, 0, 0], p2: [0.3, 0, 0, 0] }),
    "Pan Down": fx("whip", { p: [D_, 1, 0, 0], p2: [0.3, 0, 0, 0] }),
    "Swing": fx("swing", { p: [1.5, 0.5, 0, 0] }),
    "Tilt Up": fx("whip", { p: [U_, 1, 0, 0.18], p2: [0.18, 0, 0, 0] }),
    "Tilt Down": fx("whip", { p: [D_, 1, 0, 0.18], p2: [0.18, 0, 0, 0] }),
    "Shake": fx("fade", { q: [0.006, 0.045, 38, 0] }),
    "Handheld": fx("fade", { p: [1, 0, 0, 0], q: [0, 0.02, 5, 0] }),
    "Quick Zoom": fx("zoom", { p: [1.0, 0.55, 1, 0], ease: "expo", dur: 0.55 }),
    "Snap": fx("zoom", { p: [0.3, 0, 1, 0], q: [0.012, 0, 0, 0], ease: "expo", dur: 0.45 }),
    "Bounce": fx("push", { p: [U_, 0, 0, 0], p2: [0.8, 0, 0, 0], ease: "bounce", dur: 1.2 }),
    "Pull In": fx("zoom", { p: [1.7, 0.5, 0, 0] }),
    "Push Out": fx("zoom", { p: [-1.4, 0, 0, 0] }),
  },
  "3D / Warp": {
    "3D Zoom": fx("lens", { p: [1.0, 1.3, 0, 0], f: [0, 0.25, 0, 0] }),
    "3D Zoom Pro": fx("lens", { p: [1.6, 2.2, 0, 0], q: [-0.02, 0, 0, 0], f: [0.3, 0.4, 0, 0] }),
    "3D Flip": fx("flip", { p: [0, 3.2, 0, 0] }),
    "3D Rotate": fx("cube", { p: [1, 2.4, 0, 0] }),
    "Cube": fx("cube", { p: [1, 5.5, 0, 0] }),
    "Page Turn": fx("curl", { p: [0.13, 0, 0, 0] }),
    "Ripple 3D": fx("ripple", { p: [70, 0.05, 1, 0], q: [-0.012, 0, 0, 0], f: [0.2, 0.3, 0, 0] }),
    "Stretch": fx("warp", { p: [3, 0, 2, 0] }),
    "Warp": fx("warp", { p: [5, 0, 1.6, 0] }),
    "Twirl": fx("twirl", { p: [6, 0.9, 0, 0] }),
    "Swirl": fx("twirl", { p: [3.2, 0.55, 1, 0] }),
    "Fold": fx("fold", { p: [8, 0, 0, 0] }),
    "Perspective": fx("flip", { p: [1, 2.3, 0, 0] }),
    "Lens Distort": fx("lens", { p: [1.4, 0.2, 0, 0], q: [0.012, 0, 0, 0] }),
    "Spherical": fx("lens", { p: [3.0, 0.9, 0, 0], f: [0, 0.5, 0, 0] }),
    "Fisheye In": fx("lens", { p: [3.5, 1.6, 0, 0] }),
    "Fisheye Out": fx("lens", { p: [-2.2, 0.5, 0, 0] }),
  },
  "Glitch & Distortion": {
    "Glitch": fx("glitch", { p: [0, 0.6, 0.03, 0] }),
    "Digital Glitch": fx("digital", { p: [0, 0.8, 0, 0] }),
    "RGB Split": fx("fade", { p: [1, 0, 0, 0], q: [0.03, 0, 0, 0] }),
    "Chromatic Aberration": fx("lens", { p: [0.6, 0.25, 0, 0], q: [-0.035, 0, 0, 0] }),
    "Pixelate": fx("pixel", { p: [16, 0, 0, 0] }),
    "Bad TV": fx("tv", { p: [0, 0, 0, 0] }),
    "Distortion": fx("warp", { p: [2, 5, 2.2, 0] }),
    "Wave": fx("warp", { p: [0, 16, 1.6, 0] }),
    "Flicker": fx("flicker"),
    "VHS": fx("tv", { p: [1, 0, 0, 0] }),
    "Scanline": fx("tv", { p: [2, 0, 0, 0], c: [0.6, 0.9, 1] }),
    "Noise": fx("dissolve", { p: [900, 0.08, 0, 0], p2: [2, 0, 0, 0], f: [0, 0, 0.15, 0] }),
    "Data Error": fx("digital", { p: [1, 0.9, 0, 0] }),
    "Shockwave": fx("ripple", { p: [60, 0.1, 1, 0], q: [0.03, 0, 0, 0], f: [0.3, 0, 0, 0] }),
    "Freeze Frame Glitch": fx("glitch", { p: [0, 0.9, 0.02, 0], p2: [0, 0, 0, 1] }),
  },
  "Blur & Focus": {
    "Blur In": fx("blur", { p: [0, 0, 0.07, 1] }),
    "Blur Out": fx("blur", { p: [0, 0, 0.07, 2] }),
    "Motion Blur": fx("blur", { p: [1, 0, 0.14, 0] }),
    "Radial Blur": fx("blur", { p: [2, 0, 0.16, 0] }),
    "Zoom Blur": fx("blur", { p: [3, 0, 0.25, 0] }),
    "Gaussian Blur": fx("blur", { p: [0, 0, 0.05, 0] }),
    "Focus Shift": fx("blur", { p: [5, 0, 0.06, 0] }),
    "Rack Focus": fx("blur", { p: [4, 0, 0.07, 0], f: [0.2, 0, 0, 0] }),
    "Bokeh Blur": fx("blur", { p: [4, 0, 0.08, 0] }),
    "Background Blur": fx("blur", { p: [6, 0, 0.06, 0] }),
  },
  "Light & Glow": {
    "Light Leak": fx("fx", { p: [1, 0, 0, 0], c: [1, 0.55, 0.2] }),
    "Light Flash": fx("flash", { p: [3, 1, 0.05, 0], c: [1, 0.9, 0.7], f: [0.5, 0, 0, 0] }),
    "Glow": fx("blur", { p: [0, 0, 0.02, 0], f: [1.2, 0, 0, 0] }),
    "Neon": fx("fx", { p: [6, 0, 0, 0] }),
    "Lens Flare": fx("fx", { p: [2, 0, 0, 0], c: [1, 0.85, 0.6] }),
    "Shine": fx("wipe", { p: [0.785, 0.12, 2.2, 0], c: [1, 1, 1] }),
    "Strobe": fx("flash", { p: [2, 6, 0.05, 0], c: [1, 1, 1] }),
    "Lightning": fx("fx", { p: [3, 0, 0, 0] }),
    "Aurora": fx("fx", { p: [4, 0, 0, 0] }),
    "Dreamy Light": fx("blur", { p: [0, 0, 0.035, 0], f: [1.0, 0.25, 0, 0.2] }),
    "Sparkle": fx("fx", { p: [5, 0, 0, 0] }),
  },
  "Cinematic & Film": {
    "Film Roll": fx("push", { p: [U_, 1, 0.02, 0], q: [0, 0.012, 24, 0], f: [0, 0.5, 0.4, 0.35] }),
    "Film Burn": fx("dissolve", { p: [2.5, 0.25, 2.5, 0], c: [1, 0.45, 0.1], f: [0.8, 0.3, 0.3, 0.2] }),
    "Film Strip": fx("film", { p: [L_, 1, 0.015, 0] }),
    "Luma Fade": fx("dissolve", { p: [-1, 0.15, 0, 0] }),
    "Cross Film": fx("fade", { p: [1, 0, 0, 0], q: [0, 0.006, 26, 0], f: [0, 0.5, 0.45, 0.25] }),
    "Vignette Transition": fx("shape", { p: [0, 0, 0.25, 0], f: [0, 0.8, 0, 0] }),
    "Letterbox Slide": fx("push", { p: [L_, 1, 0, 0], p2: [0.4, 0.13, 0, 0] }),
    "Color Fade": fx("flash", { p: [1, 1, 0.3, 0], c: [0.1, 0.15, 0.4] }),
    "Fade to White": fx("flash", { p: [1, 1, 0.35, 0], c: [1, 1, 1] }),
    "Fade to Black": fx("flash", { p: [1, 1, 0.35, 0], c: [0, 0, 0] }),
  },
  "Aesthetic / Trendy": {
    "Polaroid Slide": fx("polaroid"),
    "Scrapbook": fx("tiles", { p: [3, 2, 0.55, 0.05], p2: [0.6, 0, 0, 0] }),
    "Paper Tear": fx("wipe", { p: [L_, 0.004, 0, 0.06], p2: [0.012, 0, 0, 0], c: [0.96, 0.94, 0.9], f: [0, 0.2, 0.25, 0] }),
    "Grain Slide": fx("push", { p: [L_, 1, 0, 0], f: [0, 0.25, 0.5, 0.3] }),
    "Vintage Swipe": fx("wipe", { p: [R_, 0.15, 0, 0], f: [0, 0.6, 0.35, 0.85] }),
    "Collage": fx("tiles", { p: [4, 3, 0.12, 0.02], p2: [0.6, 0, 0, 0] }),
    "Frame Pop": fx("tiles", { p: [1, 1, 0.08, 0.035], p2: [0, 0, 0, 0] }),
    "Instagram Style": fx("push", { p: [L_, 1, 0, 0.1], f: [0.2, 0.35, 0.15, 0.2] }),
    "VHS Aesthetic": fx("tv", { p: [1, 0, 0, 0], f: [0.2, 0.3, 0.2, 0.4] }),
    "KiraKira": fx("fx", { p: [8, 0, 0, 0] }),
    "Soft Glow": fx("blur", { p: [0, 0, 0.015, 0], f: [1.5, 0.15, 0, 0] }),
  },
  "Shape & Mask": {
    "Circle Wipe": fx("shape", { p: [0, 0, 0.02, 0], p2: [1.5, 0, 0, 0] }),
    "Heart Wipe": fx("shape", { p: [1, 0, 0.02, 0], p2: [1.5, 0, 0, 0] }),
    "Star Wipe": fx("shape", { p: [2, 0, 0.02, 0], p2: [1.5, 0, 0, 0] }),
    "Diagonal Wipe": fx("wipe", { p: [0.785, 0.03, 0, 0] }),
    "Line Reveal": fx("wipe", { p: [D_, 0.004, 3.0, 0], c: [1, 1, 1] }),
    "Split Screen": fx("split", { p: [1, 1, 0, 0] }),
    "Zoom Through Shape": fx("shape", { p: [0, 0, 0.03, 1.2] }),
    "Mask Slide": fx("blinds", { p: [0, 8, 0.05, 0.8] }),
    "Frame In": fx("shape", { p: [3, 0, 0.004, 0], p2: [1.2, 0, 0, 0] }),
    "Frame Out": fx("shape", { p: [3, 1, 0.004, 0], p2: [1.2, 0, 0, 0] }),
  },
  "Beat / Flash Style": {
    "Beat Flash": fx("flash", { p: [3, 1, 0.05, 0], beat: 4 }),
    "Beat Cut": fx("zoom", { p: [0.25, 0, 1, 0], beat: 1 }),
    "Impact": fx("zoom", { p: [0.6, 0.25, 1, 0], q: [0.02, 0.06, 45, 0.6], ease: "expo", dur: 0.6 }),
    "Zoom Beat": fx("fade", { p: [1, 0, 0, 0], beat: 2 }),
    "Shake Beat": fx("fade", { p: [1, 0, 0, 0], beat: 3 }),
    "Flash Beat": fx("fade", { p: [1, 0, 0, 0], beat: 4 }),
    "Cut on Beat": fx("fade", { p: [1, 0, 0, 0], beat: 1 }),
    "Bounce Beat": fx("fade", { p: [1, 0, 0, 0], beat: 5 }),
  },
};

export type ShaderTransitionName = {
  [K in keyof typeof CATEGORIES]: keyof (typeof CATEGORIES)[K]
}[keyof typeof CATEGORIES];
export type ShaderTransitionId = `shader:${ShaderTransitionName}`;
export const TRANSITIONS = Object.assign({}, ...Object.values(CATEGORIES)) as Record<ShaderTransitionName, ShaderTransition>;
export const TRANSITION_CATEGORIES = Object.fromEntries(
  Object.entries(CATEGORIES).map(([k, v]) => [k, Object.keys(v)])
);

export const shaderTransitionId = (name: ShaderTransitionName): ShaderTransitionId => `shader:${name}`;
export const shaderTransitions = (Object.keys(TRANSITIONS) as ShaderTransitionName[]).map(shaderTransitionId);
export function shaderTransition(id: string): ShaderTransition | undefined {
  if (!id.startsWith("shader:")) return undefined;
  const name = id.slice(7);
  return Object.hasOwn(TRANSITIONS, name) ? TRANSITIONS[name as ShaderTransitionName] : undefined;
}

const easeOutBounce = (t: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
const EASE = {
  cubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  linear: (t: number) => t,
  expo: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  bounce: easeOutBounce,
  back: (t: number) => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
};


export const shaderEase = (effect: ShaderTransition, progress: number) => EASE[effect.ease](progress);
