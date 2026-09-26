// Chapter 23 flagship: toy hierarchical galaxy assembly.
//
// Particle types (pos.w): 0 = dark matter, 1 = gas, 2 = star.
// Gravity: every particle feels the softened potential of the first `nsrc` particles
// ("sources", dark-matter particles that carry ALL the gravitating mass, baryons included).
// The same tile loop also measures a kernel-weighted local density, centroid, mean velocity
// and velocity dispersion of the sources, which drive the sub-grid gas model.
//
// Code units: G = 1, M = 1.5e12 Msun, L = 250 kpc  =>  t = 1.52 Gyr, v = 160.7 km/s.

struct Particle { pos: vec4f, vel: vec4f, aux: vec4f };
// vel.w : star birth time (code units) | gas decoupling timer (wind / AGN heated)
// aux   : x = log10 T, y = gas state (0 cold, 1 hot, 2 SN wind, 3 AGN-heated), z = local rho, w = t_cool/t_ff

struct Params {
  n: u32, nsrc: u32, step: u32, flags: u32,       // flags: bit0 cooling, bit1 AGN feedback
  dt: f32, time: f32, eps2: f32, h: f32,
  srcMass: f32, kernNorm: f32, sn: f32, tconv: f32,
  coolK: f32, tdep: f32, vwind: f32, tAgn: f32,
  rhoSF: f32, agnKick: f32, pad0: f32, pad1: f32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> src: array<Particle>;
@group(0) @binding(2) var<storage, read_write> dst: array<Particle>;
@group(0) @binding(3) var<storage, read_write> stats: array<atomic<u32>, 8>;

const WG: u32 = 256u;
const PI: f32 = 3.14159265;
var<workgroup> tilePos: array<vec4f, WG>;
var<workgroup> tileVel: array<vec4f, WG>;

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn rand(i: u32, salt: u32) -> f32 { return f32(pcg(i ^ pcg(P.step * 4u + salt))) * (1.0 / 4294967296.0); }

// Toy radiative cooling function Lambda(T) in units of 1e-22 erg cm^3 s^-1:
// nothing below ~1e4 K (hydrogen is neutral), a big H/He + metal-line peak near 2e5 K,
// a shoulder from O/Fe lines near 1e6 K, and free-free (bremsstrahlung) ~ sqrt(T) above that.
fn lambda22(lgT: f32) -> f32 {
  let cut = smoothstep(3.95, 4.3, lgT);
  let a = (lgT - 5.35) / 0.42;
  let b = (lgT - 6.0) / 0.45;
  let lines = 2.5 * exp(-a * a) + 0.5 * exp(-b * b) + 0.03;
  let brems = 1.4e-5 * sqrt(pow(10.0, lgT));
  return cut * lines + brems;
}

@compute @workgroup_size(256)
fn step(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) li: u32) {
  let i = gid.x;
  let alive = i < P.n;
  var p: Particle;
  if (alive) { p = src[i]; }
  let x = p.pos.xyz;

  // ---- O(N * nsrc) tiled gravity + kernel moments --------------------------------------
  var acc = vec3f(0.0);
  var wsum = 0.0;
  var wx = vec3f(0.0);
  var wv = vec3f(0.0);
  var wv2 = 0.0;
  let invh2 = 1.0 / (P.h * P.h);
  for (var base = 0u; base < P.nsrc; base += WG) {
    tilePos[li] = src[base + li].pos;          // nsrc is a multiple of WG
    tileVel[li] = src[base + li].vel;
    workgroupBarrier();
    for (var k = 0u; k < WG; k++) {
      let s = tilePos[k].xyz;
      let d = s - x;
      let d2 = dot(d, d);
      let ir = inverseSqrt(d2 + P.eps2);        // Plummer softening
      acc += d * (ir * ir * ir);
      let q2 = d2 * invh2;
      if (q2 < 1.0) {                            // compact kernel W = (1 - q^2)^2
        let w = (1.0 - q2) * (1.0 - q2);
        let vv = tileVel[k].xyz;
        wsum += w; wx += w * s; wv += w * vv; wv2 += w * dot(vv, vv);
      }
    }
    workgroupBarrier();
  }
  if (!alive) { return; }
  acc *= P.srcMass;

  var v = p.vel.xyz;
  var typ = u32(p.pos.w + 0.5);
  var velw = p.vel.w;
  var aux = p.aux;

  // ---- sub-grid gas physics -------------------------------------------------------------
  if (typ == 1u) {
    let rho = max(wsum * P.srcMass * P.kernNorm, 1e-3);   // total (DM + baryon) density
    var T = 1.0e4;                                         // photo-ionised IGM floor
    var xc = x;
    var vm = v;
    var sig2 = 0.0;
    if (wsum > 1.0) {
      xc = wx / wsum;
      vm = wv / wsum;
      sig2 = max(wv2 / wsum - dot(vm, vm), 0.0);
      T = max(T, P.tconv * sig2);                          // shock-heated to the virial temperature
    }
    let lgT = log2(T) * 0.30103;
    let tff = sqrt(3.0 * PI / (32.0 * rho));
    let tcool = P.coolK * T / (rho * lambda22(lgT));
    let cooling = (P.flags & 1u) != 0u;
    let agn = (P.flags & 2u) != 0u;
    velw = max(velw - P.dt, 0.0);                          // decoupling timer
    var state = 1.0;
    if (velw > 0.0) { state = aux.y; }                     // still a wind / heated particle
    var canCool = cooling && velw <= 0.0 && tcool < tff;   // Rees-Ostriker / Silk criterion
    // Radio-mode AGN: in halos hotter than tAgn the black hole keeps the hot atmosphere hot.
    let massive = agn && T > P.tAgn;
    if (massive && rho < P.rhoSF) { canCool = false; }

    let rv = x - xc;
    let rl = length(rv);
    let rh = select(vec3f(0.0, 0.0, 1.0), rv / max(rl, 1e-5), rl > 1e-4);
    if (canCool) {
      state = 0.0;
      // Radiative losses remove the *random* (radial + vertical) kinetic energy relative to
      // the local halo, on a free-fall time, while conserving the tangential (angular momentum)
      // component -> the gas settles into a rotating disk.
      let k = 1.0 - exp(-P.dt / tff);
      var vr = v - vm;
      vr -= k * dot(vr, rh) * rh;
      vr.z -= k * vr.z;
      v = vm + vr;
      if (rho > P.rhoSF) {
        let r = rand(i, 1u);
        let pSF = P.dt / P.tdep;                            // fixed depletion time
        let sigma = sqrt(max(sig2, 1e-4));
        let eta = min(P.sn / (sigma * sigma), 30.0);       // energy-driven mass loading ~ v^-2
        if (r < pSF) {
          typ = 2u; velw = P.time;                          // a star is born
        } else if (r < pSF * (1.0 + eta)) {
          // supernova-driven wind: fixed kick speed, hydrodynamically decoupled for ~150 Myr
          let up = select(-1.0, 1.0, rand(i, 2u) < 0.5);
          v += normalize(rh + vec3f(0.0, 0.0, 1.5 * up)) * P.vwind;
          velw = 0.1; state = 2.0;
        } else if (massive && rand(i, 3u) < P.dt * 3.0 / tff) {
          // quasar-mode AGN: bipolar kick along the spin axis
          let up = select(-1.0, 1.0, rh.z > 0.0);
          v += vec3f(0.3 * rh.x, 0.3 * rh.y, up) * P.agnKick;
          velw = 0.3; state = 3.0;
        }
      }
    }
    aux = vec4f(lgT, state, rho, tcool / tff);
  }

  // ---- kick-drift (leapfrog with velocities at half steps) -----------------------------
  v += acc * P.dt;
  let xn = x + v * P.dt;
  dst[i] = Particle(vec4f(xn, f32(typ)), vec4f(v, velw), aux);
}

// Diagnostic counters: 0 cold gas, 1 hot gas, 2 wind/heated gas, 3 stars,
// 4 stars within 0.12 (30 kpc) of the origin, 5 young stars (< 100 Myr), 6 cold gas within 0.12.
@compute @workgroup_size(256)
fn countStats(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  let p = src[i];
  let typ = u32(p.pos.w + 0.5);
  let central = length(p.pos.xyz) < 0.12;
  if (typ == 1u) {
    let st = u32(p.aux.y + 0.5);
    atomicAdd(&stats[min(st, 2u)], 1u);
    if (st == 0u && central) { atomicAdd(&stats[6], 1u); }
  } else if (typ == 2u) {
    atomicAdd(&stats[3], 1u);
    if (central) { atomicAdd(&stats[4], 1u); }
    if (P.time - p.vel.w < 0.0658) { atomicAdd(&stats[5], 1u); }
  }
}
