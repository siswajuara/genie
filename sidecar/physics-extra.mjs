export const extraPhysicsModels = {
  "sound-travel": {
    label: "Bunyi merambat melalui medium",
    defaults: { soundSpeed: 340, distance: 680 },
    ranges: { soundSpeed: [100, 1500], distance: [1, 1500] },
    description: "SD–SMP: muka gelombang bunyi menempuh jarak s=vt, waktu tiba=distance/soundSpeed. Medium homogen; bukan gerak partikel udara bersama bunyi.",
  },
  heating: {
    label: "Kalor dan kenaikan suhu",
    defaults: { mass: 0.5, specificHeat: 1000, power: 1000, initialTemperature: 20, temperatureRise: 20 },
    ranges: { mass: [0.1, 5], specificHeat: [100, 4200], power: [10, 2000], initialTemperature: [0, 50], temperatureRise: [1, 50] },
    description: "SD–SMA: pemanasan zat satu fase, c tetap, tanpa kehilangan kalor. Q=Pt=mcΔT; berhenti pada kenaikan suhu temperatureRise, tanpa model mendidih atau melebur.",
  },
  "energy-conservation": {
    label: "Energi potensial menjadi kinetik",
    defaults: { mass: 1, height: 5, gravity: 10 },
    ranges: { mass: [0.1, 20], height: [0.5, 20], gravity: [0.1, 30] },
    description: "SMP–SMA: benda dilepas dari diam, Ep=mgh dan Ek=mv²/2. Energi mekanik tetap sebelum menyentuh tanah; tanpa hambatan udara dan tanpa tumbukan/pantulan.",
  },
  "parallel-circuit": {
    label: "Dua resistor paralel",
    defaults: { voltage: 6, resistance1: 3, resistance2: 6 },
    ranges: { voltage: [0.1, 24], resistance1: [1, 100], resistance2: [1, 100] },
    description: "SMP–SMA: dua resistor paralel dengan sumber ideal. Tegangan cabang sama; I=I₁+I₂, 1/R=1/R₁+1/R₂. Titik menandai arah arus konvensional, bukan laju elektron.",
  },
  "elastic-collision": {
    label: "Tumbukan lenting sempurna 1D",
    defaults: { mass1: 1, mass2: 1, velocity1: 2, velocity2: 0, distance: 4 },
    ranges: { mass1: [0.1, 10], mass2: [0.1, 10], velocity1: [0.1, 10], velocity2: [-10, 0], distance: [1, 10] },
    description: "SMA: dua massa titik saling mendekat pada satu sumbu. Momentum dan energi kinetik kekal, tanpa gaya luar. Tumbukan sesaat pada t=distance/(v₁−v₂); berhenti setelah dua kali waktu itu.",
  },
  "thermal-expansion": {
    label: "Pemuaian panjang",
    defaults: { length: 1, expansionCoefficient: 0.000012, temperatureRise: 50 },
    ranges: { length: [0.1, 10], expansionCoefficient: [0.000001, 0.0001], temperatureRise: [1, 100] },
    description: "SMP–SMA: ΔL=αL₀ΔT untuk batang bebas, α konstan. Kenaikan suhu diramp selama 6 detik sebagai ilustrasi, bukan laju pemanasan fisik. Pertambahan panjang pada gambar diperbesar.",
  },
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
  if (["sound-travel", "heating", "energy-conservation", "thermal-expansion"].includes(p.kind)) {
    const duration = p.kind === "sound-travel" ? p.distance / p.soundSpeed
      : p.kind === "heating" ? p.mass * p.specificHeat * p.temperatureRise / p.power
      : p.kind === "energy-conservation" ? Math.sqrt(2 * p.height / p.gravity) : 6;
    const time = p.loop ? t % duration : Math.min(t, duration), progress = time / duration;
    if (p.kind === "sound-travel") return { x: p.soundSpeed * time, y: 0, time, duration, progress };
    if (p.kind === "heating") return { x: 0, y: 0, time, duration, progress, heat: p.power * time, temperature: p.initialTemperature + p.power * time / (p.mass * p.specificHeat) };
    if (p.kind === "thermal-expansion") return { x: 0, y: 0, time, duration, progress, temperatureRise: p.temperatureRise * progress, expansion: p.expansionCoefficient * p.length * p.temperatureRise * progress };
    const height = Math.max(0, p.height - p.gravity * time ** 2 / 2), speed = p.gravity * time;
    return { x: 0, y: height, time, duration, progress, speed, potential: p.mass * p.gravity * height, kinetic: p.mass * speed ** 2 / 2, totalEnergy: p.mass * p.gravity * p.height };
  }
  if (p.kind === "parallel-circuit") {
    const current1 = p.voltage / p.resistance1, current2 = p.voltage / p.resistance2;
    return { x: 0, y: 0, time: p.loop ? t : Math.min(t, 4), current1, current2, current: current1 + current2, resistance: p.resistance1 * p.resistance2 / (p.resistance1 + p.resistance2), power: p.voltage * (current1 + current2) };
  }
  if (p.kind === "elastic-collision") {
    const collisionTime = p.distance / (p.velocity1 - p.velocity2), duration = 2 * collisionTime,
      time = p.loop ? t % duration : Math.min(t, duration), after = time >= collisionTime,
      finalVelocity1 = ((p.mass1 - p.mass2) * p.velocity1 + 2 * p.mass2 * p.velocity2) / (p.mass1 + p.mass2),
      finalVelocity2 = (2 * p.mass1 * p.velocity1 + (p.mass2 - p.mass1) * p.velocity2) / (p.mass1 + p.mass2),
      v1 = after ? finalVelocity1 : p.velocity1, v2 = after ? finalVelocity2 : p.velocity2,
      x = -p.distance / 2 + p.velocity1 * Math.min(time, collisionTime) + finalVelocity1 * Math.max(0, time - collisionTime),
      x2 = p.distance / 2 + p.velocity2 * Math.min(time, collisionTime) + finalVelocity2 * Math.max(0, time - collisionTime);
    return { x, x2, y: 0, time, duration, collisionTime, after, finalVelocity1, finalVelocity2, v1, v2, momentum: p.mass1 * v1 + p.mass2 * v2, kinetic: (p.mass1 * v1 ** 2 + p.mass2 * v2 ** 2) / 2 };
  }
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
