// Chapter 7 flagship: self-gravitating isothermal SPH with sink particles.
// Code units: G = 1, cloud mass = 1, cloud radius = 1.
//
// Buffers (one bind group shared by every kernel):
//   bodies[i] = (x, y, z, mass)   i < N: gas, N <= i < N + Smax: sinks (mass 0 = unused / accreted)
//   vel[i]    = (vx, vy, vz, h)   h = smoothing length (gas only)
//   acc[i]    = (ax, ay, az, 0)
//   aux[i]    = (rho, -, hashBits, rankBits) for gas in original order
//   grid      = bucket counts -> exclusive prefix sums (T entries) + T/1024 block sums
//   sorted[k] = gas particles copied into bucket order for coherent neighbour loops
//   st        = scalars (dt, time, sink count, candidates) + fixed-point sink accretion accumulators

struct Params {
  N: u32, NB: u32, T: u32, Smax: u32,
  cell: f32, invCell: f32, m: f32, cs2: f32,
  rhoCrit: f32, rhoSink: f32, hmin: f32, hmax: f32,
  eta: f32, eps2: f32, racc: f32, dtmax: f32,
  alpha: f32, beta: f32, cfl: f32, dtmin: f32,
};

struct Sorted { posh: vec4f, vel: vec4f, dens: vec4f };

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> bodies: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> acc: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> aux: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> grid: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> sorted: array<Sorted>;
@group(0) @binding(7) var<storage, read_write> st: array<atomic<u32>>;

const PI = 3.14159265;
const S_DTMIN = 0u; const S_DT = 1u; const S_TIME = 2u; const S_SINKS = 3u; const S_NCAND = 4u; const S_STEPS = 5u;
const CAND0 = 16u; const CMAX = 32u; const ACC0 = 64u;
const SM = 1073741824.0;   // 2^30: fixed-point scale for accreted mass
const SP = 134217728.0;    // 2^27: fixed-point scale for m·Δx and m·Δv

fn cellOf(p: vec3f) -> vec3i { return vec3i(floor(p * P.invCell)); }
fn hashCell(c: vec3i) -> u32 {
  let u = bitcast<vec3u>(c);
  // bucket T-1 is reserved for dead (accreted) particles, so live cells hash into [0, T-2]
  return ((u.x * 73856093u) ^ (u.y * 19349663u) ^ (u.z * 83492791u)) % (P.T - 1u);
}
fn bucketEnd(b: u32) -> u32 { if (b + 1u < P.T) { return atomicLoad(&grid[b + 1u]); } return P.N; }

// M4 cubic spline, support 2h
fn W(r: f32, h: f32) -> f32 {
  let q = r / h; let s = 1.0 / (PI * h * h * h);
  if (q < 1.0) { return s * (1.0 - 1.5 * q * q + 0.75 * q * q * q); }
  if (q < 2.0) { let t = 2.0 - q; return s * 0.25 * t * t * t; }
  return 0.0;
}
fn dWdr(r: f32, h: f32) -> f32 {
  let q = r / h; let s = 1.0 / (PI * h * h * h * h);
  if (q < 1.0) { return s * (-3.0 * q + 2.25 * q * q); }
  if (q < 2.0) { let t = 2.0 - q; return -s * 0.75 * t * t; }
  return 0.0;
}
// Barotropic EOS: isothermal, stiffening to gamma = 5/3 above rhoCrit (a stand-in for the opacity limit)
fn stiff(rho: f32) -> f32 { return pow(rho / P.rhoCrit, 2.0 / 3.0); }
fn pressure(rho: f32) -> f32 { return rho * P.cs2 * (1.0 + stiff(rho)); }
fn soundSpeed(rho: f32) -> f32 { return sqrt(P.cs2 * (1.0 + 5.0 / 3.0 * stiff(rho))); }

// ---------------- neighbour grid: counting sort by spatial hash ----------------

@compute @workgroup_size(256)
fn clearGrid(@builtin(global_invocation_id) g: vec3u) {
  if (g.x < P.T) { atomicStore(&grid[g.x], 0u); }
}

@compute @workgroup_size(128)
fn countCells(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.N) { return; }
  let b = bodies[i];
  var hsh = P.T - 1u;
  if (b.w > 0.0) { hsh = hashCell(cellOf(b.xyz)); }
  let rank = atomicAdd(&grid[hsh], 1u);
  let a = aux[i];
  aux[i] = vec4f(a.x, a.y, bitcast<f32>(hsh), bitcast<f32>(rank));
}

var<workgroup> scanTmp: array<u32, 256>;

// Pass A: each workgroup scans 1024 buckets (4 per thread), writes exclusive prefixes and its block total.
@compute @workgroup_size(256)
fn scanBlocks(@builtin(local_invocation_id) l: vec3u, @builtin(workgroup_id) w: vec3u) {
  let base = w.x * 1024u + l.x * 4u;
  var v: array<u32, 4>;
  var sum = 0u;
  for (var k = 0u; k < 4u; k++) { v[k] = atomicLoad(&grid[base + k]); sum += v[k]; }
  scanTmp[l.x] = sum;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off *= 2u) {          // Hillis–Steele inclusive scan
    var add = 0u;
    if (l.x >= off) { add = scanTmp[l.x - off]; }
    workgroupBarrier();
    scanTmp[l.x] += add;
    workgroupBarrier();
  }
  var run = scanTmp[l.x] - sum;                          // exclusive offset of this thread
  for (var k = 0u; k < 4u; k++) { atomicStore(&grid[base + k], run); run += v[k]; }
  if (l.x == 255u) { atomicStore(&grid[P.T + w.x], scanTmp[255]); }
}

// Pass B: one workgroup scans the T/1024 block totals (T = 65536 -> 64 blocks).
@compute @workgroup_size(64)
fn scanTotals(@builtin(local_invocation_id) l: vec3u) {
  let nb = P.T / 1024u;
  var s = 0u;
  if (l.x < nb) { s = atomicLoad(&grid[P.T + l.x]); }
  scanTmp[l.x] = s;
  workgroupBarrier();
  for (var off = 1u; off < 64u; off *= 2u) {
    var add = 0u;
    if (l.x >= off) { add = scanTmp[l.x - off]; }
    workgroupBarrier();
    scanTmp[l.x] += add;
    workgroupBarrier();
  }
  if (l.x < nb) { atomicStore(&grid[P.T + l.x], scanTmp[l.x] - s); }
}

// Pass C: add block offsets -> grid[b] = first sorted slot of bucket b.
@compute @workgroup_size(256)
fn scanAdd(@builtin(global_invocation_id) g: vec3u) {
  if (g.x < P.T) { atomicAdd(&grid[g.x], atomicLoad(&grid[P.T + g.x / 1024u])); }
}

@compute @workgroup_size(128)
fn scatter(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.N) { return; }
  let a = aux[i];
  let dst = atomicLoad(&grid[bitcast<u32>(a.z)]) + bitcast<u32>(a.w);
  let v = vel[i];
  sorted[dst].posh = vec4f(bodies[i].xyz, v.w);
  sorted[dst].vel = vec4f(v.xyz, bitcast<f32>(i));
}

// ---------------- SPH ----------------

@compute @workgroup_size(64)
fn density(@builtin(global_invocation_id) g: vec3u) {
  let k = g.x;
  if (k >= P.N) { return; }
  let s = sorted[k];
  let idx = bitcast<u32>(s.vel.w);
  if (bodies[idx].w == 0.0) { sorted[k].dens = vec4f(0.0); return; }
  let x = s.posh.xyz; let h = s.posh.w;
  let lo = cellOf(x - vec3f(2.0 * h));
  let hi = min(cellOf(x + vec3f(2.0 * h)), lo + vec3i(6));
  var rho = 0.0;
  for (var cz = lo.z; cz <= hi.z; cz++) {
    for (var cy = lo.y; cy <= hi.y; cy++) {
      for (var cx = lo.x; cx <= hi.x; cx++) {
        let c = vec3i(cx, cy, cz);
        let b = hashCell(c);
        let end = bucketEnd(b);
        for (var j = atomicLoad(&grid[b]); j < end; j++) {
          let pj = sorted[j].posh.xyz;
          if (any(cellOf(pj) != c)) { continue; }        // hash collision: a different cell
          let r = distance(x, pj);
          if (r < 2.0 * h) { rho += P.m * W(r, h); }
        }
      }
    }
  }
  sorted[k].dens = vec4f(rho, pressure(rho) / (rho * rho), soundSpeed(rho), 0.0);
  let a = aux[idx];
  aux[idx] = vec4f(rho, a.yzw);
  let v = vel[idx];
  let hNew = clamp(P.eta * pow(P.m / rho, 1.0 / 3.0), P.hmin, P.hmax);
  vel[idx] = vec4f(v.xyz, hNew);
}

@compute @workgroup_size(64)
fn forces(@builtin(global_invocation_id) g: vec3u) {
  let k = g.x;
  if (k >= P.N) { return; }
  let s = sorted[k];
  let idx = bitcast<u32>(s.vel.w);
  if (bodies[idx].w == 0.0) { return; }
  let xi = s.posh.xyz; let hi = s.posh.w; let vi = s.vel.xyz;
  let rhoi = s.dens.x; let Pi = s.dens.y; let ci = s.dens.z;
  let lo = cellOf(xi - vec3f(2.0 * hi));
  let up = min(cellOf(xi + vec3f(2.0 * hi)), lo + vec3i(6));
  var a = vec3f(0.0);
  var divv = 0.0;
  var vsig = ci;
  var isMax = true;
  for (var cz = lo.z; cz <= up.z; cz++) {
    for (var cy = lo.y; cy <= up.y; cy++) {
      for (var cx = lo.x; cx <= up.x; cx++) {
        let c = vec3i(cx, cy, cz);
        let b = hashCell(c);
        let end = bucketEnd(b);
        for (var j = atomicLoad(&grid[b]); j < end; j++) {
          if (j == k) { continue; }
          let sj = sorted[j];
          if (any(cellOf(sj.posh.xyz) != c)) { continue; }
          let dx = xi - sj.posh.xyz;
          let r = length(dx);
          let hbar = 0.5 * (hi + sj.posh.w);
          if (r >= 2.0 * hbar || r < 1e-7) { continue; }
          if (r < 2.0 * hi && sj.dens.x > rhoi) { isMax = false; }
          let dv = vi - sj.vel.xyz;
          let vr = dot(dv, dx);
          var visc = 0.0;
          if (vr < 0.0) {                                   // Monaghan artificial viscosity
            let mu = hbar * vr / (r * r + 0.01 * hbar * hbar);
            visc = (-P.alpha * 0.5 * (ci + sj.dens.z) * mu + P.beta * mu * mu) / (0.5 * (rhoi + sj.dens.x));
            vsig = max(vsig, ci + sj.dens.z - 3.0 * vr / r);
          }
          let gradW = dWdr(r, hbar) / r * dx;
          a -= P.m * (Pi + sj.dens.y + visc) * gradW;
          divv -= P.m * dot(dv, gradW);
        }
      }
    }
  }
  divv /= rhoi;
  acc[idx] = vec4f(a, 0.0);
  atomicMin(&st[S_DTMIN], bitcast<u32>(P.cfl * hi / vsig));   // positive floats order like u32

  // Sink candidate: dense, local density maximum, converging, and not inside an existing sink.
  if (rhoi > P.rhoSink && isMax && divv < 0.0) {
    let ns = atomicLoad(&st[S_SINKS]);
    for (var q = 0u; q < ns; q++) {
      if (distance(bodies[P.N + q].xyz, xi) < 2.0 * P.racc) { return; }
    }
    let slot = atomicAdd(&st[S_NCAND], 1u);
    if (slot < CMAX) { atomicStore(&st[CAND0 + slot], idx); }
  }
}

// Single thread: turn accepted candidates into sinks (serial, so no two sinks form on top of each other).
@compute @workgroup_size(1)
fn createSinks() {
  let nc = min(atomicLoad(&st[S_NCAND]), CMAX);
  var ns = atomicLoad(&st[S_SINKS]);
  for (var c = 0u; c < nc; c++) {
    let i = atomicLoad(&st[CAND0 + c]);
    let b = bodies[i];
    if (b.w == 0.0 || ns >= P.Smax) { continue; }
    var ok = true;
    for (var q = 0u; q < ns; q++) {
      if (distance(bodies[P.N + q].xyz, b.xyz) < 2.0 * P.racc) { ok = false; }
    }
    if (!ok) { continue; }
    bodies[P.N + ns] = b;
    vel[P.N + ns] = vec4f(vel[i].xyz, 0.0);
    bodies[i] = vec4f(b.xyz, 0.0);
    ns++;
  }
  atomicStore(&st[S_SINKS], ns);
  atomicStore(&st[S_NCAND], 0u);
}

// ---------------- gravity: tiled direct summation over gas + sinks ----------------

var<workgroup> tile: array<vec4f, 256>;

@compute @workgroup_size(256)
fn gravity(@builtin(global_invocation_id) g: vec3u, @builtin(local_invocation_id) l: vec3u) {
  let i = g.x;                         // NB is a multiple of 256, so every thread takes part in the barriers
  let pi = bodies[i];
  var a = vec3f(0.0);
  let ntiles = P.NB / 256u;
  for (var t = 0u; t < ntiles; t++) {
    tile[l.x] = bodies[t * 256u + l.x];
    workgroupBarrier();
    for (var j = 0u; j < 256u; j++) {
      let q = tile[j];
      let d = q.xyz - pi.xyz;
      let inv = inverseSqrt(dot(d, d) + P.eps2);   // Plummer softening
      a += (q.w * inv * inv * inv) * d;
    }
    workgroupBarrier();
  }
  if (pi.w == 0.0) { return; }
  var base = vec3f(0.0);
  if (i < P.N) { base = acc[i].xyz; }              // hydro part written by forces()
  let tot = base + a;
  acc[i] = vec4f(tot, 0.0);
  let dtA = P.cfl * sqrt(sqrt(P.eps2) / max(length(tot), 1e-8));
  atomicMin(&st[S_DTMIN], bitcast<u32>(dtA));
}

@compute @workgroup_size(1)
fn finalizeStep() {
  let dt = clamp(bitcast<f32>(atomicLoad(&st[S_DTMIN])), P.dtmin, P.dtmax);
  atomicStore(&st[S_DT], bitcast<u32>(dt));
  atomicStore(&st[S_TIME], bitcast<u32>(bitcast<f32>(atomicLoad(&st[S_TIME])) + dt));
  atomicStore(&st[S_DTMIN], bitcast<u32>(1e9f));
  atomicAdd(&st[S_STEPS], 1u);
}

// Symplectic Euler (kick then drift) with the global timestep.
@compute @workgroup_size(128)
fn integrate(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.NB) { return; }
  let b = bodies[i];
  if (b.w == 0.0) { return; }
  let dt = bitcast<f32>(atomicLoad(&st[S_DT]));
  let v = vel[i];
  let nv = v.xyz + acc[i].xyz * dt;
  vel[i] = vec4f(nv, v.w);
  bodies[i] = vec4f(b.xyz + nv * dt, b.w);
}

// ---------------- sinks ----------------

@compute @workgroup_size(128)
fn accrete(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i >= P.N) { return; }
  let b = bodies[i];
  if (b.w == 0.0) { return; }
  let ns = atomicLoad(&st[S_SINKS]);
  var best = -1;
  var bestD = P.racc;
  for (var q = 0u; q < ns; q++) {
    let sb = bodies[P.N + q];
    let d = distance(b.xyz, sb.xyz);
    if (d < bestD) {
      let dv = vel[i].xyz - vel[P.N + q].xyz;
      // inner half of the accretion radius: always; outer half: only if bound to the sink (+ its envelope)
      if (d < 0.5 * P.racc || dot(dv, dv) < 2.0 * (sb.w + 50.0 * P.m) / d) { best = i32(q); bestD = d; }
    }
  }
  if (best < 0) { return; }
  let q = u32(best);
  let o = ACC0 + q * 8u;
  let dx = (b.xyz - bodies[P.N + q].xyz) * (b.w * SP);
  let dv = (vel[i].xyz - vel[P.N + q].xyz) * (b.w * SP);
  atomicAdd(&st[o], u32(round(b.w * SM)));
  atomicAdd(&st[o + 1u], bitcast<u32>(i32(round(dx.x))));
  atomicAdd(&st[o + 2u], bitcast<u32>(i32(round(dx.y))));
  atomicAdd(&st[o + 3u], bitcast<u32>(i32(round(dx.z))));
  atomicAdd(&st[o + 4u], bitcast<u32>(i32(round(dv.x))));
  atomicAdd(&st[o + 5u], bitcast<u32>(i32(round(dv.y))));
  atomicAdd(&st[o + 6u], bitcast<u32>(i32(round(dv.z))));
  bodies[i] = vec4f(b.xyz, 0.0);
}

// Fold the accreted mass and momentum into each sink (centre-of-mass update), then clear.
@compute @workgroup_size(64)
fn sinkUpdate(@builtin(global_invocation_id) g: vec3u) {
  let q = g.x;
  if (q >= atomicLoad(&st[S_SINKS])) { return; }
  let o = ACC0 + q * 8u;
  let dmBits = atomicExchange(&st[o], 0u);
  let ex = vec3f(f32(bitcast<i32>(atomicExchange(&st[o + 1u], 0u))), f32(bitcast<i32>(atomicExchange(&st[o + 2u], 0u))), f32(bitcast<i32>(atomicExchange(&st[o + 3u], 0u)))) / SP;
  let ev = vec3f(f32(bitcast<i32>(atomicExchange(&st[o + 4u], 0u))), f32(bitcast<i32>(atomicExchange(&st[o + 5u], 0u))), f32(bitcast<i32>(atomicExchange(&st[o + 6u], 0u)))) / SP;
  if (dmBits == 0u) { return; }
  let sb = bodies[P.N + q];
  let M = sb.w + f32(dmBits) / SM;
  bodies[P.N + q] = vec4f(sb.xyz + ex / M, M);
  let v = vel[P.N + q];
  vel[P.N + q] = vec4f(v.xyz + ev / M, v.w);
}
