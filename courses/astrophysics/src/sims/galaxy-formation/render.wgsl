// Additive billboard rendering into an HDR target, then a tonemap pass to the canvas.

struct Particle { pos: vec4f, vel: vec4f, aux: vec4f };
struct U {
  vp: mat4x4f,
  right: vec4f,
  up: vec4f,
  a: vec4f,   // x = sim time (code), y = gain, z = DM brightness, w = size scale
  b: vec4f,   // x = Gyr per code unit
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> parts: array<Particle>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec3f,
};

const Q = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
                          vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p = parts[ii];
  let t = u32(p.pos.w + 0.5);
  var col: vec3f;
  var size: f32;
  if (t == 0u) {
    col = vec3f(0.32, 0.24, 0.62) * u.a.z;
    size = 0.024;
  } else if (t == 1u) {
    let st = u32(p.aux.y + 0.5);
    if (st == 0u) {
      col = vec3f(0.22, 0.6, 1.0) * 0.8;                       // cold gas
      size = 0.013;
    } else if (st == 1u) {
      let h = clamp((p.aux.x - 4.3) / 2.2, 0.0, 1.0);          // warm -> hot
      col = mix(vec3f(0.35, 0.3, 0.7), vec3f(1.0, 0.36, 0.12), h) * 0.5;
      size = 0.02;
    } else if (st == 2u) {
      col = vec3f(0.3, 1.0, 0.75) * 1.1;                       // supernova wind
      size = 0.015;
    } else {
      col = vec3f(1.0, 0.25, 0.75) * 1.3;                      // AGN-heated
      size = 0.016;
    }
  } else {
    let age = max(u.a.x - p.vel.w, 0.0) * u.b.x;               // Gyr
    let k = clamp(log2(1.0 + age / 0.03) / log2(1.0 + 8.0 / 0.03), 0.0, 1.0);
    col = mix(vec3f(0.7, 0.85, 1.6) * 1.1, vec3f(1.2, 0.68, 0.34) * 0.55, k);
    size = 0.0085;
  }
  let c = Q[vi];
  let w = p.pos.xyz + (u.right.xyz * c.x + u.up.xyz * c.y) * size * u.a.w;
  var o: VO;
  o.pos = u.vp * vec4f(w, 1.0);
  o.uv = c;
  o.col = col * u.a.y;
  return o;
}

@fragment
fn fs(i: VO) -> @location(0) vec4f {
  let r2 = dot(i.uv, i.uv);
  if (r2 > 1.0) { discard; }
  let g = exp(-4.0 * r2) - 0.018;
  return vec4f(i.col * g, 1.0);
}

// ---- tonemap ---------------------------------------------------------------------------
@group(0) @binding(0) var hdr: texture_2d<f32>;
@group(0) @binding(1) var<uniform> tm: vec4f;   // x = exposure, yzw = background (linear)

@vertex
fn vsFull(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let q = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(q * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn fsTone(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let c = textureLoad(hdr, vec2i(fc.xy), 0).rgb;
  let m = 1.0 - exp(-c * tm.x);                  // soft saturation
  let o = tm.yzw + (1.0 - tm.yzw) * m;
  return vec4f(pow(o, vec3f(1.0 / 2.2)), 1.0);   // canvas format is non-sRGB
}
