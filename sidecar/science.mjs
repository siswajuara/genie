import {
  extraPhysicsModels,
  validateExtraPhysics,
  extraPhysicsState,
} from "./physics-extra.mjs";
export const physicsModels = {
  ...extraPhysicsModels,
  pendulum: {
    label: "Pendulum (small angle)",
    defaults: { gravity: 9.81, length: 1.5, angle: 20, damping: 0 },
    ranges: {
      gravity: [0.1, 30],
      length: [0.1, 10],
      angle: [1, 30],
      damping: [0, 5],
    },
  },
  spring: {
    label: "Damped spring",
    defaults: { mass: 1, springConstant: 10, amplitude: 0.35, damping: 0.12 },
    ranges: {
      mass: [0.1, 20],
      springConstant: [0.1, 200],
      amplitude: [0.02, 2],
      damping: [0, 5],
    },
  },
  projectile: {
    label: "Projectile (no air resistance)",
    defaults: { gravity: 9.81, velocity: 8, angle: 45 },
    ranges: { gravity: [0.1, 30], velocity: [0.1, 40], angle: [5, 85] },
  },
  "linear-motion": {
    label: "Gerak lurus beraturan",
    defaults: { velocity: 2, distance: 10 },
    ranges: { velocity: [0.1, 20], distance: [1, 100] },
  },
  "free-fall": {
    label: "Jatuh bebas",
    defaults: { gravity: 10, height: 5 },
    ranges: { gravity: [0.1, 30], height: [0.1, 100] },
  },
  lever: {
    label: "Tuas ideal",
    defaults: { loadMass: 6, loadArm: 1, effortArm: 3, gravity: 10 },
    ranges: {
      loadMass: [0.1, 100],
      loadArm: [0.1, 5],
      effortArm: [0.1, 5],
      gravity: [0.1, 30],
    },
  },
  pulley: {
    label: "Katrol ideal",
    integers: ["supportingRopes"],
    defaults: { loadMass: 4, supportingRopes: 2, gravity: 10 },
    ranges: {
      loadMass: [0.1, 100],
      supportingRopes: [1, 4],
      gravity: [0.1, 30],
    },
  },
  buoyancy: {
    label: "Gaya apung",
    defaults: {
      objectDensity: 600,
      fluidDensity: 1000,
      volume: 0.002,
      gravity: 10,
    },
    ranges: {
      objectDensity: [100, 2000],
      fluidDensity: [500, 1500],
      volume: [0.0001, 0.05],
      gravity: [0.1, 30],
    },
  },
  wave: {
    label: "Gelombang transversal",
    defaults: { amplitude: 0.3, wavelength: 2, frequency: 1 },
    ranges: {
      amplitude: [0.02, 1],
      wavelength: [0.2, 10],
      frequency: [0.1, 5],
    },
  },
  circuit: {
    label: "Rangkaian DC satu resistor",
    defaults: { voltage: 6, resistance: 3 },
    ranges: { voltage: [0.1, 24], resistance: [1, 100] },
  },
  reflection: {
    label: "Pemantulan cahaya",
    defaults: { angle: 35 },
    ranges: { angle: [0, 75] },
  },
  orbit: {
    label: "Uniform circular motion",
    defaults: { radius: 1, period: 4 },
    ranges: { radius: [0.1, 10], period: [0.2, 60] },
  },
};
export function normalizePhysics(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    !Object.hasOwn(physicsModels, raw.kind)
  )
    throw Error("Choose a supported physics model.");
  const model = physicsModels[raw.kind];
  if (
    Object.keys(raw).some(
      (key) =>
        !["kind", "loop", "trail", ...Object.keys(model.defaults)].includes(
          key,
        ),
    )
  )
    throw Error("Unsupported physics parameter.");
  const result = {
    kind: raw.kind,
    ...model.defaults,
    loop: true,
    trail: true,
    ...raw,
  };
  for (const [key, [min, max]] of Object.entries(model.ranges)) {
    if (
      typeof result[key] !== "number" ||
      !Number.isFinite(result[key]) ||
      result[key] < min ||
      result[key] > max
    )
      throw Error(`${key} must be between ${min} and ${max}.`);
  }
  if (typeof result.loop !== "boolean" || typeof result.trail !== "boolean")
    throw Error("Physics loop and trail must be boolean.");
  if (raw.kind === "pulley" && !Number.isInteger(result.supportingRopes))
    throw Error("Use 1–4 whole supporting rope segments.");
  validateExtraPhysics(result);
  return result;
}
export function normalizeLatex(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    typeof raw.source !== "string" ||
    (raw.displayMode !== undefined && typeof raw.displayMode !== "boolean")
  )
    throw Error("Invalid LaTeX equation.");
  let source = raw.source.trim();
  if (source.startsWith("$$") && source.endsWith("$$"))
    source = source.slice(2, -2).trim();
  else if (
    (source.startsWith("\\(") && source.endsWith("\\)")) ||
    (source.startsWith("\\[") && source.endsWith("\\]"))
  )
    source = source.slice(2, -2).trim();
  else if (source.startsWith("$") && source.endsWith("$"))
    source = source.slice(1, -1).trim();
  if (
    !source ||
    source.length > 2000 ||
    /\\(?:require|href|url|includegraphics|input|include|documentclass|usepackage|html\w*|style|class|cssId)\b/i.test(
      source,
    )
  )
    throw Error(
      "Use a math expression of 1–2,000 characters, without document or external-content commands.",
    );
  return { source, displayMode: raw.displayMode ?? true };
}
// Analytical solution of q'' + 2*damping*q' + omega^2*q = 0, q(0)=a, q'(0)=0.
function oscillator(a, omega, damping, time) {
  const delta = omega * omega - damping * damping;
  if (Math.abs(delta) < 1e-8)
    return a * (1 + damping * time) * Math.exp(-damping * time);
  if (delta > 0) {
    const w = Math.sqrt(delta);
    return (
      a *
      Math.exp(-damping * time) *
      (Math.cos(w * time) + (damping / w) * Math.sin(w * time))
    );
  }
  const d = Math.sqrt(-delta),
    r1 = -damping + d,
    r2 = -damping - d;
  return (
    (a * (-r2 * Math.exp(r1 * time) + r1 * Math.exp(r2 * time))) / (r1 - r2)
  );
}
export function physicsState(raw, seconds) {
  const p = normalizePhysics(raw),
    t = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const extra = extraPhysicsState(p, t);
  if (extra) return extra;
  if (p.kind === "pendulum") {
    const period = 2 * Math.PI * Math.sqrt(p.length / p.gravity);
    const local = p.loop ? t : Math.min(t, period);
    const angle = oscillator(
      (p.angle * Math.PI) / 180,
      Math.sqrt(p.gravity / p.length),
      p.damping,
      local,
    );
    return {
      x: p.length * Math.sin(angle),
      y: p.length * Math.cos(angle),
      angle,
      period,
      time: local,
    };
  }
  if (p.kind === "spring") {
    const omega = Math.sqrt(p.springConstant / p.mass),
      period = (2 * Math.PI) / omega;
    const local = p.loop ? t : Math.min(t, period);
    return {
      x: oscillator(p.amplitude, omega, p.damping, local),
      y: 0,
      period,
      time: local,
    };
  }
  if (p.kind === "projectile") {
    const angle = (p.angle * Math.PI) / 180,
      vx = p.velocity * Math.cos(angle),
      vy = p.velocity * Math.sin(angle);
    const flight = (2 * vy) / p.gravity;
    const local = p.loop ? t % flight : Math.min(t, flight);
    return {
      x: vx * local,
      y: Math.max(0, vy * local - (p.gravity * local * local) / 2),
      vx,
      vy: vy - p.gravity * local,
      flight,
      range: vx * flight,
      height: (vy * vy) / (2 * p.gravity),
      time: local,
    };
  }
  if (p.kind === "linear-motion") {
    const duration = p.distance / p.velocity,
      local = p.loop ? t % duration : Math.min(t, duration);
    return {
      x: p.velocity * local,
      y: 0,
      time: local,
      duration,
      speed: p.velocity,
    };
  }
  if (p.kind === "free-fall") {
    const duration = Math.sqrt((2 * p.height) / p.gravity),
      local = p.loop ? t % duration : Math.min(t, duration);
    return {
      x: 0,
      y: Math.max(0, p.height - (p.gravity * local ** 2) / 2),
      speed: p.gravity * local,
      time: local,
      duration,
    };
  }
  if (p.kind === "lever")
    return {
      x: 0,
      y: 0,
      time: t,
      load: p.loadMass * p.gravity,
      effort: (p.loadMass * p.gravity * p.loadArm) / p.effortArm,
      mechanicalAdvantage: p.effortArm / p.loadArm,
    };
  if (p.kind === "pulley")
    return {
      x: 0,
      y: 0,
      time: p.loop ? t : Math.min(t, 4),
      load: p.loadMass * p.gravity,
      effort: (p.loadMass * p.gravity) / p.supportingRopes,
      mechanicalAdvantage: p.supportingRopes,
    };
  if (p.kind === "buoyancy") {
    const submerged = Math.min(1, p.objectDensity / p.fluidDensity),
      weight = p.objectDensity * p.volume * p.gravity;
    return {
      x: 0,
      y: 0,
      time: t,
      submerged,
      weight,
      buoyantForce: p.fluidDensity * p.volume * submerged * p.gravity,
      floating: p.objectDensity < p.fluidDensity,
      neutral: p.objectDensity === p.fluidDensity,
    };
  }
  if (p.kind === "wave")
    return {
      x: 0,
      y:
        p.amplitude *
        Math.sin(
          -2 *
            Math.PI *
            p.frequency *
            (p.loop ? t : Math.min(t, 1 / p.frequency)),
        ),
      time: p.loop ? t : Math.min(t, 1 / p.frequency),
      speed: p.wavelength * p.frequency,
    };
  if (p.kind === "circuit")
    return {
      x: 0,
      y: 0,
      time: p.loop ? t : Math.min(t, 4),
      current: p.voltage / p.resistance,
      power: p.voltage ** 2 / p.resistance,
    };
  if (p.kind === "reflection")
    return { x: 0, y: 0, time: t, incidence: p.angle, reflected: p.angle };
  const local = p.loop ? t : Math.min(t, p.period),
    angle = (2 * Math.PI * local) / p.period;
  return {
    x: p.radius * Math.cos(angle),
    y: p.radius * Math.sin(angle),
    angle,
    speed: (2 * Math.PI * p.radius) / p.period,
    period: p.period,
    time: local,
  };
}
