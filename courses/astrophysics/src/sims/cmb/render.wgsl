// Full-screen pass: ray-cast a unit sphere (globe) or invert the Mollweide projection,
// then bilinearly sample the equirectangular temperature map and apply a Planck-like colour map.
struct U {
  right: vec4f,   // .w = tan(fov/2)
  up: vec4f,      // .w = aspect
  fwd: vec4f,     // .w = colour scale (μK at full saturation)
  eye: vec4f,     // .w = longitude shift (Mollweide)
  mode: u32, nlat: u32, nlon: u32, _p: u32,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> map: array<f32>;

struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  var p = array(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  var o: VO;
  o.pos = vec4f(p[i], 0.0, 1.0);
  o.uv = p[i];
  return o;
}

const PI = 3.14159265358979;

fn texel(ix: i32, iy: i32) -> f32 {
  let n = i32(u.nlon);
  let x = ((ix % n) + n) % n;
  let y = clamp(iy, 0, i32(u.nlat) - 1);
  return map[u32(y) * u.nlon + u32(x)];
}

fn sampleMap(n: vec3f) -> f32 {
  let th = acos(clamp(n.z, -1.0, 1.0));
  var ph = atan2(n.y, n.x);
  if (ph < 0.0) { ph += 2.0 * PI; }
  let fx = ph / (2.0 * PI) * f32(u.nlon);
  let fy = th / PI * f32(u.nlat) - 0.5;
  let x0 = floor(fx); let y0 = floor(fy);
  let tx = fx - x0; let ty = fy - y0;
  let a = mix(texel(i32(x0), i32(y0)), texel(i32(x0) + 1, i32(y0)), tx);
  let b = mix(texel(i32(x0), i32(y0) + 1), texel(i32(x0) + 1, i32(y0) + 1), tx);
  return mix(a, b, ty);
}

fn planck(t: f32) -> vec3f {
  // stops of the Planck collaboration's colour map (approximate), t in [-1, 1]
  var c = array(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 0.44, 1.0), vec3f(0.0, 0.87, 1.0), vec3f(1.0, 0.93, 0.85),
                vec3f(1.0, 0.71, 0.0), vec3f(1.0, 0.29, 0.0), vec3f(0.39, 0.0, 0.0));
  let s = clamp((t + 1.0) * 3.0, 0.0, 5.9999);
  let k = u32(floor(s));
  return mix(c[k], c[k + 1u], s - f32(k));
}

@fragment fn fs(i: VO) -> @location(0) vec4f {
  var n = vec3f(0.0);
  var alpha = 1.0;
  var shade = 1.0;
  let aspect = u.up.w;
  if (u.mode == 0u) {
    let tanH = u.right.w;
    let d = normalize(u.fwd.xyz + i.uv.x * tanH * aspect * u.right.xyz + i.uv.y * tanH * u.up.xyz);
    let e = u.eye.xyz;
    let b = dot(e, d);
    let disc = b * b - (dot(e, e) - 1.0);
    let w = fwidth(disc) + 1e-6;
    alpha = smoothstep(0.0, w, disc);
    if (disc <= 0.0) { return vec4f(0.0); }
    let t = -b - sqrt(disc);
    n = normalize(e + t * d);
    shade = 0.8 + 0.2 * max(dot(n, -d), 0.0);
  } else {
    let S2 = sqrt(2.0);
    let k = max(2.0 * S2 / (0.96 * aspect), S2 / 0.96);
    let x = i.uv.x * aspect * k;
    let y = i.uv.y * k;
    let r = (x / (2.0 * S2)) * (x / (2.0 * S2)) + (y / S2) * (y / S2);
    let w = fwidth(r) + 1e-6;
    alpha = 1.0 - smoothstep(1.0 - w, 1.0, r);
    if (r >= 1.0) { return vec4f(0.0); }
    let ta = asin(clamp(y / S2, -1.0, 1.0));
    let lat = asin(clamp((2.0 * ta + sin(2.0 * ta)) / PI, -1.0, 1.0));
    let lon = -PI * x / (2.0 * S2 * max(cos(ta), 1e-4)) + u.eye.w;
    n = vec3f(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  }
  let T = sampleMap(n);
  let col = planck(T / u.fwd.w) * shade;
  return vec4f(col * alpha, alpha);
}
