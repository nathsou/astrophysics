// Additive point-sprite renderer for active photon packets. Each instance is one photon;
// each draw emits a small quad (2 triangles, 6 vertices, no vertex buffer).

struct View {
  tau: f32,
  aspect: f32,     // canvas width / height
  pointSize: f32,  // sprite half-height in NDC
  n: u32,
  colorA: vec4<f32>, // near-surface colour (rgb, unused alpha)
  colorB: vec4<f32>, // deep-interior colour
};

struct Photon {
  x: f32,
  z: f32,
  mu: f32,
  t: f32,
  state: u32,
  rng: u32,
  _pad0: u32,
  _pad1: u32,
};

@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var<storage, read> photons: array<Photon>;

struct VOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
};

const OFFS = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
  vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0),
);

@vertex
fn vs(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  var out: VOut;
  let ph = photons[iid];
  if (ph.state != 1u) {
    out.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); // clip outside
    out.color = vec4<f32>(0.0);
    out.uv = vec2<f32>(0.0);
    return out;
  }
  // data space: x in [-tau, tau] (lateral), z in [0, tau] (depth, 0 = surface)
  let ndcX = (ph.x / V.tau) / V.aspect;
  let ndcY = 1.0 - 2.0 * (ph.z / V.tau);
  let off = OFFS[vid] * vec2<f32>(V.pointSize / V.aspect, V.pointSize); // square in pixels
  out.pos = vec4<f32>(ndcX + off.x, ndcY + off.y, 0.0, 1.0);
  let depthFrac = clamp(ph.z / V.tau, 0.0, 1.0);
  let c = mix(V.colorA.rgb, V.colorB.rgb, depthFrac);
  out.color = vec4<f32>(c, V.colorA.a); // colorA.a carries the per-photon brightness
  out.uv = OFFS[vid];
  return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {
  // soft round sprite; additive blending, brightness scaled on the CPU by photon count
  let d = length(in.uv);
  let g = max(0.0, 1.0 - d * d);
  return vec4<f32>(in.color.rgb * in.color.a * g, 1.0);
}
