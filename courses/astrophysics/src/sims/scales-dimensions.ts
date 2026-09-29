// Chapter 1: a dimensional-analysis workbench. Raise constants to (half-)integer powers,
// watch the dimensions [M^a L^b T^c] update, and read off the value when they match a target.

import { defineSim } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';

// symbol, name, SI value, dims [M, L, T]
type Q = [string, string, number, [number, number, number]];
const QS: Q[] = [
  ['G', 'gravitational constant', 6.674e-11, [-1, 3, -2]],
  ['c', 'speed of light', 2.998e8, [0, 1, -1]],
  ['ħ', 'reduced Planck constant', 1.0546e-34, [1, 2, -1]],
  ['mₚ', 'proton mass', 1.6726e-27, [1, 0, 0]],
  ['mₑ', 'electron mass', 9.109e-31, [1, 0, 0]],
  ['e²/4πε₀', 'electric coupling', 2.307e-28, [1, 3, -2]],
  ['M', 'mass (Sun)', 1.989e30, [1, 0, 0]],
  ['R', 'radius (Sun)', 6.957e8, [0, 1, 0]],
  ['ρ', 'density (Sun, mean)', 1408, [1, -3, 0]],
];

const PRESETS: { name: string; exps: Record<string, number>; note: string }[] = [
  { name: 'Escape speed √(GM/R)', exps: { G: 0.5, M: 0.5, R: -0.5 }, note: 'Solar escape speed is √2 × this: 618 km/s.' },
  { name: 'Free-fall time 1/√(Gρ)', exps: { G: -0.5, 'ρ': -0.5 }, note: 'For the Sun: ~1 hour. The exact free-fall time is √(3π/32) ≈ 0.54 × this.' },
  { name: 'Bohr radius ħ²/(mₑ e²/4πε₀)', exps: { 'ħ': 2, 'mₑ': -1, 'e²/4πε₀': -1 }, note: 'a₀ = 0.529 Å, exactly — no fudge factor.' },
  { name: 'Planck length √(ħG/c³)', exps: { 'ħ': 0.5, G: 0.5, c: -1.5 }, note: '1.6 × 10⁻³⁵ m.' },
  { name: 'Chandrasekhar mass (ħc/G)^1.5 / mₚ²', exps: { 'ħ': 1.5, c: 1.5, G: -1.5, 'mₚ': -2 }, note: '≈ 1.85 M☉. The real limit is 1.44 M☉ (Chapter 16).' },
  { name: 'Schwarzschild radius GM/c²', exps: { G: 1, M: 1, c: -2 }, note: 'Times 2: 2.95 km for the Sun.' },
];

// HTML rendering of each symbol (the Unicode subscripts ₚ/ₑ are missing from most fonts).
const HTML: Record<string, string> = { 'mₚ': 'm<sub>p</sub>', 'mₑ': 'm<sub>e</sub>', 'e²/4πε₀': 'e<sup>2</sup>/4πε<sub>0</sub>', M: 'M<sub>☉</sub>', R: 'R<sub>☉</sub>', 'ρ': 'ρ<sub>☉</sub>' };
const sym = (k: string) => HTML[k] ?? k;

const SUPS = (n: number) => {
  if (n === 1) return '';
  const s = Number.isInteger(n) ? String(n) : `${n * 2}/2`;
  return `<sup>${s.replace('-', '−')}</sup>`;
};
// The exponent as a readable label: 0, +1, −3/2 …
const POW = (n: number) => {
  const s = Number.isInteger(n) ? String(Math.abs(n)) : `${Math.abs(n * 2)}/2`;
  return n === 0 ? '0' : `${n < 0 ? '−' : '+'}${s}`;
};
// What a screen reader should call each symbol (the button labels are "Raise G's power" etc.).
const SPOKEN: Record<string, string> = { 'ħ': 'h-bar', 'mₚ': 'the proton mass', 'mₑ': 'the electron mass', 'e²/4πε₀': 'the electric coupling', M: 'the solar mass', R: 'the solar radius', 'ρ': 'the solar density' };

export default defineSim({
  mount({ host }) {
    const exps: Record<string, number> = {};
    QS.forEach((q) => (exps[q[0]] = 0));

    const box = document.createElement('div');
    box.className = 'dimlab';
    host.append(box);
    const grid = document.createElement('div');
    grid.className = 'dimlab-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Constants and their powers');
    box.append(grid);
    const chips = QS.map((q, i) => {
      const spoken = SPOKEN[q[0]] ?? q[0];
      const d = document.createElement('div');
      d.className = 'dimlab-chip';
      d.title = `${q[1]} = ${fmt(q[2], 4)} (SI)`;
      const minus = document.createElement('button');
      const plus = document.createElement('button');
      minus.className = plus.className = 'dimlab-step';
      minus.type = plus.type = 'button';
      minus.textContent = '−';
      plus.textContent = '+';
      minus.setAttribute('aria-label', `Lower ${spoken}'s power`);
      plus.setAttribute('aria-label', `Raise ${spoken}'s power`);
      const mid = document.createElement('div');
      mid.className = 'dimlab-mid';
      const lab = document.createElement('span');
      lab.className = 'dimlab-sym';
      const pow = document.createElement('span');
      pow.className = 'dimlab-pow';
      pow.id = `dimlab-pow-${Math.random().toString(36).slice(2, 8)}-${i}`;
      mid.append(lab, pow);
      minus.setAttribute('aria-describedby', pow.id);
      plus.setAttribute('aria-describedby', pow.id);
      minus.onclick = () => { exps[q[0]] -= 0.5; update(); };
      plus.onclick = () => { exps[q[0]] += 0.5; update(); };
      d.append(minus, mid, plus);
      grid.append(d);
      return { q, lab, pow, d };
    });
    const out = document.createElement('div');
    out.className = 'dimlab-out';
    out.setAttribute('aria-live', 'polite');
    const note = document.createElement('div');
    note.className = 'dimlab-note';
    box.append(out, note);

    function update() {
      const dim = [0, 0, 0];
      let logv = 0;
      const parts: string[] = [];
      for (const { q, lab, pow, d } of chips) {
        const e = exps[q[0]];
        lab.innerHTML = `${sym(q[0])}${e ? SUPS(e) : ''}`;
        pow.textContent = `power ${POW(e)}`;
        d.classList.toggle('on', e !== 0);
        if (!e) continue;
        for (let k = 0; k < 3; k++) dim[k] += e * q[3][k];
        logv += e * Math.log10(q[2]);
        parts.push(`${sym(q[0])}${SUPS(e)}`);
      }
      const dimStr = ['kg', 'm', 's'].map((u, k) => (dim[k] ? `${u}${SUPS(dim[k])}` : '')).filter(Boolean).join(' ') || 'dimensionless';
      const v = Math.pow(10, logv);
      const key = dim.join(',');
      const nice: Record<string, string> = {
        '0,1,0': v > 3e15 ? `${fmt(v / 3.0857e16, 3)} pc` : v > 1e9 ? `${fmt(v / 1.496e11, 3)} AU` : v > 1e3 ? `${fmt(v / 1e3, 3)} km` : v < 1e-9 ? `${fmt(v / 1e-10, 3)} Å` : `${fmt(v, 3)} m`,
        '1,0,0': `${fmt(v / 1.989e30, 3)} M☉`,
        '0,0,1': v > 3.15e7 ? `${fmt(v / 3.156e7, 3)} yr` : v > 3600 ? `${fmt(v / 3600, 3)} h` : `${fmt(v, 3)} s`,
        '0,1,-1': `${fmt(v / 1e3, 3)} km/s`,
        '0,0,-1': `${fmt(v, 3)} Hz`,
      };
      out.innerHTML = parts.length
        ? `<b>${parts.join(' ')}</b> has dimensions <b>[${dimStr}]</b> and value <b>${fmt(v, 3)}</b> SI${nice[key] ? ` = <b class="dimlab-hit">${nice[key]}</b>` : ''}`
        : 'Press + and − to raise the constants to powers. Try to build a length, a mass or a time.';
    }

    const panel = new Panel(host);
    panel.select('Preset', [{ value: '-1', label: '—' }, ...PRESETS.map((p, i) => ({ value: String(i), label: p.name }))], '-1', (v) => {
      QS.forEach((q) => (exps[q[0]] = 0));
      const p = PRESETS[+v];
      if (p) { Object.assign(exps, p.exps); note.textContent = p.note; } else note.textContent = '';
      update();
    });
    panel.button('Clear', () => { QS.forEach((q) => (exps[q[0]] = 0)); note.textContent = ''; update(); });
    update();
    return {};
  },
});
