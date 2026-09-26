// Chapter 3 secondary figure: where the collinear Lagrange points sit as a function of mass ratio μ,
// with real systems overlaid (Sun–Earth, Earth–Moon, Sun–Jupiter) so the abstract Hill-radius scaling
// x2 turns into "JWST orbits 1.5 million km from Earth."

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { lagrangePoints } from './three-body/cr3bp';
import { AU } from '../lib/physics/constants';

interface SysDef { mu: number; a: number; label: string; unit: string; toUnit: (x: number) => number }
const SYSTEMS: Record<'sunEarth' | 'earthMoon' | 'sunJupiter', SysDef> = {
  sunEarth: { mu: 3.003e-6, a: AU, label: 'Sun–Earth', unit: 'km', toUnit: (x: number) => x / 1000 },
  earthMoon: { mu: 0.012150585, a: 384400, label: 'Earth–Moon', unit: 'km', toUnit: (x: number) => x },
  sunJupiter: { mu: 0.0009537, a: 5.2 * AU, label: 'Sun–Jupiter', unit: 'AU', toUnit: (x: number) => x / AU },
};
type SysKey = keyof typeof SYSTEMS;

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 6, maxDpr: 2 });
    const ctx = stage.canvas.getContext('2d')!;

    let sysKey: SysKey = 'sunEarth';
    let mu = SYSTEMS[sysKey].mu;

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
      const sys = SYSTEMS[sysKey];
      const L = lagrangePoints(mu);
      const rh = Math.cbrt(mu / 3);

      // horizontal axis spans a fixed window around the secondary, in Hill radii, so L1/L2 are visible
      // regardless of how small μ is.
      const secX = 1 - mu;
      const win = Math.max(8 * rh, 0.05);
      const x0 = secX - win, x1 = secX + win;
      const y = H / 2;
      const toPx = (x: number) => ((x - x0) / (x1 - x0)) * (W - 40) + 20;

      ctx.strokeStyle = pal.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(W - 20, y); ctx.stroke();

      // Hill sphere band
      ctx.fillStyle = pal.faint; ctx.globalAlpha = 0.35;
      ctx.fillRect(toPx(secX - rh), y - 22, toPx(secX + rh) - toPx(secX - rh), 44);
      ctx.globalAlpha = 1;

      const mark = (x: number, color: string, label: string, r = 5) => {
        const px = toPx(x);
        if (px < 10 || px > W - 10) return;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, px, y - r - 8);
      };
      mark(secX, 'rgba(140,190,255,0.95)', sys.label.split('–')[1] ?? 'secondary', 9);
      mark(L.L1[0], pal.series[0], 'L1');
      mark(L.L2[0], pal.series[1], 'L2');

      ctx.textAlign = 'left';
      ctx.fillStyle = pal.muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(`Hill radius r_H = a(μ/3)^{1/3} — shaded band`, 20, 20);

      // JWST marker on the Sun–Earth L2
      if (sysKey === 'sunEarth') {
        const jwstA = 1.5e9 / sys.a; // JWST orbits ~1.5 million km beyond L2, in units of a
        mark(secX + rh + jwstA, pal.bad, 'JWST', 4);
      }

      updateReadout(sys, L, rh);
    }

    const loop = new Loop(null, render);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    const sysSel = panel.select<SysKey>('System', [
      { value: 'sunEarth', label: 'Sun–Earth' },
      { value: 'earthMoon', label: 'Earth–Moon' },
      { value: 'sunJupiter', label: 'Sun–Jupiter' },
    ], sysKey, (v) => { sysKey = v; mu = SYSTEMS[v].mu; muCtl.set(mu); loop.invalidate(); });
    const muCtl = panel.slider('Mass ratio μ', { min: 1e-6, max: 0.45, value: mu, log: true, format: (v) => fmt(v, 3) }, (v) => { mu = v; loop.invalidate(); });
    const ro = panel.readout('');
    function updateReadout(sys: typeof SYSTEMS[SysKey], L: ReturnType<typeof lagrangePoints>, rh: number) {
      const distL2 = sys.toUnit(Math.abs(L.L2[0] - (1 - mu)) * sys.a);
      const distL1 = sys.toUnit(Math.abs((1 - mu) - L.L1[0]) * sys.a);
      ro.set(`μ = ${fmt(mu, 4)} · r_H ≈ ${fmt(rh, 4)}a · L1 is ${fmt(distL1, 3)} ${sys.unit} inward, L2 is ${fmt(distL2, 3)} ${sys.unit} outward`);
    }
    void sysSel;

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
