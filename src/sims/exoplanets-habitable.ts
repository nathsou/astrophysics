// Secondary figure: habitable-zone calculator. Drag the star's luminosity (and, via a preset,
// its temperature) and watch the conservative habitable zone scale as sqrt(L). Picking a preset
// star places its real planets on the (logarithmic) distance axis.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

// Each preset carries its known planets (name, semi-major axis in AU) to place on the axis.
const PRESETS: { name: string; L: number; T: number; planets: [string, number][] }[] = [
  { name: 'Sun (G2V)', L: 1, T: 5772, planets: [['Mercury', 0.387], ['Venus', 0.723], ['Earth', 1], ['Mars', 1.524], ['Jupiter', 5.2], ['Saturn', 9.58]] },
  { name: 'TRAPPIST-1 (M8V)', L: 0.000553, T: 2566, planets: [['b', 0.0115], ['c', 0.0158], ['d', 0.0223], ['e', 0.0293], ['f', 0.0385], ['g', 0.0469], ['h', 0.0619]] },
  { name: 'Kepler-186 (M1V)', L: 0.055, T: 3755, planets: [['b', 0.0378], ['c', 0.0574], ['d', 0.0861], ['e', 0.1216], ['f', 0.432]] },
  { name: 'Proxima Centauri (M5.5V)', L: 0.0017, T: 3042, planets: [['d', 0.029], ['b', 0.0485]] },
];
const AU_MIN = 0.005, AU_MAX = 30;

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 3.4 });
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
    const tReadout = panel.readout('Star T_eff (main sequence)');

    // Main-sequence effective temperature for a given luminosity: log-linear interpolation
    // through the preset stars (plus an A star at 30 L☉).
    const TL: [number, number][] = [[1e-4, 2300], [0.000553, 2566], [0.0017, 3042], [0.055, 3755], [1, 5772], [30, 9000]];
    function tempFor(L: number) {
      const x = Math.log(Math.min(Math.max(L, TL[0][0]), TL[TL.length - 1][0]));
      for (let i = 1; i < TL.length; i++) {
        const xa = Math.log(TL[i - 1][0]), xb = Math.log(TL[i][0]);
        if (x <= xb) return TL[i - 1][1] + ((x - xa) / (xb - xa)) * (TL[i][1] - TL[i - 1][1]);
      }
      return TL[TL.length - 1][1];
    }
    // Kopparapu et al. (2013) effective stellar flux at each edge (in units of Earth's insolation),
    // as a quartic in (T_eff − 5780 K); valid for 2600–7200 K, so T is clamped to that range.
    function sEff(T: number, c: [number, number, number, number, number]) {
      const t = Math.min(7200, Math.max(2600, T)) - 5780;
      return c[0] + c[1] * t + c[2] * t * t + c[3] * t ** 3 + c[4] * t ** 4;
    }
    const RUNAWAY: [number, number, number, number, number] = [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15];
    const MAXGH: [number, number, number, number, number] = [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16];

    function render() {
      const L = lumCtl.get();
      const T = tempFor(L);
      const dInner = Math.sqrt(L / sEff(T, RUNAWAY)); // runaway greenhouse
      const dOuter = Math.sqrt(L / sEff(T, MAXGH)); // maximum greenhouse
      innerReadout.set(`${fmt(dInner, 3)} AU`);
      outerReadout.set(`${fmt(dOuter, 3)} AU`);
      earthReadout.set(`${fmt(Math.sqrt(L), 3)} AU (equal insolation to Earth)`);
      tReadout.set(`${Math.round(T / 10) * 10} K`);

      const w = stage.width, h = stage.height, dpr = stage.dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cy = h * 0.55;
      const x0 = 64, x1 = w - 24;
      // log distance axis, so a red dwarf's HZ (a few hundredths of an AU) and a bright star's both fit
      const toPx = (au: number) => x0 + ((Math.log(au) - Math.log(AU_MIN)) / (Math.log(AU_MAX) - Math.log(AU_MIN))) * (x1 - x0);
      const font = (px: number) => `${px}px Inter, system-ui, sans-serif`;

      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 - 20, cy); ctx.lineTo(x1, cy); ctx.stroke();
      const narrow = w < 520;
      for (const au of [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30]) {
        if (narrow && [0.03, 0.3, 3].includes(au)) continue;
        const x = toPx(au);
        ctx.strokeStyle = pal.faint;
        ctx.beginPath(); ctx.moveTo(x, cy - 4); ctx.lineTo(x, cy + 4); ctx.stroke();
        ctx.fillStyle = pal.muted; ctx.font = font(10); ctx.textAlign = 'center';
        ctx.fillText(`${au} AU`, x, cy + 40);
      }

      // habitable zone band
      const hx0 = toPx(dInner), hx1 = toPx(dOuter);
      ctx.fillStyle = pal.good; ctx.globalAlpha = 0.18;
      ctx.fillRect(hx0, cy - 22, hx1 - hx0, 44);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.good;
      ctx.strokeRect(hx0, cy - 22, hx1 - hx0, 44);
      ctx.fillStyle = pal.good; ctx.font = font(11); ctx.textAlign = 'center';
      ctx.fillText('habitable zone', (hx0 + hx1) / 2, cy - 28);

      // star, drawn at the left end of the axis
      const r = Math.min(22, 7 + 6 * Math.pow(L, 0.15));
      const g = ctx.createRadialGradient(x0 - 34, cy, 0, x0 - 34, cy, r * 1.8);
      g.addColorStop(0, blackbodyCSS(T)); g.addColorStop(0.55, blackbodyCSS(T)); g.addColorStop(1, blackbodyCSS(T, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x0 - 34, cy, r * 1.8, 0, 2 * Math.PI); ctx.fill();

      // Earth-equivalent insolation marker
      const dEq = Math.sqrt(L);
      if (dEq >= AU_MIN && dEq <= AU_MAX) {
        ctx.strokeStyle = pal.accent; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(toPx(dEq), cy - 22); ctx.lineTo(toPx(dEq), cy + 22); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = pal.accent; ctx.font = font(10); ctx.textAlign = 'center';
        ctx.fillText('Earth-like insolation', toPx(dEq), cy + 56);
      }

      // the preset's real planets, when the luminosity matches that star
      const preset = PRESETS.find((p) => Math.abs(Math.log(p.L / L)) < 0.01);
      if (preset) {
        let lastX = -1e9, row = 0;
        for (const [name, a] of preset.planets) {
          const x = toPx(a);
          const inHZ = a >= dInner && a <= dOuter;
          ctx.fillStyle = inHZ ? pal.good : pal.fg;
          ctx.beginPath(); ctx.arc(x, cy, 3.5, 0, 2 * Math.PI); ctx.fill();
          row = x - lastX < 38 ? 1 - row : 0; // stagger crowded labels
          lastX = x;
          ctx.font = font(10); ctx.textAlign = 'center';
          ctx.fillText(name, x, cy - 50 - row * 12);
        }
      }
    }

    stage.onResize(() => render());
    onThemeChange(() => { pal = palette(); render(); });
    onDestroy(() => {});
    return { setVisible: () => render() };
  },
});
