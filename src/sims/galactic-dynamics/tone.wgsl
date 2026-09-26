// Chapter 22 — HDR tonemapping pass (fullscreen triangle).
@group(0) @binding(0) var hdr : texture_2d<f32>;
@group(0) @binding(1) var<uniform> T : vec4f; // exposure, background r g b (linear)

@vertex
fn vsFull(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4f {
  let p = array<vec2f, 3>(vec2f(-1, -3), vec2f(-1, 1), vec2f(3, 1));
  return vec4f(p[vi], 0.0, 1.0);
}

@fragment
fn fsTone(@builtin(position) fc : vec4f) -> @location(0) vec4f {
  let c = textureLoad(hdr, vec2i(fc.xy), 0).rgb * T.x;
  // filmic-ish curve: 1 − e^(−x) per channel, then a gentle desaturation of the brightest cores
  var m = vec3f(1.0) - exp(-c);
  let l = dot(m, vec3f(0.2126, 0.7152, 0.0722));
  m = mix(m, vec3f(l), smoothstep(0.7, 1.0, l) * 0.5);
  let outc = pow(m + T.yzw * (1.0 - l), vec3f(1.0 / 2.2));
  return vec4f(outc, 1.0);
}
