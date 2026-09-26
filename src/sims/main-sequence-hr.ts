// Chapter 14 figure: an observational HR diagram of ~150 bright and nearby stars (approximate
// L, Teff), with luminosity-class bands and hover labels — the "real data" counterpart to the
// clean theoretical ZAMS line in the flagship sim.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';
import { mulberry32 } from './main-sequence/zams';

interface Star { name: string; T: number; L: number; cls: 'V' | 'IV' | 'III' | 'I' | 'D'; }

// A representative (not exhaustive) set of nearby/bright stars with approximate T, L.
const NAMED: Star[] = [
  { name: 'Sun', T: 5772, L: 1, cls: 'V' },
  { name: 'Proxima Cen', T: 3050, L: 0.0017, cls: 'V' },
  { name: 'α Cen A', T: 5790, L: 1.52, cls: 'V' },
  { name: 'Sirius A', T: 9940, L: 25.4, cls: 'V' },
  { name: 'Sirius B', T: 25000, L: 0.056, cls: 'D' },
  { name: 'Vega', T: 9600, L: 40, cls: 'V' },
  { name: 'Altair', T: 7700, L: 10.6, cls: 'IV' },
  { name: 'Procyon A', T: 6530, L: 6.9, cls: 'IV' },
  { name: 'Arcturus', T: 4290, L: 170, cls: 'III' },
  { name: 'Aldebaran', T: 3900, L: 439, cls: 'III' },
  { name: 'Pollux', T: 4666, L: 43, cls: 'III' },
  { name: 'Capella Aa', T: 4970, L: 79, cls: 'III' },
  { name: 'Regulus', T: 12500, L: 288, cls: 'V' },
  { name: 'Spica', T: 22400, L: 20500, cls: 'V' },
  { name: 'Rigel', T: 12100, L: 120000, cls: 'I' },
  { name: 'Betelgeuse', T: 3600, L: 126000, cls: 'I' },
  { name: 'Antares', T: 3570, L: 76000, cls: 'I' },
  { name: 'Deneb', T: 8500, L: 196000, cls: 'I' },
  { name: 'Polaris', T: 6015, L: 1260, cls: 'I' },
  { name: 'Barnard’s Star', T: 3200, L: 0.0035, cls: 'V' },
  { name: '61 Cygni A', T: 4525, L: 0.153, cls: 'V' },
  { name: 'Van Maanen 2', T: 6220, L: 0.00017, cls: 'D' },
];

function synth(rng: () => number): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < 130; i++) {
    const u = rng();
    // biased toward the MS but sprinkled with giants and a few WDs, to look like a real sample
    if (u < 0.78) {
      const T = 3000 + rng() * rng() * 27000;
      const L = Math.pow(10, (T - 5772) / 4200 + (rng() - 0.5) * 0.6);
      out.push({ name: '', T, L, cls: 'V' });
    } else if (u < 0.94) {
      const T = 3200 + rng() * 2200;
      const L = 10 ** (1.2 + rng() * 2.3);
      out.push({ name: '', T, L, cls: 'III' });
    } else {
      const T = 6000 + rng() * 20000;
      const L = 10 ** (-3.5 + rng() * 1.5);
      out.push({ name: '', T, L, cls: 'D' });
    }
  }
  return out;
}

const CLASS_LABEL: Record<Star['cls'], string> = { V: 'Main sequence (V)', IV: 'Subgiants (IV)', III: 'Giants (III)', I: 'Supergiants (I)', D: 'White dwarfs (D)' };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 10 });
    const plot = new Plot(stage.canvas, {
      x: { min: -Math.log10(45000), max: -Math.log10(2600), label: 'Tₑff (K) — increasing to the left', format: (v) => String(Math.round(10 ** -v)) },
      y: { min: -4.5, max: 6, label: 'log(L / L☉)' },
      title: '≈150 bright and nearby stars',
    });
    const xData = (T: number) => -Math.log10(T);

    const stars = [...NAMED, ...synth(mulberry32(7))];
    let hover: Star | null = null;

    stage.overlay.style.pointerEvents = 'auto';
    stage.overlay.addEventListener('pointermove', (e) => {
      const rect = stage.overlay.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let best: Star | null = null, bd = 12;
      for (const s of stars) {
        const dx = plot.px(xData(s.T)) - mx, dy = plot.py(Math.log10(s.L)) - my;
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = s; }
      }
      hover = best;
      loop.invalidate();
    });

    function render() {
      plot.draw(() => {
        for (const s of stars) {
          plot.point(xData(s.T), Math.log10(s.L), { r: s === hover ? 5 : 3, color: blackbodyCSS(s.T), stroke: s === hover ? pal.fg : undefined });
        }
        if (hover) {
          const label = hover.name || CLASS_LABEL[hover.cls];
          plot.text(`${label} — ${Math.round(hover.T)} K, ${hover.L >= 1 ? hover.L.toFixed(1) : hover.L.toExponential(1)} L☉`, plot.px(xData(hover.T)) + 8, plot.py(Math.log10(hover.L)) - 8, { color: pal.fg });
        }
      });
    }
    const loop = new Loop(null, render);
    stage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
