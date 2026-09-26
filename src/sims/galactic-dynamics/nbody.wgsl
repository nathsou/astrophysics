// Chapter 22 — galaxy-merger N-body kernels (G = 1; length 3 kpc, mass 5e10 Msun, time 10.96 Myr).
//
// pos[i] = (x, y, z, m)  m > 0 only for the first nSrc particles ("sources", disk particles that gravitate)
// vel[i] = (vx, vy, vz, _)
// acc[i] = last acceleration (used by the next half-kick)
//
// Per timestep (kick–drift–kick leapfrog), two dispatches:
//   kickDrift:  v += a·dt/2 ;  x += v·dt
//   force:      a = Σ_sources softened pair forces (tiled through workgroup memory) + rigid halos/bulges
//               v += a·dt/2

struct Params {
  c0 : vec4f,   // centre of galaxy 0 (xyz), halo mass
  c1 : vec4f,   // centre of galaxy 1 (xyz), halo mass
  s0 : vec4f,   // galaxy 0: halo scale a_h, bulge mass, bulge scale a_b, _
  s1 : vec4f,   // galaxy 1: same
  dt : f32,
  eps2 : f32,   // Plummer softening squared
  n : u32,      // particle count
  nSrc : u32,   // gravitating particles (multiple of WG)
};

@group(0) @binding(0) var<uniform> P : Params;
@group(0) @binding(1) var<storage, read_write> pos : array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel : array<vec4f>;
@group(0) @binding(3) var<storage, read_write> acc : array<vec4f>;

const WG : u32 = 256u;

// Hernquist sphere: a(r) = −M r̂ / (r + a)²
fn hernquist(d : vec3f, M : f32, a : f32) -> vec3f {
  let r = sqrt(dot(d, d)) + 1e-4;
  let s = r + a;
  return -d * (M / (r * s * s));
}

fn rigid(p : vec3f) -> vec3f {
  let d0 = p - P.c0.xyz;
  let d1 = p - P.c1.xyz;
  return hernquist(d0, P.c0.w, P.s0.x) + hernquist(d0, P.s0.y, P.s0.z)
       + hernquist(d1, P.c1.w, P.s1.x) + hernquist(d1, P.s1.y, P.s1.z);
}

@compute @workgroup_size(WG)
fn kickDrift(@builtin(global_invocation_id) gid : vec3u) {
  let i = gid.x;
  if (i >= P.n) { return; }
  var v = vel[i];
  v = vec4f(v.xyz + 0.5 * P.dt * acc[i].xyz, v.w);
  vel[i] = v;
  let p = pos[i];
  pos[i] = vec4f(p.xyz + P.dt * v.xyz, p.w);
}

var<workgroup> tile : array<vec4f, WG>;

@compute @workgroup_size(WG)
fn force(@builtin(global_invocation_id) gid : vec3u, @builtin(local_invocation_index) li : u32) {
  // Out-of-range threads still take part in the tile loads and barriers (uniform control flow).
  let i = min(gid.x, P.n - 1u);
  let p = pos[i].xyz;
  var a = vec3f(0.0);
  for (var base = 0u; base < P.nSrc; base += WG) {
    tile[li] = pos[base + li];          // one coalesced load per thread…
    workgroupBarrier();
    for (var j = 0u; j < WG; j++) {     // …then WG interactions served from on-chip memory
      let q = tile[j];
      let d = q.xyz - p;
      let r2 = dot(d, d) + P.eps2;
      let inv = inverseSqrt(r2);
      a += d * (q.w * inv * inv * inv);
    }
    workgroupBarrier();
  }
  a += rigid(p);
  if (gid.x < P.n) {
    acc[i] = vec4f(a, 0.0);
    let v = vel[i];
    vel[i] = vec4f(v.xyz + 0.5 * P.dt * a, v.w);
  }
}
