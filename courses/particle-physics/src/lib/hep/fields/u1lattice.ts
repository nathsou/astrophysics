/**
 * Two-dimensional compact U(1) lattice gauge theory (Wilson action), by Monte Carlo.
 *
 * Link variables θ_{x,μ} ∈ (−π, π] on an L × L torus, μ = 0 (x) or 1 (y); the plaquette angle
 *   θ_p = θ_{x,0} + θ_{x+0̂,1} − θ_{x+1̂,0} − θ_{x,1}
 * and the action S = β Σ_p (1 − cos θ_p), weight e^{−S}. β plays the role of 1/g² (strong coupling is small β).
 *
 * Exact results (infinite volume; the corrections on a torus are of order (I₁/I₀)^{L²}, utterly negligible for L ≥ 8):
 *   ⟨cos θ_p⟩ = I₁(β)/I₀(β),       ⟨W(R, T)⟩ = [I₁(β)/I₀(β)]^{RT}  (area law with string tension σ = −ln[I₁(β)/I₀(β)]).
 * In two dimensions the pure gauge field has no propagating photon, and the Coulomb potential between charges is linear at every
 * coupling: confinement is exact. (In four dimensions compact U(1) has a weak-coupling phase with a perimeter law; the area
 * law there is a strong-coupling property.)
 *
 * Every update uses a seeded `Rng`. Two updates are provided: Metropolis (the textbook one, with `hits` tries per link) and
 * the exact heat bath (draws θ from its conditional von Mises distribution, Best & Fisher 1979).
 */
import { uniform, type Rng } from '../random/index.ts';
import { besselRatio } from './bessel.ts';

const PI = Math.PI;
const TWO_PI = 2 * Math.PI;

export const exactPlaquette = (beta: number): number => besselRatio(beta);
export const exactWilson = (beta: number, R: number, T: number): number => besselRatio(beta) ** (R * T);
export const exactStringTension = (beta: number): number => -Math.log(besselRatio(beta));

/** A von Mises variate with mean 0 and concentration κ: density ∝ e^{κ cos θ} on (−π, π]. */
export function vonMises(r: Rng, kappa: number): number {
  if (kappa < 1e-6) return uniform(r, -PI, PI);
  const a = 1 + Math.sqrt(1 + 4 * kappa * kappa);
  const b = (a - Math.sqrt(2 * a)) / (2 * kappa);
  const rr = (1 + b * b) / (2 * b);
  for (;;) {
    const z = Math.cos(PI * r());
    const f = (1 + rr * z) / (rr + z);
    const c = kappa * (rr - f);
    const u2 = r();
    if (c * (2 - c) - u2 > 0 || Math.log(c / u2) + 1 - c >= 0) {
      return (r() > 0.5 ? 1 : -1) * Math.acos(Math.max(-1, Math.min(1, f)));
    }
  }
}

export class U1Lattice {
  readonly L: number;
  /** θ[(y·L + x)·2 + μ] */
  th: Float64Array;
  readonly rng: Rng;
  sweeps = 0;

  constructor(L: number, rng: Rng, hot = false) {
    this.L = L;
    this.rng = rng;
    this.th = new Float64Array(2 * L * L);
    if (hot) for (let i = 0; i < this.th.length; i++) this.th[i] = uniform(rng, -PI, PI);
  }

  private at(x: number, y: number, mu: number): number {
    const L = this.L;
    return this.th[(((y + L) % L) * L + ((x + L) % L)) * 2 + mu]!;
  }

  /** The plaquette angle at (x, y). */
  plaquetteAngle(x: number, y: number): number {
    return this.at(x, y, 0) + this.at(x + 1, y, 1) - this.at(x, y + 1, 0) - this.at(x, y, 1);
  }

  /**
   * The two plaquettes that contain link (x, y, μ) contribute β[cos(θ + s₁) + cos(θ − s₂)] = β R cos(θ + ψ), with
   * Z = e^{i s₁} + e^{−i s₂} = R e^{iψ}. Returns [R, ψ].
   */
  private staple(x: number, y: number, mu: number): [number, number] {
    const nx = mu === 0 ? 0 : 1; // the other direction ν = (nx, ny) has ν = y when μ = x and vice versa
    const ny = 1 - nx;
    const mx = 1 - nx; // μ direction vector
    const my = 1 - ny;
    const nu = 1 - mu;
    // plaquette "up" (in the ν direction): θ_μ + [θ_ν(s+μ) − θ_μ(s+ν) − θ_ν(s)]
    const s1 = this.at(x + mx, y + my, nu) - this.at(x + nx, y + ny, mu) - this.at(x, y, nu);
    // plaquette "down": −θ_μ + [θ_μ(s−ν) + θ_ν(s+μ−ν) − θ_ν(s−ν)]
    const s2 = this.at(x - nx, y - ny, mu) + this.at(x + mx - nx, y + my - ny, nu) - this.at(x - nx, y - ny, nu);
    const zr = Math.cos(s1) + Math.cos(s2);
    const zi = Math.sin(s1) - Math.sin(s2);
    return [Math.hypot(zr, zi), Math.atan2(zi, zr)];
  }

  /** One Metropolis sweep (every link, `hits` proposals each, step size δ). Returns the acceptance rate. */
  sweepMetropolis(beta: number, delta: number, hits = 1): number {
    const { L, rng, th } = this;
    let acc = 0;
    let tot = 0;
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++)
        for (let mu = 0; mu < 2; mu++) {
          const [R, psi] = this.staple(x, y, mu);
          const idx = (y * L + x) * 2 + mu;
          let t = th[idx]!;
          let e = Math.cos(t + psi);
          for (let h = 0; h < hits; h++) {
            const tn = t + delta * (2 * rng() - 1);
            const en = Math.cos(tn + psi);
            tot++;
            // accept with min(1, exp(β R (cos(θ'+ψ) − cos(θ+ψ)))), action −βR cos(θ+ψ) per link
            const dS = beta * R * (en - e);
            if (dS >= 0 || rng() < Math.exp(dS)) {
              t = tn;
              e = en;
              acc++;
            }
          }
          th[idx] = wrap(t);
        }
    this.sweeps++;
    return acc / tot;
  }

  /** One heat-bath sweep: θ is drawn from its exact conditional distribution ∝ e^{βR cos(θ+ψ)}. */
  sweepHeatbath(beta: number): void {
    const { L, rng, th } = this;
    for (let y = 0; y < L; y++)
      for (let x = 0; x < L; x++)
        for (let mu = 0; mu < 2; mu++) {
          const [R, psi] = this.staple(x, y, mu);
          th[(y * L + x) * 2 + mu] = wrap(-psi + vonMises(rng, beta * R));
        }
    this.sweeps++;
  }

  /** Average of cos θ_p over all L² plaquettes (or over the plaquettes with x, y < `window`). */
  meanPlaquette(window = this.L): number {
    let s = 0;
    const W = Math.min(window, this.L);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) s += Math.cos(this.plaquetteAngle(x, y));
    return s / (W * W);
  }

  /** Copy link angles from another array (for example a read-back from the GPU). */
  loadLinks(th: ArrayLike<number>): void {
    if (th.length !== this.th.length) throw new Error('loadLinks: size mismatch');
    for (let i = 0; i < th.length; i++) this.th[i] = th[i]!;
  }

  /**
   * ⟨cos⟩ of the R × T Wilson loop, averaged over the two orientations and over all positions, or over the positions with
   * x, y < `window` (a cheaper estimate on a big lattice).
   */
  wilsonLoop(R: number, T: number, window = this.L): number {
    const { L } = this;
    const W = Math.min(window, L);
    let s = 0;
    let n = 0;
    for (const [w, h] of R === T ? [[R, T]] : [[R, T], [T, R]]) {
      for (let y = 0; y < W; y++)
        for (let x = 0; x < W; x++) {
          let a = 0;
          for (let i = 0; i < w; i++) a += this.at(x + i, y, 0) - this.at(x + i, y + h, 0);
          for (let j = 0; j < h; j++) a += this.at(x + w, y + j, 1) - this.at(x, y + j, 1);
          s += Math.cos(a);
          n++;
        }
    }
    return s / n;
  }

  /** Set all links (cold start: θ = 0, every plaquette 1). */
  cold(): void {
    this.th.fill(0);
    this.sweeps = 0;
  }
}

function wrap(t: number): number {
  if (t > PI || t <= -PI) {
    t -= TWO_PI * Math.round(t / TWO_PI);
    if (t <= -PI) t += TWO_PI;
  }
  return t;
}

/** Mean and standard error by blocking (n blocks), which accounts for autocorrelation between successive sweeps. */
export function blockStats(values: ArrayLike<number>, blocks = 10): { mean: number; err: number } {
  const n = values.length;
  const bs = Math.floor(n / blocks);
  if (bs < 1) {
    let m = 0;
    for (let i = 0; i < n; i++) m += values[i]!;
    return { mean: n ? m / n : NaN, err: Infinity };
  }
  const means: number[] = [];
  for (let b = 0; b < blocks; b++) {
    let s = 0;
    for (let i = b * bs; i < (b + 1) * bs; i++) s += values[i]!;
    means.push(s / bs);
  }
  const mean = means.reduce((a, c) => a + c, 0) / blocks;
  const v = means.reduce((a, c) => a + (c - mean) ** 2, 0) / (blocks - 1);
  return { mean, err: Math.sqrt(v / blocks) };
}

/** A step size for Metropolis that gives an acceptance near one half (a fit that is good enough: δ ≈ 2.5/√(1+β), capped at π). */
export function metropolisDelta(beta: number): number {
  return Math.min(PI, 2.6 / Math.sqrt(1 + beta));
}
