// Chapter 22 — particle sprites (additive, into an rgba16float HDR target) and a tonemapping pass.

struct View {
  vp : mat4x4f,
  viewport : vec4f,   // width px, height px, point size (world), min size (px)
  look : vec4f,       // brightness, colour mode (0 galaxy, 1 population, 2 speed), speed scale, _
};

@group(0) @binding(0) var<uniform> V : View;
@group(0) @binding(1) var<storage, read> pos : array<vec4f>;
@group(0) @binding(2) var<storage, read> vel : array<vec4f>;
@group(0) @binding(3) var<storage, read> attr : array<vec4f>;

struct VOut {
  @builtin(position) clip : vec4f,
  @location(0) uv : vec2f,
  @location(1) col : vec3f,
};

const CORNERS = array<vec2f, 6>(vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1), vec2f(-1, 1), vec2f(1, -1), vec2f(1, 1));

fn ramp(t : f32) -> vec3f {
  // speed colour map: deep blue → cyan → white → amber → red
  let c0 = vec3f(0.15, 0.25, 1.0);
  let c1 = vec3f(0.3, 0.85, 1.0);
  let c2 = vec3f(1.0, 0.95, 0.85);
  let c3 = vec3f(1.0, 0.6, 0.2);
  let c4 = vec3f(1.0, 0.2, 0.15);
  let x = clamp(t, 0.0, 1.0) * 4.0;
  if (x < 1.0) { return mix(c0, c1, x); }
  if (x < 2.0) { return mix(c1, c2, x - 1.0); }
  if (x < 3.0) { return mix(c2, c3, x - 2.0); }
  return mix(c3, c4, x - 3.0);
}

@vertex
fn vs(@builtin(vertex_index) vi : u32, @builtin(instance_index) ii : u32) -> VOut {
  let p = pos[ii];
  let at = attr[ii];
  var o : VOut;
  var clip = V.vp * vec4f(p.xyz, 1.0);
  let corner = CORNERS[vi];
  // sprite radius: world size projected, but never below `min size` pixels
  let worldPx = V.viewport.z * V.vp[1][1] / max(clip.w, 1e-3) * 0.5 * V.viewport.y;
  let rpx = max(worldPx, V.viewport.w);
  // fade sprites that were enlarged to the pixel floor, so total light is roughly conserved
  let fade = clamp(worldPx / V.viewport.w, 0.25, 1.0);
  clip = vec4f(clip.xy + corner * rpx * 2.0 / V.viewport.xy * clip.w, clip.zw);
  o.clip = clip;
  o.uv = corner;

  let gal = at.x;
  let r0 = at.y;
  let bulge = at.z;
  let rnd = at.w;
  var c : vec3f;
  let mode = u32(V.look.y + 0.5);
  if (mode == 0u) {
    // by galaxy: warm gold vs. cool blue, bulges whiter
    let a = select(vec3f(1.0, 0.72, 0.38), vec3f(0.42, 0.66, 1.0), gal > 0.5);
    c = mix(a, vec3f(1.0, 0.92, 0.8), bulge * 0.55);
  } else if (mode == 1u) {
    // by stellar population: old red bulge, yellow-white inner disk, blue outer disk, pink HII knots
    let disk = mix(vec3f(1.0, 0.85, 0.62), vec3f(0.5, 0.68, 1.0), smoothstep(0.6, 3.0, r0));
    c = select(disk, vec3f(1.0, 0.62, 0.34), bulge > 0.5);
    if (bulge < 0.5 && rnd > 0.985 && r0 > 1.0) { c = vec3f(1.0, 0.35, 0.6) * 2.0; }
  } else {
    let v = vel[ii].xyz;
    c = ramp(length(v) * V.look.z);
  }
  o.col = c * (V.look.x * fade * (0.6 + 0.8 * rnd));
  if (clip.w <= 0.0) { o.clip = vec4f(2.0, 2.0, 2.0, 1.0); }
  return o;
}

@fragment
fn fs(i : VOut) -> @location(0) vec4f {
  let r2 = dot(i.uv, i.uv);
  if (r2 > 1.0) { discard; }
  let g = exp(-4.0 * r2);
  return vec4f(i.col * g, 0.0);
}

