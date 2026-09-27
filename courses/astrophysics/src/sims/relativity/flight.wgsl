// Relativistic flight: stars (and lattice lamps) rendered as instanced Gaussian sprites into an HDR
// target, then composited with a per-pixel CMB background and tonemapped.
//
// Frames: S = rest frame of the stars. The observer moves with speed β along u.vel.xyz.
// Kinematic numbers that cancel catastrophically in f32 near β → 1 (1 − β, γ) come from the CPU,
// where they are computed from the rapidity in f64.

struct U {
  right: vec4f,   // camera right; w = focal length f = 1/tan(fov/2)
  up: vec4f,      // camera up;    w = aspect (width/height)
  fwd: vec4f,     // camera forward; w = device pixels per CSS pixel
  vel: vec4f,     // unit velocity direction; w = β
  kin: vec4f,     // x = γ, y = 1 − β, z = exposure, w = CMB brightness scale
  lat: vec4f,     // observer position in the lattice (xyz), w = lattice period L
  vp: vec4f,      // x,y = 2 / viewport size (NDC per device px), z = lattice fade radius, w = sprite σ₀ (device px)
  flags: vec4u,   // x aberration, y Doppler, z beaming, w CMB
};

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> stars: array<vec4f>;   // 2 per source: (dir or pos, kind), (T, F_bol, -, -)
@group(0) @binding(2) var<storage, read> lut: array<vec4f>;     // visible-band RGB per unit bolometric flux vs log10 T
@group(0) @binding(3) var hdr: texture_2d<f32>;

const LUT_N: f32 = 512.0;
const LOGT_MIN: f32 = 0.0;
const LOGT_MAX: f32 = 9.0;
const LUMA = vec3f(0.2126, 0.7152, 0.0722);

fn bandColor(T: f32) -> vec3f {
  let t = clamp((log2(max(T, 1.0)) * 0.30103 - LOGT_MIN) / (LOGT_MAX - LOGT_MIN), 0.0, 1.0) * (LUT_N - 1.0);
  let i = u32(t);
  let j = min(i + 1u, u32(LUT_N) - 1u);
  return mix(lut[i].rgb, lut[j].rgb, fract(t));
}

// Rest-frame direction n → observed direction n′ (xyz) and Doppler factor δ (w).
// Written so nothing of the form (1 − x) with x ≈ 1 is ever formed in f32:
//   1 + β μ = (1 − β) + β (1 + μ),   with 1 + μ = |n + v̂|² / 2.
fn aberrate(n: vec3f) -> vec4f {
  let v = u.vel.xyz;
  let beta = u.vel.w;
  let gamma = u.kin.x;
  let mu = dot(n, v);
  let w = n + v;
  let a = u.kin.y + beta * 0.5 * dot(w, w);        // 1 + β μ, accurate even for μ → −1
  let perp = n - mu * v;                          // component ⟂ to the motion (exact)
  let np = ((mu + beta) / a) * v + perp / (gamma * a);
  return vec4f(normalize(np), gamma * a);         // δ = γ (1 + β μ)
}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,       // offset from the centre in units of σ
  @location(1) col: vec3f,      // peak HDR colour
};

@vertex
fn vsStar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var o: VOut;
  o.pos = vec4f(2.0, 2.0, 2.0, 1.0);             // default: clipped away
  o.uv = vec2f(0.0);
  o.col = vec3f(0.0);
  let a = stars[2u * ii];
  let p = stars[2u * ii + 1u];

  var n = a.xyz;
  var flux = p.y;
  if (a.w > 0.5) {
    // A lattice lamp at a finite distance. The lattice is periodic, so wrap it around the observer.
    let L = u.lat.w;
    var r = a.xyz - u.lat.xyz;
    r = r - L * round(r / L);
    let d = length(r);
    n = r / max(d, 1e-4);
    let fade = clamp(2.0 - 2.0 * d / u.vp.z, 0.0, 1.0);
    flux = flux * fade / max(d * d, 0.04);
  }

  let ab = aberrate(n);
  let dir = select(n, ab.xyz, u.flags.x != 0u);
  let delta = ab.w;

  // Doppler: a blackbody at T is seen as a blackbody at δT (I_ν/ν³ is invariant).
  let T = select(p.x, p.x * delta, u.flags.y != 0u);
  // Beaming: the bolometric flux of a point source scales as δ² (δ⁴ in surface brightness × δ⁻² in solid angle).
  let boost = select(1.0, delta * delta, u.flags.z != 0u);
  var c = bandColor(T) * (flux * boost * u.kin.z);

  let z = dot(dir, u.fwd.xyz);
  let lum = dot(c, LUMA);
  if (z < 1e-3 || lum < 2e-4) { return o; }

  let f = u.right.w;
  let ndc = vec2f(dot(dir, u.right.xyz) / z * f / u.up.w, dot(dir, u.up.xyz) / z * f);

  // Sprite size grows gently with brightness (a cheap stand-in for the eye's/camera's PSF wings).
  let sigma = u.vp.w * clamp(1.0 + 0.3 * log2(1.0 + lum), 1.0, 2.6);
  let peak = min(c / (6.2831853 * sigma * sigma), vec3f(64.0));   // conserve total flux; keep fp16 happy
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let ext = 3.0;
  o.pos = vec4f(ndc + corner * ext * sigma * u.vp.xy, 0.0, 1.0);
  o.uv = corner * ext;
  o.col = peak;
  return o;
}

@fragment
fn fsStar(i: VOut) -> @location(0) vec4f {
  let g = exp(-0.5 * dot(i.uv, i.uv));
  return vec4f(i.col * g, 0.0);
}

// ---------- Composite: CMB background (per pixel) + tonemap ----------

@vertex
fn vsFull(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

fn srgb(x: vec3f) -> vec3f {
  return select(1.055 * pow(x, vec3f(1.0 / 2.4)) - 0.055, 12.92 * x, x <= vec3f(0.0031308));
}

@fragment
fn fsComposite(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  var c = min(textureLoad(hdr, vec2i(fc.xy), 0).rgb, vec3f(6.0e4));

  if (u.flags.w != 0u) {
    // Observed direction through this pixel.
    let ndc = vec2f(fc.x * u.vp.x - 1.0, 1.0 - fc.y * u.vp.y);
    let f = u.right.w;
    let d = normalize(u.fwd.xyz + u.right.xyz * (ndc.x * u.up.w / f) + u.up.xyz * (ndc.y / f));
    let v = u.vel.xyz;
    let beta = u.vel.w;
    var delta: f32;
    if (u.flags.x != 0u) {
      // δ = 1 / (γ (1 − β μ′)),  1 − β μ′ = (1 − β) + β (1 − μ′),  1 − μ′ = |d − v̂|² / 2
      let w = d - v;
      delta = 1.0 / (u.kin.x * (u.kin.y + beta * 0.5 * dot(w, w)));
    } else {
      let w = d + v;
      delta = u.kin.x * (u.kin.y + beta * 0.5 * dot(w, w));
    }
    let T0 = 2.7255;
    let T = select(T0, T0 * delta, u.flags.y != 0u);
    // Surface brightness ∝ T⁴ × visible fraction; beaming alone would scale it by δ⁴.
    let Tb = select(T0, T0 * delta, u.flags.z != 0u);
    let s = Tb / 5800.0;
    c += bandColor(T) * (s * s * s * s * u.kin.w * u.kin.z);
  }

  c = 1.0 - exp(-c);
  return vec4f(srgb(c), 1.0);
}
