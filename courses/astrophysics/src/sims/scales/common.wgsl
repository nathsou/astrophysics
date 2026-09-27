// Shared by every pass of scales-zoom.
// Units: everything is expressed relative to the camera *focus* in units of the current camera
// distance D (so the eye sits at |x| = 1). Layers bring their own f32 coordinates in their
// own natural unit and are shifted/scaled into that frame by a per-layer uniform.

struct Frame {
  view: mat4x4f,
  proj: mat4x4f,
  viewport: vec2f,  // px
  focalPx: f32,     // px per unit of (view-space x / depth)
  logK: f32,        // 1 / log2(1 + far)
  tanHalf: vec2f,   // tan(fov/2) · (aspect, 1)
  time: f32,
  _pad: f32,
};

// Logarithmic depth: z_ndc = log2(1 + w) / log2(1 + far). Constant *relative* depth precision
// from 1e-5 D to 1e15 D, so an Earth 10^−9 D across and a galaxy 10^13 D away share one buffer.
fn logDepth(w: f32, logK: f32) -> f32 {
  return clamp(log2(1.0 + max(w, 0.0)) * logK, 0.0, 1.0);
}

fn srgbToLinear(c: vec3f) -> vec3f { return pow(c, vec3f(2.2)); }

fn hash3(p: vec3i) -> f32 {
  var h = (u32(p.x) * 0x8da6b343u) ^ (u32(p.y) * 0xd8163841u) ^ (u32(p.z) * 0xcb1ab31fu);
  h = (h ^ (h >> 16u)) * 0x7feb352du;
  h = (h ^ (h >> 15u)) * 0x846ca68bu;
  h = h ^ (h >> 16u);
  return f32(h) * (1.0 / 4294967296.0);
}

fn vnoise(p: vec3f) -> f32 {
  let i = vec3i(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(hash3(i), hash3(i + vec3i(1, 0, 0)), u.x), mix(hash3(i + vec3i(0, 1, 0)), hash3(i + vec3i(1, 1, 0)), u.x), u.y);
  let b = mix(mix(hash3(i + vec3i(0, 0, 1)), hash3(i + vec3i(1, 0, 1)), u.x), mix(hash3(i + vec3i(0, 1, 1)), hash3(i + vec3i(1, 1, 1)), u.x), u.y);
  return mix(a, b, u.z);
}

fn fbm(p0: vec3f, oct: i32) -> f32 {
  var p = p0;
  var s = 0.0;
  var a = 0.5;
  for (var k = 0; k < oct; k++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3f(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
