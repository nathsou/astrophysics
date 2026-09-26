// Secondary figure: habitable-zone calculator. Drag the star's luminosity (and, via a preset,
// its temperature) and watch the conservative habitable zone scale as sqrt(L), with a few
// worked systems (Sun, TRAPPIST-1, Kepler-186) placed for reference.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const PRESETS = [
  { name: 'Sun (G2V)', L: 1, T: 5772 },
  { name: 'TRAPPIST-1 (M8V)', L: 0.000553, T: 2566 },
  { name: 'Kepler-186 (M1V)', L: 0.04, T: 3755 },
  { name: 'Proxima Centauri (M5.5V)', L: 0.0017, T: 3042 },
];

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 2.6 });
    const ctx = stage.canvas.getContext('2d')!;

    const panel = new Panel(host);
    const lumCtl = panel.slider('Stellar luminosity', { min: 0.0001, max: 30, value: 1, log: true, unit: 'L☉' }, () => render());
    const select = panel.select('Preset', PRESETS.map((p) => ({ value: p.name, label: p.name })), 'Sun (G2V)', (v) => {
      const p = PRESETS.find((x) => x.name === v)!;
      lumCtl.set(p.L, true);
    });
    const innerReadout = panel.readout('Inner edge (runaway greenhouse)');
    const outerReadout = panel.readout('Outer edge (max. greenhouse)');
    const earthReadout = panel.readout('Earth-equivalent orbit');

    function tempFor(L: number) {
      const p = PRESETS.reduce((a, b) => (Math.abs(Math.log(b.L) - Math.log(L)) < Math.abs(Math.log(a.L) - Math.log(L)) ? b : a));
      return p.T;
    }

    function render() {
      const L = lumCtl.get();
      // Conservative HZ (Kopparapu et al. 2013 style scaling, simplified to sqrt(L)):
      const dInner = Math.sqrt(L / 1.1); // runaway greenhouse
      const dOuter = Math.sqrt(L / 0.53); // maximum greenhouse
      innerReadout.set(`${fmt(dInner, 3)} AU`);
      outerReadout.set(`${fmt(dOuter, 3)} AU`);
      earthReadout.set(`${fmt(Math.sqrt(L), 3)} AU (equal insolation to Earth)`);

      const w = stage.width, h = stage.height, dpr = stage.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = 60, cy = h / 2;
      const maxAU = 20;
      const scale = (w - 100) / Math.sqrt(maxAU); // sqrt scale so both tiny and huge HZs are visible
      const toPx = (au: number) => cx + Math.sqrt(au) * scale;

      // orbit axis
      ctx.strokeStyle = pal.grid;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(w - 20, cy); ctx.stroke();
      for (const au of [0.1, 0.3, 1, 3, 10, 20]) {
        const x = toPx(au);
        ctx.strokeStyle = pal.faint;
        ctx.beginPath(); ctx.moveTo(x, cy - 4); ctx.lineTo(x, cy + 4); ctx.stroke();
        ctx.fillStyle = pal.muted;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${au} AU`, x, cy + 18);
      }

      // habitable zone band
      ctx.fillStyle = pal.good + '33';
      ctx.fillRect(toPx(dInner), cy - 24, toPx(dOuter) - toPx(dInner), 48);
      ctx.strokeStyle = pal.good;
      ctx.strokeRect(toPx(dInner), cy - 24, toPx(dOuter) - toPx(dInner), 48);

      // star
      const T = tempFor(L);
      const r = 8 + 10 * Math.pow(L, 0.2);
      ctx.fillStyle = blackbodyCSS(T);
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(r, 26), 0, 7); ctx.fill();

      // Earth marker at 1 AU-equivalent
      const dEq = Math.sqrt(L);
      if (dEq <= maxAU) {
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(toPx(dEq), cy, 4, 0, 7); ctx.fill();
        ctx.fillStyle = pal.fg;
        ctx.textAlign = 'center';
        ctx.fillText('equal insolation to Earth', toPx(dEq), cy - 32);
      }
    }

    stage.onResize(() => render());
    onThemeChange(() => { pal = palette(); render(); });
    onDestroy(() => {});
    return { setVisible: () => render() };
  },
});
