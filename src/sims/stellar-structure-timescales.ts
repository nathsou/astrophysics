// Secondary figure: the three timescales of stellar structure, as functions of mass.
// Dynamical: t_dyn ~ sqrt(R^3 / GM)  (how fast the star notices it's out of hydrostatic balance)
// Kelvin–Helmholtz: t_KH ~ GM^2 / (R L)  (how fast it could radiate away its gravitational energy)
// Nuclear: t_nuc ~ 0.007 x 0.1 x M c^2 / L  (how long its nuclear fuel actually lasts)
// Main-sequence scaling laws R ~ M^0.8, L ~ M^3.5 (both in solar units) give closed forms; a mass
// slider sweeps a marker across log-log curves of all three, in years, from red dwarfs to O stars.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { G, Msun, Rsun, Lsun, c, yr } from '../lib/physics/constants';

function timescales(Mmsun: number) {
  const Rsol = Math.pow(Mmsun, 0.8);
  const Lsol = Math.pow(Mmsun, 3.5);
  const M = Mmsun * Msun, R = Rsol * Rsun, L = Lsol * Lsun;
  const tDyn = Math.sqrt((R * R * R) / (G * M));
  const tKH = (G * M * M) / (R * L);
  const tNuc = (0.007 * 0.1 * M * c * c) / L;
  return { tDyn: tDyn / yr, tKH: tKH / yr, tNuc: tNuc / yr, Rsol, Lsol };
}

export default defineSim({
  mount({ host }) {
    const stage = createStage(host, { aspect: 16 / 9 });
    const plot = new Plot(stage.canvas, {
      x: { min: 0.1, max: 60, log: true, label: 'M / M☉' },
      y: { min: 1e-4, max: 3e11, log: true, label: 't (yr)' },
    });
    stage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); draw(); });
    let pal = palette();
    onThemeChange(() => { pal = palette(); draw(); });

    let M = 1;
    const panel = new Panel(host);
    panel.slider('Mass M', { min: 0.1, max: 60, value: M, log: true, unit: 'M☉' }, (v) => { M = v; draw(); });
    const roDyn = panel.readout('Dynamical time');
    const roKH = panel.readout('Kelvin–Helmholtz time');
    const roNuc = panel.readout('Nuclear time');

    function yrLabel(y: number) {
      if (y < 1e-3) return `${fmt(y * yr, 3)} s`;
      if (y < 1) return `${fmt(y * 365.25, 3)} days`;
      return `${fmt(y, 3)} yr`;
    }

    function draw() {
      const t = timescales(M);
      roDyn.set(yrLabel(t.tDyn));
      roKH.set(yrLabel(t.tKH));
      roNuc.set(yrLabel(t.tNuc));
      plot.draw(() => {
        plot.fn((m) => timescales(m).tDyn, { color: pal.series[0] });
        plot.fn((m) => timescales(m).tKH, { color: pal.series[1] });
        plot.fn((m) => timescales(m).tNuc, { color: pal.series[2] });
        plot.vline(M, { color: pal.accent });
        plot.point(M, t.tDyn, { color: pal.series[0] });
        plot.point(M, t.tKH, { color: pal.series[1] });
        plot.point(M, t.tNuc, { color: pal.series[2] });
        plot.text('t_dyn', plot.w - 60, plot.py(timescales(50).tDyn), { color: pal.series[0], size: 10 });
        plot.text('t_KH', plot.w - 60, plot.py(timescales(50).tKH), { color: pal.series[1], size: 10 });
        plot.text('t_nuc', plot.w - 60, plot.py(timescales(50).tNuc), { color: pal.series[2], size: 10 });
      });
    }

    draw();
    return { setVisible() {}, destroy() {} };
  },
});
