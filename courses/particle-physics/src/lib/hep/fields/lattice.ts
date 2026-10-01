/**
 * The scalar field on a lattice: a chain (or sheet) of coupled oscillators.
 *
 *   φ̈ᵢ = c² (φᵢ₊₁ − 2φᵢ + φᵢ₋₁)/a² − m² φᵢ − λ φᵢ³        (Klein–Gordon, with an optional φ⁴ interaction)
 *
 * Integrated with the velocity-Verlet form of the symplectic leapfrog (kick–drift–kick). Units: the lattice spacing a
 * and c are parameters (default 1), ħ = 1, so a wave number k is a momentum p and a frequency ω is an energy E.
 * The chain is periodic. Nothing here touches the DOM; every random number comes from a seeded `Rng`.
 *
 * The energy  E = Σ a [½ π² + ½ c² ((φᵢ₊₁ − φᵢ)/a)² + ½ m² φ² + ¼ λ φ⁴]  (π = φ̇) is conserved by the exact dynamics.
 * A symplectic integrator conserves a nearby "shadow" energy exactly, so E itself wobbles by O(dt²) and never drifts.
 */
import { fft, fft2, hann, isPow2 } from './fft.ts';
import { normal, type Rng } from '../random/index.ts';

export interface KGParams {
  /** Number of sites (a power of two, for the FFT-based helpers). */
  n: number;
  /** Lattice spacing. */
  a: number;
  /** Wave speed. */
  c: number;
  /** Mass term m (the "mass slider"); 0 gives massless waves that move at c. */
  m: number;
  /** Quartic coupling λ (0 = free field). */
  lambda: number;
  /** Time step. Stability needs dt² (4c²/a² + m²) < 4. */
  dt: number;
}

export const defaultKG = (over: Partial<KGParams> = {}): KGParams => ({ n: 256, a: 1, c: 1, m: 0, lambda: 0, dt: 0.1, ...over });

/** Continuum dispersion: ω = √(c²k² + m²). */
export function omegaContinuum(k: number, m: number, c = 1): number {
  return Math.sqrt(c * c * k * k + m * m);
}
/** Dispersion of the lattice equations in continuous time: ω² = m² + (4c²/a²) sin²(ka/2). */
export function omegaLattice(k: number, m: number, c = 1, a = 1): number {
  const s = Math.sin((k * a) / 2);
  return Math.sqrt(m * m + ((4 * c * c) / (a * a)) * s * s);
}
/** Dispersion of the lattice plus the leapfrog time step: cos(ω dt) = 1 − (Ω dt)²/2 with Ω the lattice frequency. */
export function omegaNumerical(k: number, p: Pick<KGParams, 'm' | 'c' | 'a' | 'dt'>): number {
  const O = omegaLattice(k, p.m, p.c, p.a);
  const x = (O * p.dt) / 2;
  return (2 / p.dt) * Math.asin(Math.min(1, x));
}
/** Group velocity dω/dk of the lattice dispersion: c² sin(ka)/(a ω). */
export function groupVelocityLattice(k: number, m: number, c = 1, a = 1): number {
  const w = omegaLattice(k, m, c, a);
  return w > 0 ? (c * c * Math.sin(k * a)) / (a * w) : c;
}
/** The particle relation v = p/E with E = √(p² + m²) (c = 1). */
export function particleVelocity(p: number, m: number, c = 1): number {
  const E = Math.sqrt(c * c * p * p + m * m);
  return E > 0 ? (c * c * p) / E : 0;
}

/** Is dt stable for the given parameters? */
export function isStable(p: KGParams): boolean {
  return p.dt * p.dt * ((4 * p.c * p.c) / (p.a * p.a) + p.m * p.m) < 4;
}

export class KGChain {
  readonly p: KGParams;
  readonly n: number;
  phi: Float64Array;
  /** π = φ̇. */
  pi: Float64Array;
  t = 0;
  steps = 0;
  private f: Float64Array;

  constructor(p: KGParams) {
    if (!isStable(p)) throw new Error('KGChain: time step too large for stability');
    this.p = { ...p };
    this.n = p.n;
    this.phi = new Float64Array(p.n);
    this.pi = new Float64Array(p.n);
    this.f = new Float64Array(p.n);
    this.updateForce();
  }

  /** Change m, λ (and c, dt) while running. */
  set(over: Partial<Pick<KGParams, 'm' | 'lambda' | 'c' | 'dt'>>): void {
    const q = { ...this.p, ...over };
    if (!isStable(q)) throw new Error('KGChain: time step too large for stability');
    Object.assign(this.p, over);
    this.updateForce();
  }

  private updateForce(): void {
    const { n, a, c, m, lambda } = this.p;
    const k = (c * c) / (a * a);
    const m2 = m * m;
    const phi = this.phi;
    const f = this.f;
    for (let i = 0; i < n; i++) {
      const l = phi[i === 0 ? n - 1 : i - 1]!;
      const r = phi[i === n - 1 ? 0 : i + 1]!;
      const x = phi[i]!;
      f[i] = k * (r - 2 * x + l) - m2 * x - lambda * x * x * x;
    }
  }

  /** One leapfrog step of size dt. */
  step(): void {
    const { n, dt } = this.p;
    const h = dt / 2;
    const { phi, pi, f } = this;
    for (let i = 0; i < n; i++) {
      pi[i] = pi[i]! + h * f[i]!;
      phi[i] = phi[i]! + dt * pi[i]!;
    }
    this.updateForce();
    for (let i = 0; i < n; i++) pi[i] = pi[i]! + h * f[i]!;
    this.t += dt;
    this.steps++;
  }

  run(steps: number): void {
    for (let s = 0; s < steps; s++) this.step();
  }

  /** The conserved energy. */
  energy(): number {
    return this.energyDensity().reduce((s, e) => s + e, 0);
  }

  /** Energy on each site: the gradient energy of each link is shared equally by the two sites it joins. The sum is E. */
  energyDensity(out: Float64Array = new Float64Array(this.n)): Float64Array {
    const { n, a, c, m, lambda } = this.p;
    const { phi, pi } = this;
    const g = (c * c) / (4 * a); // ½ × (½ c² (Δφ)²/a) per link end
    for (let i = 0; i < n; i++) {
      const x = phi[i]!;
      const dr = phi[i === n - 1 ? 0 : i + 1]! - x;
      const dl = x - phi[i === 0 ? n - 1 : i - 1]!;
      out[i] = a * (0.5 * pi[i]! * pi[i]! + 0.5 * m * m * x * x + 0.25 * lambda * x * x * x * x) + g * (dr * dr + dl * dl);
    }
    return out;
  }

  /** Energy centroid on the circle, as a position in [0, n·a), and the total energy: a packet's "position". */
  centroid(): { x: number; total: number } {
    const e = this.energyDensity();
    let cs = 0;
    let sn = 0;
    let tot = 0;
    const w = (2 * Math.PI) / this.n;
    for (let i = 0; i < this.n; i++) {
      cs += e[i]! * Math.cos(w * i);
      sn += e[i]! * Math.sin(w * i);
      tot += e[i]!;
    }
    let ang = Math.atan2(sn, cs);
    if (ang < 0) ang += 2 * Math.PI;
    return { x: (ang / w) * this.p.a, total: tot };
  }

  clear(): void {
    this.phi.fill(0);
    this.pi.fill(0);
    this.t = 0;
    this.steps = 0;
    this.updateForce();
  }

  /** A Gaussian bump in φ (a "pluck"): φ += A exp(−(x−x0)²/2σ²), at rest. */
  pluck(x0: number, sigma: number, amp: number): void {
    const { n, a } = this.p;
    for (let i = 0; i < n; i++) {
      let d = i * a - x0;
      d -= n * a * Math.round(d / (n * a));
      this.phi[i] = this.phi[i]! + amp * Math.exp(-(d * d) / (2 * sigma * sigma));
    }
    this.updateForce();
  }

  /**
   * Add a Gaussian wave packet with wave number k moving right (k > 0) or left (k < 0), by giving each Fourier mode
   * the positive-frequency phase relation of the discrete dynamics: a clean one-way packet with no backward wave.
   * Requires n to be a power of two.
   */
  addPacket(x0: number, sigma: number, k: number, amp: number): void {
    const { n, a } = this.p;
    if (!isPow2(n)) throw new Error('addPacket: n must be a power of two');
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let d = i * a - x0;
      d -= n * a * Math.round(d / (n * a));
      const g = amp * Math.exp(-(d * d) / (2 * sigma * sigma));
      re[i] = g * Math.cos(k * d);
      im[i] = g * Math.sin(k * d);
    }
    fft(re, im, false);
    // ψ̂(q) → −i Ω̃(q) ψ̂(q), with the positive-frequency velocity factor of the leapfrog map.
    const pr = new Float64Array(n);
    const pim = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const q = ((j < n / 2 ? j : j - n) * 2 * Math.PI) / (n * a);
      const O = omegaLattice(q, this.p.m, this.p.c, a);
      const fac = O / Math.sqrt(Math.max(1e-12, 1 - (O * this.p.dt) ** 2 / 4));
      // −i·fac·(re + i im) = fac·im − i·fac·re
      pr[j] = fac * im[j]!;
      pim[j] = -fac * re[j]!;
    }
    fft(pr, pim, true);
    // `re`/`im` hold ψ̂ (scaled); bring ψ back, too, for φ = Re ψ.
    fft(re, im, true);
    for (let i = 0; i < n; i++) {
      this.phi[i] = this.phi[i]! + re[i]!;
      this.pi[i] = this.pi[i]! + pr[i]!;
    }
    this.updateForce();
  }

  /** White noise in φ and π with the given standard deviations (seeded). */
  addNoise(r: Rng, sigmaPhi: number, sigmaPi: number): void {
    for (let i = 0; i < this.n; i++) {
      this.phi[i] = this.phi[i]! + normal(r, 0, sigmaPhi);
      this.pi[i] = this.pi[i]! + normal(r, 0, sigmaPi);
    }
    this.updateForce();
  }

  /**
   * Classical energy in each normal mode: E_q = ½|π_q|² + ½Ω_q²|φ_q|² (with the discrete Fourier normalisation
   * φ_q = a Σ φ_j e^{−iqx_j}/√(N a)), for q = 2πj/(N a), j = 0 … N/2. For the free field (λ = 0) every E_q is
   * separately conserved: the normal modes are independent oscillators. Divided by Ω_q it is the "number of quanta"
   * in the mode, but only as a classical amplitude: the classical field has no quanta.
   */
  modeEnergies(): { q: Float64Array; E: Float64Array; omega: Float64Array } {
    const { n, a, c, m } = this.p;
    if (!isPow2(n)) throw new Error('modeEnergies: n must be a power of two');
    const fr = Float64Array.from(this.phi);
    const fi = new Float64Array(n);
    const pr = Float64Array.from(this.pi);
    const pim = new Float64Array(n);
    fft(fr, fi, false);
    fft(pr, pim, false);
    const half = n / 2;
    const q = new Float64Array(half + 1);
    const E = new Float64Array(half + 1);
    const omega = new Float64Array(half + 1);
    const norm = a / n; // |φ_q|² = (a/N)|FFT|² so that Σ_q over all modes of E_q equals the total energy
    for (let j = 0; j <= half; j++) {
      q[j] = (2 * Math.PI * j) / (n * a);
      omega[j] = omegaLattice(q[j]!, m, c, a);
      const mult = j === 0 || j === half ? 1 : 2; // fold −q onto +q
      const ph2 = fr[j]! ** 2 + fi[j]! ** 2;
      const pi2 = pr[j]! ** 2 + pim[j]! ** 2;
      E[j] = mult * norm * (0.5 * pi2 + 0.5 * omega[j]! ** 2 * ph2);
    }
    return { q, E, omega };
  }
}

/** Result of `measureDispersion`. */
export interface DispersionMeasurement {
  /** Wave numbers q_j, j = 0 … n/2. */
  k: Float64Array;
  /** Measured ω of the strongest spectral peak at each k (NaN where there is none). */
  omega: Float64Array;
  /** Power spectrum |Φ(k, ω)|², k-major: [j * nw + l], for l = 0 … nw−1 (ω from 0 to ωmax). */
  power: Float64Array;
  nk: number;
  nw: number;
  omegaMax: number;
  /** The field steps per sample. */
  stepsPerSample: number;
}

/**
 * Measure ω(k) of the free lattice field (λ = 0 is used whatever `p.lambda` says) by driving it with seeded white noise,
 * recording φ(x, t) on a grid of `nt` samples, and taking the two-dimensional Fourier transform (Hann window in time).
 * A plane wave exp(i(kx − ωt)) appears as a peak at (k, ω), so the ridge of the power spectrum is the dispersion
 * relation. Needs `p.n` and `nt` to be powers of two.
 */
export function measureDispersion(p: KGParams, r: Rng, nt = 512, stepsPerSample = 4): DispersionMeasurement {
  const chain = new KGChain({ ...p, lambda: 0 });
  chain.addNoise(r, 0.1, 0.1 * (0.3 + p.m));
  const n = p.n;
  const re = new Float64Array(nt * n);
  const im = new Float64Array(nt * n);
  const w = hann(nt);
  const dtS = p.dt * stepsPerSample;
  for (let s = 0; s < nt; s++) {
    chain.run(stepsPerSample);
    for (let i = 0; i < n; i++) re[s * n + i] = chain.phi[i]! * w[s]!;
  }
  fft2(re, im, nt, n);
  const nk = n / 2 + 1;
  const nw = nt / 2;
  const power = new Float64Array(nk * nw);
  const omegaMax = Math.PI / dtS;
  const dOmega = (2 * Math.PI) / (nt * dtS);
  const k = new Float64Array(nk);
  const omega = new Float64Array(nk);
  for (let j = 0; j < nk; j++) {
    k[j] = (2 * Math.PI * j) / (n * p.a);
    let best = 0;
    let bl = -1;
    for (let l = 0; l < nw; l++) {
      // At positive k, a left-moving wave e^{i(kx+ωt)} sits at the positive time bin l = ω/dΩ and a right-moving one at −l;
      // white noise excites both equally, so the positive bins carry the dispersion relation.
      const pw = re[l * n + j]! ** 2 + im[l * n + j]! ** 2;
      power[j * nw + l] = pw;
      if (pw > best) {
        best = pw;
        bl = l;
      }
    }
    if (bl > 0 && bl < nw - 1) {
      const y0 = Math.log(power[j * nw + bl - 1]! + 1e-300);
      const y1 = Math.log(power[j * nw + bl]! + 1e-300);
      const y2 = Math.log(power[j * nw + bl + 1]! + 1e-300);
      const den = y0 - 2 * y1 + y2;
      const off = den < 0 ? (0.5 * (y0 - y2)) / den : 0;
      omega[j] = (bl + Math.max(-0.5, Math.min(0.5, off))) * dOmega;
    } else omega[j] = bl === 0 ? 0 : NaN;
  }
  return { k, omega, power, nk, nw, omegaMax, stepsPerSample };
}

/**
 * Velocity of a packet from its position history by least squares over the last `window` time units.
 * Positions are on a circle of circumference `length` and are unwrapped first.
 */
export function fitVelocity(ts: ArrayLike<number>, xs: ArrayLike<number>, length: number, window: number): number {
  const n = ts.length;
  if (n < 3) return NaN;
  const tEnd = ts[n - 1]!;
  let i0 = n - 1;
  while (i0 > 0 && ts[i0 - 1]! >= tEnd - window) i0--;
  if (n - i0 < 3) return NaN;
  const un: number[] = [];
  let off = 0;
  un.push(xs[i0]!);
  for (let i = i0 + 1; i < n; i++) {
    const d = xs[i]! - xs[i - 1]!;
    if (d > length / 2) off -= length;
    else if (d < -length / 2) off += length;
    un.push(xs[i]! + off);
  }
  let st = 0, sx = 0, stt = 0, stx = 0;
  const m = un.length;
  for (let i = 0; i < m; i++) {
    const t = ts[i0 + i]!;
    st += t; sx += un[i]!; stt += t * t; stx += t * un[i]!;
  }
  const den = m * stt - st * st;
  return den === 0 ? NaN : (m * stx - st * sx) / den;
}

/**
 * The same equation on an n × n sheet (periodic), for the two-dimensional demonstration.
 * φ̈ = c² ∇²φ − m² φ − λ φ³ with the five-point Laplacian.
 */
export class KGSheet {
  readonly n: number;
  m: number;
  c: number;
  lambda: number;
  dt: number;
  a: number;
  phi: Float64Array;
  pi: Float64Array;
  private f: Float64Array;
  t = 0;
  constructor(n: number, m = 0, c = 1, lambda = 0, dt = 0.2, a = 1) {
    this.n = n;
    this.m = m;
    this.c = c;
    this.lambda = lambda;
    this.dt = dt;
    this.a = a;
    this.phi = new Float64Array(n * n);
    this.pi = new Float64Array(n * n);
    this.f = new Float64Array(n * n);
  }
  private force(): void {
    const { n, phi, f } = this;
    const k = (this.c * this.c) / (this.a * this.a);
    const m2 = this.m * this.m;
    const lam = this.lambda;
    for (let y = 0; y < n; y++) {
      const yu = ((y + 1) % n) * n;
      const yd = ((y + n - 1) % n) * n;
      const yc = y * n;
      for (let x = 0; x < n; x++) {
        const xr = (x + 1) % n;
        const xl = (x + n - 1) % n;
        const v = phi[yc + x]!;
        f[yc + x] = k * (phi[yc + xr]! + phi[yc + xl]! + phi[yu + x]! + phi[yd + x]! - 4 * v) - m2 * v - lam * v * v * v;
      }
    }
  }
  step(): void {
    const { pi, phi, f, dt } = this;
    const N = this.n * this.n;
    this.force();
    for (let i = 0; i < N; i++) {
      pi[i] = pi[i]! + 0.5 * dt * f[i]!;
      phi[i] = phi[i]! + dt * pi[i]!;
    }
    this.force();
    for (let i = 0; i < N; i++) pi[i] = pi[i]! + 0.5 * dt * f[i]!;
    this.t += dt;
  }
  pluck(x0: number, y0: number, sigma: number, amp: number): void {
    const { n } = this;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let dx = x - x0;
        let dy = y - y0;
        dx -= n * Math.round(dx / n);
        dy -= n * Math.round(dy / n);
        this.phi[y * n + x] = this.phi[y * n + x]! + amp * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      }
  }
  clear(): void {
    this.phi.fill(0);
    this.pi.fill(0);
    this.t = 0;
  }
  energy(): number {
    const { n, phi, pi } = this;
    const a2 = this.a * this.a;
    let e = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const dx = phi[y * n + ((x + 1) % n)]! - phi[i]!;
        const dy = phi[((y + 1) % n) * n + x]! - phi[i]!;
        e += 0.5 * pi[i]! ** 2 + 0.5 * this.c * this.c * (dx * dx + dy * dy) / a2 + 0.5 * this.m * this.m * phi[i]! ** 2 + 0.25 * this.lambda * phi[i]! ** 4;
      }
    return e * a2;
  }
}
