// Chapter 4, figure: planetary equilibrium temperature, T_eq = T★√(R★/2a)·(1−A)^(1/4).
// Draggable star temperature/radius, orbital distance and albedo, with Earth/Venus/Mars presets
// and a caveat readout about the greenhouse effect.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyRGB } from '../lib/physics/blackbody';
import { Rsun, AU } from '../lib/physics/constants';

interface PlanetPreset { name: string; aAU: number; albedo: number; Tsurf: number; greenhouse: string }
const PLANETS: PlanetPreset[] = [
  { name: 'Venus', aAU: 0.723, albedo: 0.75, Tsurf: 737, greenhouse: '+500 K from a runaway CO₂ greenhouse' },
  { name: 'Earth', aAU: 1.0, albedo: 0.30, Tsurf: 288, greenhouse: '+33 K from H₂O/CO₂ greenhouse' },
  { name: 'Mars', aAU: 1.524, albedo: 0.25, Tsurf: 210, greenhouse: '+5 K — a thin CO₂ atmosphere' },
];

/** Cold (blue) → temperate (green) → hot (orange-red) false colour for a planet's temperature. */
const STOPS: [number, [number, number, number]][] = [[100, [120, 160, 255]], [230, [110, 200, 230]], [290, [110, 205, 120]], [380, [235, 195, 80]], [700, [255, 95, 60]]];
function tempColour(T: number) {
  if (T <= STOPS[0][0]) return `rgb(${STOPS[0][1]})`;
  for (let i = 1; i < STOPS.length; i++) {
    if (T <= STOPS[i][0]) {
      const f = (T - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]);
      return `rgb(${STOPS[i][1].map((c, k) => Math.round(STOPS[i - 1][1][k] + (c - STOPS[i - 1][1][k]) * f))})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1]})`;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 16 / 8 : 16 / 4.5 });
    const ctx = stage.canvas.getContext('2d')!;

    let Tstar = 5772, Rstar = 1, aAU = 1, albedo = 0.3;
    let active: PlanetPreset | null = PLANETS[1];

    function Teq() {
      const R = Rstar * Rsun, a = aAU * AU;
      return Tstar * Math.sqrt(R / (2 * a)) * (1 - albedo) ** 0.25;
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // a night sky in both themes: the star is drawn in its physical colour
      ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, W, H);
      const sky = { faint: 'rgba(200,210,235,0.5)', rule: 'rgba(200,210,235,0.5)', muted: 'rgba(220,226,240,0.75)', fg: '#eef0f6' };
      const cy = H / 2;
      const starX = W * 0.12, starR = 20 + 6 * Rstar;
      const [r, g, b] = blackbodyRGB(Tstar);
      const rgb = `${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0}`;
      const glow = ctx.createRadialGradient(starX, cy, 0, starX, cy, starR * 2.5);
      glow.addColorStop(0, `rgba(${rgb},0.5)`); glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(starX, cy, starR * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.beginPath(); ctx.arc(starX, cy, starR, 0, Math.PI * 2); ctx.fill();

      // orbital distance on a log axis (0.05–5 AU, matching the slider), with the real planets marked
      const x0 = starX + starR * 2.6, x1 = W - 40;
      const X = (au: number) => x0 + (Math.log(au / 0.05) / Math.log(100)) * (x1 - x0);
      ctx.strokeStyle = sky.faint;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(starX, cy); ctx.lineTo(x1 + 20, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.textAlign = 'center';
      // names on up to three staggered rows, so close ticks (narrow screens) never collide
      const rowEnd = [-1e9, -1e9, -1e9];
      for (const pl of PLANETS) {
        const x = X(pl.aAU), half = ctx.measureText(pl.name).width / 2 + 3;
        ctx.fillStyle = sky.faint;
        ctx.fillRect(x - 0.5, cy - 30, 1, 8);
        let row = rowEnd.findIndex((e) => x - half > e);
        if (row < 0) row = 2;
        rowEnd[row] = x + half;
        ctx.fillStyle = sky.muted;
        ctx.fillText(pl.name, x, cy - 36 - row * 12);
      }
      const orbitX = X(aAU);

      // planet coloured by a simple cold → temperate → hot scale (a 255 K body emits no visible light)
      const teq = Teq();
      ctx.fillStyle = tempColour(teq);
      ctx.beginPath(); ctx.arc(orbitX, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = sky.rule; ctx.stroke();

      ctx.fillStyle = sky.fg;
      ctx.font = '600 12px JetBrains Mono, ui-monospace, monospace';
      ctx.fillText(`T_eq ≈ ${Math.round(teq)} K`, orbitX, cy + 30);
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = sky.muted;
      ctx.fillText(`a = ${fmt(aAU, 3)} AU`, orbitX, cy + 46);
      ctx.textAlign = 'left';

      readTeq.set(`${Math.round(teq)} K (${Math.round(teq - 273.15)} °C)`.replace('-', '−'));
      readCompare.set(active ? `${active.name}: measured surface T ≈ ${active.Tsurf} K — ${active.greenhouse}` : 'Custom set-up: pick a planet preset to compare with a real surface temperature.');
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.select('Planet preset', PLANETS.map((p) => ({ value: p.name, label: p.name })), 'Earth', (name) => {
      const pl = PLANETS.find((p) => p.name === name)!;
      active = pl;
      aAU = pl.aAU; albedo = pl.albedo; Tstar = 5772; Rstar = 1;
      tStar.set(Tstar); rStar.set(Rstar);
      aSlider.set(aAU); aSlider2.set(albedo);
      loop.invalidate();
    });
    const tStar = panel.slider('Star temperature', { min: 2500, max: 40000, value: Tstar, log: true, unit: 'K', format: (v) => String(Math.round(v)) }, (v) => { Tstar = v; active = null; loop.invalidate(); });
    const rStar = panel.slider('Star radius', { min: 0.1, max: 20, value: Rstar, log: true, unit: 'R☉' }, (v) => { Rstar = v; active = null; loop.invalidate(); });
    const aSlider = panel.slider('Orbital distance', { min: 0.05, max: 5, value: aAU, log: true, unit: 'AU' }, (v) => { aAU = v; active = null; loop.invalidate(); });
    const aSlider2 = panel.slider('Albedo', { min: 0, max: 0.95, value: albedo, step: 0.01 }, (v) => { albedo = v; active = null; loop.invalidate(); });
    const readTeq = panel.readout('Equilibrium temperature T_eq =');
    const readCompare = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
