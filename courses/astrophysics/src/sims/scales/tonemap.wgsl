// HDR (rgba16float, additive) → display. Exponential tonemap, faint vignette, sRGB encode.
@group(0) @binding(0) var hdr: texture_2d<f32>;
@group(0) @binding(1) var<uniform> P: vec4f; // exposure, bg tint strength, -, -

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3))[vi];
  return vec4f(p, 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let x = textureLoad(hdr, vec2i(fc.xy), 0).rgb * P.x;
  var c = vec3f(1.0) - exp(-x);
  // gentle highlight desaturation keeps bright cores white rather than clipped-cyan
  let l = dot(c, vec3f(0.2126, 0.7152, 0.0722));
  c = mix(c, vec3f(l), smoothstep(0.7, 1.0, l) * 0.5);
  let dims = vec2f(textureDimensions(hdr));
  let uv = fc.xy / dims - 0.5;
  let bg = vec3f(0.006, 0.008, 0.02) * P.y * (1.2 - dot(uv, uv));
  c = c + bg;
  c *= 1.0 - 0.35 * dot(uv, uv);
  return vec4f(pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.2)), 1.0);
}
