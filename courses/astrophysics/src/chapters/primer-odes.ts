// Page script for Appendix A5 (primer-odes): Newton's method on Kepler's equation M = E − e sin E.
import { compute } from '../lib/runtime/vars';
import { fmt } from '../lib/ui/controls';

const DEG = Math.PI / 180;

function newton(M: number, e: number) {
  // Standard starting guess E₀ = M (fine for e ≲ 0.8); use π for very eccentric orbits.
  let E = e > 0.8 ? Math.PI : M;
  const seq = [E];
  for (let i = 0; i < 30; i++) {
    const f = E - e * Math.sin(E) - M, fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    seq.push(E);
    if (Math.abs(dE) < 1e-15) break;
  }
  return seq;
}

function fixedPoint(M: number, e: number) {
  let E = M;
  for (let i = 1; i <= 100000; i++) {
    const En = M + e * Math.sin(E);
    if (Math.abs(En - E) < 1e-15) return i;
    E = En;
  }
  return Infinity;
}

compute('kepNewton', ['kepE', 'kepM'], ({ kepE, kepM }) => {
  const seq = newton(kepM * DEG, kepE);
  const Ef = seq[seq.length - 1];
  const shown = seq.slice(0, 6).map((E) => fmt(E / DEG, 10) + '°');
  return shown.join(' → ') + (seq.length > 6 ? ' → …' : '') + `  (E = ${fmt(Ef / DEG, 8)}° after ${seq.length - 1} steps)`;
});
compute('kepFixed', ['kepE', 'kepM'], ({ kepE, kepM }) => {
  const n = fixedPoint(kepM * DEG, kepE);
  return Number.isFinite(n) ? `${n}` : 'more than 100,000';
});
