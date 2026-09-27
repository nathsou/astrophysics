// Appendix A9: a particle in a one-dimensional box (infinite square well) of width L.
// Three views:
//  • Stationary states: ψ_n = √(2/L) sin(nπx/L) drawn at the height of its energy E_n = n²h²/(8mL²).
//  • Superposition: (ψ₁ + ψ₂)/√2 evolving in time; |ψ|² sloshes at the beat frequency (E₂−E₁)/h.
//  • Fill the box: N particles at temperature T, as fermions (Fermi–Dirac, two spin states per
//    level, Pauli exclusion) or as bosons (Bose–Einstein). The chemical potential μ is found by
//    bisection so that the occupancies add up to N.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { narrowAspect } from './primer-common/stack';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Mode = 'states' | 'super' | 'fill';
type Stats = 'fermi' | 'bose';

const E1_EL_1NM = 0.3760; // eV: ground-state energy of an electron in a 1 nm box, h²/(8 m_e L²)
const KB_EV = 8.617333e-5; // eV/K
const H_EV_S = 4.135667e-15; // eV·s
const HC_EV_NM = 1239.84193;
const NLEV = 40; // levels included in the statistics

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });

    narrowAspect(stage, 16 / 9, 1.1);
    const ctx = stage.canvas.getContext('2d')!;

    let mode: Mode = params.mode === 'fill' || params.mode === 'super' ? params.mode : 'states';
    let L = 1; // nm
    let nSel = 1;
    let Npart = 6;
    let T = 0; // K
    let stats: Stats = 'fermi';
    let phaseT = 0; // animation clock for the superposition, in units of the beat period

    const E1 = () => E1_EL_1NM / (L * L);
    const En = (n: number) => n * n * E1();

    // occupation of each *level* (fermions: up to 2, one per spin state)
    const occ = new Float64Array(NLEV + 1);
    let mu = 0;
    function solveOccupation() {
      occ.fill(0);
      const kT = KB_EV * T;
      if (kT < 1e-9 * E1()) {
        // T = 0: fill from the bottom
        if (stats === 'fermi') {
          let left = Npart;
          for (let n = 1; n <= NLEV && left > 0; n++) { const k = Math.min(2, left); occ[n] = k; left -= k; }
          mu = En(Math.ceil(Npart / 2));
        } else { occ[1] = Npart; mu = En(1); }
        return;
      }
      const g = stats === 'fermi' ? 2 : 1;
      const f = (E: number, m: number) => g / (Math.exp((E - m) / kT) + (stats === 'fermi' ? 1 : -1));
      const total = (m: number) => { let s = 0; for (let n = 1; n <= NLEV; n++) s += f(En(n), m); return s; };
      // bracket μ: fermions anywhere; bosons strictly below E₁
      let lo = stats === 'fermi' ? En(1) - 50 * kT - En(NLEV) : En(1) - 200 * kT - 10 * E1();
      let hi = stats === 'fermi' ? En(NLEV) + 50 * kT : En(1) - 1e-12 * E1();
      for (let it = 0; it < 200; it++) {
        const m = 0.5 * (lo + hi);
        if (total(m) > Npart) hi = m; else lo = m;
      }
      mu = 0.5 * (lo + hi);
      for (let n = 1; n <= NLEV; n++) occ[n] = f(En(n), mu);
    }

    const loop = new Loop((dt) => { if (mode === 'super') phaseT += dt / 2.5; }, render, 1 / 60);

    function drawBox(x0: number, x1: number, y0: number, y1: number) {
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.fillStyle = pal.grid;
      ctx.fillRect(x0 - 10, y0, 10, y1 - y0); ctx.fillRect(x1, y0, 10, y1 - y0);
    }

    function render() {
      if (mode === 'fill') solveOccupation();
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = `${W < 560 ? 10 : 12}px Inter, system-ui, sans-serif`;
      const x0 = W * 0.16, x1 = W * (mode === 'fill' ? 0.56 : 0.7), yb = H - 34, yt = 26;
      drawBox(x0, x1, yt, yb);
      ctx.fillStyle = pal.muted; ctx.textAlign = 'center';
      ctx.fillText(`0`, x0, yb + 16); ctx.fillText(`L = ${fmt(L, 3)} nm`, x1, yb + 16);

      if (mode === 'states') {
        const nMax = Math.max(5, nSel);
        const Emax = En(nMax) * 1.12;
        const Y = (E: number) => yb - (E / Emax) * (yb - yt);
        for (let n = 1; n <= nMax; n++) {
          const y = Y(En(n));
          const sel = n === nSel;
          ctx.strokeStyle = sel ? pal.accent : pal.faint; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
          const A = Math.min(40, (yb - yt) * 0.065); // same drawn amplitude for every level
          if (sel) {
            // |ψ|² shaded
            ctx.beginPath(); ctx.moveTo(x0, y);
            for (let i = 0; i <= 200; i++) { const u = i / 200, s = Math.sin(n * Math.PI * u); ctx.lineTo(x0 + u * (x1 - x0), y - A * s * s * 1.6); }
            ctx.lineTo(x1, y); ctx.closePath();
            ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1;
          }
          ctx.beginPath();
          for (let i = 0; i <= 200; i++) { const u = i / 200; const X = x0 + u * (x1 - x0), yy = y - A * Math.sin(n * Math.PI * u); i ? ctx.lineTo(X, yy) : ctx.moveTo(X, yy); }
          ctx.strokeStyle = sel ? pal.accent : pal.accent2; ctx.lineWidth = sel ? 2 : 1.3; ctx.stroke();
          ctx.fillStyle = sel ? pal.accent : pal.muted; ctx.textAlign = 'left';
          ctx.fillText(`n=${n}  ${fmtE(En(n))}`, x1 + 16, y + 4);
        }
        ctx.textAlign = 'left'; ctx.fillStyle = pal.muted;
        ctx.fillText('energy ↑', 10, yt + 4);
        ctx.fillText(`${nSel - 1} node${nSel === 2 ? '' : 's'} inside the box`, 10, yt + 22);
      } else if (mode === 'super') {
        // ψ = (ψ1 e^{-iE1t/ħ} + ψ2 e^{-iE2t/ħ})/√2 ; relative phase advances by 2π per beat period
        const ph = 2 * Math.PI * phaseT;
        const peak = 2.0;
        const Y = (p: number) => yb - (p / peak) * (yb - yt) * 0.9;
        ctx.beginPath(); ctx.moveTo(x0, yb);
        let xm = 0, norm = 0;
        for (let i = 0; i <= 300; i++) {
          const u = i / 300, a = Math.sin(Math.PI * u), b = Math.sin(2 * Math.PI * u);
          const p = a * a + b * b + 2 * a * b * Math.cos(ph); // ∝ |ψ|² (units of 1/L)
          ctx.lineTo(x0 + u * (x1 - x0), Y(p));
          xm += u * p; norm += p;
        }
        ctx.lineTo(x1, yb); ctx.closePath();
        ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.accent; ctx.lineWidth = 2; ctx.stroke();
        // expectation value of x
        const X = x0 + (xm / norm) * (x1 - x0);
        ctx.strokeStyle = pal.accent2; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X, yt); ctx.lineTo(X, yb); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = pal.accent2; ctx.textAlign = 'center'; ctx.fillText('⟨x⟩', X, yt - 6);
        const Tbeat = H_EV_S / (En(2) - En(1));
        ctx.textAlign = 'left'; ctx.fillStyle = pal.muted;
        ctx.fillText('|ψ|² for (ψ₁+ψ₂)/√2', 10, yt + 4);
        ctx.fillText(`slosh period h/(E₂−E₁) = ${fmtT(Tbeat)}`, 10, yt + 22);
        ctx.fillText('(slowed down for display)', 10, yt + 40);
      } else {
        const nShow = Math.min(NLEV, Math.max(6, stats === 'fermi' ? Math.ceil(Npart / 2) + 3 : 5));
        const Emax = En(nShow) * 1.08;
        const Y = (E: number) => yb - (E / Emax) * (yb - yt);
        const g = stats === 'fermi' ? 2 : 1;
        for (let n = 1; n <= nShow; n++) {
          const y = Y(En(n));
          ctx.strokeStyle = pal.faint; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x0 + 8, y); ctx.lineTo(x1 - 8, y); ctx.stroke();
          const cx = (x0 + x1) / 2;
          if (stats === 'fermi') {
            // two slots: spin up and spin down; each drawn with opacity = occupancy per slot
            const p = occ[n] / g;
            [-1, 1].forEach((side) => {
              const X = cx + side * 18;
              ctx.globalAlpha = Math.max(0.08, p);
              ctx.fillStyle = pal.accent;
              ctx.beginPath(); ctx.arc(X, y, 7, 0, Math.PI * 2); ctx.fill();
              ctx.globalAlpha = 1;
              ctx.strokeStyle = pal.accent; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.arc(X, y, 7, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = pal.bg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              if (p > 0.5) ctx.fillText(side < 0 ? '↑' : '↓', X, y + 1);
              ctx.textBaseline = 'alphabetic';
            });
          } else {
            // bosons: a stack of dots, count = occupancy (rounded for display)
            const k = occ[n];
            const nd = Math.round(k);
            for (let i = 0; i < nd; i++) {
              const X = cx + (i - (nd - 1) / 2) * 13;
              ctx.fillStyle = pal.accent2; ctx.beginPath(); ctx.arc(X, y, 5, 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.fillStyle = pal.muted; ctx.textAlign = 'left';
          ctx.fillText(`n=${n}  ${fmtE(En(n))}   ⟨N⟩ = ${fmt(occ[n], 2)}`, x1 + 16, y + 4);
        }
        // chemical potential / Fermi level
        if (mu > 0 && mu < Emax) {
          const y = Y(mu);
          ctx.strokeStyle = pal.bad; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = pal.bad; ctx.textAlign = 'right';
          ctx.fillText(stats === 'fermi' && T === 0 ? 'Fermi level' : 'μ', x1 - 4, y - 4);
        }
        let Etot = 0; for (let n = 1; n <= NLEV; n++) Etot += occ[n] * En(n);
        ctx.textAlign = 'left'; ctx.fillStyle = pal.muted;
        ctx.fillText(`${Npart} ${stats === 'fermi' ? 'fermions' : 'bosons'}, T = ${fmt(T, 3)} K`, 10, yt + 4);
        ctx.fillText(`total E = ${fmtE(Etot)}`, 10, yt + 22);
        ctx.fillText(`vs all in n=1: ${fmtE(Npart * En(1))}`, 10, yt + 40);
      }
    }

    function fmtE(E: number) { return E >= 1 ? `${fmt(E, 3)} eV` : `${fmt(E * 1e3, 3)} meV`; }
    function fmtT(t: number) { return t >= 1e-12 ? `${fmt(t * 1e15, 3)} fs` : `${fmt(t * 1e18, 3)} as`; }

    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.select<Mode>('View', [
      { value: 'states', label: 'Stationary states' },
      { value: 'super', label: 'Superposition of n=1 and 2' },
      { value: 'fill', label: 'Fill the box (Pauli)' },
    ], mode, (v) => { mode = v; show(); loop.invalidate(); });
    panel.slider('Box width L', { min: 0.1, max: 5, value: L, log: true, unit: 'nm' }, (v) => { L = v; update(); });
    const nCtl = panel.slider('Level n', { min: 1, max: 8, value: nSel, step: 1, format: (v) => String(Math.round(v)) }, (v) => { nSel = Math.round(v); update(); });
    const NCtl = panel.slider('Particles', { min: 1, max: 20, value: Npart, step: 1, format: (v) => String(Math.round(v)) }, (v) => { Npart = Math.round(v); update(); });
    const TCtl = panel.slider('Temperature', { min: 0, max: 20000, value: T, step: 100, unit: 'K' }, (v) => { T = v; update(); });
    const sCtl = panel.select<Stats>('Particles are', [
      { value: 'fermi', label: 'Fermions (electrons)' },
      { value: 'bose', label: 'Bosons' },
    ], stats, (v) => { stats = v; update(); });
    const r1 = panel.readout('E₁ =');
    const r2 = panel.readout('');

    function show() {
      nCtl.el.style.display = mode === 'states' ? '' : 'none';
      [NCtl.el, TCtl.el, sCtl.el].forEach((el) => (el.style.display = mode === 'fill' ? '' : 'none'));
      update();
    }
    function update() {
      r1.set(fmtE(E1()));
      if (mode === 'states' && nSel > 1) {
        const dE = En(nSel) - En(nSel - 1);
        r2.set(`photon for n=${nSel}→${nSel - 1}: λ = ${fmt(HC_EV_NM / dE, 3)} nm`);
      } else if (mode === 'fill') r2.set(`kT = ${fmtE(KB_EV * T)}`);
      else r2.set('');
      loop.invalidate();
    }
    show();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
