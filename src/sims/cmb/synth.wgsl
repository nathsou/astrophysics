// Pass B: per pixel, T(θ_j, φ_i) = F_0 + 2 Re Σ_{m≥1} F_m e^{i m φ_i}   (+ optional kinematic dipole).
// One workgroup handles 256 pixels of one ring; F_m is staged through workgroup memory in tiles of 256.
struct Params { lmax: u32, nlat: u32, nlon: u32, _pad: u32, dip: vec4f };
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> F: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> map: array<f32>;

const TAU = 6.28318530717959;
var<workgroup> tile: array<vec2f, 256>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) g: vec3u, @builtin(local_invocation_id) li: vec3u, @builtin(workgroup_id) wg: vec3u) {
  let i = g.x;
  let j = wg.y;
  let L1 = P.lmax + 1u;
  let dphi = TAU * f32(i) / f32(P.nlon);
  let cd = cos(dphi);
  let sd = sin(dphi);
  var T = 0.0;
  for (var m0 = 0u; m0 < L1; m0 += 256u) {
    let mm = m0 + li.x;
    tile[li.x] = select(vec2f(0.0), F[j * L1 + min(mm, P.lmax)], mm < L1);
    workgroupBarrier();
    // exact start phase: m0·φ_i = 2π (m0·i mod nlon) / nlon, no large-argument cos()
    let ang = TAU * f32((m0 * i) % P.nlon) / f32(P.nlon);
    var c = cos(ang);
    var s = sin(ang);
    let n = min(256u, L1 - m0);
    for (var t = 0u; t < n; t++) {
      let f = tile[t];
      let w = select(2.0, 1.0, m0 + t == 0u);
      T += w * (f.x * c - f.y * s);
      let c2 = c * cd - s * sd;   // rotate e^{imφ} → e^{i(m+1)φ}
      s = s * cd + c * sd;
      c = c2;
    }
    workgroupBarrier();
  }
  if (i < P.nlon) {
    let th = 3.14159265358979 * (f32(j) + 0.5) / f32(P.nlat);
    let n3 = vec3f(sin(th) * cd, sin(th) * sd, cos(th));
    map[j * P.nlon + i] = T + P.dip.w * dot(n3, P.dip.xyz);
  }
}
