// Derivatives are taken after the geodesic loop, where every invocation of a quad has reconverged.
diagnostic(off, derivative_uniformity);

// Chapter 19 flagship: per-pixel Schwarzschild null-geodesic ray tracer.
//
// Units: r_s = 2GM/c² = 1, c = 1. Photon sphere at r = 1.5, ISCO at r = 3.
// We integrate the photon's *spatial path* with the Cartesian form of the Binet equation
//     d²x/dλ² = −(3/2) h² x / r⁵,   h = |x × dx/dλ|  (conserved)
// whose orbits r(φ) are exactly Schwarzschild null geodesics (u'' + u = (3/2) u², u = 1/r).
// λ is not an affine parameter, but we only need the shape of the path.

struct U {
  eye: vec4f,    // xyz camera position, w = tan(fov/2)
  right: vec4f,  // xyz, w = aspect
  up: vec4f,     // xyz, w = time (s)
  fwd: vec4f,    // xyz, w = max steps
  prm: vec4f,    // x = step factor k (dλ = k·r), y = T_peak (K), z = exposure, w = escape radius
  disk: vec4f,   // x = r_in, y = r_out, z = flux normalisation, w = camera distance
  src: vec4f,    // xyz background-galaxy direction, w = on
  flags: vec4f,  // lensing, disk, doppler, grav. redshift
  flags2: vec4f, // grid sky, stars, -, -
};

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> bb: array<vec4f>; // 256-entry blackbody chroma LUT, log T ∈ [1e3, 4e4] K

const PI = 3.14159265;

struct VO { @builtin(position) pos: vec4f, @location(0) ndc: vec2f };

@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: VO;
  o.pos = vec4f(p[i], 0.0, 1.0);
  o.ndc = p[i];
  return o;
}

// ---------- noise ----------
fn hash3(p: vec3f) -> f32 {
  var q = fract(p * 0.3183099 + vec3f(0.11, 0.23, 0.37));
  q *= 17.0;
  return fract(q.x * q.y * q.z * (q.x + q.y + q.z));
}
fn vnoise(x: vec3f) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let w = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3f(1, 0, 0)), w.x), mix(hash3(i + vec3f(0, 1, 0)), hash3(i + vec3f(1, 1, 0)), w.x), w.y),
    mix(mix(hash3(i + vec3f(0, 0, 1)), hash3(i + vec3f(1, 0, 1)), w.x), mix(hash3(i + vec3f(0, 1, 1)), hash3(i + vec3f(1, 1, 1)), w.x), w.y),
    w.z);
}
fn fbm(x: vec3f) -> f32 {
  var s = 0.0; var a = 0.5; var p = x;
  for (var i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec3f(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}

// ---------- colour ----------
fn bbColor(T: f32) -> vec3f {
  let t = clamp((log(T) - 6.9077553) / (10.596635 - 6.9077553), 0.0, 1.0) * 255.0;
  let i = u32(floor(t));
  let j = min(i + 1u, 255u);
  return mix(bb[i].rgb, bb[j].rgb, fract(t));
}

// ---------- background sky ----------
// Stars are points, so each one is drawn as a ~1-pixel spot *in the image*, whatever the lensing does
// to the sky behind it. J = (∂d/∂x, ∂d/∂y) is the screen-space Jacobian of the escaped direction
// (from derivatives); solving J·δ = Δ gives the star's offset δ in pixels. Its brightness is multiplied
// by the lensing magnification μ = (unlensed pixel solid angle) / |∂d/∂x × ∂d/∂y|.
struct Foot { jx: vec3f, jy: vec3f, gram: vec3f, idet: f32, mu: f32 };

fn starLayer(d: vec3f, s: f32, ft: Foot) -> vec3f {
  let q = d * s;
  let cell = floor(q);
  let h = hash3(cell);
  if (h < 0.88) { return vec3f(0.0); }
  let jit = vec3f(hash3(cell + 1.7), hash3(cell + 3.1), hash3(cell + 5.3)) - 0.5;
  let c = normalize(cell + 0.5 + jit * 0.6);
  let dl = c - d;
  // least-squares pixel offset: (JᵀJ) δ = Jᵀ Δ
  let rx = dot(ft.jx, dl);
  let ry = dot(ft.jy, dl);
  let a = (ft.gram.z * rx - ft.gram.y * ry) * ft.idet;
  let b = (ft.gram.x * ry - ft.gram.y * rx) * ft.idet;
  let w = exp(-(a * a + b * b) * 1.1);
  let br = pow((h - 0.88) / 0.12, 6.0) * 9.0 + 0.012;
  let T = 2800.0 + 22000.0 * pow(hash3(cell + 9.1), 3.0);
  return bbColor(T) * br * w * ft.mu;
}

fn sky(d: vec3f, ft: Foot) -> vec3f {
  if (u.flags2.x > 0.5) {
    // latitude/longitude grid: makes the lensing map obvious
    let phi = atan2(d.y, d.x) / (PI / 12.0);
    let th = acos(clamp(d.z, -1.0, 1.0)) / (PI / 12.0);
    let chk = (i32(floor(phi)) + i32(floor(th))) & 1;
    var c = select(vec3f(0.05, 0.07, 0.12), vec3f(0.10, 0.12, 0.20), chk == 1);
    if (d.z > 0.0) { c *= vec3f(1.3, 0.8, 0.6); }
    let lw = min(abs(fract(phi + 0.5) - 0.5), abs(fract(th + 0.5) - 0.5));
    c += vec3f(0.45, 0.6, 0.9) * (1.0 - smoothstep(0.02, 0.06, lw));
    return c;
  }
  var c = vec3f(0.0);
  if (u.flags2.y > 0.5) {
    let band = exp(-pow(dot(d, normalize(vec3f(0.35, -0.45, 0.82))), 2.0) * 7.0);
    let n1 = fbm(d * 3.0);
    let n2 = fbm(d * 7.0 + 4.0);
    c += (vec3f(0.42, 0.20, 0.55) * n1 * n1 * 1.4 + vec3f(0.10, 0.22, 0.40) * n2 * n2) * band * 0.35;
    c += vec3f(0.006, 0.007, 0.012);
    // fade the point stars where one pixel covers several star cells (near the shadow edge)
    let fp = max(length(ft.jx), length(ft.jy));
    c += starLayer(d, 70.0, ft) * (1.0 - smoothstep(1.0, 3.0, fp * 70.0));
    c += starLayer(d, 160.0, ft) * 0.55 * (1.0 - smoothstep(1.0, 3.0, fp * 160.0));
    var fz = ft;                                                 // the third layer is rotated (d.zxy): rotate J too
    fz.jx = ft.jx.zxy; fz.jy = ft.jy.zxy;
    c += starLayer(d.zxy, 330.0, fz) * 0.25 * (1.0 - smoothstep(1.0, 3.0, fp * 330.0));
  }
  if (u.src.w > 0.5) {
    // a background galaxy exactly behind the hole → Einstein ring
    let k = dot(d, u.src.xyz);
    c += vec3f(1.0, 0.82, 0.62) * exp((k - 1.0) * 6000.0) * 5.0 + vec3f(0.55, 0.5, 0.95) * exp((k - 1.0) * 700.0) * 0.8;
  }
  return c;
}

// ---------- accretion disk ----------
fn flowTex(r: f32, phi: f32, om: f32) -> f32 {
  // two-phase flow noise: each layer is advected differentially (Kepler shear) and
  // periodically reset, cross-faded so the reset is invisible.
  let P = 8.0;
  let t = u.up.w;
  let f1 = fract(t / P);
  let f2 = fract(t / P + 0.5);
  let w1 = 1.0 - abs(2.0 * f1 - 1.0);
  let lr = log(r) * 9.0;
  let a1 = phi - om * f1 * P * 14.0;
  let a2 = phi - om * f2 * P * 14.0;
  let n1 = fbm(vec3f(cos(a1) * 2.2, sin(a1) * 2.2, lr));
  let n2 = fbm(vec3f(cos(a2) * 2.2, sin(a2) * 2.2, lr) + 13.7);
  return mix(n2, n1, w1);
}

fn diskEmit(pc: vec3f, lam: f32) -> vec4f {
  let r = length(pc.xy);
  let rin = u.disk.x;
  let rout = u.disk.y;
  if (r < rin || r > rout) { return vec4f(0.0); }
  // Novikov–Thorne-like flux F ∝ r⁻³ (1 − √(r_in/r)),  T ∝ F^{1/4}
  let F = max((1.0 - sqrt(rin / r)) / (r * r * r), 0.0) / u.disk.z;
  let T = u.prm.y * pow(F, 0.25);
  let om = sqrt(0.5 / (r * r * r)); // Kepler Ω = √(GM/r³), GM = 1/2
  var g = 1.0;
  if (u.flags.w > 0.5) { g *= sqrt(1.0 - 1.0 / r) / sqrt(1.0 - 1.0 / u.disk.w); }
  if (u.flags.z > 0.5) { g *= sqrt((1.0 - 1.5 / r) / (1.0 - 1.0 / r)) / (1.0 - om * lam); }
  let Tobs = g * T;
  let I = pow(Tobs / u.prm.y, 4.0); // bolometric: I_obs = g⁴ I_emit
  let tex = flowTex(r, atan2(pc.y, pc.x), om);
  let a = clamp(smoothstep(rout, rout * 0.6, r) * (0.35 + 0.9 * tex), 0.0, 0.97);
  return vec4f(bbColor(Tobs) * I * (0.25 + 1.5 * tex * tex) * a, a);
}

// ---------- geodesic integration ----------
fn accel(p: vec3f, k: f32) -> vec3f {
  let r2 = dot(p, p);
  return -k * p / (r2 * r2 * sqrt(r2)); // k = (3/2) h²
}

fn rk4(p: ptr<function, vec3f>, v: ptr<function, vec3f>, dt: f32, k: f32) {
  let p0 = *p; let v0 = *v;
  let a1 = accel(p0, k);
  let a2 = accel(p0 + 0.5 * dt * v0, k);
  let a3 = accel(p0 + 0.5 * dt * v0 + 0.25 * dt * dt * a1, k);
  let a4 = accel(p0 + dt * v0 + 0.5 * dt * dt * a2, k);
  *p = p0 + dt * v0 + dt * dt / 6.0 * (a1 + a2 + a3);
  *v = v0 + dt / 6.0 * (a1 + 2.0 * a2 + 2.0 * a3 + a4);
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

@fragment fn fs(in: VO) -> @location(0) vec4f {
  // Direction n in the static observer's local orthonormal frame.
  let n = normalize(u.fwd.xyz + in.ndc.x * u.eye.w * u.right.w * u.right.xyz + in.ndc.y * u.eye.w * u.up.xyz);
  let pix0 = length(cross(dpdx(n), dpdy(n)));                 // unlensed solid angle of this pixel
  var p = u.eye.xyz;
  let rc = length(p);
  let rhat = p / rc;
  let nr = dot(n, rhat);
  let nt = n - nr * rhat;
  let alpha = sqrt(max(1.0 - 1.0 / rc, 1e-4));
  // Local → coordinate direction: dr/dφ picks up a factor √(1 − r_s/r) (only the direction matters).
  var v = n;
  if (u.flags.x > 0.5) { v = normalize(nr * alpha * rhat + nt); }
  let hv = cross(p, v);
  let k = 1.5 * dot(hv, hv) * u.flags.x;
  // Photon's conserved L_z/E (for light travelling *towards* the camera, hence the minus sign).
  let lam = -cross(p, n).z / alpha;

  var col = vec3f(0.0);
  var trans = 1.0;
  var escaped = false;
  let maxSteps = i32(u.fwd.w);
  for (var i = 0; i < maxSteps; i++) {
    let r = length(p);
    if (r < 1.0) { break; }                                   // crossed the horizon
    if (r > u.prm.w && dot(p, v) > 0.0) { escaped = true; break; }
    let dt = u.prm.x * r;                                      // step ∝ r: fine near the hole, coarse far away
    let p0 = p;
    rk4(&p, &v, dt, k);
    if (u.flags.y > 0.5 && p0.z * p.z < 0.0) {                 // crossed the equatorial plane
      let pc = mix(p0, p, p0.z / (p0.z - p.z));
      let e = diskEmit(pc, lam);
      col += trans * e.rgb;
      trans *= 1.0 - e.a;
      if (trans < 0.02) { break; }
    }
  }
  // Screen-space footprint of the escaped direction (control flow has reconverged after the loop).
  let dOut = normalize(v);
  var ft: Foot;
  ft.jx = dpdx(dOut);
  ft.jy = dpdy(dOut);
  ft.gram = vec3f(dot(ft.jx, ft.jx), dot(ft.jx, ft.jy), dot(ft.jy, ft.jy));
  ft.idet = 1.0 / max(ft.gram.x * ft.gram.z - ft.gram.y * ft.gram.y, 1e-24);
  ft.mu = clamp(pix0 / max(length(cross(ft.jx, ft.jy)), 1e-12), 0.0, 25.0);
  if (escaped) { col += trans * sky(dOut, ft); }

  var c = aces(col * u.prm.z);
  c = pow(c, vec3f(1.0 / 2.2));
  c += (hash3(vec3f(in.pos.xy, u.up.w)) - 0.5) / 255.0; // dither
  return vec4f(c, 1.0);
}
