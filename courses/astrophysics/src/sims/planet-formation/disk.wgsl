// Planet-formation disk: heliocentric Kepler-drift + kick (Wisdom–Holman-style) integrator.
// Units: AU, yr, M☉, so G = 4π² and a 1 AU circular orbit has v = 2π AU/yr.
//
// Buffers
//   particles: 2 vec4 per planetesimal: [x y z a0] [vx vy vz alive]   (a0 = formation radius → composition)
//   bodies:    2 vec4 per massive body:  [x y z m ] [vx vy vz alive]   (slots 0,1 = giant planets)
//   aux:       1 vec4 per body:          [iceMass, collisionRadius, isGiant, 0]
//   counts:    2 atomic u32 per body: rocky / icy planetesimals accreted this step
//   glob:      indirect acceleration + counters

const G: f32 = 39.47841760435743;      // 4π²  (AU³ M☉⁻¹ yr⁻²); star mass = 1 M☉ so GM = G
const NB: u32 = 256u;                  // body slots (= workgroup size)

struct Params {
  dt: f32,
  nParticles: u32,
  nBodies: u32,
  drag: f32,        // 1 = gas present
  eta: f32,         // fractional sub-Keplerian headwind of the gas
  stP: f32,         // Stokes number of planetesimals (Ω t_stop)
  stB: f32,         // effective damping "Stokes number" for embryos (tidal damping stand-in)
  mParticle: f32,   // mass of one planetesimal tracer (M☉)
  snow: f32,        // snow line (AU)
  rIn: f32,         // inner removal radius (AU)
  rOut: f32,        // outer removal radius (AU)
  inflate: f32,     // collision-radius inflation factor for embryos
};

struct Glob {
  ind: vec4f,              // indirect acceleration (reflex of the star), xyz
  dead: atomic<u32>,       // planetesimals lost (star / ejected)
  eaten: atomic<u32>,      // planetesimals accreted by bodies
  merges: atomic<u32>,     // body–body mergers
  pad: u32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> bodies: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> aux: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read_write> glob: Glob;

// ---------------------------------------------------------------- Kepler drift
struct PV { r: vec3f, v: vec3f };

// Advance a heliocentric Kepler orbit by dt exactly, with Gauss f and g functions.
// Solves the *difference* form of Kepler's equation for ΔE, which stays well conditioned
// in f32 because we never form the absolute mean anomaly.
fn kepler(r0: vec3f, v0: vec3f, dt: f32) -> PV {
  let r = length(r0);
  let alpha = 2.0 / r - dot(v0, v0) / G;          // 1/a  (vis-viva)
  if (alpha < 0.02) {                              // unbound or a > 50 AU: leaving anyway
    return PV(r0 + v0 * dt, v0);
  }
  let a = 1.0 / alpha;
  let n = sqrt(G * alpha * alpha * alpha);         // mean motion
  let ec = 1.0 - r * alpha;                        // e cos E0
  let es = dot(r0, v0) / (n * a * a);              // e sin E0
  let dM = n * dt;
  var x = dM;                                      // ΔE, Newton from ΔM
  for (var k = 0; k < 6; k++) {
    let s = sin(x);
    let omc = 2.0 * sin(0.5 * x) * sin(0.5 * x);   // 1 − cos x without cancellation
    let f = x - ec * s + es * omc - dM;
    x -= f / (1.0 - ec * (1.0 - omc) + es * s);
  }
  let s = sin(x);
  let omc = 2.0 * sin(0.5 * x) * sin(0.5 * x);
  let x2 = x * x;                                  // x − sin x by series when small (f32!)
  let xms = select(x - s, x * x2 * (1.0 / 6.0 - x2 * (1.0 / 120.0 - x2 / 5040.0)), abs(x) < 0.25);
  let f = 1.0 - (a / r) * omc;
  let g = dt - xms / n;
  let r1v = f * r0 + g * v0;
  let r1 = length(r1v);
  let fd = -a * a * n * s / (r * r1);
  let gd = 1.0 - (a / r1) * omc;
  return PV(r1v, fd * r0 + gd * v0);
}

// ---------------------------------------------------------------- gas drag
// Gas orbits at v_K (1 − η) in the midplane. The relative velocity relaxes exponentially on
// the stopping time t_s = St / Ω, which is unconditionally stable for any dt.
fn gasDrag(p: vec3f, v: vec3f, st: f32, dt: f32) -> vec3f {
  let R = max(length(p.xy), 1e-3);
  let vk = sqrt(G / R);
  let omega = vk / R;
  let vgas = vec3f(-p.y, p.x, 0.0) / R * vk * (1.0 - P.eta);
  return vgas + (v - vgas) * exp(-dt * omega / st);
}

// ---------------------------------------------------------------- shared staging
var<workgroup> tPos: array<vec4f, NB>;     // xyz, G·m (0 if dead)
var<workgroup> tRad: array<f32, NB>;

fn stageBodies(li: u32) {
  var b = vec4f(0.0);
  var R = 0.0;
  if (li < P.nBodies) {
    let p = bodies[2u * li];
    let alive = bodies[2u * li + 1u].w;
    b = vec4f(p.xyz, G * p.w * alive);
    R = aux[li].y * alive;
  }
  tPos[li] = b;
  tRad[li] = R;
}

// ---------------------------------------------------------------- kicks
@compute @workgroup_size(256)
fn kickParticles(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) li: u32) {
  stageBodies(li);
  workgroupBarrier();
  let i = gid.x;
  if (i >= P.nParticles) { return; }
  var v = particles[2u * i + 1u];
  if (v.w == 0.0) { return; }
  let p = particles[2u * i];

  var acc = glob.ind.xyz;              // the star is accelerated by the bodies: indirect term
  var hit = -1;
  for (var j = 0u; j < P.nBodies; j++) {
    let b = tPos[j];
    let d = b.xyz - p.xyz;
    let r2 = dot(d, d);
    let R = tRad[j];
    if (r2 < R * R) { hit = i32(j); }  // inside an embryo's (inflated) radius: accreted
    let inv = inverseSqrt(r2 + 1e-9);
    acc += d * (b.w * inv * inv * inv);
  }
  if (hit >= 0) {
    let icy = select(0u, 1u, p.w > P.snow);
    atomicAdd(&counts[2u * u32(hit) + icy], 1u);
    atomicAdd(&glob.eaten, 1u);
    particles[2u * i + 1u] = vec4f(v.xyz, 0.0);
    return;
  }
  var vel = v.xyz + acc * P.dt;
  if (P.drag > 0.5) { vel = gasDrag(p.xyz, vel, P.stP, P.dt); }
  particles[2u * i + 1u] = vec4f(vel, 1.0);
}

@compute @workgroup_size(256)
fn kickBodies(@builtin(local_invocation_index) i: u32) {
  stageBodies(i);
  workgroupBarrier();
  if (i >= P.nBodies) { return; }
  let v = bodies[2u * i + 1u];
  if (v.w == 0.0) { return; }
  let p = tPos[i];
  var acc = glob.ind.xyz;
  for (var j = 0u; j < P.nBodies; j++) {
    if (j == i) { continue; }
    let d = tPos[j].xyz - p.xyz;
    let inv = inverseSqrt(dot(d, d) + 1e-10);
    acc += d * (tPos[j].w * inv * inv * inv);
  }
  var vel = v.xyz + acc * P.dt;
  if (P.drag > 0.5 && aux[i].z < 0.5) { vel = gasDrag(p.xyz, vel, P.stB, P.dt); }
  bodies[2u * i + 1u] = vec4f(vel, 1.0);
}

// ---------------------------------------------------------------- drifts
@compute @workgroup_size(256)
fn driftParticles(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.nParticles) { return; }
  let v = particles[2u * i + 1u];
  if (v.w == 0.0) { return; }
  let p = particles[2u * i];
  let s = kepler(p.xyz, v.xyz, P.dt);
  let r = length(s.r);
  if (!(r > P.rIn && r < P.rOut)) {            // also catches NaN
    particles[2u * i + 1u] = vec4f(0.0);
    atomicAdd(&glob.dead, 1u);
    return;
  }
  particles[2u * i] = vec4f(s.r, p.w);
  particles[2u * i + 1u] = vec4f(s.v, 1.0);
}

@compute @workgroup_size(256)
fn driftBodies(@builtin(local_invocation_index) i: u32) {
  if (i >= P.nBodies) { return; }
  let v = bodies[2u * i + 1u];
  if (v.w == 0.0) { return; }
  let p = bodies[2u * i];
  let s = kepler(p.xyz, v.xyz, P.dt);
  let r = length(s.r);
  if (!(r > P.rIn && r < P.rOut)) {
    bodies[2u * i + 1u] = vec4f(0.0);
    return;
  }
  bodies[2u * i] = vec4f(s.r, p.w);
  bodies[2u * i + 1u] = vec4f(s.v, 1.0);
}

// ---------------------------------------------------------------- accretion, merging, indirect term
var<workgroup> sPos: array<vec4f, NB>;    // xyz, m (0 = dead)
var<workgroup> sVel: array<vec4f, NB>;    // v, iceMass
var<workgroup> sR: array<f32, NB>;
var<workgroup> sPartner: array<i32, NB>;
var<workgroup> sInd: array<vec3f, NB>;

// Physical radius (AU) of a body of mass m (M☉) and bulk density rho (g cm⁻³).
fn physRadius(m: f32, rho: f32) -> f32 { return 5.21e-3 * pow(m / rho, 1.0 / 3.0); }

fn collisionRadius(i: u32, m: f32, ice: f32) -> f32 {
  if (aux[i].z > 0.5) { return 3.0 * physRadius(m, 1.3); }   // giants: modest inflation
  let rho = mix(3.3, 1.6, clamp(ice / max(m, 1e-20), 0.0, 1.0));
  return P.inflate * physRadius(m, rho);
}

@compute @workgroup_size(256)
fn finish(@builtin(local_invocation_index) i: u32) {
  // 1. Fold this step's accreted planetesimals into their bodies (perfect sticking).
  var p = vec4f(0.0);
  var v = vec4f(0.0);
  if (i < P.nBodies) {
    p = bodies[2u * i];
    v = bodies[2u * i + 1u];
    let nRock = atomicExchange(&counts[2u * i], 0u);
    let nIce = atomicExchange(&counts[2u * i + 1u], 0u);
    if (v.w > 0.5) {
      p.w += f32(nRock + nIce) * P.mParticle;
      v.w = aux[i].x + f32(nIce) * P.mParticle;       // v.w now carries ice mass
    } else {
      p.w = 0.0;
    }
  }
  sPos[i] = p;
  sVel[i] = v;
  sR[i] = select(0.0, collisionRadius(i, p.w, v.w), p.w > 0.0);
  workgroupBarrier();

  // 2. Each body looks for the first overlapping partner above it (O(N²/2), N ≤ 256).
  var partner = -1;
  if (sPos[i].w > 0.0) {
    for (var j = i + 1u; j < P.nBodies; j++) {
      let d = sPos[j].xyz - sPos[i].xyz;
      let rr = sR[i] + sR[j];
      if (sPos[j].w > 0.0 && dot(d, d) < rr * rr) { partner = i32(j); break; }
    }
  }
  sPartner[i] = partner;
  workgroupBarrier();

  // 3. One thread resolves the (rare) collisions serially: no races, exact momentum conservation.
  if (i == 0u) {
    for (var k = 0u; k < P.nBodies; k++) {
      let jj = sPartner[k];
      if (jj < 0) { continue; }
      let j = u32(jj);
      let mk = sPos[k].w;
      let mj = sPos[j].w;
      if (mk == 0.0 || mj == 0.0) { continue; }
      let m = mk + mj;
      let keep = select(j, k, mk >= mj);               // the heavier slot survives (giants keep theirs)
      let gone = select(k, j, mk >= mj);
      sPos[keep] = vec4f((sPos[k].xyz * mk + sPos[j].xyz * mj) / m, m);
      sVel[keep] = vec4f((sVel[k].xyz * mk + sVel[j].xyz * mj) / m, sVel[k].w + sVel[j].w);
      sPos[gone] = vec4f(0.0);
      atomicAdd(&glob.merges, 1u);
    }
  }
  workgroupBarrier();

  // 4. Write back and accumulate the indirect term  a_ind = −Σ G m_j r_j / r_j³.
  var ind = vec3f(0.0);
  if (i < P.nBodies) {
    let q = sPos[i];
    let alive = q.w > 0.0;
    bodies[2u * i] = q;
    bodies[2u * i + 1u] = vec4f(sVel[i].xyz, select(0.0, 1.0, alive));
    aux[i] = vec4f(sVel[i].w, select(0.0, collisionRadius(i, q.w, sVel[i].w), alive), aux[i].z, 0.0);
    if (alive) {
      let r = length(q.xyz);
      ind = -G * q.w * q.xyz / (r * r * r);
    }
  }
  sInd[i] = ind;
  workgroupBarrier();
  for (var s = NB / 2u; s > 0u; s >>= 1u) {
    if (i < s) { sInd[i] += sInd[i + s]; }
    workgroupBarrier();
  }
  if (i == 0u) { glob.ind = vec4f(sInd[0], 0.0); }
}
