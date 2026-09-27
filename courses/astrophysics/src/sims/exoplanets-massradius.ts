// Secondary figure: mass-radius diagram. Scatter of representative confirmed planets plus
// analytic composition curves (iron, rock, water/ice, H/He envelope) so the reader can see
// where the "radius valley" (Fulton gap) sits between rocky super-Earths and gas-dominated
// sub-Neptunes.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

// Approximate analytic mass-radius relations (R in Earth radii, M in Earth masses), fit to
// the ranges relevant here — not precise equations of state. See the chapter text.
const CURVES: { id: string; label: string; short: string; color: 'accent' | 'accent2' | 'accent3' | 's0' | 's1'; R: (M: number) => number }[] = [
  { id: 'iron', label: 'pure iron', short: 'iron', color: 's1', R: (M) => 0.7 * Math.pow(M, 0.27) },
  { id: 'rock', label: 'rocky (Earth-like)', short: 'rock', color: 'accent', R: (M) => Math.pow(M, 0.27) },
  { id: 'water', label: 'water/ice', short: 'water', color: 'accent3', R: (M) => 1.27 * Math.pow(M, 0.27) },
  // Rocky core plus a 1%-by-mass H/He envelope, after the Lopez & Fortney (2014) fit at ~1 Gyr and
  // ~100× Earth's insolation: the envelope's thickness barely depends on mass, so R ≈ 2–2.7 R⊕.
  { id: 'hhe', label: 'rock + 1% H/He envelope', short: '1% H/He', color: 'accent2', R: (M) => (M >= 1 && M <= 30 ? Math.pow(M, 0.25) + 1.16 * Math.pow(M, -0.21) : NaN) },
  // Gas giants: mostly H/He, whose radius stays near Jupiter's over a factor of ~10 in mass.
  { id: 'giant', label: 'gas giant (mostly H/He)', short: 'gas giant', color: 's0', R: (M) => (M >= 60 ? 11.2 * Math.pow(M / 318, M < 318 ? 0.08 : -0.06) : NaN) },
];

// name, mass (M⊕), radius (R⊕) — approximate published values, for orientation not precision.
// Only planets with both a measured mass and a measured (transit) radius are listed.
const PLANETS: { name: string; M: number; R: number }[] = [
  { name: 'Mercury', M: 0.055, R: 0.38 }, { name: 'Venus', M: 0.815, R: 0.95 },
  { name: 'Earth', M: 1, R: 1 }, { name: 'Mars', M: 0.107, R: 0.53 },
  { name: 'Neptune', M: 17.1, R: 3.88 }, { name: 'Uranus', M: 14.5, R: 4.01 },
  { name: 'Saturn', M: 95.2, R: 9.14 }, { name: 'Jupiter', M: 317.8, R: 11.2 },
  { name: 'HD 189733 b', M: 359, R: 12.7 }, { name: 'GJ 1214 b', M: 8.2, R: 2.7 },
  { name: 'K2-18 b', M: 8.6, R: 2.6 }, { name: 'TRAPPIST-1 e', M: 0.69, R: 0.92 },
  { name: 'TRAPPIST-1 b', M: 1.37, R: 1.12 }, { name: 'Kepler-10b', M: 3.3, R: 1.47 },
  { name: '55 Cnc e', M: 8.0, R: 1.9 }, { name: 'WASP-39 b', M: 96, R: 14.0 },
  { name: 'HD 209458 b', M: 220, R: 15.3 }, { name: 'Kepler-36c', M: 8.1, R: 3.68 },
  { name: 'Kepler-36b', M: 4.5, R: 1.49 }, { name: 'GJ 486 b', M: 3.0, R: 1.34 },
  { name: 'LHS 1140 b', M: 5.6, R: 1.73 }, { name: 'WASP-107 b', M: 30.5, R: 10.7 },
];

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0.05, max: 4000, log: true, label: 'mass (M⊕)' },
      y: { min: 0.3, max: 20, log: true, label: 'radius (R⊕)' },
    });
    stage.onResize((w, h, dpr) => plot.resize(w, h, dpr));

    const panel = new Panel(host);
    const toggles = CURVES.map((c) => panel.toggle(c.label, true, () => render()));
    const hoverReadout = panel.readout('Hover a planet');

    function colorOf(c: (typeof CURVES)[number]['color']) {
      return c === 'accent' ? pal.accent : c === 'accent2' ? pal.accent2 : c === 'accent3' ? pal.accent3 : c === 's0' ? pal.series[0] : pal.series[1];
    }

    let hoverIdx = -1;
    function render() {
      plot.draw(() => {
        CURVES.forEach((c, i) => {
          if (!toggles[i].get()) return;
          const dashed = c.id === 'hhe' || c.id === 'giant';
          plot.fn((M) => c.R(M), { color: colorOf(c.color), width: 1.75, dash: dashed ? [5, 3] : undefined });
          // label each curve on the canvas so the legend is not needed
          const xl = c.id === 'hhe' ? 30 : c.id === 'giant' ? 1500 : 2500;
          const yl = c.R(xl);
          if (Number.isFinite(yl)) plot.text(c.short, plot.px(xl), plot.py(yl) + (c.id === 'giant' ? -6 : c.id === 'hhe' ? -6 : 14), { color: colorOf(c.color), align: 'right' });
        });
        PLANETS.forEach((p, i) => {
          plot.point(p.M, p.R, { r: i === hoverIdx ? 5.5 : 3, color: i === hoverIdx ? pal.fg : pal.muted, stroke: pal.bg });
        });
        // radius-valley band (Fulton gap), roughly 1.5-2.0 R⊕ for close-in planets
        plot.hline(1.5, { color: pal.faint, dash: [2, 4] });
        plot.hline(2.0, { color: pal.faint, dash: [2, 4], label: 'radius valley (Fulton gap)' });
        if (hoverIdx >= 0) {
          const p = PLANETS[hoverIdx];
          plot.text(`${p.name}: ${fmt(p.M, 3)} M⊕, ${fmt(p.R, 3)} R⊕`, plot.px(p.M) + 8, plot.py(p.R) - 8, { color: pal.fg });
        }
      });
    }

    function pick(clientX: number, clientY: number) {
      const r = stage.canvas.getBoundingClientRect();
      const mx = clientX - r.left, my = clientY - r.top;
      let best = -1, bestD = 18;
      PLANETS.forEach((p, i) => {
        const d = Math.hypot(plot.px(p.M) - mx, plot.py(p.R) - my);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }
    stage.canvas.addEventListener('pointermove', (ev) => {
      const i = pick(ev.clientX, ev.clientY);
      if (i !== hoverIdx) { hoverIdx = i; hoverReadout.set(i >= 0 ? PLANETS[i].name : '—'); render(); }
    });
    stage.canvas.addEventListener('pointerleave', () => { hoverIdx = -1; render(); });

    stage.onResize(() => render());
    onThemeChange(() => { pal = palette(); render(); });
    onDestroy(() => {});
    return { setVisible: () => render() };
  },
});
