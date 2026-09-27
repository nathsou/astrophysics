// Chapter 7 flagship rendering: additive gas splats + sink "stars" into an HDR target, then tonemap.

struct R {
  vp: mat4x4f,
  view: vec4f,     // focal (1/tan(fov/2)), aspect, pixel height, min splat size in px
  gas: vec4f,      // N, rho0, h0, gain
  star: vec4f,     // N (sink base index), mass -> M_sun, gain, Smax
  bg: vec4f,       // background rgb, exposure
  lut: array<vec4f, 16>,   // star colour by log mass
};

@group(0) @binding(0) var<uniform> U: R;
@group(0) @binding(1) var<storage, read> bodies: array<vec4f>;
@group(0) @binding(2) var<storage, read> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read> aux: array<vec4f>;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec3f };

const CORNERS = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(1, 1), vec2f(-1, 1));

fn billboard(p: vec3f, worldR: f32, minPx: f32, corner: vec2f) -> vec4f {
  let c = U.vp * vec4f(p, 1.0);
  let ndcR = max(worldR * U.view.x / max(c.w, 1e-3), minPx * 2.0 / U.view.z);
  return vec4f(c.xy + corner * vec2f(ndcR / U.view.y, ndcR) * c.w, c.z, c.w);
}

// Density colour ramp: cold diffuse gas is dusky blue, filaments magenta, dense cores warm gold.
fn gasColour(lr: f32) -> vec3f {
  let t = clamp((lr + 0.5) / 2.5, 0.0, 1.0);
  let c0 = vec3f(0.18, 0.28, 0.85);
  let c1 = vec3f(0.85, 0.25, 0.55);
  let c2 = vec3f(1.0, 0.72, 0.35);
  if (t < 0.5) { return mix(c0, c1, t * 2.0); }
  return mix(c1, c2, t * 2.0 - 1.0);
}

@vertex
fn vsGas(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var o: VOut;
  let b = bodies[ii];
  let corner = CORNERS[vi];
  if (b.w == 0.0) { o.pos = vec4f(2.0, 2.0, 2.0, 1.0); return o; }
  let h = vel[ii].w;
  let rho = max(aux[ii].x, 1e-6);
  let lr = log2(rho / U.gas.y) * 0.30103;          // log10(rho / rho0)
  o.pos = billboard(b.xyz, 1.3 * h, U.view.w, corner);
  o.uv = corner;
  // brightness per splat rises gently with density (flux ∝ h^2 · peak, peak ∝ h0/h)
  o.col = gasColour(lr) * U.gas.w * (U.gas.z / h);
  return o;
}

@fragment
fn fsGas(i: VOut) -> @location(0) vec4f {
  let r2 = dot(i.uv, i.uv);
  if (r2 > 1.0) { discard; }
  let f = exp(-4.0 * r2) - 0.018;
  return vec4f(i.col * f, 0.0);
}

@vertex
fn vsStar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var o: VOut;
  let b = bodies[u32(U.star.x) + ii];
  let corner = CORNERS[vi];
  if (b.w == 0.0) { o.pos = vec4f(2.0, 2.0, 2.0, 1.0); return o; }
  let msun = b.w * U.star.y;
  let lm = clamp((log2(msun) * 0.30103 + 2.0) / 3.5, 0.0, 1.0);   // log10 M from -2 to 1.5
  let fi = lm * 15.0;
  let i0 = u32(floor(fi));
  let col = mix(U.lut[i0].rgb, U.lut[min(i0 + 1u, 15u)].rgb, fi - f32(i0));
  let px = 5.0 + 9.0 * pow(msun, 0.35);
  o.pos = billboard(b.xyz, 0.0, px, corner);
  o.uv = corner;
  o.col = col * U.star.z * (0.6 + 0.4 * pow(msun, 0.3));
  return o;
}

@fragment
fn fsStar(i: VOut) -> @location(0) vec4f {
  let r2 = dot(i.uv, i.uv);
  if (r2 > 1.0) { discard; }
  let core = exp(-60.0 * r2) * 8.0 + exp(-14.0 * r2) * 1.2;
  let halo = (exp(-4.0 * r2) - 0.018) * 0.35;
  let spikes = exp(-400.0 * i.uv.x * i.uv.x) * exp(-3.0 * abs(i.uv.y)) + exp(-400.0 * i.uv.y * i.uv.y) * exp(-3.0 * abs(i.uv.x));
  return vec4f(i.col * (core + halo + 0.25 * spikes) + vec3f(core * 0.3), 0.0);
}

// ---- tonemap ----
@group(0) @binding(4) var hdr: texture_2d<f32>;

@vertex
fn vsFull(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return vec4f(p[vi], 0.0, 1.0);
}

@fragment
fn fsTone(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let x = textureLoad(hdr, vec2i(fc.xy), 0).rgb * U.bg.w;
  let mapped = vec3f(1.0) - exp(-x);                    // exponential tonemap (soft saturation)
  let c = U.bg.rgb + pow(mapped, vec3f(0.8)) * (vec3f(1.0) - U.bg.rgb);
  return vec4f(c, 1.0);
}
