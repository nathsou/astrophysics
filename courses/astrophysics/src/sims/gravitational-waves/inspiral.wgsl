// Chapter 20 flagship: spacetime ripple surface + black-hole billboards.
// Units: G = c = 1, total mass M = 1. Lengths and times in M.

struct U {
  viewProj: mat4x4f,
  p0: vec4f,      // tNow, t0, dt, nSamples
  p1: vec4f,      // gridHalf, gain, rRef, near-zone radius
  bhPos: vec4f,   // x1, y1, x2, y2
  bhM: vec4f,     // m1, m2, well strength, merged (0/1)
  colPos: vec4f,  // colour for h > 0
  colNeg: vec4f,  // colour for h < 0
  colLine: vec4f, // grid line colour (rgb) , a = base alpha
  misc: vec4f,    // gridN, line spacing, dark (1) / light (0), remnant mass
  camRight: vec4f,
  camUp: vec4f,
  bhR: vec4f,     // radius1, radius2, radius remnant, remnant fade-in
};

@group(0) @binding(0) var<uniform> u: U;
// Timeline samples: x = Φ_gw, y = amplitude A, z = ω_gw, w = separation.
@group(0) @binding(1) var<storage, read> tl: array<vec4f>;

fn sampleTL(t: f32) -> vec4f {
  let n = u.p0.w;
  let x = (t - u.p0.y) / u.p0.z;
  if (x <= 0.0) { return vec4f(0.0); }         // wavefront has not reached here yet
  let xc = min(x, n - 1.001);
  let i = u32(floor(xc));
  let f = xc - floor(xc);
  return mix(tl[i], tl[i + 1u], f);
}

// Newtonian-ish potential wells under each hole (purely cosmetic, softened).
fn well(p: vec2f) -> f32 {
  let s = u.bhM.z;
  if (u.bhM.w > 0.5) {
    return -s * u.misc.w / sqrt(dot(p, p) + 9.0);
  }
  let d1 = p - u.bhPos.xy;
  let d2 = p - u.bhPos.zw;
  return -s * (u.bhM.x / sqrt(dot(d1, d1) + 9.0) + u.bhM.y / sqrt(dot(d2, d2) + 9.0));
}

// Plus-polarisation strain in the orbital plane (ι = 90°): h+ = A/2 · cos(Φ_gw(t−R) − 2φ) · (rRef/R).
// Returns the (dimensionless, per unit M/r) strain pattern, normalised to rRef.
fn strain(p: vec2f) -> f32 {
  let R = length(p);
  let s = sampleTL(u.p0.x - R);                 // retarded time t − R/c
  let phi = atan2(p.y, p.x);
  let fall = u.p1.z / max(R, u.p1.z);           // 1/r fall-off, clamped inside rRef
  let nearZone = smoothstep(0.5 * u.p1.w, 1.5 * u.p1.w + 6.0, R);
  return 0.5 * s.y * cos(s.x - 2.0 * phi) * fall * nearZone;
}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec2f,
  @location(1) h: f32,
  @location(2) shade: f32,
};

@vertex
fn vsGrid(@builtin(vertex_index) vid: u32) -> VOut {
  let N = u32(u.misc.x);
  let i = vid % N;
  let j = vid / N;
  let H = u.p1.x;
  let p = vec2f(-H + 2.0 * H * f32(i) / f32(N - 1u), -H + 2.0 * H * f32(j) / f32(N - 1u));
  let h = strain(p);
  let z = u.p1.y * h + well(p);
  // cheap normal from finite differences for a hint of shading
  let e = 2.0 * H / f32(N - 1u);
  let zx = u.p1.y * strain(p + vec2f(e, 0.0)) + well(p + vec2f(e, 0.0));
  let zy = u.p1.y * strain(p + vec2f(0.0, e)) + well(p + vec2f(0.0, e));
  let nrm = normalize(vec3f(z - zx, z - zy, e));
  var o: VOut;
  o.pos = u.viewProj * vec4f(p, z, 1.0);
  o.world = p;
  o.h = h;
  o.shade = clamp(dot(nrm, normalize(vec3f(0.4, 0.3, 1.0))), 0.0, 1.0);
  return o;
}

@fragment
fn fsGrid(i: VOut) -> @location(0) vec4f {
  let sp = u.misc.y;
  let g = i.world / sp;
  let w = fwidth(g);
  let gl = abs(fract(g - 0.5) - 0.5) / max(w, vec2f(1e-4));
  let line = 1.0 - min(min(gl.x, gl.y), 1.0);
  let R = length(i.world);
  let edge = 1.0 - smoothstep(0.75 * u.p1.x, u.p1.x, max(abs(i.world.x), abs(i.world.y)));
  let a = clamp(abs(i.h) * u.p1.y * 0.12, 0.0, 1.0);   // wave strength in "visual" units
  let waveCol = select(u.colNeg.rgb, u.colPos.rgb, i.h > 0.0);
  let dark = u.misc.z;
  // glow: brighter lines where the ripple is strong; soft fill in between
  var col = u.colLine.rgb * (0.35 + 0.65 * i.shade);
  col = mix(col, waveCol, a);
  var alpha = u.colLine.a * (0.18 + 0.82 * line) * edge;
  alpha = alpha + a * (0.25 + 0.6 * line) * edge;
  alpha = alpha * smoothstep(0.0, 8.0, R + 8.0);
  // Reinhard-ish tonemap on the boosted colour (dark theme glows, light theme stays ink-like)
  let boosted = col * (1.0 + dark * 1.5 * a * line);
  let tm = boosted / (1.0 + dark * 0.35 * boosted);
  let al = clamp(alpha, 0.0, 1.0);
  return vec4f(tm * al, al);
}

// ---- black-hole billboards (instanced: 0 = BH1, 1 = BH2, 2 = remnant) ----
struct BOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) fade: f32,
};

@vertex
fn vsBH(@builtin(vertex_index) vid: u32, @builtin(instance_index) inst: u32) -> BOut {
  var corners = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));
  let c = corners[vid];
  var center = vec2f(0.0);
  var r = u.bhR.z;
  var fade = u.bhR.w;
  if (inst == 0u) { center = u.bhPos.xy; r = u.bhR.x; fade = 1.0 - u.bhR.w; }
  if (inst == 1u) { center = u.bhPos.zw; r = u.bhR.y; fade = 1.0 - u.bhR.w; }
  let z = well(center) + 0.6 * r;
  let ext = 2.2 * r;                             // quad covers the glow halo
  let wp = vec3f(center, z) + (c.x * u.camRight.xyz + c.y * u.camUp.xyz) * ext;
  var o: BOut;
  o.pos = u.viewProj * vec4f(wp, 1.0);
  o.uv = c * 2.2;                                // in units of the horizon radius
  o.fade = fade;
  return o;
}

@fragment
fn fsBH(i: BOut) -> @location(0) vec4f {
  let d = length(i.uv);
  if (i.fade <= 0.001) { discard; }
  let shadow = 1.0 - smoothstep(0.95, 1.05, d);            // the "shadow" (~2.6 r_h in reality)
  let ring = exp(-pow((d - 1.15) / 0.12, 2.0));             // photon-ring glow
  let halo = exp(-pow(max(d - 1.0, 0.0) / 0.5, 2.0)) * 0.35;
  let glow = (ring + halo) * u.colPos.rgb * (0.6 + 0.8 * u.misc.z);
  let a = clamp(shadow + ring + halo, 0.0, 1.0) * i.fade;
  // premultiplied: black core, glowing rim
  return vec4f(glow * (1.0 - shadow) * i.fade, a);
}
