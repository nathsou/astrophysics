// Monte Carlo radiative transfer: photon packets random-walking out of a plane-parallel slab.
// Units: length in mean free paths (ℓ = 1), so tau = L/ℓ is the slab's optical depth.
// Boundary at z = 0 is the surface (escape); z = tau is the deep interior (reflecting).

struct Params {
  tau: f32,
  albedo: f32,
  seed: u32,
  substeps: u32,
  n: u32,
  tScale: f32,     // histogram time-axis scale (path length in ℓ units)
  _pad0: f32,
  _pad1: f32,
};

struct Photon {
  x: f32,
  z: f32,
  mu: f32,
  t: f32,
  state: u32,   // 0 = absorbed, 1 = active, 2 = escaped
  rng: u32,
  _pad0: u32,
  _pad1: u32,
};

const NBUCKETS: u32 = 64u;

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> photons: array<Photon>;
@group(0) @binding(2) var<storage, read_write> muHist: array<atomic<u32>, NBUCKETS>;
@group(0) @binding(3) var<storage, read_write> tHist: array<atomic<u32>, NBUCKETS>;
@group(0) @binding(4) var<storage, read_write> counters: array<atomic<u32>, 4>; // active, escaped, absorbed, totalSteps

fn pcg_next(s: u32) -> u32 {
  var state = s * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
fn rnd(rng: ptr<function, u32>) -> f32 {
  *rng = pcg_next(*rng);
  return f32(*rng) * (1.0 / 4294967296.0);
}

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= P.n) { return; }
  var ph = photons[i];
  if (ph.state != 1u) { return; }
  var rng = ph.rng ^ P.seed;
  var steps = 0u;
  loop {
    if (steps >= P.substeps || ph.state != 1u) { break; }
    steps = steps + 1u;
    let u1 = max(rnd(&rng), 1e-8);
    let s = -log(u1); // path length in units of ell
    let u2 = rnd(&rng);
    let u3 = rnd(&rng);
    let cosT = 1.0 - 2.0 * u2;
    let phi = 6.2831853 * u3;
    let sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
    let dirz = cosT;
    let dirx = sinT * cos(phi);
    let newz = ph.z + s * dirz;
    if (newz <= 0.0) {
      // escapes through the surface: find the fraction of the step that reaches z=0
      let frac = select(1.0, ph.z / (-s * dirz), dirz < 0.0);
      ph.t = ph.t + s * frac;
      ph.mu = -dirz; // cosine of the exit angle from the surface normal
      ph.x = ph.x + s * frac * dirx;
      ph.z = 0.0;
      ph.state = 2u;
      atomicAdd(&counters[1], 1u);
      atomicSub(&counters[0], 1u);
      let tb = min(NBUCKETS - 1u, u32(clamp(ph.t / P.tScale, 0.0, 1.0) * f32(NBUCKETS)));
      let mb = min(NBUCKETS - 1u, u32(clamp(ph.mu, 0.0, 1.0) * f32(NBUCKETS)));
      atomicAdd(&tHist[tb], 1u);
      atomicAdd(&muHist[mb], 1u);
      break;
    }
    var z2 = newz;
    var x2 = ph.x + s * dirx;
    if (z2 >= P.tau) {
      z2 = 2.0 * P.tau - z2; // reflect at the deep, optically-thick base
    }
    ph.t = ph.t + s;
    if (rnd(&rng) > P.albedo) {
      ph.state = 0u; // thermalised: absorbed
      atomicAdd(&counters[2], 1u);
      atomicSub(&counters[0], 1u);
      break;
    }
    ph.x = x2;
    ph.z = z2;
    ph.mu = dirz;
  }
  atomicAdd(&counters[3], steps);
  ph.rng = rng;
  photons[i] = ph;
}
