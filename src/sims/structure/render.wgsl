// Particle rendering for structure-pm: camera-facing Gaussian sprites, additive into an HDR target,
// then a tonemapping pass to the canvas.

struct R {
  vp: mat4x4f,
  proj: vec4f,    // p00, p11, sprite size (world), brightness
  misc: vec4f,    // ng, colour mode (0 density, 1 velocity), a, dx (Mpc/h per cell)
  misc2: vec4f,   // mass fixed-point scale, box scale (world units per cell), _, _
};

@group(0) @binding(0) var<uniform> U: R;
@group(0) @binding(1) var<storage, read> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read> rho: array<u32>;

struct VO {
  @builtin(position) p: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec3f,
};

fn densityColour(d: f32) -> vec3f {
  // voids: dim indigo → filaments: amber → halos: white-hot
  let t = clamp((log2(max(d, 1e-3)) + 1.5) / 7.0, 0.0, 1.0);
  let c0 = vec3f(0.10, 0.16, 0.55);
  let c1 = vec3f(0.95, 0.42, 0.12);
  let c2 = vec3f(1.00, 0.93, 0.80);
  let c = select(mix(c1, c2, (t - 0.5) * 2.0), mix(c0, c1, t * 2.0), t < 0.5);
  return c * (0.25 + 1.5 * t);
}

fn velocityColour(v: f32) -> vec3f {
  let t = clamp(v / 1200.0, 0.0, 1.0);   // km/s
  let c0 = vec3f(0.15, 0.30, 0.95);
  let c1 = vec3f(0.20, 0.90, 0.80);
  let c2 = vec3f(1.00, 0.35, 0.20);
  let c = select(mix(c1, c2, (t - 0.5) * 2.0), mix(c0, c1, t * 2.0), t < 0.5);
  return c * (0.4 + t);
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let x = pos[ii].xyz;
  let ng = U.misc.x;
  let world = (x / ng - 0.5) * 2.0;
  var clip = U.vp * vec4f(world, 1.0);
  clip = vec4f(clip.xy + corner * U.proj.z * U.proj.xy, clip.zw);

  var col: vec3f;
  if (U.misc.y < 0.5) {
    let c = vec3u(round(x)) % vec3u(u32(ng));
    let n = u32(ng);
    let d = f32(rho[c.x + (c.y + c.z * n) * n]) / U.misc2.x;
    col = densityColour(d);
  } else {
    let v = length(vel[ii].xyz) / U.misc.z * U.misc.w * 100.0;   // p/a in cells·H0 → km/s
    col = velocityColour(v);
  }
  var o: VO;
  o.p = clip;
  o.uv = corner;
  o.col = col * U.proj.w;
  return o;
}

@fragment
fn fs(i: VO) -> @location(0) vec4f {
  let r2 = dot(i.uv, i.uv);
  if (r2 > 1.0) { discard; }
  let w = exp(-4.0 * r2);
  return vec4f(i.col * w, w);
}

// ---- box wireframe ----
@vertex
fn vsBox(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let e = vi / 2u;          // 12 edges
  let end = f32(vi & 1u) * 2.0 - 1.0;
  let ax = e / 4u;
  let k = e % 4u;
  let a = f32(k & 1u) * 2.0 - 1.0;
  let b = f32(k >> 1u) * 2.0 - 1.0;
  var p: vec3f;
  if (ax == 0u) { p = vec3f(end, a, b); } else if (ax == 1u) { p = vec3f(a, end, b); } else { p = vec3f(a, b, end); }
  return U.vp * vec4f(p, 1.0);
}
@fragment
fn fsBox() -> @location(0) vec4f { return vec4f(0.05, 0.07, 0.10, 0.0); }

// ---- tonemap ----
@group(0) @binding(0) var hdr: texture_2d<f32>;

@vertex
fn vsFull(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u)) * 2.0 - 1.0;
  return vec4f(p, 0.0, 1.0);
}
@fragment
fn fsTone(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let c = textureLoad(hdr, vec2i(fc.xy), 0).rgb;
  let bg = vec3f(0.012, 0.014, 0.024);
  let m = 1.0 - exp(-c);
  return vec4f(bg + m * (1.0 - bg), 1.0);
}
