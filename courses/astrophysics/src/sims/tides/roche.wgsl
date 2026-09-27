// Chapter 9 flagship: a rubble-pile moon near a planet.
// Self-gravity is a direct O(N^2) sum (a few thousand grains), tiled through workgroup memory,
// softened at short range and with a soft-sphere contact (spring + normal damping) so grains
// don't overlap. The planet's gravity is exact (not linearised), so the same code shows both the
// far-field tidal stretch and a full disruption. Everything runs in the planet's (inertial,
// non-rotating) frame.

struct Particle {
  pos: vec2<f32>,
  vel: vec2<f32>,
};

struct Params {
  GMp: f32, Rp: f32, dRoche: f32, eps2: f32,      // planet GM, radius, fluid Roche radius, softening^2
  Gm: f32, dt: f32, n: f32, grainR: f32,          // per-grain Gm, full step dt, grain count, contact radius
  kSpring: f32, kDamp: f32, viewHalf: f32, aspect: f32,
  dotPx: f32, heightPx: f32, dRigid: f32, pad: f32,
};

@group(0) @binding(0) var<storage, read> pIn: array<Particle>;
@group(0) @binding(1) var<storage, read_write> pOut: array<Particle>;
@group(0) @binding(2) var<storage, read_write> accel: array<vec2<f32>>;
@group(0) @binding(3) var<uniform> pr: Params;

const WG = 64u;
var<workgroup> tile: array<Particle, WG>;

fn hash(u: u32) -> f32 {
  var x = u * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  return f32((x >> 22u) ^ x) / 4294967295.0;
}

// Polydisperse grains (0.7–1.0 × grainR): mixed sizes can't lock into a crystal, so the pile
// flows more like loose rubble than a rigid lattice.
fn radius(i: u32) -> f32 { return pr.grainR * (0.7 + 0.3 * hash(i)); }


// ---- compute: acceleration on every grain from the planet + all other grains ----
@compute @workgroup_size(WG)
fn csAccel(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let i = gid.x;
  let n = u32(pr.n);
  let me = pIn[min(i, n - 1u)];
  let ri = me.pos;

  // Planet's exact (not linearised) gravity, planet fixed at the origin.
  let rp = length(ri);
  var a = -pr.GMp * ri / (rp * rp * rp + 1e-6);

  // Pairwise self-gravity + soft-sphere contacts, one 64-grain tile at a time.
  for (var t = 0u; t < n; t = t + WG) {
    var q = pIn[min(t + lid.x, n - 1u)];
    if (length(q.pos) < pr.Rp) { q.pos = vec2(1e6, 1e6); } // absorbed grains no longer interact
    tile[lid.x] = q;
    workgroupBarrier();
    let cnt = min(WG, n - t);
    for (var k = 0u; k < cnt; k = k + 1u) {
      if (t + k == i) { continue; }
      let d = tile[k].pos - ri;
      let r2 = dot(d, d);
      let s2 = r2 + pr.eps2;
      a = a + pr.Gm * d / (s2 * sqrt(s2));
      // Contact: once grains overlap, a spring pushes them apart and a dashpot damps their
      // approach speed along the normal (a crude soft-sphere collision, not a rigid-body one).
      let overlap = radius(i) + radius(t + k) - sqrt(r2);
      if (overlap > 0.0 && r2 > 1e-12) {
        let nrm = d * inverseSqrt(r2);
        a = a - (pr.kSpring * overlap - pr.kDamp * dot(tile[k].vel - me.vel, nrm)) * nrm;
      }
    }
    workgroupBarrier();
  }
  if (i < n) { accel[i] = a; }
}

// ---- compute: half-kick (velocity += a * dt/2) ----
@compute @workgroup_size(WG)
fn csKick(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u32(pr.n)) { return; }
  // Grains that have hit the planet stay where they landed (absorbed, and no longer drawn).
  let absorbed = length(pIn[i].pos) < pr.Rp;
  pOut[i].vel = select(pIn[i].vel + accel[i] * (0.5 * pr.dt), vec2(0.0), absorbed);
  pOut[i].pos = pIn[i].pos;
}

// ---- compute: drift (position += v * dt) ----
@compute @workgroup_size(WG)
fn csDrift(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u32(pr.n)) { return; }
  let absorbed = length(pIn[i].pos) < pr.Rp;
  pOut[i].pos = select(pIn[i].pos + pIn[i].vel * pr.dt, pIn[i].pos, absorbed);
  pOut[i].vel = select(pIn[i].vel, vec2(0.0), absorbed);
}

// ---- render: background (planet disk + Roche rings), one big triangle ----
struct VOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) world: vec2<f32>,
};

@vertex
fn vsBg(@builtin(vertex_index) vi: u32) -> VOut {
  var p = array<vec2<f32>, 3>(vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  var o: VOut;
  o.clip = vec4(p[vi], 0.0, 1.0);
  o.world = vec2(p[vi].x * pr.viewHalf * pr.aspect, p[vi].y * pr.viewHalf);
  return o;
}

@fragment
fn fsBg(in: VOut) -> @location(0) vec4<f32> {
  let r = length(in.world);
  let px = 2.0 * pr.viewHalf / pr.heightPx; // world units per pixel
  var col = vec4(0.0, 0.0, 0.0, 0.0);
  // Planet disk, limb-darkened, with a soft terminator toward the lower left.
  let edge = clamp((pr.Rp - r) / px, 0.0, 1.0);
  if (edge > 0.0) {
    let mu = sqrt(max(0.0, 1.0 - (r / pr.Rp) * (r / pr.Rp)));
    let lit = 0.35 + 0.65 * clamp(0.6 + 0.5 * dot(in.world / pr.Rp, vec2(0.6, 0.5)), 0.0, 1.0);
    let base = vec3(0.32, 0.46, 0.66) * (0.55 + 0.45 * mu) * lit;
    col = vec4(base * edge, edge);
  }
  // Roche limits, dashed by angle: fluid (red) and rigid (fainter).
  let ang = atan2(in.world.y, in.world.x);
  if (abs(r - pr.dRoche) < 0.9 * px && fract(ang * 24.0 / 6.2831853) > 0.45) {
    col = vec4(0.88, 0.36, 0.30, 1.0);
  }
  if (abs(r - pr.dRigid) < 0.7 * px && fract(ang * 36.0 / 6.2831853) > 0.6) {
    col = vec4(0.88, 0.36, 0.30, 1.0) * 0.55;
  }
  return col;
}

// ---- render: grains as small shaded dots (premultiplied "over" blending) ----
struct PVOut {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) tone: vec3<f32>,
};

@vertex
fn vsPts(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PVOut {
  var corner = array<vec2<f32>, 6>(
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0));
  let c = corner[vi];
  let px = 2.0 * pr.viewHalf / pr.heightPx;
  let sizeWorld = max(1.15 * radius(ii), pr.dotPx * px);
  let hidden = length(pIn[ii].pos) < pr.Rp;
  let world = pIn[ii].pos + c * select(sizeWorld, 0.0, hidden);
  var o: PVOut;
  o.clip = vec4(world.x / (pr.viewHalf * pr.aspect), world.y / pr.viewHalf, 0.0, 1.0);
  o.uv = c;
  // Rock tones: grey-brown with per-grain variation.
  let h = hash(ii);
  o.tone = mix(vec3(0.50, 0.45, 0.40), vec3(0.86, 0.80, 0.70), h);
  return o;
}

@fragment
fn fsPts(in: PVOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  let a = clamp((1.0 - d) * 3.0, 0.0, 1.0);
  let shade = 1.0 - 0.35 * d + 0.15 * (in.uv.y - in.uv.x) * 0.5;
  return vec4(in.tone * shade * a, a);
}
