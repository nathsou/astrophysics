// Ray-traced sphere impostors (Earth, Moon, Sun, CMB last-scattering surface).
// Prepended with common.wgsl. One uniform block per sphere, 6 vertices per draw.

struct Sphere {
  center: vec3f,   // view space, units of D (computed in f64 on the CPU)
  radius: f32,
  r0: vec4f,       // object→view rotation columns; .w = kind
  r1: vec4f,       // .w = alpha
  r2: vec4f,       // .w = billboard half-size (≤ 0: full screen)
  sunDir: vec3f,   // view space
  glowPx: f32,
};

@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var<uniform> S: Sphere;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  let k = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1))[vi];
  let h = S.r2.w;
  if (h <= 0.0 || dot(S.center, S.center) < S.radius * S.radius * 1.05) {
    return vec4f(k, 0.5, 1.0);
  }
  let p = S.center + vec3f(k * h, 0.0);
  var c = F.proj * vec4f(p, 1.0);
  c.z = 0.5 * c.w;
  return c;
}

fn objN(n: vec3f) -> vec3f { return vec3f(dot(S.r0.xyz, n), dot(S.r1.xyz, n), dot(S.r2.xyz, n)); }

fn earth(n: vec3f, no: vec3f, l: vec3f, v: vec3f) -> vec3f {
  let lat = abs(no.z);
  let h = fbm(no * 2.3, 6) + 0.12 * fbm(no * 9.0, 3);
  let land = smoothstep(0.6, 0.615, h);
  let dry = smoothstep(0.55, 0.75, fbm(no * 3.1 + 7.0, 4) + 0.25 * (1.0 - abs(abs(no.z) - 0.35) * 3.0));
  var col = mix(vec3f(0.01, 0.045, 0.14), mix(vec3f(0.07, 0.16, 0.05), vec3f(0.42, 0.33, 0.18), dry), land);
  col = mix(col, vec3f(0.9, 0.93, 0.97), smoothstep(0.86, 0.9, lat + 0.06 * h));
  let swirl = no + 0.35 * vec3f(fbm(no * 3.0 + 1.0, 3), fbm(no * 3.0 + 4.0, 3), 0.0);
  let cloud = smoothstep(0.5, 0.75, fbm(swirl * 4.5 + vec3f(F.time * 0.004, 0.0, 0.0), 5));
  let ndl = dot(n, l);
  let day = smoothstep(-0.05, 0.25, ndl);
  var c = mix(col, vec3f(1.0), cloud * 0.9) * max(ndl, 0.0) * 1.6;
  // ocean glint
  let hv = normalize(l + v);
  c += (1.0 - land) * (1.0 - cloud) * pow(max(dot(n, hv), 0.0), 60.0) * vec3f(1.0, 0.9, 0.7) * 0.8 * day;
  // city lights on the night side
  let city = step(0.72, vnoise(no * 90.0)) * step(0.5, vnoise(no * 11.0)) * land * (1.0 - cloud) * (1.0 - smoothstep(0.7, 0.8, lat));
  c += city * (1.0 - day) * vec3f(1.0, 0.62, 0.25) * 0.9;
  // atmosphere: Rayleigh-blue rim on the lit limb
  let mu = max(dot(n, v), 0.0);
  c += vec3f(0.25, 0.5, 1.0) * pow(1.0 - mu, 3.0) * smoothstep(-0.2, 0.4, ndl) * 1.2;
  return c;
}

fn moon(n: vec3f, no: vec3f, l: vec3f) -> vec3f {
  let maria = smoothstep(0.5, 0.6, fbm(no * 1.7 + 3.0, 4));
  let crat = fbm(no * 14.0, 4);
  let alb = mix(0.55, 0.28, maria) * (0.8 + 0.4 * crat);
  return vec3f(alb) * max(dot(n, l), 0.0) * 1.3;
}

fn sun(n: vec3f, no: vec3f, v: vec3f) -> vec3f {
  let mu = max(dot(n, v), 0.0);
  let limb = 0.35 + 0.65 * pow(mu, 0.55);            // limb darkening
  let gran = 0.85 + 0.3 * fbm(no * 40.0 + vec3f(F.time * 0.05), 3);
  return vec3f(1.0, 0.78, 0.5) * 7.0 * limb * gran;
}

fn cmb(no: vec3f) -> vec3f {
  // Gaussian-ish random field with power on several angular scales, Planck-style colour map
  let t = (fbm(no * 5.0, 6) - 0.5) * 3.2 + (vnoise(no * 45.0) - 0.5) * 0.5;
  let x = clamp(t * 0.5 + 0.5, 0.0, 1.0);
  let cold = vec3f(0.05, 0.15, 0.75);
  let mid = vec3f(0.95, 0.88, 0.78);
  let hot = vec3f(0.85, 0.12, 0.05);
  let c = select(mix(mid, hot, (x - 0.5) * 2.0), mix(cold, mid, x * 2.0), x < 0.5);
  return c * 0.55;
}

struct FOut { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 };

@fragment
fn fs(@builtin(position) fc: vec4f) -> FOut {
  var o: FOut;
  let kind = i32(S.r0.w + 0.5);
  let alpha = S.r1.w;
  let ndc = vec2f(fc.x / F.viewport.x * 2.0 - 1.0, 1.0 - fc.y / F.viewport.y * 2.0);
  let dir = normalize(vec3f(ndc * F.tanHalf, -1.0));
  let c = S.center;
  let r = S.radius;
  // Robust ray–sphere: work with the perpendicular offset p instead of |c|² − r²,
  // which cancels catastrophically in f32 when the sphere is tiny and far away.
  let b = dot(dir, c);
  let p = c - b * dir;
  let h2 = r * r - dot(p, p);
  o.depth = 1.0;
  if (kind == 3) {
    // CMB shell: we may be inside it (it surrounds every observer) or looking at it from outside.
    if (h2 < 0.0) { o.color = vec4f(0.0); return o; }
    let hq = sqrt(h2);
    let t0 = b - hq;
    let t1 = b + hq;
    if (t1 < 0.0) { discard; }
    var col = cmb(objN(normalize(dir * t1 - c))) * 0.8;
    if (t0 > 0.0) {
      let nn = normalize(dir * t0 - c);
      let rim = 1.0 - abs(dot(nn, dir));
      col = col * 0.55 + cmb(objN(nn)) * 0.3 + vec3f(0.5, 0.6, 1.0) * pow(rim, 6.0) * 0.4;
    }
    o.color = vec4f(col * alpha, 0.0);
    return o;
  }
  let v = -dir;
  if (h2 >= 0.0 && b > 0.0) {
    let t = b - sqrt(h2);
    let hit = dir * t;
    let n = normalize(hit - c);
    let no = objN(n);
    var col = vec3f(0.0);
    if (kind == 0) { col = earth(n, no, S.sunDir, v); }
    else if (kind == 1) { col = moon(n, no, S.sunDir); }
    else { col = sun(n, no, v); }
    o.color = vec4f(col * alpha, 0.0);
    o.depth = logDepth(-hit.z, F.logK);
    return o;
  }
  // Outside the disc: glow / atmosphere halo, in pixels so that tiny spheres stay visible as dots.
  if (b <= 0.0) { discard; }
  let pxPerUnit = F.focalPx / b;
  let q = max(length(p) - r, 0.0) * pxPerUnit;
  let rpx = r * pxPerUnit;
  var g = vec3f(0.0);
  let s = S.glowPx;
  if (kind == 0) {
    g = vec3f(0.35, 0.55, 1.0) * (exp(-q * q / (2.0 * s * s)) * 1.3 + exp(-q / max(rpx * 0.02, 0.5)) * 0.6);
  } else if (kind == 1) {
    g = vec3f(0.8) * exp(-q * q / (2.0 * s * s)) * 0.8;
  } else {
    let R = max(rpx, 3.0);
    g = vec3f(1.0, 0.8, 0.55) * (exp(-q * q / (2.0 * s * s)) * 6.0 + 1.2 * R * R / ((q + R) * (q + R)) * exp(-q / (R * 12.0)));
  }
  if (max(g.r, max(g.g, g.b)) < 0.002) { discard; }
  o.color = vec4f(g * alpha, 0.0);
  return o;
}
