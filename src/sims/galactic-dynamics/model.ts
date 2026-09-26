// Galaxy models and initial conditions for the Chapter 22 merger sim.
//
// Natural units (G = 1):  length 3 kpc, mass 5×10¹⁰ M☉  ⇒  velocity 267.7 km/s, time 10.96 Myr.
// With these units the numbers the GPU sees stay O(1–100), comfortably inside f32.
//
// Each galaxy = live exponential disk (particles; a subset are gravitating "sources")
//             + analytic Hernquist bulge + analytic Hernquist dark halo, both rigid and attached to
//               a centre that moves on a CPU-integrated (f64) orbit with Chandrasekhar dynamical friction.
// Bulge particles are drawn for looks and orbit in the total potential, but do not source gravity.

export const UNIT = { kpc: 3, Msun: 5e10, kms: 267.7, Myr: 10.96 };

export interface GalaxySpec {
  Md: number; Rd: number; // disk mass, scale length
  Mb: number; ab: number; // bulge (Hernquist)
  Mh: number; ah: number; // halo (Hernquist)
}

/** The reference (Milky-Way-like) galaxy: 5×10¹⁰ M☉ disk, 3 kpc scale length, 1.5×10¹² M☉ halo. */
export const BASE: GalaxySpec = { Md: 1, Rd: 1, Mb: 0.3, ab: 0.2, Mh: 30, ah: 12 };

/** Scale a galaxy by mass ratio q: masses × q, lengths × √q (roughly the observed size–mass relation). */
export function scaled(q: number, g: GalaxySpec = BASE): GalaxySpec {
  const s = Math.sqrt(q);
  return { Md: g.Md * q, Rd: g.Rd * s, Mb: g.Mb * q, ab: g.ab * s, Mh: g.Mh * q, ah: g.ah * s };
}

export const totalMass = (g: GalaxySpec) => g.Md + g.Mb + g.Mh;

/** Hernquist enclosed-mass acceleration magnitude at radius r. */
const hqAcc = (r: number, M: number, a: number) => M / ((r + a) * (r + a));
const hqRho = (r: number, M: number, a: number) => (M * a) / (2 * Math.PI * r * (r + a) ** 3);

// ---------------------------------------------------------------- random numbers
export function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return { u, gauss };
}

// ---------------------------------------------------------------- orbit of the two centres (f64, CPU)
export class Centers {
  x = [new Float64Array(3), new Float64Array(3)];
  v = [new Float64Array(3), new Float64Array(3)];
  M: [number, number];
  a: [number, number];
  lnL: number;
  g: [GalaxySpec, GalaxySpec];
  constructor(g: [GalaxySpec, GalaxySpec], lnLambda = 3) {
    this.g = g;
    this.M = [totalMass(g[0]), totalMass(g[1])];
    this.a = [g[0].ah, g[1].ah];
    this.lnL = lnLambda;
  }

  /** Accelerations of both centres: softened mutual attraction + Chandrasekhar friction. */
  accel(out: [Float64Array, Float64Array]) {
    const [x0, x1] = this.x, [v0, v1] = this.v;
    const dx = x1[0] - x0[0], dy = x1[1] - x0[1], dz = x1[2] - x0[2];
    const r = Math.hypot(dx, dy, dz) + 1e-9;
    const aeff = 0.5 * (this.a[0] + this.a[1]);
    // Mutual attraction of two extended (Hernquist-like) spheres: F = M0 M1 / (r + a)^2.
    const F = (this.M[0] * this.M[1]) / ((r + aeff) * (r + aeff));
    let fx = (F * dx) / r, fy = (F * dy) / r, fz = (F * dz) / r; // force on 0 (towards 1)
    // Dynamical friction (Chandrasekhar), each galaxy ploughing through the other's halo.
    const wx = v0[0] - v1[0], wy = v0[1] - v1[1], wz = v0[2] - v1[2];
    const w = Math.hypot(wx, wy, wz) + 1e-9;
    const rs = Math.max(r, 0.5);
    let fdf = 0;
    for (let i = 0; i < 2; i++) {
      const j = 1 - i;
      const rho = hqRho(rs, this.g[j].Mh, this.g[j].ah);
      const sigma = Math.sqrt(this.M[j] / (rs + this.g[j].ah)) / Math.SQRT2;
      const X = w / (Math.SQRT2 * sigma);
      const fX = erf(X) - (2 * X / Math.sqrt(Math.PI)) * Math.exp(-X * X);
      // the satellite's effective mass: what lies inside the separation (tidal stripping, crudely)
      const Msat = this.M[i] * (rs / (rs + this.g[i].ah)) ** 2;
      fdf += 0.5 * (4 * Math.PI * this.lnL * Msat * Msat * rho * fX) / (w * w);
    }
    fx -= (fdf * wx) / w; fy -= (fdf * wy) / w; fz -= (fdf * wz) / w;
    out[0][0] = fx / this.M[0]; out[0][1] = fy / this.M[0]; out[0][2] = fz / this.M[0];
    out[1][0] = -fx / this.M[1]; out[1][1] = -fy / this.M[1]; out[1][2] = -fz / this.M[1];
  }

  private acc: [Float64Array, Float64Array] = [new Float64Array(3), new Float64Array(3)];
  /** Kick–drift–kick leapfrog. */
  step(dt: number) {
    const A = this.acc;
    this.accel(A);
    for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) this.v[i][k] += 0.5 * dt * A[i][k];
    for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) this.x[i][k] += dt * this.v[i][k];
    this.accel(A);
    for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) this.v[i][k] += 0.5 * dt * A[i][k];
  }

  separation() {
    return Math.hypot(this.x[1][0] - this.x[0][0], this.x[1][1] - this.x[0][1], this.x[1][2] - this.x[0][2]);
  }

  /** Put the pair on an orbit (in the softened pair potential −M/(r+a)) with separation d, pericentre rp
   *  and specific orbital energy E (0 = marginally bound), in the xy plane and the centre-of-mass frame. */
  setOrbit(d: number, rp: number, E = 0, vRadOverride?: number, vTanOverride?: number) {
    const Mt = this.M[0] + this.M[1];
    const aeff = 0.5 * (this.a[0] + this.a[1]);
    const vp = Math.sqrt(Math.max(2 * (E + Mt / (rp + aeff)), 0));
    const L = rp * vp;
    const vt = vTanOverride ?? L / d;
    const vr = vRadOverride ?? -Math.sqrt(Math.max(2 * (E + Mt / (d + aeff)) - vt * vt, 0));
    const f0 = this.M[1] / Mt, f1 = this.M[0] / Mt;
    // relative vector (1 − 0) = (d, 0, 0); relative velocity (vr, vt, 0)
    this.x[0].set([-f0 * d, 0, 0]); this.x[1].set([f1 * d, 0, 0]);
    this.v[0].set([-f0 * vr, -f0 * vt, 0]); this.v[1].set([f1 * vr, f1 * vt, 0]);
  }
}

function erf(x: number) {
  // Abramowitz & Stegun 7.1.26 (|err| < 1.5e-7)
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

// ---------------------------------------------------------------- particle initial conditions
export interface Placement {
  spec: GalaxySpec;
  pos: ArrayLike<number>; // centre position
  vel: ArrayLike<number>; // centre velocity
  normal: [number, number, number]; // spin axis (disk rotates counter-clockwise about it)
  nDisk: number;
  nBulge: number;
  nSrc: number; // how many of the disk particles gravitate
  Q?: number;    // Toomre Q of the disk (default 1.4)
  flat?: boolean; // razor-thin, purely 2D disk
  rMax?: number; // disk truncation in scale lengths (default 6)
}

export interface ICBuffers {
  pos: Float32Array; // xyz, w = gravitating mass (0 for tracers)
  vel: Float32Array; // xyz, w unused
  attr: Float32Array; // x = galaxy id, y = R0/Rd (0..), z = 1 for bulge, w = random in [0,1)
}

/** Orthonormal basis (e1, e2, n) with n the given unit vector. */
function basis(n: [number, number, number]) {
  const l = Math.hypot(...n);
  const nz = [n[0] / l, n[1] / l, n[2] / l];
  const t = Math.abs(nz[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let e1 = [t[1] * nz[2] - t[2] * nz[1], t[2] * nz[0] - t[0] * nz[2], t[0] * nz[1] - t[1] * nz[0]];
  const l1 = Math.hypot(...e1); e1 = e1.map((c) => c / l1);
  const e2 = [nz[1] * e1[2] - nz[2] * e1[1], nz[2] * e1[0] - nz[0] * e1[2], nz[0] * e1[1] - nz[1] * e1[0]];
  return [e1, e2, nz];
}

/**
 * Build particle buffers for two galaxies. Layout: [g0 sources | g1 sources | g0 rest | g1 rest],
 * so the force kernel's source loop is a contiguous prefix of the position buffer.
 */
export function buildICs(gals: [Placement, Placement], eps: number, selfGravity: boolean, seed = 7): ICBuffers {
  const N = gals.reduce((s, g) => s + g.nDisk + g.nBulge, 0);
  const pos = new Float32Array(N * 4), vel = new Float32Array(N * 4), attr = new Float32Array(N * 4);
  const R = rng(seed);
  const nSrcTot = gals[0].nSrc + gals[1].nSrc;
  let srcCursor = 0, restCursor = nSrcTot;

  gals.forEach((G, gi) => {
    const S = G.spec;
    // 1. sample disk positions in the galaxy frame (f64 scratch)
    const nd = G.nDisk;
    const dx = new Float64Array(nd * 3);
    const zh = G.flat ? 0 : 0.1 * S.Rd;
    const rTrunc = (G.rMax ?? 6) * S.Rd;
    for (let i = 0; i < nd; i++) {
      let r = 0;
      do r = -S.Rd * Math.log((1 - R.u()) * (1 - R.u())); while (r > rTrunc);
      const ph = 2 * Math.PI * R.u();
      const z = G.flat ? 0 : zh * Math.atanh(Math.max(-0.995, Math.min(0.995, 2 * R.u() - 1)));
      dx[i * 3] = r * Math.cos(ph); dx[i * 3 + 1] = r * Math.sin(ph); dx[i * 3 + 2] = z;
    }
    const mSrc = G.nSrc > 0 ? S.Md / G.nSrc : 0;

    // 2. radial acceleration table: halo + bulge (+ softened disk sources, azimuthally averaged)
    const NT = 96, Rmax = 8 * S.Rd;
    const aTab = new Float64Array(NT + 1);
    for (let k = 0; k <= NT; k++) {
      const Rk = (k / NT) * Rmax;
      let a = hqAcc(Rk, S.Mh, S.ah) + hqAcc(Rk, S.Mb, S.ab);
      if (selfGravity && G.nSrc > 0 && Rk > 0) {
        let ad = 0;
        const NA = 12;
        for (let q = 0; q < NA; q++) {
          const ph = (2 * Math.PI * (q + 0.5)) / NA;
          const px = Rk * Math.cos(ph), py = Rk * Math.sin(ph);
          let ax = 0, ay = 0;
          for (let j = 0; j < G.nSrc; j++) {
            const ex = dx[j * 3] - px, ey = dx[j * 3 + 1] - py, ez = dx[j * 3 + 2];
            const r2 = ex * ex + ey * ey + ez * ez + eps * eps;
            const inv = mSrc / (r2 * Math.sqrt(r2));
            ax += ex * inv; ay += ey * inv;
          }
          ad += -(ax * Math.cos(ph) + ay * Math.sin(ph)); // inward component
        }
        a += ad / NA;
      }
      aTab[k] = a;
    }
    const aAt = (r: number) => {
      const f = Math.min((r / Rmax) * NT, NT - 1e-6);
      const k = Math.floor(f), t = f - k;
      return aTab[k] * (1 - t) + aTab[k + 1] * t;
    };
    const vc2 = (r: number) => Math.max(r * aAt(r), 0);

    const [e1, e2, n] = basis(G.normal);
    const put = (idx: number, lx: number, ly: number, lz: number, vx: number, vy: number, vz: number, m: number, R0: number, bulge: number) => {
      const o = idx * 4;
      for (let c = 0; c < 3; c++) {
        pos[o + c] = G.pos[c] + lx * e1[c] + ly * e2[c] + lz * n[c];
        vel[o + c] = G.vel[c] + vx * e1[c] + vy * e2[c] + vz * n[c];
      }
      pos[o + 3] = m;
      attr[o] = gi; attr[o + 1] = R0; attr[o + 2] = bulge; attr[o + 3] = R.u();
    };

    // 3. disk velocities: rotation + Toomre-Q-limited dispersion + asymmetric drift
    const Q = G.Q ?? 1.4;
    for (let i = 0; i < nd; i++) {
      const x = dx[i * 3], y = dx[i * 3 + 1], z = dx[i * 3 + 2];
      const r = Math.max(Math.hypot(x, y), 1e-3);
      const v2 = vc2(r);
      const vc = Math.sqrt(v2);
      const Om = vc / r;
      const dr = 0.02 * S.Rd;
      const dv2 = (vc2(r + dr) - vc2(Math.max(r - dr, 1e-3))) / (2 * dr); // d(vc²)/dR
      const kappa2 = Math.max(2 * v2 / (r * r) + dv2 / r, 1e-6);
      const kappa = Math.sqrt(kappa2);
      const Sigma = (S.Md / (2 * Math.PI * S.Rd * S.Rd)) * Math.exp(-r / S.Rd);
      const sR = Math.min((3.36 * Q * Sigma) / kappa, 0.6 * vc);
      const sP = sR * kappa / (2 * Om);
      const sZ = Math.sqrt(Math.PI * Sigma * zh) * 0.9;
      const vphi2 = v2 + sR * sR * (1 - kappa2 / (4 * Om * Om) - 2 * r / S.Rd);
      const vphi = Math.sqrt(Math.max(vphi2, 0.2 * v2)) + sP * R.gauss();
      const vr = sR * R.gauss();
      const c = x / r, s = y / r;
      const idx = i < G.nSrc ? srcCursor++ : restCursor + (i - G.nSrc);
      put(idx, x, y, z, vr * c - vphi * s, vr * s + vphi * c, G.flat ? 0 : sZ * R.gauss(), i < G.nSrc ? mSrc : 0, r / S.Rd, 0);
    }
    restCursor += nd - G.nSrc;

    // 4. bulge tracers: Hernquist radii, isotropic Gaussian velocities, slight rotation
    for (let i = 0; i < G.nBulge; i++) {
      let r = 0;
      do { const u = Math.sqrt(R.u()); r = (S.ab * u) / (1 - u); } while (r > 8 * S.ab);
      const ct = 2 * R.u() - 1, st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * R.u();
      const x = r * st * Math.cos(ph), y = r * st * Math.sin(ph), z = r * ct * 0.75;
      const sig = Math.sqrt(vc2(Math.max(r, 0.02 * S.Rd)) / 2.2);
      const rc = Math.max(Math.hypot(x, y), 1e-3), rot = 0.3 * sig;
      put(restCursor++, x, y, z, sig * R.gauss() - (rot * y) / rc, sig * R.gauss() + (rot * x) / rc, sig * R.gauss(), 0, r / S.Rd, 1);
    }
  });
  return { pos, vel, attr };
}
