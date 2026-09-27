// Pass A: for each latitude ring pair (j, nlat-1-j) and each m, sum over ℓ
//   F_m(θ_j) = Σ_ℓ amp_ℓ · g_ℓm · λ_ℓm(cos θ_j)
// with λ_ℓm the orthonormalised associated Legendre functions, computed by the stable three-term
// recurrence in ℓ. The start value λ_mm ∝ sin^m θ underflows f32 near the poles, so it is carried as
// mantissa × 2^e (an "extended exponent" number) until it grows back into the normal f32 range.
struct Params { lmax: u32, nlat: u32, nlon: u32, _pad: u32, dip: vec4f };
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> alm: array<vec2f>;   // unit-variance Gaussian g_ℓm, m-major
@group(0) @binding(2) var<storage, read> amp: array<f32>;     // sqrt(C_ℓ) × band filter (μK)
@group(0) @binding(3) var<storage, read> mlog: array<f32>;    // log2 of the λ_mm prefactor
@group(0) @binding(4) var<storage, read_write> F: array<vec2f>;

const PI = 3.14159265358979;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) g: vec3u) {
  let m = g.x;
  let j = g.y;
  if (m > P.lmax || j >= P.nlat / 2u) { return; }
  let theta = PI * (f32(j) + 0.5) / f32(P.nlat);
  let x = cos(theta);
  let lg = mlog[m] + f32(m) * log2(sin(theta));   // log2 λ_mm
  var e = floor(lg);
  var p1 = exp2(lg - e);                          // mantissa of λ_mm, in [1, 2)
  var p0 = 0.0;
  if (e > -100.0) { p1 *= exp2(e); e = 0.0; }
  let base = m * (2u * P.lmax + 3u - m) / 2u;
  let fm2 = f32(m) * f32(m);
  var north = vec2f(0.0);
  var south = vec2f(0.0);
  var parity = 1.0;
  for (var l = m; l <= P.lmax; l++) {
    if (l > m) {
      let fl = f32(l);
      let a = sqrt((4.0 * fl * fl - 1.0) / (fl * fl - fm2));
      let b = sqrt(((fl - 1.0) * (fl - 1.0) - fm2) / (4.0 * (fl - 1.0) * (fl - 1.0) - 1.0));
      let pn = a * (x * p1 - b * p0);
      p0 = p1;
      p1 = pn;
      if (e != 0.0) {
        if (abs(p1) > 4294967296.0) { p1 *= 2.3283064e-10; p0 *= 2.3283064e-10; e += 32.0; }
        if (e > -100.0) { let s = exp2(e); p1 *= s; p0 *= s; e = 0.0; }
      }
    }
    if (e == 0.0) {
      let c = alm[base + l - m] * (amp[l] * p1);
      north += c;
      south += c * parity;   // λ_ℓm(−x) = (−1)^(ℓ+m) λ_ℓm(x)
    }
    parity = -parity;
  }
  let L1 = P.lmax + 1u;
  F[j * L1 + m] = north;
  F[(P.nlat - 1u - j) * L1 + m] = south;
}
