// Chapter 9 flagship: a rubble-pile moon/comet near a planet.
// Self-gravity is a direct O(N^2) sum (a few thousand particles), softened at short range and
// with a simple soft-sphere repulsion so grains don't overlap. The planet's gravity is exact
// (not linearised), so the same code shows both the far-field tidal stretch and a close, fully
// disruptive passage. Everything runs in the planet's (inertial, non-rotating) frame.

struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
};

struct Params {
  GMp: f32, Rp: f32, dRoche: f32, eps2: f32,      // planet GM, radius, fluid Roche radius, softening^2
  Gm: f32, dt: f32, n: f32, grainR: f32,          // per-particle Gm, kick dt, particle count, contact radius
  kSpring: f32, kDamp: f32, viewHalf: f32, aspect: f32,
  quadPx: f32, time: f32, comX: f32, comY: f32,
};

@group(0) @binding(0) var<storage, read> pIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> pOut: array<Particle>;
@group(0) @binding(2) var<storage, read_write> accel: array<vec2<f32>>;
@group(0) @binding(3) var<uniform> pr: Params;

const WG = 64u;

// ---- compute: acceleration on every particle from the planet + all other grains ----
@compute @workgroup_size(WG)
fn csAccel(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  let n = u32(pr.n);
  if (i >= n) { return; }
  let ri = pIn[i].pos;

  // Planet's exact (not linearised) gravity, planet fixed at the origin.
  let rp = length(ri);
  var a = -pr.GMp * ri / (rp * rp * rp + 1e-6);

  // Pairwise self-gravity + soft-sphere contact repulsion.
  for (var j = 0u; j < n; j = j + 1u) {
    if (j == i) { continue; }
    let d = pIn[j].pos - ri;
    let r2 = dot(d, d);
    let r = sqrt(r2);
    let invR3 = 1.0 / pow(r2 + pr.eps2, 1.5);
    a = a + pr.Gm * d * invR3;
    // Cohesion / collision: once grains overlap, push them apart and damp relative velocity
    // along the contact normal (a crude soft-sphere contact, not a real rigid-body collision).
    let overlap = 2.0 * pr.grainR - r;
    if (overlap > 0.0 && r > 1e-5) {
      let nrm = d / r;
      a = a - pr.kSpring * overlap * nrm;
      let relV = pIn[j].vel - pIn[i].vel;
      a = a - pr.kDamp * dot(relV, nrm) * nrm;
    }
  }
  accel[i] = a;
}

// ---- compute: half-kick (velocity += a * dt), dt carries the half-step already ----
@compute @workgroup_size(WG)
fn csKick(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u32(pr.n)) { return; }
  pOut[i].vel = pIn[i].vel + accel[i] * pr.dt;
  pOut[i].pos = pIn[i].pos;
}

// ---- compute: drift (position += v * dt) ----
@compute @workgroup_size(WG)
fn csDrift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u32(pr.n)) { return; }
  pOut[i].pos = pIn[i].pos + pIn[i].vel * pr.dt;
  pOut[i].vel = pIn[i].vel;
}

// ---- render: background (planet disk + Roche ring), one big triangle ----
struct VOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) world: vec2<f32>,
};

@vertex
fn vsBg(@builtin(vertex_index) vi: u32) -> VOut {
  // Oversized triangle covering the viewport in clip space.
  var p = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  var o: VOut;
  o.clip = vec4(p[vi], 0.0, 1.0);
  o.world = vec2(p[vi].x * pr.viewHalf * pr.aspect, p[vi].y * pr.viewHalf);
  return o;
}

@fragment
fn fsBg(in: VOut) -> @location(0) vec4<f32> {
  let r = length(in.world);
  var col = vec4(0.0, 0.0, 0.0, 0.0);
  // Planet disk, softly shaded.
  if (r < pr.Rp) {
    let shade = 0.55 + 0.45 * sqrt(max(0.0, 1.0 - (r / pr.Rp) * (r / pr.Rp)));
    col = vec4(0.30 * shade, 0.42 * shade, 0.58 * shade, 1.0);
  }
  // Roche limit ring (dashed by angle).
  let ringW = pr.viewHalf * 0.004;
  let ang = atan2(in.world.y, in.world.x);
  let dash = fract(ang * 10.0 / 6.2831853) > 0.5;
  if (abs(r - pr.dRoche) < ringW && dash) {
    col = vec4(0.85, 0.35, 0.30, 1.0);
  }
  return col;
}

// ---- render: particles as glowing additive quads ----
struct PVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) speed: f32,
};

@vertex
fn vsPts(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PVOut {
  var corner = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0));
  let c = corner[vi];
  let pos = pIn[ii].pos;
  let sizeWorld = pr.quadPx * pr.viewHalf / 400.0;
  let world = pos + c * sizeWorld;
  var o: PVOut;
  o.clip = vec4(world.x / (pr.viewHalf * pr.aspect), world.y / pr.viewHalf, 0.0, 1.0);
  o.uv = c;
  o.speed = length(pIn[ii].vel);
  return o;
}

@fragment
fn fsPts(in: PVOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  let glow = pow(max(0.0, 1.0 - d), 2.2);
  // Cool blue for slow grains, hot white for fast ones near periapsis.
  let t = clamp(in.speed / (0.6 * sqrt(pr.GMp / max(pr.Rp, 0.01))), 0.0, 1.0);
  let cool = vec3(0.45, 0.65, 1.0);
  let hot = vec3(1.0, 0.92, 0.75);
  let rgb = mix(cool, hot, t);
  return vec4(rgb * glow, glow);
}
