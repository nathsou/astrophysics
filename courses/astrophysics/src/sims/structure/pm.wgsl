// Particle-mesh cosmological N-body kernels (Chapter 28, structure-pm).
// Code units: lengths in mesh cells, time in 1/H0, canonical momentum p = a² dx/dt.
// Grid point (i,j,k) sits at position (i,j,k); the box is periodic with side ng.

struct Params {
  ng: u32, n: u32, seed: u32, axis: u32,
  kick: f32, drift: f32, pois: f32, dScale: f32,
  vScale: f32, amp: f32, ns: f32, gamma: f32,
  dx: f32, wdm: f32, invN: f32, mscale: f32,
  rsm: f32, np: u32, _p1: f32, _p2: f32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> rho: array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> cx: array<vec2f>;
@group(0) @binding(5) var<storage, read_write> kb: array<vec2f>;
@group(0) @binding(6) var<storage, read_write> frc: array<vec4f>;

const TAU = 6.283185307;

fn coords(i: u32) -> vec3u {
  let ng = P.ng;
  return vec3u(i % ng, (i / ng) % ng, i / (ng * ng));
}
fn idx(c: vec3u) -> u32 {
  let ng = P.ng;
  return (c.x % ng) + ((c.y % ng) + (c.z % ng) * ng) * ng;
}
// Wavevector (radians per cell) of FFT bin c.
fn kvec(c: vec3u) -> vec3f {
  let h = i32(P.ng / 2u);
  var n = vec3i(c);
  n = select(n, n - i32(P.ng), n > vec3i(h));
  return vec3f(n) * (TAU / f32(P.ng));
}
fn isNyq(c: vec3u) -> bool { return any(c == vec3u(P.ng / 2u)); }
fn wrap(x: vec3f) -> vec3f { let g = f32(P.ng); return x - floor(x / g) * g; }

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

// ---------- initial conditions ----------

// White noise: one unit Gaussian per cell (Box–Muller on a hashed counter).
@compute @workgroup_size(256)
fn noise(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  let h1 = pcg(i ^ pcg(P.seed * 7919u + 17u));
  let h2 = pcg(h1 ^ 0x9e3779b9u);
  let u1 = (f32(h1 >> 8u) + 0.5) / 16777216.0;
  let u2 = f32(h2 >> 8u) / 16777216.0;
  cx[i] = vec2f(sqrt(-2.0 * log(u1)) * cos(TAU * u2), 0.0);
}

fn transfer(k: f32) -> f32 {
  // BBKS (1986) CDM transfer function, k in h/Mpc
  let q = max(k / P.gamma, 1e-6);
  let poly = 1.0 + 3.89 * q + pow(16.1 * q, 2.0) + pow(5.46 * q, 3.0) + pow(6.71 * q, 4.0);
  var T = log(1.0 + 2.34 * q) / (2.34 * q) * pow(poly, -0.25);
  if (P.wdm > 0.0) { T *= pow(1.0 + pow(P.wdm * k, 2.24), -5.0 / 1.12); }
  return T;
}

// Colour the noise: δ0(k) = W(k) · sqrt(P(k) / Δx³), P(k) = A k^ns T²(k). Stored in kb.
@compute @workgroup_size(256)
fn shape(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  let c = coords(i);
  if (i == 0u || isNyq(c)) { kb[i] = vec2f(0.0); return; }
  let kphys = length(kvec(c)) / P.dx;
  let T = transfer(kphys);
  let pk = P.amp * pow(kphys, P.ns) * T * T;
  kb[i] = cx[i] * sqrt(pk / (P.dx * P.dx * P.dx));
}

// Zel'dovich displacement along one axis: ψ_k = i k δ_k / k².
@compute @workgroup_size(256)
fn zeldo(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  let c = coords(i);
  if (i == 0u) { cx[i] = vec2f(0.0); return; }
  let k = kvec(c);
  let d = kb[i];
  cx[i] = vec2f(-d.y, d.x) * (k[P.axis] / dot(k, k));
}

// Place particles on the lattice, displaced by D(a_i) ψ; momentum p = a³ H dD/da ψ.
@compute @workgroup_size(256)
fn setp(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  let c = coords(i);
  let psi = cx[i].x * P.invN;
  let m = vec3f(select(vec3f(0.0), vec3f(1.0), vec3u(P.axis) == vec3u(0u, 1u, 2u)));
  var p = pos[i];
  var v = vel[i];
  if (P.axis == 0u) { p = vec4f(vec3f(c), 0.0); v = vec4f(0.0); }
  p = vec4f(p.xyz + m * (P.dScale * psi), 0.0);
  v = vec4f(v.xyz + m * (P.vScale * psi), 0.0);
  if (P.axis == 2u) { p = vec4f(wrap(p.xyz), 0.0); }
  pos[i] = p;
  vel[i] = v;
}

// ---------- gravity ----------

@compute @workgroup_size(256)
fn clear(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= P.n) { return; }
  atomicStore(&rho[g.x], 0u);
}

// Cloud-in-cell mass assignment with fixed-point u32 atomics.
@compute @workgroup_size(256)
fn deposit(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.np) { return; }
  let x = pos[i].xyz;
  let f0 = floor(x);
  let f = x - f0;
  let b = vec3u(f0);
  for (var o = 0u; o < 8u; o++) {
    let d = vec3u(o & 1u, (o >> 1u) & 1u, o >> 2u);
    let w3 = select(1.0 - f, f, d == vec3u(1u));
    let w = w3.x * w3.y * w3.z;
    atomicAdd(&rho[idx(b + d)], u32(w * P.mscale + 0.5));
  }
}

// Fixed-point density → complex overdensity δ = ρ/ρ̄ − 1.
@compute @workgroup_size(256)
fn toc(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  cx[i] = vec2f(f32(atomicLoad(&rho[i])) / P.mscale - 1.0, 0.0);
}

fn sinc(x: f32) -> f32 { return select(sin(x) / x, 1.0, abs(x) < 1e-4); }

// Poisson in Fourier space: φ_k = −(3Ωm/2a) δ_k / k², with CIC deconvolution and a small Gaussian filter.
@compute @workgroup_size(256)
fn poisson(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  if (i == 0u) { cx[0] = vec2f(0.0); return; }
  let k = kvec(coords(i));
  let k2 = dot(k, k);
  let s = vec3f(sinc(0.5 * k.x), sinc(0.5 * k.y), sinc(0.5 * k.z));
  let w = s.x * s.x * s.y * s.y * s.z * s.z;   // CIC window Π sinc²(k/2)
  let green = -P.pois / (k2 * w * w) * exp(-k2 * P.rsm * P.rsm);
  cx[i] = cx[i] * green;
}

// Acceleration on the mesh, g = −∇φ, with a 4-point finite difference.
@compute @workgroup_size(256)
fn grad(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.n) { return; }
  let c = coords(i) + vec3u(P.ng);   // offset so c − 2 never underflows
  var a = vec3f(0.0);
  for (var ax = 0u; ax < 3u; ax++) {
    var e = vec3u(0u);
    e[ax] = 1u;
    let p1 = cx[idx(c + e)].x;
    let m1 = cx[idx(c - e)].x;
    let p2 = cx[idx(c + 2u * e)].x;
    let m2 = cx[idx(c - 2u * e)].x;
    a[ax] = -(8.0 * (p1 - m1) - (p2 - m2)) / 12.0;
  }
  frc[i] = vec4f(a * P.invN, 0.0);
}

// Kick: p += g(x) Δ, with g interpolated by the same CIC kernel (so no self-force).
@compute @workgroup_size(256)
fn kick(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.np) { return; }
  let x = pos[i].xyz;
  let f0 = floor(x);
  let f = x - f0;
  let b = vec3u(f0);
  var acc = vec3f(0.0);
  for (var o = 0u; o < 8u; o++) {
    let d = vec3u(o & 1u, (o >> 1u) & 1u, o >> 2u);
    let w3 = select(1.0 - f, f, d == vec3u(1u));
    acc += frc[idx(b + d)].xyz * (w3.x * w3.y * w3.z);
  }
  vel[i] = vec4f(vel[i].xyz + acc * P.kick, 0.0);
}

// Drift: x += p Δ (periodic wrap).
@compute @workgroup_size(256)
fn drift(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.np) { return; }
  pos[i] = vec4f(wrap(pos[i].xyz + vel[i].xyz * P.drift), 0.0);
}
