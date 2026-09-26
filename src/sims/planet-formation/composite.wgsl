// Tonemapping composite for the HDR (additively blended) sprite buffer.
@group(0) @binding(0) var hdr: texture_2d<f32>;
struct Comp { bg: vec4f, exposure: vec4f };
@group(0) @binding(1) var<uniform> comp: Comp;

@vertex
fn vsFull(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn fsComposite(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let x = textureLoad(hdr, vec2i(fc.xy), 0).rgb * comp.exposure.x;
  let mapped = vec3f(1.0) - exp(-x);                      // soft exposure tonemap
  return vec4f(comp.bg.rgb + mapped * (vec3f(1.0) - comp.bg.rgb), 1.0);
}
