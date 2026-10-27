export const extraPhysicsModels = {
  "accelerated-motion": {
    label: "Gerak lurus berubah beraturan",
    defaults: { initialVelocity: 0, acceleration: 2, distance: 20 },
    ranges: {
      initialVelocity: [0, 20],
      acceleration: [0.1, 10],
      distance: [1, 100],
    },
    description:
      "Gerak satu arah dengan percepatan positif tetap. s=v₀t+at²/2 dan v=v₀+at; lintasan dibatasi distance.",
  },
  "inclined-plane": {
    label: "Bidang miring tanpa gesekan",
    defaults: { mass: 2, angle: 30, gravity: 10, distance: 5 },
    ranges: {
      mass: [0.1, 20],
      angle: [5, 60],
      gravity: [0.1, 30],
      distance: [1, 20],
    },
    description:
      "Benda dilepas dari diam. Percepatan g sin θ; gaya sejajar mg sin θ, normal mg cos θ. Tidak ada gesekan.",
  },
  friction: {
    label: "Gesekan kinetik",
    defaults: {
      mass: 2,
      coefficient: 0.3,
      gravity: 10,
      velocity: 1,
      distance: 5,
    },
    ranges: {
      mass: [0.1, 20],
      coefficient: [0, 1],
      gravity: [0.1, 30],
      velocity: [0.1, 5],
      distance: [1, 20],
    },
    description:
      "Benda ditarik dengan kecepatan tetap di permukaan datar. Gaya tarik menyeimbangkan gesekan kinetik μmg; bukan model gesekan statik.",
  },
  hydraulic: {
    label: "Dongkrak hidrolik ideal",
    defaults: { force: 100, area1: 0.01, area2: 0.04 },
    ranges: { force: [1, 1000], area1: [0.001, 0.1], area2: [0.001, 0.5] },
    description:
      "Tekanan sama: F₁/A₁=F₂/A₂. Penampang dalam m²; diagram gaya statis, tanpa rugi-rugi dan tanpa beda ketinggian piston.",
  },
  "hydrostatic-pressure": {
    label: "Tekanan hidrostatis",
    defaults: { fluidDensity: 1000, depth: 2, gravity: 10 },
    ranges: { fluidDensity: [500, 1500], depth: [0.1, 10], gravity: [0.1, 30] },
    description:
      "Tekanan ukur relatif permukaan: p=ρgh, tidak termasuk tekanan atmosfer; cairan diam bermassa jenis tetap.",
  },
  refraction: {
    label: "Pembiasan dan pantulan total",
    defaults: { index1: 1, index2: 1.5, angle: 35 },
    ranges: { index1: [1, 2.5], index2: [1, 2.5], angle: [0, 80] },
    description:
      "Hukum Snell n₁ sin i=n₂ sin r, sudut terhadap normal. Jika sin r>1, terjadi pantulan internal total dan tidak ada sinar bias.",
  },
  "longitudinal-wave": {
    label: "Gelombang longitudinal",
    defaults: { amplitude: 0.1, wavelength: 2, frequency: 1 },
    ranges: { amplitude: [0.01, 0.3], wavelength: [1, 8], frequency: [0.1, 3] },
    description:
      "Partikel berosilasi sejajar arah rambat, bukan berpindah bersama gelombang. Syarat 2πA/λ≤0,8 agar urutan partikel tetap; v=λf.",
  },
  "series-circuit": {
    label: "Dua resistor seri",
    defaults: { voltage: 6, resistance1: 2, resistance2: 4 },
    ranges: {
      voltage: [0.1, 24],
      resistance1: [1, 100],
      resistance2: [1, 100],
    },
    description:
      "Rangkaian ideal tertutup: Rtotal=R₁+R₂, arus sama pada semua bagian, U₁+U₂=U. Titik bergerak mengilustrasikan arus konvensional.",
  },
};
export function validateExtraPhysics(p) {
  if (
    p.kind === "longitudinal-wave" &&
    (2 * Math.PI * p.amplitude) / p.wavelength > 0.8
  )
    throw Error(
      "Use 2π × amplitude / wavelength ≤ 0.8 for a longitudinal wave.",
    );
}
export function extraPhysicsState(p, t) {
  if (p.kind === "accelerated-motion") {
    const duration =
        (2 * p.distance) /
        (Math.sqrt(p.initialVelocity ** 2 + 2 * p.acceleration * p.distance) +
          p.initialVelocity),
      time = p.loop ? t % duration : Math.min(t, duration);
    return {
      x: p.initialVelocity * time + (p.acceleration * time * time) / 2,
      y: 0,
      time,
      duration,
      speed: p.initialVelocity + p.acceleration * time,
    };
  }
  if (p.kind === "inclined-plane") {
    const a = p.gravity * Math.sin((p.angle * Math.PI) / 180),
      duration = Math.sqrt((2 * p.distance) / a),
      time = p.loop ? t % duration : Math.min(t, duration);
    return {
      x: (a * time * time) / 2,
      y: 0,
      time,
      duration,
      speed: a * time,
      acceleration: a,
      parallel: p.mass * a,
      normal: p.mass * p.gravity * Math.cos((p.angle * Math.PI) / 180),
    };
  }
  if (p.kind === "friction") {
    const duration = p.distance / p.velocity,
      time = p.loop ? t % duration : Math.min(t, duration);
    return {
      x: p.velocity * time,
      y: 0,
      time,
      duration,
      friction: p.coefficient * p.mass * p.gravity,
      normal: p.mass * p.gravity,
      work: p.coefficient * p.mass * p.gravity * p.velocity * time,
    };
  }
  if (p.kind === "hydraulic")
    return {
      x: 0,
      y: 0,
      time: t,
      pressure: p.force / p.area1,
      outputForce: (p.force * p.area2) / p.area1,
    };
  if (p.kind === "hydrostatic-pressure")
    return {
      x: 0,
      y: 0,
      time: t,
      pressure: p.fluidDensity * p.gravity * p.depth,
    };
  if (p.kind === "refraction") {
    const sin = (p.index1 / p.index2) * Math.sin((p.angle * Math.PI) / 180);
    return {
      x: 0,
      y: 0,
      time: p.loop ? t : Math.min(t, 3),
      totalReflection: sin > 1 + 1e-12,
      refraction:
        sin > 1 + 1e-12
          ? undefined
          : (Math.asin(Math.min(1, sin)) * 180) / Math.PI,
    };
  }
  if (p.kind === "longitudinal-wave")
    return {
      x: 0,
      y: 0,
      time: p.loop ? t : Math.min(t, 1 / p.frequency),
      speed: p.wavelength * p.frequency,
    };
  if (p.kind === "series-circuit") {
    const resistance = p.resistance1 + p.resistance2,
      current = p.voltage / resistance;
    return {
      x: 0,
      y: 0,
      time: p.loop ? t : Math.min(t, 4),
      resistance,
      current,
      voltage1: current * p.resistance1,
      voltage2: current * p.resistance2,
      power: p.voltage * current,
    };
  }
  return null;
}
