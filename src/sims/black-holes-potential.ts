// Chapter 19: the Schwarzschild effective potential vs the Newtonian one.
// Units r_s = 1, c = 1 (so GM = 1/2). Per unit rest mass, the radial equation is
//   ½ ṙ² + V(r) = ½(E² − 1),   V(r) = −1/(2r) + L²/(2r²) − L²/(2r³)
// and the Newtonian V_N drops the last term. For light: ṙ²/L² + W(r) = 1/b², W = (1 − 1/r)/r².

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const V = (r: number, L: number) => -1 / (2 * r) + (L * L) / (2 * r * r) - (L * L) / (2 * r ** 3);
const VN = (r: number, L: number) => -1 / (2 * r) + (L * L) / (2 * r * r);
const W = (r: number) => (1 - 1 / r) / (r * r);

/** Circular orbits: r² − 2L² r + 3L² = 0. */
function circular(L: number): { stable?: number; unstable?: number } {
  const L2 = L * L, disc = L2 * L2 - 3 * L2;
  if (disc < 0) return {};
  const s = Math.sqrt(disc);
  return { stable: L2 + s, unstable: L2 - s };
}

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const stage = createStage(host, { aspect: 16 / 9 });
    let mode: 'massive' | 'photon' = params.mode === 'photon' ? 'photon' : 'massive';
    let L = 1.9;
    let eps = -0.03; // ½(E² − 1) for particles
    let invB2 = 0.12; // 1/b² for photons
    const plot = new Plot(stage.canvas, { x: { min: 1, max: 30, log: true, label: 'r / r_s' }, y: { min: -0.25, max: 0.1, label: 'V_eff  (c² per unit mass)' } });

    function setAxes() {
      if (mode === 'massive') { plot.o.y = { min: -0.2, max: 0.12, label: 'V_eff  (units of c², per unit mass)' }; plot.o.x.max = 40; }
      else { plot.o.y = { min: 0, max: 0.3, label: 'W(r) = (1 − r_s/r) r_s²/r²' }; plot.o.x.max = 12; }
    }
    setAxes();

    const loop = new Loop(null, () => {
      plot.draw(() => {
        const c = circular(L);
        if (mode === 'massive') {
          plot.hline(0, { color: pal.faint });
          plot.fn((r) => VN(r, L), { color: pal.muted, dash: [5, 4], width: 1.4 });
          plot.fn((r) => V(r, L), { color: pal.series[0], width: 2.2 });
          plot.vline(3, { color: pal.accent3, label: 'ISCO 3 r_s' });
          plot.vline(1, { color: pal.bad, label: 'horizon' });
          plot.hline(eps, { color: pal.accent, dash: [], width: 1.5 });
          if (c.stable) plot.point(c.stable, V(c.stable, L), { color: pal.good, label: `stable ${fmt(c.stable, 3)}` });
          if (c.unstable) plot.point(c.unstable, V(c.unstable, L), { color: pal.bad, label: `unstable ${fmt(c.unstable, 3)}` });
          // Newtonian circular orbit, for comparison: r = 2L²
          plot.point(2 * L * L, VN(2 * L * L, L), { r: 3, color: pal.muted });
        } else {
          plot.fn(W, { color: pal.series[1], width: 2.2 });
          plot.vline(1.5, { color: pal.accent3, label: 'photon sphere 1.5 r_s' });
          plot.vline(1, { color: pal.bad, label: 'horizon' });
          plot.hline(invB2, { color: pal.accent, dash: [], width: 1.5 });
          plot.point(1.5, 4 / 27, { color: pal.bad, label: 'unstable circular (light)' });
        }
      });
      // fate of the orbit
      if (mode === 'massive') {
        const c = circular(L);
        const peak = c.unstable ? V(c.unstable, L) : Infinity;
        let fate: string;
        if (!c.stable) fate = 'L < √3: no barrier at all. Everything plunges.';
        else if (eps > peak) fate = 'Energy above the barrier: plunges into the hole.';
        else if (eps >= 0) fate = 'Unbound: swings past and escapes (or plunges if coming from inside).';
        else if (eps < V(c.stable, L)) fate = 'Below the well: not allowed.';
        else fate = 'Bound, precessing orbit between two turning points.';
        fateOut.set(fate);
        circOut.set(c.stable ? `stable ${fmt(c.stable, 3)} r_s, unstable ${fmt(c.unstable!, 3)} r_s` : 'none');
        EOut.set(fmt(Math.sqrt(Math.max(0, 1 + 2 * eps)), 4) + ' mc²');
      } else {
        const b = 1 / Math.sqrt(invB2);
        fateOut.set(invB2 > 4 / 27 ? 'b < √27/2 r_s: captured.' : 'b > √27/2 r_s: deflected, escapes.');
        circOut.set('r = 1.5 r_s (unstable)');
        EOut.set(`b = ${fmt(b, 3)} r_s`);
      }
    });
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    // drag vertically to set the energy line
    const el = stage.canvas;
    el.style.touchAction = 'none';
    el.style.cursor = 'ns-resize';
    let drag = false;
    const setFromY = (e: PointerEvent) => {
      const y = plot.dy(e.clientY - el.getBoundingClientRect().top);
      if (mode === 'massive') eps = Math.max(plot.o.y.min, Math.min(plot.o.y.max, y));
      else invB2 = Math.max(0.001, Math.min(plot.o.y.max, y));
      loop.invalidate();
    };
    el.addEventListener('pointerdown', (e) => { drag = true; el.setPointerCapture(e.pointerId); setFromY(e); });
    el.addEventListener('pointermove', (e) => drag && setFromY(e));
    el.addEventListener('pointerup', () => (drag = false));
    el.addEventListener('pointercancel', () => (drag = false));

    const panel = new Panel(host);
    panel.select('Particle', [{ value: 'massive', label: 'Massive particle' }, { value: 'photon', label: 'Photon' }], mode, (v) => {
      mode = v; setAxes(); Lslider.el.style.display = v === 'massive' ? '' : 'none'; loop.invalidate();
    });
    const Lslider = panel.slider('L', { min: 0.8, max: 4, value: L, step: 0.005, unit: 'r_s c' }, (v) => { L = v; loop.invalidate(); });
    if (mode !== 'massive') Lslider.el.style.display = 'none';
    panel.button('L = √3 (ISCO)', () => { L = Math.sqrt(3) + 1e-4; Lslider.set(L); loop.invalidate(); });
    const circOut = panel.readout('Circular orbits:');
    const EOut = panel.readout('E =');
    const fateOut = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
