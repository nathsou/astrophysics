// Point sprites and line lists for one scale "layer". Prepended with common.wgsl.

struct Layer {
  rot: mat3x3f,     // layer axes → world (ecliptic) axes
  offset: vec3f,    // (layer origin − camera focus) in layer units, computed in f64 on the CPU
  scale: f32,       // layer unit / D
  gain: f32,        // brightness × crossfade
  minPx: f32,       // sprite radius for an unresolved point
  worldR: f32,      // physical sprite radius, layer units (0 = always unresolved)
  maxPx: f32,       // fade sprites out beyond this radius (fill-rate guard)
};

@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<uniform> L: Layer;
@group(0) @binding(2) var<storage, read> pts: array<vec4f>;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec3f,
};

fn toView(p: vec3f) -> vec4f {
  // Camera-relative: subtract the focus *before* scaling, while numbers are still in layer units.
  let rel = (L.rot * p + L.offset) * L.scale;
  return F.view * vec4f(rel, 1.0);
}

fn unpack(w: f32) -> vec4f { return unpack4x8unorm(bitcast<u32>(w)); }

@vertex
fn vsPoint(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var o: VOut;
  let p = pts[ii];
  let c = unpack(p.w);
  let v = toView(p.xyz);
  let w = -v.z;
  let corner = vec2f(f32((vi & 1u) * 2u) - 1.0, f32(((vi >> 1u) & 1u) * 2u) - 1.0);
  if (w < 1e-5 || L.gain <= 0.0) { o.pos = vec4f(2.0, 2.0, 2.0, 1.0); return o; }
  // unresolved size grows gently with brightness; resolved size conserves flux
  let r0 = L.minPx * (0.6 + 1.6 * c.a);
  let rWorld = L.worldR * L.scale * F.focalPx / w;
  let r = max(r0, rWorld);
  var I = L.gain * (0.12 + c.a) * (r0 * r0) / (r * r);
  I *= clamp(2.0 - r / L.maxPx, 0.0, 1.0);
  var clip = F.proj * v;
  clip.x += corner.x * r * 2.0 / F.viewport.x * clip.w;
  clip.y += corner.y * r * 2.0 / F.viewport.y * clip.w;
  clip.z = logDepth(w, F.logK) * clip.w;
  o.pos = clip;
  o.uv = corner;
  o.col = srgbToLinear(c.rgb) * I;
  return o;
}

@fragment
fn fsPoint(i: VOut) -> @location(0) vec4f {
  let d2 = dot(i.uv, i.uv);
  if (d2 > 1.0) { discard; }
  let k = exp(-d2 * 4.5) - 0.011;
  return vec4f(i.col * k, 0.0);
}

// Dust: same sprites, but composited as dst · (1 − a): a subtractive "absorber".
@fragment
fn fsDust(i: VOut) -> @location(0) vec4f {
  let d2 = dot(i.uv, i.uv);
  if (d2 > 1.0) { discard; }
  let a = clamp(i.col.r * (1.0 - d2) * (1.0 - d2), 0.0, 0.9);
  return vec4f(a, a * 0.93, a * 0.8, a);
}

@vertex
fn vsLine(@builtin(vertex_index) vi: u32) -> VOut {
  var o: VOut;
  let p = pts[vi];
  let c = unpack(p.w);
  let v = toView(p.xyz);
  let w = -v.z;
  var clip = F.proj * v;
  if (w > 1e-6) { clip.z = logDepth(w, F.logK) * clip.w; }
  o.pos = clip;
  o.uv = vec2f(0.0);
  o.col = srgbToLinear(c.rgb) * c.a * L.gain;
  return o;
}

@fragment
fn fsLine(i: VOut) -> @location(0) vec4f { return vec4f(i.col, 0.0); }
