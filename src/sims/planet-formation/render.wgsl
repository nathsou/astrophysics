// Rendering for the planet-formation disk: glowing point sprites into an HDR target,
// orbit rings, then a tonemapping composite.

const G: f32 = 39.47841760435743;
const MEARTH: f32 = 3.0035e-6;

struct Cam {
  vp: mat4x4f,
  viewport: vec4f,   // width px, height px, dpr, colour mode (0 = composition, 1 = eccentricity)
  misc: vec4f,       // snow line AU, nBodies, exposure, particle brightness
};

@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<storage, read> particles: array<vec4f>;
@group(0) @binding(2) var<storage, read> bodies: array<vec4f>;
@group(0) @binding(3) var<storage, read> aux: array<vec4f>;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec3f,
  @location(2) kind: f32,
};

const CORNERS = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));

const ROCK = vec3f(1.0, 0.52, 0.22);
const ICE = vec3f(0.35, 0.68, 1.0);

fn eccentricity(r: vec3f, v: vec3f) -> f32 {
  let h = cross(r, v);
  return length(cross(v, h) / G - normalize(r));
}

// Map e ∈ [0, 0.2] onto a cool→hot ramp.
fn eccColour(e: f32) -> vec3f {
  let t = clamp(e / 0.2, 0.0, 1.0);
  let c0 = vec3f(0.25, 0.35, 1.0);
  let c1 = vec3f(0.3, 1.0, 0.75);
  let c2 = vec3f(1.0, 0.85, 0.25);
  let c3 = vec3f(1.0, 0.25, 0.2);
  if (t < 0.33) { return mix(c0, c1, t / 0.33); }
  if (t < 0.66) { return mix(c1, c2, (t - 0.33) / 0.33); }
  return mix(c2, c3, (t - 0.66) / 0.34);
}

fn sprite(world: vec3f, corner: vec2f, sizePx: f32) -> vec4f {
  var c = cam.vp * vec4f(world, 1.0);
  c = vec4f(c.xy + corner * sizePx * c.w * 2.0 / cam.viewport.xy, c.zw);
  return c;
}

@vertex
fn vsParticle(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var o: VOut;
  let v = particles[2u * ii + 1u];
  if (v.w == 0.0) { o.pos = vec4f(2.0, 2.0, 2.0, 1.0); return o; }   // culled
  let p = particles[2u * ii];
  let corner = CORNERS[vi];
  o.pos = sprite(p.xyz, corner, 1.6 * cam.viewport.z);
  o.uv = corner;
  var col = select(ROCK, ICE, p.w > cam.misc.x);
  if (cam.viewport.w > 0.5) { col = eccColour(eccentricity(p.xyz, v.xyz)); }
  o.col = col * cam.misc.w;
  o.kind = 0.0;
  return o;
}

@vertex
fn vsBody(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  var o: VOut;
  let corner = CORNERS[vi];
  o.uv = corner;
  let nB = u32(cam.misc.y);
  if (ii == nB) {                                      // the star
    o.pos = sprite(vec3f(0.0), corner, 34.0 * cam.viewport.z);
    o.col = vec3f(1.0, 0.86, 0.62) * 3.0;
    o.kind = 2.0;
    return o;
  }
  let v = bodies[2u * ii + 1u];
  if (v.w == 0.0) { o.pos = vec4f(2.0, 2.0, 2.0, 1.0); return o; }
  let p = bodies[2u * ii];
  let a = aux[ii];
  let mE = p.w / MEARTH;
  let size = min(4.0 + 6.0 * pow(mE, 0.33), 30.0) * cam.viewport.z;
  o.pos = sprite(p.xyz, corner, size);
  var col = mix(ROCK, ICE, clamp(a.x / max(p.w, 1e-20), 0.0, 1.0));
  if (a.z > 0.5) { col = vec3f(1.0, 0.8, 0.55); }
  if (cam.viewport.w > 0.5 && a.z < 0.5) { col = eccColour(eccentricity(p.xyz, v.xyz)); }
  o.col = col * 1.6;
  o.kind = 1.0;
  return o;
}

@fragment
fn fsSprite(i: VOut) -> @location(0) vec4f {
  let d2 = dot(i.uv, i.uv);
  if (d2 > 1.0) { discard; }
  var w: f32;
  if (i.kind < 0.5) {
    w = exp(-3.0 * d2);
  } else if (i.kind < 1.5) {
    w = exp(-12.0 * d2) * 2.5 + exp(-3.0 * d2) * 0.35;           // bright core + halo
  } else {
    let d = sqrt(d2);
    w = exp(-30.0 * d2) * 6.0 + 0.25 * max(0.0, 1.0 - d) / (d * 8.0 + 0.25);
  }
  return vec4f(i.col * w, 1.0);
}

// ---------------------------------------------------------------- rings (snow line, giants' orbits)
struct Rings { r: array<vec4f, 4> };          // radius, r, g, b
@group(0) @binding(4) var<uniform> rings: Rings;

struct LOut { @builtin(position) pos: vec4f, @location(0) col: vec3f };

@vertex
fn vsRing(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LOut {
  let seg = vi / 2u + (vi & 1u);
  let th = f32(seg) / 192.0 * 6.283185307;
  let R = rings.r[ii];
  var o: LOut;
  o.pos = cam.vp * vec4f(R.x * cos(th), R.x * sin(th), 0.0, 1.0);
  // dashed look: every other pair of segments is dimmer
  let dash = select(0.25, 1.0, ((vi / 2u) / 3u) % 2u == 0u);
  o.col = R.yzw * dash * select(1.0, 0.0, R.x <= 0.0);
  return o;
}

@fragment
fn fsRing(i: LOut) -> @location(0) vec4f { return vec4f(i.col, 1.0); }

