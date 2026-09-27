// Per-pixel inverse ray shooting: for each image-plane pixel, beta = theta - alpha(theta), sample the source.
@group(0) @binding(1) var<storage, read> caustic: array<u32>;

struct VOut { @builtin(position) pos: vec4f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var o: VOut; o.pos = vec4f(p, 0.0, 1.0); return o;
}

fn hash2(p: vec2f) -> vec2f {
  var q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}
fn hash1(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(41.3, 289.1))) * 17853.37); }

// face-on-ish spiral: exponential disc + log-spiral arms + bulge
fn spiral(p: vec2f, R: f32, incl: f32, ang: f32, arms: f32) -> vec3f {
  var q = rot(p, -ang); q.y = q.y / incl;
  let r = length(q) / R;
  let th = atan2(q.y, q.x);
  let disk = exp(-3.0 * r);
  let arm = pow(0.5 + 0.5 * cos(arms * (th - 2.4 * log(r + 0.03))), 3.0);
  let bulge = exp(-r * r * 70.0);
  return disk * (0.2 + 1.3 * arm) * vec3f(0.55, 0.72, 1.0) + bulge * vec3f(1.6, 1.25, 0.8) + disk * 0.15 * vec3f(1.0, 0.8, 0.6);
}

fn field(b: vec2f) -> vec3f {
  var col = vec3f(0.0);
  // background galaxies on a jittered grid (cell 0.9 units)
  let cs = 0.9;
  let c0 = floor(b / cs);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = c0 + vec2f(f32(i), f32(j));
      let h = hash2(c);
      if (h.x > 0.55) { continue; }
      let h2 = hash2(c + 17.0);
      let ctr = (c + h2) * cs;
      let R = 0.05 + 0.12 * h.y;
      let p = b - ctr;
      if (dot(p, p) > 16.0 * R * R) { continue; }
      if (h2.x < 0.4) {
        col += 0.5 * spiral(p, R * 1.6, 0.4 + 0.6 * h2.y, 6.28 * h.x, 2.0);
      } else {
        var q = rot(p, 6.28 * h2.y); q.y = q.y / (0.45 + 0.5 * h.x);
        let r = length(q) / R;
        col += 0.9 * exp(-2.5 * sqrt(r)) * vec3f(1.1, 0.85, 0.6);
      }
    }
  }
  // stars (cell 0.22 units)
  let ss = 0.22;
  let s0 = floor(b / ss);
  let hs = hash2(s0 + 5.0);
  if (hs.x < 0.35) {
    let ctr = (s0 + hash2(s0 + 91.0)) * ss;
    let d2 = dot(b - ctr, b - ctr);
    let t = hash1(s0);
    let tint = mix(vec3f(0.7, 0.8, 1.2), vec3f(1.2, 0.9, 0.6), t);
    col += (0.6 + 2.0 * hs.y) * tint * exp(-d2 / (2.0 * 0.006 * 0.006)) ;
  }
  return col;
}

fn source(b: vec2f) -> vec3f {
  var col = field(b);
  let typ = i32(U.e.w);
  let p = b - U.e.xy;
  if (typ == 0) {
    col = col * 0.4 + 2.2 * spiral(p, U.e.z, 0.8, 0.4, 2.0);
  } else if (typ == 1) {
    let s = 0.12 * U.e.z;
    col = col * 0.5 + 25.0 * exp(-dot(p, p) / (2.0 * s * s)) * vec3f(0.75, 0.85, 1.2);
  }
  return col;
}

@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let n = max(i32(U.b.z), 1);
  var col = vec3f(0.0);
  // rotated-grid supersampling: n x n rays per pixel, each ray just samples the source (surface brightness is conserved)
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      let o = (vec2f(f32(i), f32(j)) + 0.5) / f32(n) - 0.5;
      let t = toTheta(fc.xy + rot(o, 0.4636));
      col += source(t - alpha(t));
    }
  }
  col = col / f32(n * n);

  let theta = toTheta(fc.xy);
  let det = detA(theta, 0.5 * U.b.x);
  let fw = max(fwidth(det), 1e-6);

  if (U.f.w > 0.5) { // light of the lens galaxy itself (image plane, not lensed)
    let r = length(theta - U.c.xy) / max(U.c.z, 0.3);
    col += 0.35 * exp(-7.0 * sqrt(r)) * vec3f(1.2, 0.95, 0.65);
  }
  var outc = 1.0 - exp(-U.g.z * col); // exponential tonemap

  if (U.f.z > 0.5) { // magnification map: log10|mu|, red = positive parity, blue = negative
    let lm = clamp(log(1.0 / max(abs(det), 1e-6)) / log(10.0) / 2.0, 0.0, 1.0);
    let hue = select(vec3f(0.25, 0.55, 1.0), vec3f(1.0, 0.45, 0.2), det > 0.0);
    outc = mix(outc, hue * (0.15 + 0.85 * lm), 0.6);
  }
  if (U.f.x > 0.5) { // critical curves: det A = 0, drawn with a screen-space-width line
    let line = 1.0 - smoothstep(0.35, 1.25, abs(det) / fw);
    outc = mix(outc, vec3f(1.0, 0.38, 0.38), 0.85 * line);
  }
  if (U.f.y > 0.5) { // caustics splatted by the compute pass
    let W = i32(U.g.x); let H = i32(U.g.y);
    let p = vec2i(fc.xy);
    var m = 0u;
    // centre pixel at full strength, its 4 neighbours at half: a ~2 px antialiased line
    let c0 = caustic[clamp(p.y, 0, H - 1) * W + clamp(p.x, 0, W - 1)];
    for (var k = 0; k < 4; k++) {
      let d = select(select(vec2i(0, -1), vec2i(0, 1), k == 1), select(vec2i(-1, 0), vec2i(1, 0), k == 3), k >= 2);
      let q = clamp(p + d, vec2i(0), vec2i(W - 1, H - 1));
      m = max(m, caustic[q.y * W + q.x]);
    }
    let cw = select(select(0.0, 0.45, m > 0u), 0.85, c0 > 0u);
    outc = mix(outc, vec3f(0.35, 1.0, 0.6), cw);
  }
  return vec4f(outc, 1.0);
}
