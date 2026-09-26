// Appendix A1: a dimensional-analysis workbench. Raise G, M, R, c and ρ to powers (in steps of ½)
// until the combination has the dimensions of the target quantity; the widget then evaluates it
// for the Sun. Pure DOM, no canvas: the "physics" is bookkeeping of exponents of M, L and T.

import { defineSim } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';

type Dim = [number, number, number]; // exponents of mass, length, time

interface Q { sym: string; name: string; dim: Dim; sun: number; unit: string }
const QS: Q[] = [
  { sym: 'G', name: 'gravitational constant', dim: [-1, 3, -2], sun: 6.674e-11, unit: 'm³ kg⁻¹ s⁻²' },
  { sym: 'M', name: 'mass', dim: [1, 0, 0], sun: 1.989e30, unit: 'kg (the Sun)' },
  { sym: 'R', name: 'radius', dim: [0, 1, 0], sun: 6.957e8, unit: 'm (the Sun)' },
  { sym: 'c', name: 'speed of light', dim: [0, 1, -1], sun: 2.998e8, unit: 'm s⁻¹' },
  { sym: 'ρ', name: 'mean density', dim: [1, -3, 0], sun: 1410, unit: 'kg m⁻³ (the Sun)' },
];

interface Target { key: string; label: string; dim: Dim; unit: string; nice: (v: number) => string; note: string; solution: number[] }
const TARGETS: Target[] = [
  {
    key: 'time', label: 'a time', dim: [0, 0, 1], unit: 's', solution: [-0.5, -0.5, 1.5, 0, 0],
    nice: (v) => `${fmt(v, 3)} s = ${fmt(v / 60, 3)} min`,
    note: 'The dynamical (free-fall) time: how long a star takes to collapse or ring if pressure vanished. Chapters 7 and 11.',
  },
  {
    key: 'speed', label: 'a speed', dim: [0, 1, -1], unit: 'm/s', solution: [0.5, 0.5, -0.5, 0, 0],
    nice: (v) => `${fmt(v / 1000, 3)} km/s`,
    note: 'Orbital speed at the surface; multiply by √2 for the escape speed (618 km/s for the Sun). Chapter 2.',
  },
  {
    key: 'accel', label: 'an acceleration', dim: [0, 1, -2], unit: 'm/s²', solution: [1, 1, -2, 0, 0],
    nice: (v) => `${fmt(v, 3)} m/s² = ${fmt(v / 9.81, 3)} g`,
    note: 'Surface gravity. Chapter 11 balances it against pressure.',
  },
  {
    key: 'length', label: 'a length (without R)', dim: [0, 1, 0], unit: 'm', solution: [1, 1, 0, -2, 0],
    nice: (v) => `${fmt(v / 1000, 3)} km`,
    note: 'GM/c², the gravitational radius. Double it for the Schwarzschild radius: 2.95 km for the Sun. Chapter 19.',
  },
  {
    key: 'energy', label: 'an energy', dim: [1, 2, -2], unit: 'J', solution: [1, 2, -1, 0, 0],
    nice: (v) => `${fmt(v, 3)} J`,
    note: 'Gravitational binding energy GM²/R. At the Sun’s luminosity it would last ~30 Myr: the Kelvin–Helmholtz time (Chapter 12).',
  },
  {
    key: 'power', label: 'a power (from G and c only)', dim: [1, 2, -3], unit: 'W', solution: [-1, 0, 0, 5, 0],
    nice: (v) => `${fmt(v, 3)} W`,
    note: 'c⁵/G, the "Planck luminosity". Merging black holes briefly radiate a percent or so of it in gravitational waves. Chapter 20.',
  },
  {
    key: 'none', label: 'a pure number', dim: [0, 0, 0], unit: '', solution: [1, 1, -1, -2, 0],
    nice: (v) => fmt(v, 3),
    note: 'GM/(Rc²), the compactness: 2×10⁻⁶ for the Sun, 0.2 for a neutron star, 0.5 at a black hole horizon. Dimensionless numbers are what physics actually depends on.',
  },
];

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function powStr(n: number): string {
  if (n === 1) return '';
  const neg = n < 0 ? '⁻' : '';
  const a = Math.abs(n);
  const s = Number.isInteger(a) ? [...String(a)].map((d) => SUP[+d]).join('') : a === 0.5 ? '½' : `${[...String(a * 2)].map((d) => SUP[+d]).join('')}ᐟ²`;
  return neg + s;
}
const dimStr = (d: Dim) => {
  const parts = (['M', 'L', 'T'] as const).map((s, i) => (d[i] === 0 ? '' : `${s}${powStr(d[i])}`)).filter(Boolean);
  return parts.length ? parts.join(' ') : '1 (dimensionless)';
};

export default defineSim({
  mount({ host }) {
    const exps = QS.map(() => 0);
    let target = TARGETS[0];

    const panel = new Panel(host);
    panel.select('Build', TARGETS.map((t) => ({ value: t.key, label: t.label })), target.key, (v) => {
      target = TARGETS.find((t) => t.key === v)!;
      update();
    });
    panel.button('Clear', () => { exps.fill(0); update(); });
    panel.button('Show a solution', () => { target.solution.forEach((e, i) => (exps[i] = e)); update(); });

    const box = document.createElement('div');
    box.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:0.35rem 0.8rem;align-items:center;padding:0.9rem 1rem;font-family:var(--font-ui);font-size:0.85rem;border-top:1px solid var(--rule);';
    host.prepend(box);

    const expEls: HTMLElement[] = [];
    QS.forEach((q, i) => {
      const name = document.createElement('div');
      name.innerHTML = `<b style="font-family:var(--font-mono);font-size:1rem;color:var(--accent)">${q.sym}</b> <span style="color:var(--fg-muted)">${q.name}</span>`;
      const dim = document.createElement('div');
      dim.style.cssText = 'color:var(--fg-muted);font-family:var(--font-mono);font-size:0.78rem';
      dim.textContent = `[${dimStr(q.dim)}]`;
      const ctl = document.createElement('div');
      ctl.style.cssText = 'display:flex;align-items:center;gap:0.3rem';
      const mk = (label: string, d: number) => {
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = label;
        b.style.cssText = 'min-width:2rem;padding:0.15rem 0.4rem';
        b.setAttribute('aria-label', `${d > 0 ? 'Increase' : 'Decrease'} the power of ${q.sym}`);
        b.addEventListener('click', () => { exps[i] = Math.max(-3, Math.min(5, exps[i] + d)); update(); });
        return b;
      };
      const val = document.createElement('span');
      val.style.cssText = 'min-width:2.6rem;text-align:center;font-family:var(--font-mono)';
      expEls.push(val);
      ctl.append(mk('−', -0.5), val, mk('+', 0.5));
      box.append(name, dim, ctl);
    });

    const result = document.createElement('div');
    result.style.cssText = 'grid-column:1/-1;margin-top:0.5rem;padding:0.7rem 0.9rem;border-radius:8px;background:var(--bg-sunk);line-height:1.5';
    box.append(result);

    function update() {
      const d: Dim = [0, 0, 0];
      let val = 1;
      QS.forEach((q, i) => {
        for (let k = 0; k < 3; k++) d[k] += exps[i] * q.dim[k];
        val *= Math.pow(q.sun, exps[i]);
        expEls[i].textContent = exps[i] === 0 ? '0' : Number.isInteger(exps[i]) ? String(exps[i]) : `${exps[i] * 2}/2`;
      });
      const formula = QS.map((q, i) => (exps[i] === 0 ? '' : `${q.sym}${powStr(exps[i])}`)).filter(Boolean).join(' ') || '1';
      const ok = d.every((x, k) => Math.abs(x - target.dim[k]) < 1e-9) && exps.some((e) => e !== 0);
      const noR = target.key === 'length' && exps[2] !== 0;
      const noMRrho = target.key === 'power' && (exps[1] !== 0 || exps[2] !== 0 || exps[4] !== 0);
      const need = `[${dimStr(target.dim)}]`;
      let html = `<div><span style="color:var(--fg-muted)">Your combination:</span> <b style="font-family:var(--font-mono)">${formula}</b> has dimensions <b style="font-family:var(--font-mono)">[${dimStr(d)}]</b>; you need <b style="font-family:var(--font-mono)">${need}</b>.</div>`;
      if (ok && !noR && !noMRrho) {
        html += `<div style="color:var(--good);font-weight:600">✓ Dimensions match. For the Sun: ${target.nice(val)}</div><div style="color:var(--fg-muted)">${target.note}</div>`;
      } else if (ok) {
        html += `<div style="color:var(--accent)">Dimensions match, but try it with the restriction in the target name.</div>`;
      } else {
        const miss = (['mass', 'length', 'time'] as const).map((s, k) => (Math.abs(d[k] - target.dim[k]) > 1e-9 ? `${s} is off by ${fmt(target.dim[k] - d[k], 2)}` : '')).filter(Boolean).join('; ');
        html += `<div style="color:var(--fg-muted)">Not yet: ${miss}.</div>`;
      }
      result.innerHTML = html;
    }
    update();

    return {};
  },
});
