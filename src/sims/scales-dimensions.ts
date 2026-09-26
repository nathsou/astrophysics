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
  { name: 'Chandrasekhar mass (ħc/G)^{3/2}/mₚ²', exps: { 'ħ': 1.5, c: 1.5, G: -1.5, 'mₚ': -2 }, note: '≈ 1.85 M☉. The real limit is 1.44 M☉ (Chapter 16).' },
  { name: 'Schwarzschild radius GM/c²', exps: { G: 1, M: 1, c: -2 }, note: 'Times 2: 2.95 km for the Sun.' },
];

const SUPS = (n: number) => {
  if (n === 1) return '';
  const s = Number.isInteger(n) ? String(n) : `${n * 2}/2`;
  return `<sup>${s.replace('-', '−')}</sup>`;
};

export default defineSim({
  mount({ host }) {
    const exps: Record<string, number> = {};
    QS.forEach((q) => (exps[q[0]] = 0));

    const box = document.createElement('div');
    box.style.cssText = 'padding:14px 16px 6px;font-family:var(--font-ui);font-size:.8rem;color:var(--fg)';
    host.append(box);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px';
    box.append(grid);
    const chips = QS.map((q) => {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex;align-items:center;gap:6px;border:1px solid var(--rule);border-radius:6px;padding:4px 6px;background:var(--bg-elev)';
      d.title = `${q[1]} = ${fmt(q[2], 4)} (SI)`;
      const minus = document.createElement('button'); minus.className = 'btn'; minus.textContent = '−';
      const plus = document.createElement('button'); plus.className = 'btn'; plus.textContent = '+';
      for (const b of [minus, plus]) b.style.cssText = 'padding:0 .5em;min-width:0';
      const lab = document.createElement('span');
      lab.style.cssText = 'flex:1;text-align:center;font-family:var(--font-mono)';
      minus.onclick = () => { exps[q[0]] -= 0.5; update(); };
      plus.onclick = () => { exps[q[0]] += 0.5; update(); };
      d.append(minus, lab, plus);
      grid.append(d);
      return { q, lab, d };
    });
    const out = document.createElement('div');
    out.style.cssText = 'margin:12px 0 4px;font-size:.95rem;line-height:1.6';
    const note = document.createElement('div');
    note.style.cssText = 'color:var(--fg-muted);font-size:.78rem;min-height:1.2em';
    box.append(out, note);

    function update() {
      const dim = [0, 0, 0];
      let logv = 0;
      const parts: string[] = [];
      for (const { q, lab, d } of chips) {
        const e = exps[q[0]];
        lab.innerHTML = `${q[0]}${e ? SUPS(e) : ''}${e ? '' : '<span style="opacity:.4">⁰</span>'}`;
        d.style.borderColor = e ? 'var(--accent)' : 'var(--rule)';
        if (!e) continue;
        for (let k = 0; k < 3; k++) dim[k] += e * q[3][k];
        logv += e * Math.log10(q[2]);
        parts.push(`${q[0]}${SUPS(e)}`);
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
        ? `<b>${parts.join(' ')}</b> has dimensions <b>[${dimStr}]</b> and value <b>${fmt(v, 3)}</b> SI${nice[key] ? ` = <b style="color:var(--accent)">${nice[key]}</b>` : ''}`
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
