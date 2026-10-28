/** Shader sources adapted from the supplied shaders-transition.tsx. */
export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const UNIFORMS = `
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform vec2  uRes;
uniform float uTime;
uniform float uProgress;   // eased 0..1 (may overshoot for bounce/back easings)
uniform float uRaw;        // linear 0..1, 0 means idle
uniform float uAspect0;
uniform float uAspect1;
uniform float uLod0;
uniform float uLod1;
uniform float uBpm;
uniform float uBeatMode;
uniform vec2  uCenter;
uniform vec4  uP;          // kind parameters
uniform vec4  uP2;
uniform vec4  uQ;          // chroma, shake amp, shake freq, flash
uniform vec4  uF;          // glow, vignette, grain, sepia
uniform vec3  uC;          // effect colour
out vec4 outColor;
`;

const COMMON = `
#define PI 3.14159265
float p, env, asp, T, beat, eon;

float sat(float t) { return clamp(t, 0.0, 1.0); }
vec2  sat(vec2 t)  { return clamp(t, 0.0, 1.0); }
float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rand(i), rand(i + vec2(1.0, 0.0)), f.x),
             mix(rand(i + vec2(0.0, 1.0)), rand(i + vec2(1.0, 1.0)), f.x), f.y);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec2 rot(vec2 q, float a) { float c = cos(a), s = sin(a); return vec2(c*q.x - s*q.y, s*q.x + c*q.y); }
vec2 mirror(vec2 x) { return 1.0 - abs(1.0 - mod(x, 2.0)); }

// object-fit: cover
vec2 cov(vec2 uv, float ia) {
  float ca = uRes.x / uRes.y;
  vec2 s = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 A(vec2 uv) { return textureLod(uTex0, mirror(cov(uv, uAspect0)), uLod0).rgb; }
vec3 B(vec2 uv) { return textureLod(uTex1, mirror(cov(uv, uAspect1)), uLod1).rgb; }
vec3 mixAB(vec2 uv, float m) {
  if (m <= 0.0) return A(uv);
  if (m >= 1.0) return B(uv);
  return mix(A(uv), B(uv), m);
}
vec3 baseAB(vec2 uv) { return mixAB(uv, smoothstep(0.3, 0.7, p)); }
vec2 dirv(float a) { return vec2(cos(a), -sin(a)); }   // screen direction, y is down
bool inside(vec2 u) { return all(greaterThanEqual(u, vec2(0.0))) && all(lessThanEqual(u, vec2(1.0))); }
float dot2(vec2 v) { return dot(v, v); }
float sdBox(vec2 q, vec2 b) {
  vec2 d = abs(q) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
`;

const MAIN = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  asp = uRes.x / uRes.y;

  if (uRaw <= 0.0) { outColor = vec4(A(uv), 1.0); return; }
  if (uRaw >= 1.0) { outColor = vec4(B(uv), 1.0); return; }

  p = uProgress;
  env = sin(PI * clamp(uRaw, 0.0, 1.0));
  T = uTime;
  eon = smoothstep(0.0, 0.05, uRaw) * (1.0 - smoothstep(0.95, 1.0, uRaw));
  beat = pow(1.0 - fract(uTime * uBpm / 60.0), 3.0);
  int bm = int(uBeatMode + 0.5);
  if (bm == 1) p = clamp(floor(uRaw * 4.0) / 3.0, 0.0, 1.0);
  if (uP2.w > 0.5) { T = floor(uTime * 8.0) / 8.0; p = clamp(floor(uProgress * 6.0) / 5.0, 0.0, 1.0); }

  // camera: shake / beat zoom / beat bounce
  vec2 off = vec2(0.0);
  float sc = 1.0;
  float fq = uQ.z > 0.0 ? uQ.z : 30.0;
  if (uQ.y > 0.0) off += (vec2(vnoise(vec2(T * fq, 1.7)), vnoise(vec2(T * fq, 9.1))) - 0.5) * 2.0 * uQ.y * env;
  if (bm == 3) off += (vec2(rand(vec2(floor(T * 40.0), 1.0)), rand(vec2(floor(T * 40.0), 2.0))) - 0.5) * 0.08 * beat * env;
  if (bm == 2) sc = 1.0 + 0.12 * beat * env;
  if (bm == 5) off.y += 0.07 * beat * env;
  uv = 0.5 + (uv - 0.5 - off) / sc;

  // render, optionally with per-channel offsets (chroma > 0 horizontal split, < 0 radial)
  float ch = uQ.x * env;
  vec3 col;
  if (abs(ch) > 0.0005) {
    vec2 dv = ch > 0.0 ? vec2(ch, 0.0) : (uv - 0.5) * (-ch) * 2.0;
    col = vec3(render(uv + dv).r, render(uv).g, render(uv - dv).b);
  } else {
    col = render(uv);
  }

  // post
  float fl = uQ.w * pow(env, 3.0);
  if (bm == 4) fl += beat * 0.4 * env;
  col = mix(col, vec3(1.0), clamp(fl, 0.0, 1.0));
  col += col * col * uF.x * env * 1.5;
  col *= 1.0 - uF.y * env * smoothstep(0.25, 0.95, length((uv - 0.5) * vec2(asp * 0.6, 1.0) * 1.4));
  col += (rand(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * uF.z * env;
  vec3 sepia = vec3(dot(col, vec3(0.393, 0.769, 0.189)), dot(col, vec3(0.349, 0.686, 0.168)), dot(col, vec3(0.272, 0.534, 0.131)));
  col = mix(col, sepia, clamp(uF.w * env, 0.0, 1.0));
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const KIND_SRC: Record<string, string> = {};
const DEPS: Record<string, string[]> = { whip: ["push"], film: ["push"] };

/* ---- basic ---- */

KIND_SRC.fade = `
vec3 k_fade(vec2 uv) {
  float m = uP.x > 0.5 ? smoothstep(0.25, 0.75, p) : p;
  return mixAB(uv, m);
}`;

KIND_SRC.dissolve = `
vec3 k_dissolve(vec2 uv) {
  float sc = uP.x;
  float w = max(uP.y, 0.002);
  float n;
  if (sc < 0.0) n = 1.0 - luma(B(uv));
  else if (sc > 500.0) n = rand(floor(uv * uRes / max(uP2.x, 1.0)) + floor(T * 30.0));
  else { vec2 q = uv * vec2(asp, 1.0) * sc; n = vnoise(q) * 0.65 + vnoise(q * 2.3 + 5.0) * 0.35; }
  float t = p * (1.0 + 2.0 * w) - w;
  float m = smoothstep(n - w, n + w, t);
  float edge = exp(-pow((n - t) / (w * 0.8 + 0.002), 2.0)) * uP.z * eon;
  return mixAB(uv, m) + uC * edge;
}`;

KIND_SRC.wipe = `
vec3 k_wipe(vec2 uv) {
  vec2 d = dirv(uP.x);
  float c = dot(uv - 0.5, d) / (abs(d.x) + abs(d.y)) + 0.5;
  float s = max(uP.y, 0.002);
  float jg = uP.w;
  vec2 q = uv * vec2(asp, 1.0);
  c += ((vnoise(q * 12.0) - 0.5) + 0.5 * (vnoise(q * 37.0) - 0.5)) * jg;
  float ext = s + abs(jg);
  float e = p * (1.0 + 2.0 * ext) - ext;
  float m = 1.0 - smoothstep(e - s, e + s, c);
  vec3 col = mixAB(uv, m);
  float bw = uP2.x;
  if (bw > 0.0) col = mix(col, uC, step(e + s, c) * step(c, e + s + bw) * eon);
  col += uC * exp(-pow((c - e) / (s + 0.004), 2.0)) * uP.z * eon;
  return col;
}`;

KIND_SRC.push = `
vec3 k_push(vec2 uv) {
  vec2 d = dirv(uP.x);
  float sc = 1.0 - uP.w * env;
  vec2 u = 0.5 + (uv - 0.5) / sc;
  if (!inside(u)) return vec3(0.02);
  float c = dot(u - 0.5, d) / (abs(d.x) + abs(d.y)) + 0.5;
  vec3 col = c < p ? B(u + d * (1.0 - p)) : A(u - d * p * uP.y);
  float sh = c >= p ? smoothstep(0.14, 0.0, c - p) * uP2.x * eon : 0.0;
  col *= 1.0 - 0.55 * sh;
  if (abs(c - p) < uP.z * 0.5 && env > 0.001) col = vec3(0.01);
  float bars = uP2.y * env;
  if (bars > 0.0 && (uv.y < bars || uv.y > 1.0 - bars)) col = vec3(0.0);
  return col;
}`;

KIND_SRC.split = `
vec3 k_split(vec2 uv) {
  vec2 ax = uP.x > 0.5 ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
  bool closing = uP.y > 0.5;
  float s = (closing ? 1.0 - p : p) * 0.5;
  vec2 uvL = uv + ax * s;
  vec2 uvR = uv - ax * s;
  bool showL = dot(uvL, ax) <= 0.5;
  bool showR = dot(uvR, ax) >= 0.5;
  vec3 col;
  if (closing) col = showL ? B(uvL) : (showR ? B(uvR) : A(uv));
  else         col = showL ? A(uvL) : (showR ? A(uvR) : B(uv));
  float ln = exp(-pow((abs(dot(uv, ax) - 0.5) - s) / 0.004, 2.0)) * eon;
  return col + vec3(ln * 0.5);
}`;

KIND_SRC.zoom = `
vec3 k_zoom(vec2 uv) {
  float S = uP.x, bl = uP.y * env, hard = uP.z;
  float sa, sb;
  if (S >= 0.0) { sa = 1.0 + S * p; sb = 1.0 + 0.3 * S * (1.0 - p); }
  else { float a = -S; sa = 1.0 + 0.25 * a * p; sb = 1.0 + a * (1.0 - p); }
  float m = hard > 0.5 ? smoothstep(0.42, 0.58, p) : smoothstep(0.15, 0.85, p);
  if (bl < 0.002) return mix(A(0.5 + (uv - 0.5) / sa), B(0.5 + (uv - 0.5) / sb), m);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float t = float(i) / 11.0 - 0.5;
    float k = 1.0 + t * bl * 0.8;
    acc += mix(A(0.5 + (uv - 0.5) / (sa * k)), B(0.5 + (uv - 0.5) / (sb * k)), m);
  }
  return acc / 12.0;
}`;

KIND_SRC.flash = `
vec3 k_flash(vec2 uv) {
  float pw = max(uP.x, 0.1);
  float N = max(uP.y, 1.0);
  float w = uP.z;
  float f = N < 1.5 ? pow(env, pw) : pow(abs(sin(p * N * PI)), 2.0) * env;
  float m = smoothstep(0.5 - w, 0.5 + w, p);
  return mix(mixAB(uv, m), uC, clamp(f, 0.0, 1.0));
}`;

/* ---- camera / motion ---- */

KIND_SRC.spin = `
vec3 k_spin(vec2 uv) {
  float ang = uP.x, zm = uP.y, mode = uP.z;
  float pa = (mode > 0.5 && mode < 1.5) ? 0.0 : p;
  float pb = mode > 1.5 ? 1.0 : p;
  vec2 q = (uv - 0.5) * vec2(asp, 1.0);
  vec2 qa = rot(q, ang * pa) / (1.0 + zm * pa);
  vec2 qb = rot(q, ang * (pb - 1.0)) / (1.0 + zm * (1.0 - pb) * 0.5);
  float m = mode > 1.5 ? smoothstep(0.1, 0.9, p) : (mode > 0.5 ? smoothstep(0.0, 0.7, p) : smoothstep(0.25, 0.75, p));
  return mix(A(qa / vec2(asp, 1.0) + 0.5), B(qb / vec2(asp, 1.0) + 0.5), m);
}`;

KIND_SRC.whip = `
vec3 k_whip(vec2 uv) {
  float bl = uP2.x * env;
  if (bl < 0.002) return k_push(uv);
  vec2 d = dirv(uP.x);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 14; i++) {
    float t = float(i) / 13.0 - 0.5;
    acc += k_push(uv + d * bl * t);
  }
  return acc / 14.0;
}`;

KIND_SRC.swing = `
vec3 k_swing(vec2 uv) {
  vec2 pv = uP.yz;
  float ang = uP.x * p * p;
  vec2 q = rot((uv - pv) * vec2(asp, 1.0), -ang);
  vec2 ua = q / vec2(asp, 1.0) + pv;
  if (inside(ua)) return A(ua);
  vec3 b = B(0.5 + (uv - 0.5) * (1.0 - 0.07 * (1.0 - p)));
  return b * (1.0 - 0.35 * env * smoothstep(0.5, 0.0, abs(ua.x - 0.5)));
}`;

/* ---- 3D / warp ---- */

KIND_SRC.flip = `
vec3 k_flip(vec2 uv) {
  float th = p * PI;
  bool useB = th > 0.5 * PI;
  float t = useB ? th - PI : th;
  bool sw = uP.x > 0.5;
  vec2 s = (uv - 0.5) * vec2(asp, 1.0) * 2.0;
  vec2 ext = vec2(asp, 1.0);
  if (sw) { s = s.yx; ext = ext.yx; }
  float D = uP.y;
  float ct = cos(t), st = sin(t);
  float den = D * ct + s.x * st;
  vec3 bg = mix(A(uv), B(uv), smoothstep(0.3, 0.7, p)) * 0.12;
  if (den <= 0.01) return bg;
  float X = s.x * D / den;
  float Y = s.y * (D - X * st) / D;
  if (abs(X) > ext.x || abs(Y) > ext.y) return bg;
  vec2 cuv = vec2(X / ext.x, Y / ext.y) * 0.5 + 0.5;
  if (sw) cuv = cuv.yx;
  vec3 col = useB ? B(cuv) : A(cuv);
  return col * (0.5 + 0.5 * ct);
}`;

KIND_SRC.cube = `
vec3 k_cube(vec2 uv) {
  float D = uP.y;
  float hw = asp * D / (D + asp);
  float hh = (D - hw) / D;
  vec2 s = (uv - 0.5) * vec2(asp, 1.0) * 2.0;
  bool flipX = uP.x < 0.0;
  if (flipX) s.x = -s.x;
  float phi = p * PI * 0.5;
  vec3 col = mix(A(uv), B(uv), smoothstep(0.3, 0.7, p)) * 0.12;
  float best = -1e9;
  for (int f = 0; f < 2; f++) {
    float ph = phi - float(f) * PI * 0.5;
    float sn = sin(ph), cs = cos(ph);
    float den = s.x * sn - D * cs;
    if (abs(den) > 1e-4) {
      float X = (hw * D * sn + s.x * hw * cs - s.x * D) / den;
      float z = -X * sn + hw * cs;
      float Y = s.y * (D - z) / D;
      if (abs(X) <= hw && abs(Y) <= hh && z > best) {
        best = z;
        vec2 cu = vec2(X / (2.0 * hw) + 0.5, Y / (2.0 * hh) + 0.5);
        if (flipX) cu.x = 1.0 - cu.x;
        col = (f == 0 ? A(cu) : B(cu)) * (0.45 + 0.55 * max(cs, 0.0));
      }
    }
  }
  return col;
}`;

KIND_SRC.curl = `
vec2 curlT(vec2 uv, int dir) {
  if (dir == 1) return vec2(1.0 - uv.x, uv.y);
  if (dir == 2) return vec2(uv.y, uv.x);
  if (dir == 3) return vec2(1.0 - uv.y, uv.x);
  return uv;
}
vec2 curlI(vec2 u, int dir) {
  if (dir == 1) return vec2(1.0 - u.x, u.y);
  if (dir == 2) return vec2(u.y, u.x);
  if (dir == 3) return vec2(u.y, 1.0 - u.x);
  return u;
}
vec3 k_curl(vec2 uv) {
  int dir = int(uP.y + 0.5);
  float R = uP.x;
  vec2 u = curlT(uv, dir);
  float xf = mix(1.0, -R, p);
  if (u.x < xf) return A(uv);
  float d = u.x - xf;
  if (d >= R) return B(uv) * (1.0 - 0.45 * (1.0 - smoothstep(R, R * 2.6, d)));
  float a = asin(clamp(d / R, 0.0, 1.0));
  float s2 = R * (PI - a);
  float s1 = R * a;
  vec3 col;
  if (xf + s2 <= 1.0) {
    col = A(curlI(vec2(xf + s2, u.y), dir)) * (0.5 + 0.35 * (1.0 - d / R)) + vec3(0.1);
    col = mix(col, vec3(luma(col)) * vec3(1.0, 0.97, 0.92), 0.5);
  } else if (xf + s1 <= 1.0) {
    col = A(curlI(vec2(xf + s1, u.y), dir)) * (1.0 - 0.4 * d / R);
  } else {
    col = B(uv);
  }
  return col;
}`;

KIND_SRC.twirl = `
vec3 k_twirl(vec2 uv) {
  float amt = uP.x, rad = max(uP.y, 0.05), mode = uP.z;
  vec2 q = (uv - 0.5) * vec2(asp, 1.0);
  float r = length(q);
  float f = mode < 0.5 ? smoothstep(rad, 0.0, r) : exp(-r * r / (rad * rad));
  vec2 qa = rot(q, amt * p * f);
  vec2 qb = rot(q, -amt * (1.0 - p) * f);
  return mix(A(qa / vec2(asp, 1.0) + 0.5), B(qb / vec2(asp, 1.0) + 0.5), smoothstep(0.25, 0.75, p));
}`;

KIND_SRC.lens = `
vec2 lensd(vec2 q, float k) {
  float r2 = dot(q, q);
  float g = k * r2 / (1.0 + abs(k) * r2);
  return q * (1.0 - 0.5 * g);
}
vec3 k_lens(vec2 uv) {
  float k = uP.x, zm = uP.y;
  vec2 sc = vec2(asp, 1.0) * 2.0;
  vec2 q = (uv - 0.5) * sc;
  vec2 qa = lensd(q, k * p) / (1.0 + zm * p);
  vec2 qb = lensd(q, k * (p - 1.0)) / (1.0 + zm * (1.0 - p) * 0.5);
  return mix(A(qa / sc + 0.5), B(qb / sc + 0.5), smoothstep(0.25, 0.75, p));
}`;

KIND_SRC.warp = `
vec3 k_warp(vec2 uv) {
  float mode = uP.x, fr = uP.y, am = uP.z;
  vec2 ua = uv, ub = uv;
  float e = env * am;
  if (mode < 0.5) { ua.x += sin(uv.y * fr + T * 8.0) * 0.05 * e; ub = ua; }
  else if (mode < 1.5) { ua.y += sin(uv.x * fr + T * 8.0) * 0.05 * e; ub = ua; }
  else if (mode < 2.5) {
    vec2 n = vec2(vnoise(uv * fr + T * 1.5), vnoise(uv * fr + 7.3 - T * 1.5)) - 0.5;
    ua += n * 0.35 * e; ub = ua;
  }
  else if (mode < 3.5) {
    ua.x = 0.5 + (uv.x - 0.5) / (1.0 + am * p);
    ub.x = 0.5 + (uv.x - 0.5) / (1.0 + am * (1.0 - p));
  }
  else if (mode < 4.5) {
    ua.y = 0.5 + (uv.y - 0.5) / (1.0 + am * p);
    ub.y = 0.5 + (uv.y - 0.5) / (1.0 + am * (1.0 - p));
  }
  else {
    vec2 q = (uv - 0.5) * vec2(asp, 1.0);
    float r = length(q);
    float f = 1.0 - clamp(0.45 * am * env * exp(-r * r * 5.0), 0.0, 0.9);
    ua = 0.5 + q * f / vec2(asp, 1.0); ub = ua;
  }
  return mix(A(ua), B(ub), smoothstep(0.25, 0.75, p));
}`;

KIND_SRC.ripple = `
vec3 k_ripple(vec2 uv) {
  vec2 pq = (uv - uCenter) * vec2(asp, 1.0);
  float d = length(pq);
  vec2 dir = d > 1e-4 ? pq / d : vec2(0.0);
  float reach = length(vec2(asp, 1.0)) + 0.35;
  float R = mix(-0.15, reach, p);
  float n = vnoise(uv * vec2(asp, 1.0) * 5.0 + T * 0.6) - 0.5;
  float x = d - R + n * 0.22 * env;
  float m = 1.0 - smoothstep(-0.03, 0.03, x);
  float ring = exp(-x * x / 0.012);
  vec2 disp = dir * sin(x * uP.x) * ring * uP.y * env / vec2(asp, 1.0);
  vec2 ub = (uv - uCenter) * (1.0 + 0.12 * (1.0 - p)) + uCenter;
  vec3 col = mix(A(uv + disp), B(ub + disp), m);
  return col + vec3(0.85, 0.92, 1.0) * ring * env * 0.1 * uP.z;
}`;

KIND_SRC.fold = `
vec3 k_fold(vec2 uv) {
  float N = max(uP.x, 1.0);
  bool vert = uP.y > 0.5;
  float c = vert ? uv.y : uv.x;
  float g = c * N;
  float id = floor(g);
  float f = fract(g) - 0.5;
  bool second = p > 0.5;
  float wdt = clamp(second ? (2.0 * p - 1.0) : (1.0 - 2.0 * p), 0.0, 1.0);
  if (abs(f) > 0.5 * wdt) return vec3(0.02);
  float src = (id + 0.5 + f / max(wdt, 0.001)) / N;
  vec2 u = vert ? vec2(uv.x, src) : vec2(src, uv.y);
  vec3 col = second ? B(u) : A(u);
  return col * (0.45 + 0.55 * wdt) * (1.0 - 0.2 * (1.0 - wdt) * mod(id, 2.0));
}`;

/* ---- glitch & distortion ---- */

KIND_SRC.glitch = `
float remap(float t, float a, float b) { return sat((t - a) / (b - a)); }
float linterp(float t) { return sat(1.0 - abs(2.0 * t - 1.0)); }
vec3 spectrum_offset(float t) {
  float lo = step(t, 0.5);
  float hi = 1.0 - lo;
  float w = linterp(remap(t, 1.0 / 6.0, 5.0 / 6.0));
  float neg_w = 1.0 - w;
  vec3 ret = vec3(lo, 1.0, hi) * vec3(neg_w, w, neg_w);
  return pow(ret, vec3(1.0 / 2.2));
}
float mytrunc(float x, float n) { return floor(x * n) / n; }
vec2 mytrunc(vec2 x, float n) { return floor(x * n) / n; }

vec3 k_glitch(vec2 uv) {
  float G = uP.y * env;
  float gnm = sat(G);
  float time = mod(T * 100.0, 32.0) / 110.0;
  float rnd0 = rand(mytrunc(vec2(time, time), 6.0));
  float r0 = sat((1.0 - gnm) * 0.7 + rnd0);
  float rnd1 = rand(vec2(mytrunc(uv.x, 10.0 * r0), time));
  float r1 = 0.5 - 0.5 * gnm + rnd1;
  r1 = 1.0 - max(0.0, (r1 < 1.0) ? r1 : 0.9999999);
  float rnd2 = rand(vec2(mytrunc(uv.y, 40.0 * r1), time));
  float r2 = sat(rnd2);
  float rnd3 = rand(vec2(mytrunc(uv.y, 10.0 * r0), time));
  float r3 = (1.0 - sat(rnd3 + 0.8)) - 0.1;
  float pxrnd = rand(uv + time);
  float ofs = 0.05 * r2 * G * (rnd0 > 0.5 ? 1.0 : -1.0);
  ofs += 0.5 * pxrnd * ofs;
  uv.y += 0.1 * r3 * G;

  float m = sat((p - 0.5) * 3.0 + 0.5 + (rnd2 - 0.5) * 0.9 * env);
  float bl = uP.z * env;

  vec3 sum = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < 20; ++i) {
    float t = float(i) / 20.0;
    uv.x = sat(uv.x + ofs * t);
    float a = float(i) * 2.39996323;
    vec2 d = vec2(cos(a), sin(a)) * sqrt(t) * bl * vec2(1.0 / asp, 1.0);
    vec3 s = spectrum_offset(t);
    sum += mixAB(uv + d, m) * s;
    wsum += s;
  }
  return sum / wsum;
}`;

KIND_SRC.digital = `
vec3 k_digital(vec2 uv) {
  float mode = uP.x;
  float G = uP.y * env;
  float tq = floor(T * 18.0);
  float row = floor(uv.y * mix(14.0, 40.0, rand(vec2(tq, 1.0))));
  float rr = rand(vec2(row, tq));
  vec2 u = uv;
  if (rr > 1.0 - 0.55 * G) u.x += (rand(vec2(row, tq + 3.0)) - 0.5) * 0.5 * G;
  float m = step(0.5 + (rand(vec2(row, tq + 7.0)) - 0.5) * 0.8 * env, p);
  vec3 col = vec3(mixAB(u + vec2(0.012 * G, 0.0), m).r, mixAB(u, m).g, mixAB(u - vec2(0.012 * G, 0.0), m).b);
  if (mode > 0.5) {
    vec2 bl = floor(uv * vec2(16.0, 9.0));
    float rb = rand(bl + tq);
    if (rb < 0.35 * G) {
      int kd = int(rand(bl + tq + 9.0) * 4.0);
      if (kd == 0) col = 1.0 - col;
      else if (kd == 1) col = floor(col * 3.0) / 3.0 * vec3(1.0, 0.2, 0.6);
      else if (kd == 2) col = vec3(luma(col) > 0.5 ? 1.0 : 0.0);
      else col = mixAB(vec2(uv.x, fract(uv.y * 8.0)), m);
    }
  }
  return col;
}`;

KIND_SRC.tv = `
vec3 k_tv(vec2 uv) {
  float mode = uP.x;
  float tq = floor(T * 30.0);
  float m = step(0.5, p);
  vec2 u = uv;
  vec3 col;
  if (mode < 0.5) {
    u.y = fract(u.y + env * 0.4 * step(0.7, rand(vec2(tq, 5.0))) * rand(vec2(tq, 8.0)));
    float line = floor(uv.y * 240.0);
    u.x += (rand(vec2(line, tq)) - 0.5) * 0.06 * env * step(0.85, rand(vec2(floor(uv.y * 14.0), tq)));
    u.x += sin(uv.y * 40.0 + T * 25.0) * 0.004 * env;
    float sp = 0.006 * env;
    col = vec3(mixAB(u + vec2(sp, 0.0), m).r, mixAB(u, m).g, mixAB(u - vec2(sp, 0.0), m).b);
    col += (rand(uv * uRes + T) - 0.5) * 0.5 * env;
    col *= 0.82 + 0.18 * sin(uv.y * uRes.y * 1.6);
    col *= 1.0 - 0.5 * env * smoothstep(0.35, 0.9, length(uv - 0.5));
  } else if (mode < 1.5) {
    float band = fract(T * 0.35 + p * 1.5);
    float inBand = smoothstep(0.08, 0.0, abs(uv.y - band));
    u.x += inBand * 0.05 * env * sin(uv.y * 200.0) + (rand(vec2(floor(uv.y * 180.0), tq)) - 0.5) * 0.008 * env;
    float bleed = 0.004 + 0.012 * env;
    col = vec3(mixAB(u + vec2(bleed, 0.0), m).r, mixAB(u, m).g, mixAB(u - vec2(bleed, 0.0), m).b);
    col += step(0.995, rand(vec2(floor(uv.y * 480.0), tq))) * 0.5 * env;
    if (uv.y > 0.93) col = mix(col, vec3(rand(uv * uRes + T)), 0.7 * env);
    col *= 0.9 + 0.1 * sin(uv.y * uRes.y * 1.2);
  } else {
    float m2 = step(uv.y, p);
    col = mixAB(uv, m2);
    col += uC * exp(-pow((uv.y - p) / 0.012, 2.0)) * 1.4 * eon;
    col *= 1.0 - 0.14 * env * (0.5 + 0.5 * sin(uv.y * uRes.y * 2.0));
  }
  return col;
}`;

KIND_SRC.flicker = `
vec3 k_flicker(vec2 uv) {
  float stp = floor(uRaw * 16.0);
  float r = rand(vec2(stp, 4.0));
  float m = r < smoothstep(0.1, 0.9, uRaw) ? 1.0 : 0.0;
  vec3 col = mixAB(uv, m);
  float br = 1.0 + (rand(vec2(floor(T * 40.0), 2.0)) - 0.5) * 0.9 * env;
  return col * br + step(0.93, rand(vec2(stp, 9.0))) * 0.35 * env;
}`;

KIND_SRC.pixel = `
vec3 k_pixel(vec2 uv) {
  float n = exp(mix(log(1500.0), log(max(uP.x, 4.0)), pow(env, 0.8)));
  vec2 cells = vec2(n * asp, n);
  vec2 u = (floor(uv * cells) + 0.5) / cells;
  return mixAB(u, smoothstep(0.45, 0.55, p));
}`;

/* ---- blur & focus ---- */

KIND_SRC.blur = `
vec3 smp(int w, vec2 u) { return w == 0 ? A(u) : B(u); }
float localAmt(vec2 uv, float mode) {
  if (mode > 4.5 && mode < 5.5) return smoothstep(0.0, 0.3, abs(uv.y - p));
  if (mode > 5.5) return smoothstep(0.18, 0.55, length((uv - 0.5) * vec2(asp, 1.0)));
  return 1.0;
}
vec3 blurTex(int w, vec2 uv, float amt, float mode, float prm) {
  amt *= localAmt(uv, mode);
  if (amt < 0.0004) return smp(w, uv);
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  vec2 bs = vec2(1.0 / asp, 1.0);
  for (int i = 0; i < 18; i++) {
    float t = (float(i) + 0.5) / 18.0;
    float a = float(i) * 2.39996323;
    vec2 su;
    if (mode > 0.5 && mode < 1.5) su = uv + dirv(prm) * (t - 0.5) * 2.0 * amt * bs;
    else if (mode > 1.5 && mode < 2.5) su = 0.5 + rot((uv - 0.5) * vec2(asp, 1.0), (t - 0.5) * amt * 6.0) / vec2(asp, 1.0);
    else if (mode > 2.5 && mode < 3.5) su = 0.5 + (uv - 0.5) * (1.0 + (t - 0.5) * amt * 4.0);
    else su = uv + vec2(cos(a), sin(a)) * sqrt(t) * amt * bs;
    vec3 c = smp(w, su);
    float wt = (mode > 3.5 && mode < 4.5) ? 1.0 + 8.0 * pow(luma(c), 4.0) : 1.0;
    acc += c * wt;
    ws += wt;
  }
  return acc / ws;
}
vec3 k_blur(vec2 uv) {
  float mode = uP.x, prm = uP.y, amt = uP.z, which = uP.w;
  float ba = (which > 1.5 ? p : (which > 0.5 ? 0.0 : env)) * amt;
  float bb = (which > 1.5 ? 0.0 : (which > 0.5 ? 1.0 - p : env)) * amt;
  float m = smoothstep(0.25, 0.75, p);
  vec3 ca = m < 1.0 ? blurTex(0, uv, ba, mode, prm) : vec3(0.0);
  vec3 cb = m > 0.0 ? blurTex(1, uv, bb, mode, prm) : vec3(0.0);
  return mix(ca, cb, m);
}`;

/* ---- light & glow ---- */

KIND_SRC.fx = `
vec3 k_fx(vec2 uv) {
  float mode = uP.x;
  vec3 col = baseAB(uv);
  if (mode < 1.5) {
    vec2 c1 = vec2(mix(-0.4, 1.4, p), 0.25 + 0.2 * sin(p * 5.0));
    vec2 c2 = vec2(mix(1.4, -0.3, p), 0.75 + 0.15 * cos(p * 4.0));
    vec2 d1 = (uv - c1) * vec2(asp, 1.6);
    vec2 d2 = (uv - c2) * vec2(asp, 1.2);
    vec3 L = (uC * exp(-dot(d1, d1) * 4.0) + vec3(1.0, 0.25, 0.35) * exp(-dot(d2, d2) * 5.0)) * env * 1.6;
    L += vec3(1.0, 0.6, 0.2) * pow(1.0 - uv.x, 6.0) * env * 0.6;
    col = 1.0 - (1.0 - col) * (1.0 - L);
  } else if (mode < 2.5) {
    vec2 fp = vec2(mix(0.1, 0.9, p), 0.35);
    vec2 axis = vec2(0.5) - fp;
    vec3 L = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float k = float(i) * 0.55 + 0.35;
      vec2 gp = fp + axis * k;
      float r = 0.03 + 0.025 * float(i);
      float dd = length((uv - gp) * vec2(asp, 1.0));
      vec3 gc = 0.5 + 0.5 * cos(6.2831 * (float(i) * 0.19 + vec3(0.0, 0.33, 0.67)));
      L += gc * smoothstep(r, r * 0.6, dd) * 0.22;
      L += gc * exp(-pow((dd - r) / 0.006, 2.0)) * 0.25;
    }
    float d0 = length((uv - fp) * vec2(asp, 1.0));
    L += uC * (0.012 / (d0 * d0 + 0.004));
    L += uC * exp(-abs(uv.y - fp.y) * 60.0) * exp(-abs(uv.x - fp.x) * 2.5) * 0.8;
    col += L * env;
  } else if (mode < 3.5) {
    float tq = floor(T * 14.0);
    float fl = step(0.72, rand(vec2(tq, 1.0))) * env;
    float bx = rand(vec2(floor(T * 7.0), 2.0));
    float jag = (vnoise(vec2(uv.y * 18.0, floor(T * 7.0))) - 0.5) * 0.12 + (vnoise(vec2(uv.y * 60.0, 3.0)) - 0.5) * 0.03;
    float bolt = exp(-abs(uv.x - bx - jag) * 140.0) * fl;
    col = col * (1.0 + fl * 0.8) + vec3(0.7, 0.8, 1.0) * (bolt * 2.0 + fl * 0.35);
  } else if (mode < 4.5) {
    vec3 L = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y = 0.28 + 0.14 * fi + 0.12 * sin(uv.x * 3.0 + T * 0.8 + fi * 2.0) + (vnoise(vec2(uv.x * 3.0 + fi * 7.0, T * 0.3)) - 0.5) * 0.2;
      float band = exp(-pow((uv.y - y) / (0.07 + 0.03 * fi), 2.0));
      vec3 ac = i == 0 ? vec3(0.1, 1.0, 0.5) : (i == 1 ? vec3(0.2, 0.6, 1.0) : vec3(0.7, 0.3, 1.0));
      L += ac * band * (0.6 + 0.4 * vnoise(vec2(uv.x * 10.0 + T, fi)));
    }
    col += L * env * 0.8;
  } else if (mode < 5.5 || mode > 7.5) {
    float N = mode > 7.5 ? 9.0 : 14.0;
    vec2 g = uv * vec2(asp, 1.0) * N;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = rand(id);
    f -= (vec2(rand(id + 1.7), rand(id + 4.3)) - 0.5) * 0.5;
    float tw = pow(max(0.0, sin(T * 4.0 + h * 40.0)), 6.0);
    float on = step(0.55, h);
    float star = exp(-abs(f.x) * 30.0) * exp(-abs(f.y) * 5.0) + exp(-abs(f.y) * 30.0) * exp(-abs(f.x) * 5.0) + 1.2 * exp(-dot(f, f) * 60.0);
    vec3 sc = mode > 7.5 ? mix(vec3(1.0, 0.8, 0.95), vec3(0.8, 0.9, 1.0), h) : vec3(1.0);
    col += sc * star * tw * on * env * 1.2;
    if (mode > 7.5) col = 1.0 - (1.0 - col) * (1.0 - 0.15 * env * vec3(1.0, 0.8, 0.9));
  } else if (mode < 6.5) {
    vec2 e = vec2(2.2 / uRes.y, 0.0);
    float lx = luma(baseAB(uv + e)) - luma(baseAB(uv - e));
    float ly = luma(baseAB(uv + e.yx)) - luma(baseAB(uv - e.yx));
    float edge = clamp(length(vec2(lx, ly)) * 6.0, 0.0, 1.0);
    vec3 neon = 0.5 + 0.5 * cos(6.2831 * (uv.x * 0.5 + T * 0.3 + vec3(0.0, 0.33, 0.67)));
    col = col * (1.0 - 0.6 * env) + neon * edge * env * 2.2;
  }
  return col;
}`;

/* ---- cinematic ---- */

KIND_SRC.film = `
vec3 k_film(vec2 uv) {
  float bar = 0.09;
  if (uv.y < bar || uv.y > 1.0 - bar) {
    float hx = fract(uv.x * asp * 9.0 - p * 6.0);
    float hy = uv.y < bar ? uv.y : 1.0 - uv.y;
    float hole = step(0.2, hx) * step(hx, 0.8) * step(0.2 * bar, hy) * step(hy, 0.75 * bar);
    return mix(vec3(0.04, 0.035, 0.03), vec3(0.85), hole);
  }
  return k_push(vec2(uv.x, (uv.y - bar) / (1.0 - 2.0 * bar)));
}`;

/* ---- aesthetic ---- */

KIND_SRC.tiles = `
float backOut(float t) { float c1 = 1.70158; float c3 = c1 + 1.0; float x = t - 1.0; return 1.0 + c3 * x * x * x + c1 * x * x; }
vec3 k_tiles(vec2 uv) {
  vec2 N = max(uP.xy, vec2(1.0));
  float rotAmt = uP.z, border = uP.w, spread = uP2.x;
  bool grow = uP2.y < 0.5;
  vec2 g = uv * N;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = rand(id + 3.1);
  float lp = clamp((p - h * spread) / max(1.0 - spread, 0.05), 0.0, 1.0);
  float s = grow ? backOut(lp) : 1.0 - lp;
  vec3 base = grow ? A(uv) : B(uv);
  float cellAsp = asp * N.y / N.x;
  float ang = (grow ? 1.0 - lp : lp) * rotAmt * (h - 0.5) * 2.0;
  vec2 q = rot(f * vec2(cellAsp, 1.0), ang) / max(s, 0.001) / vec2(cellAsp, 1.0);
  float bd = border * (grow ? 1.0 - smoothstep(0.7, 1.0, lp) : smoothstep(0.0, 0.3, lp));
  if (s <= 0.001 || any(greaterThan(abs(q), vec2(0.5)))) return base;
  bool inner = all(lessThan(abs(q), vec2(0.5 - bd)));
  vec3 tile = grow ? B(uv) : A(uv);
  return inner ? tile : vec3(0.96, 0.94, 0.9);
}`;

KIND_SRC.polaroid = `
vec3 k_polaroid(vec2 uv) {
  float sl = 1.0 - pow(1.0 - clamp(p, 0.0, 1.0), 3.0);
  vec2 q = (uv - 0.5) * vec2(asp, 1.0);
  q -= vec2(0.18 * (1.0 - sl), 1.25 * (1.0 - sl));
  q = rot(q, (1.0 - sl) * 0.35);
  float s = mix(0.66, 1.0, smoothstep(0.5, 1.0, p));
  vec2 hf = vec2(asp, 1.0) * 0.5 * s;
  vec2 cq = q / hf;
  float k = 1.0 - smoothstep(0.55, 1.0, p);
  float bw = 0.07 * k;
  float bb = 0.27 * k;
  float d = sdBox(cq, vec2(1.0));
  if (d < 0.0) {
    if (cq.x > -1.0 + bw && cq.x < 1.0 - bw && cq.y > -1.0 + bw && cq.y < 1.0 - bb) {
      vec2 ui = vec2((cq.x + 1.0 - bw) / (2.0 - 2.0 * bw), (cq.y + 1.0 - bw) / (2.0 - bw - bb));
      return B(ui);
    }
    return vec3(0.97, 0.96, 0.93);
  }
  return A(uv) * (1.0 - 0.45 * env) * (1.0 - exp(-d * 6.0) * 0.45);
}`;

/* ---- shape & mask ---- */

KIND_SRC.shape = `
float sdHeart(vec2 pp) {
  pp.x = abs(pp.x);
  if (pp.y + pp.x > 1.0) return sqrt(dot2(pp - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot2(pp - vec2(0.0, 1.0)), dot2(pp - 0.5 * max(pp.x + pp.y, 0.0)))) * sign(pp.x - pp.y);
}
float sdStar5(vec2 pp, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  pp.x = abs(pp.x);
  pp -= 2.0 * max(dot(k1, pp), 0.0) * k1;
  pp -= 2.0 * max(dot(k2, pp), 0.0) * k2;
  pp.x = abs(pp.x);
  pp.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(pp, ba) / dot(ba, ba), 0.0, r);
  return length(pp - ba * h) * sign(pp.y * ba.x - pp.x * ba.y);
}
vec3 k_shape(vec2 uv) {
  int shp = int(uP.x + 0.5);
  bool grow = uP.y < 0.5;
  float soft = max(uP.z, 0.002);
  float zt = uP.w;
  float f = grow ? p : 1.0 - p;
  vec2 q = (uv - 0.5) * vec2(asp, 1.0);
  float rm = length(vec2(asp, 1.0)) * 0.5 + 0.1;
  float d;
  if (shp == 1) { float s = max(f * rm * 4.0, 0.001); d = sdHeart(vec2(q.x, -q.y) / s + vec2(0.0, 0.5)) * s; }
  else if (shp == 2) { float r = max(f * rm * 3.0, 0.001); d = sdStar5(vec2(q.x, -q.y), r, 0.45); }
  else if (shp == 3) { d = sdBox(q, vec2(asp, 1.0) * 0.5 * f); }
  else if (shp == 4) { d = abs(q.x) + abs(q.y) - f * rm * 1.3; }
  else { d = length(q) - f * rm; }
  d += soft * (1.0 - 2.0 * f);
  float m = 1.0 - smoothstep(-soft, soft, d);
  vec2 ua = 0.5 + (uv - 0.5) / (1.0 + zt * p);
  vec2 ub = 0.5 + (uv - 0.5) / (1.0 + zt * 0.5 * (1.0 - p));
  vec3 col = grow ? mix(A(ua), B(ub), m) : mix(B(ub), A(ua), m);
  float ring = exp(-pow(d / (0.012 + soft), 2.0)) * uP2.x * eon;
  return mix(col, uC, clamp(ring, 0.0, 1.0));
}`;

KIND_SRC.blinds = `
vec3 k_blinds(vec2 uv) {
  vec2 d = dirv(uP.x);
  vec2 n = vec2(-d.y, d.x);
  float N = max(uP.y, 1.0);
  float soft = max(uP.z, 0.002);
  float stag = uP.w;
  float cs = dot(uv, n) * N;
  float id = floor(cs);
  float f = fract(cs);
  float pe = clamp(p * (1.0 + stag) - rand(vec2(id, 1.0)) * stag, 0.0, 1.0);
  float e = pe * (1.0 + 2.0 * soft) - soft;
  float m = 1.0 - smoothstep(e - soft, e + soft, f);
  return mixAB(uv, m);
}`;

/** Fragment shader for one kind. Programs are compiled lazily, one per kind. */
export function buildFragment(kind: string) {
  const chain = [...(DEPS[kind] || []), kind];
  const code = chain.map((k) => KIND_SRC[k]).join("\n");
  return `#version 300 es\nprecision highp float;\n${UNIFORMS}${COMMON}${code}\nvec3 render(vec2 uv) { return k_${kind}(uv); }\n${MAIN}`;
}
export const SHADER_KINDS = Object.keys(KIND_SRC);
