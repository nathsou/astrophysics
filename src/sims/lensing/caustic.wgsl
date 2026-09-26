// Caustic pass: find det A = 0 inside each cell (marching-squares edge crossings), then map the
// critical-curve segment through the lens equation and splat it into a screen-sized buffer.
@group(0) @binding(1) var<storage, read_write> caustic: array<atomic<u32>>;

fn splat(t: vec2f) {
  let b = t - alpha(t);
  let p = vec2i(floor(toPix(b)));
  let W = i32(U.g.x); let H = i32(U.g.y);
  if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) { return; }
  atomicMax(&caustic[p.y * W + p.x], 1u);
}

@compute @workgroup_size(8, 8)
fn cs(@builtin(global_invocation_id) id: vec3u) {
  let cell = 2.0; // cells of 2x2 pixels
  let base = vec2f(id.xy) * cell;
  if (base.x >= U.a.x || base.y >= U.a.y) { return; }
  let h = 0.5 * U.b.x;
  let p00 = base; let p10 = base + vec2f(cell, 0.0);
  let p01 = base + vec2f(0.0, cell); let p11 = base + vec2f(cell, cell);
  let d00 = detA(toTheta(p00), h); let d10 = detA(toTheta(p10), h);
  let d01 = detA(toTheta(p01), h); let d11 = detA(toTheta(p11), h);
  var pts: array<vec2f, 4>;
  var n = 0;
  if ((d00 > 0.0) != (d10 > 0.0)) { pts[n] = mix(p00, p10, d00 / (d00 - d10)); n++; }
  if ((d10 > 0.0) != (d11 > 0.0)) { pts[n] = mix(p10, p11, d10 / (d10 - d11)); n++; }
  if ((d11 > 0.0) != (d01 > 0.0)) { pts[n] = mix(p11, p01, d11 / (d11 - d01)); n++; }
  if ((d01 > 0.0) != (d00 > 0.0)) { pts[n] = mix(p01, p00, d01 / (d01 - d00)); n++; }
  if (n < 2) { return; }
  // reject the fake "crossing" at a singular centre, where det jumps from +inf to -inf
  if (max(max(abs(d00), abs(d10)), max(abs(d01), abs(d11))) > 50.0) { return; }
  for (var k = 0; k <= 12; k++) {
    splat(toTheta(mix(pts[0], pts[1], f32(k) / 12.0)));
  }
}
