// Shared by the lensing-playground render and caustic passes.
// Angles are in "view units" (1 unit = 1 arcsec for galaxy lenses), so every number is O(1) in f32.

struct Uniforms {
  a: vec4f,  // res.xy (px), viewCenter.xy (units)
  b: vec4f,  // scale (units / px), model, supersamples per axis, time
  c: vec4f,  // lensPos.xy, thetaE (or mass scale), axis ratio q
  d: vec4f,  // ellipse angle, shear gamma, shear angle, nComp
  e: vec4f,  // srcPos.xy, srcSize, srcType
  f: vec4f,  // flags: critical, caustic, magmap, lens light
  g: vec4f,  // caustic grid w, h (px), exposure, unused
  comps: array<vec4f, 8>, // cluster halos: x, y, strength, rs (rs > 0 → NFW, else SIS)
};

@group(0) @binding(0) var<uniform> U: Uniforms;

fn rot(v: vec2f, a: f32) -> vec2f {
  let c = cos(a); let s = sin(a);
  return vec2f(c * v.x - s * v.y, s * v.x + c * v.y);
}

fn toTheta(px: vec2f) -> vec2f {
  let d = (px - 0.5 * U.a.xy) * U.b.x;
  return U.a.zw + vec2f(d.x, -d.y);
}
fn toPix(t: vec2f) -> vec2f {
  let d = (t - U.a.zw) / U.b.x;
  return vec2f(d.x, -d.y) + 0.5 * U.a.xy;
}

// ---- deflection laws ------------------------------------------------------
fn aPoint(d: vec2f, E: f32) -> vec2f { return E * E * d / max(dot(d, d), 1e-8); }
fn aSIS(d: vec2f, b: f32) -> vec2f { return b * d / max(length(d), 1e-6); }
// Singular isothermal ellipsoid (Kormann et al. 1994 / Keeton 2001), major axis along angle phi.
fn aSIE(d: vec2f, b: f32, q: f32, phi: f32) -> vec2f {
  if (q > 0.995) { return aSIS(d, b); }
  let p = rot(d, -phi);
  let s = sqrt(1.0 - q * q);
  let psi = max(sqrt(q * q * p.x * p.x + p.y * p.y), 1e-6);
  let k = b * sqrt(q) / s;
  let a = vec2f(k * atan(s * p.x / psi), k * atanh(clamp(s * p.y / psi, -0.999999, 0.999999)));
  return rot(a, phi);
}
// Navarro-Frenk-White: alpha(r) = 4 kappa_s r_s h(x)/x,  x = r/r_s
fn nfwH(x: f32) -> f32 {
  if (x < 0.999) { return log(0.5 * x) + 2.0 / sqrt(1.0 - x * x) * atanh(sqrt((1.0 - x) / (1.0 + x))); }
  if (x > 1.001) { return log(0.5 * x) + 2.0 / sqrt(x * x - 1.0) * atan(sqrt((x - 1.0) / (x + 1.0))); }
  return 1.0 - log(2.0);
}
fn aNFW(d: vec2f, ks: f32, rs: f32) -> vec2f {
  let r = max(length(d), 1e-5);
  let x = max(r / rs, 1e-4);
  return 4.0 * ks * rs * nfwH(x) / x * d / r;
}

fn alpha(t: vec2f) -> vec2f {
  let d = t - U.c.xy;
  let E = U.c.z;
  let model = i32(U.b.y);
  var a = vec2f(0.0);
  if (model == 0) { a = aPoint(d, E); }
  else if (model == 1) { a = aSIS(d, E); }
  else if (model == 2) { a = aSIE(d, E, U.c.w, U.d.x); }
  else {
    let n = i32(U.d.w);
    for (var i = 0; i < n; i++) {
      let h = U.comps[i];
      let dd = d - h.xy;
      if (h.w > 0.0) { a += aNFW(dd, h.z * E, h.w); }
      else { a += aSIE(dd, h.z * E, U.c.w, U.d.x); }
    }
  }
  // external shear: alpha = Gamma . d with Gamma = [[g1, g2], [g2, -g1]]
  let g1 = U.d.y * cos(2.0 * U.d.z);
  let g2 = U.d.y * sin(2.0 * U.d.z);
  return a + vec2f(g1 * d.x + g2 * d.y, g2 * d.x - g1 * d.y);
}

// det of the lensing Jacobian A = d(beta)/d(theta), by central differences
fn detA(t: vec2f, h: f32) -> f32 {
  let ax = (alpha(t + vec2f(h, 0.0)) - alpha(t - vec2f(h, 0.0))) / (2.0 * h);
  let ay = (alpha(t + vec2f(0.0, h)) - alpha(t - vec2f(0.0, h))) / (2.0 * h);
  return (1.0 - ax.x) * (1.0 - ay.y) - ay.x * ax.y;
}
