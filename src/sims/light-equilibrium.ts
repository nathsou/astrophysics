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

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 6 });
    const ctx = stage.canvas.getContext('2d')!;

    let Tstar = 5772, Rstar = 1, aAU = 1, albedo = 0.3;
    let active: PlanetPreset = PLANETS[1];

    function Teq() {
      const R = Rstar * Rsun, a = aAU * AU;
      return Tstar * Math.sqrt(R / (2 * a)) * (1 - albedo) ** 0.25;
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
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

      const maxA = 5; // AU shown across the panel
      const orbitX = starX + Math.min(1, aAU / maxA) * (W - starX - 60);
      ctx.strokeStyle = pal.faint;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(starX, cy); ctx.lineTo(W - 30, cy); ctx.stroke();
      ctx.setLineDash([]);

      const teq = Teq();
      const [pr, pg, pb] = blackbodyRGB(Math.max(teq, 60));
      ctx.fillStyle = `rgb(${(pr * 255) | 0},${(pg * 255) | 0},${(pb * 255) | 0})`;
      ctx.beginPath(); ctx.arc(orbitX, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = pal.rule; ctx.stroke();

      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'center';
      ctx.fillText(`a = ${fmt(aAU, 3)} AU`, orbitX, cy + 26);

      readTeq.set(`${fmt(teq, 4)} K (${fmt(teq - 273.15, 4)} °C)`);
      readCompare.set(active ? `${active.name}: measured surface T ≈ ${active.Tsurf} K — ${active.greenhouse}` : '—');
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.select('Planet preset', PLANETS.map((p) => ({ value: p.name, label: p.name })), 'Earth', (name) => {
      active = PLANETS.find((p) => p.name === name)!;
      aAU = active.aAU; albedo = active.albedo;
      aSlider.set(aAU); aSlider2.set(albedo);
      loop.invalidate();
    });
    const tStar = panel.slider('Star temperature', { min: 2500, max: 40000, value: Tstar, log: true, unit: 'K' }, (v) => { Tstar = v; loop.invalidate(); });
    const rStar = panel.slider('Star radius', { min: 0.1, max: 20, value: Rstar, log: true, unit: 'R☉' }, (v) => { Rstar = v; loop.invalidate(); });
    const aSlider = panel.slider('Orbital distance', { min: 0.05, max: 5, value: aAU, log: true, unit: 'AU' }, (v) => { aAU = v; loop.invalidate(); });
    const aSlider2 = panel.slider('Albedo', { min: 0, max: 0.95, value: albedo, step: 0.01 }, (v) => { albedo = v; loop.invalidate(); });
    const readTeq = panel.readout('Equilibrium temperature T_eq =');
    const readCompare = panel.readout('');
    void tStar; void rStar;

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
