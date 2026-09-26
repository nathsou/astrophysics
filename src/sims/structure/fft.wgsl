// One pass of a 3D FFT: every workgroup transforms one line of NG complex values along `axis`,
// entirely in workgroup memory, with a radix-2 Stockham (auto-sort) algorithm. No bit reversal.
// NG and LOGN are substituted at pipeline-creation time.

const N: u32 = NGu;
const H: u32 = N / 2u;
const LOG: u32 = LOGNu;

struct F { axis: u32, sign: f32, _a: u32, _b: u32 };
@group(0) @binding(0) var<uniform> U: F;
@group(0) @binding(1) var<storage, read_write> data: array<vec2f>;

var<workgroup> S: array<vec2f, 2u * N>;   // ping-pong halves [0,N) and [N,2N)

fn cmul(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }

@compute @workgroup_size(H)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_index) j: u32) {
  var base: u32;
  var stride: u32;
  if (U.axis == 0u) { base = (wg.x + wg.y * N) * N; stride = 1u; }
  else if (U.axis == 1u) { base = wg.x + wg.y * N * N; stride = N; }
  else { base = wg.x + wg.y * N; stride = N * N; }

  S[j] = data[base + j * stride];
  S[j + H] = data[base + (j + H) * stride];
  workgroupBarrier();

  var src = 0u;
  var ns = 1u;
  for (var s = 0u; s < LOG; s++) {
    let dst = N - src;
    let k = j % ns;
    let ang = U.sign * 3.14159265358979 * f32(k) / f32(ns);   // ∓2πk / (2 ns)
    let v0 = S[src + j];
    let v1 = cmul(S[src + j + H], vec2f(cos(ang), sin(ang)));
    let d = (j / ns) * ns * 2u + k;
    S[dst + d] = v0 + v1;
    S[dst + d + ns] = v0 - v1;
    workgroupBarrier();
    src = dst;
    ns *= 2u;
  }

  data[base + j * stride] = S[src + j];
  data[base + (j + H) * stride] = S[src + j + H];
}
