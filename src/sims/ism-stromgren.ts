// Chapter 6 secondary figure: Strömgren sphere. Pick a star (sets ionising photon rate Q),
// drag the ambient density n, and watch the H II region radius R_S = (3Q / 4π n² α_B)^{1/3}
// drawn to scale next to the Orion Nebula for reference.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const PC = 3.0857e18; // cm

// Approximate ionising photon output Q (s^-1) and effective temperature by spectral type.
const STARS = [
  { id: 'O5V', label: 'O5 V', Q: 5.0e49, T: 42000 },
  { id: 'O7V', label: 'O7 V', Q: 1.0e49, T: 35000 },
  { id: 'O9V', label: 'O9 V', Q: 2.6e48, T: 32000 },
  { id: 'B0V', label: 'B0 V', Q: 4.0e47, T: 28000 },
  { id: 'B3V', label: 'B3 V', Q: 4.0e42, T: 18000 },
] as const;

const alphaB = 2.6e-13; // case-B recombination coefficient, cm^3/s, ~10^4 K

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1 : 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;

    let star: (typeof STARS)[number] = STARS[0];
    let logN = 1; // log10 n (cm^-3)

    function R_S_pc(): number {
      const n = 10 ** logN;
      const R_cm = (3 * star.Q / (4 * Math.PI * n * n * alphaB)) ** (1 / 3);
      return R_cm / PC;
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = pal.bg || '#05060a';
      ctx.fillRect(0, 0, W, H);
      const R = R_S_pc();
      const cx = W * 0.38, cy = H * 0.55;
      const scale = Math.min(W, H) * 0.38 / Math.max(R, 0.05);

      // ionised sphere: glow, sharp-ish edge (ionisation front)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * scale);
      g.addColorStop(0, 'rgba(140,190,255,0.55)');
      g.addColorStop(0.85, 'rgba(120,170,255,0.28)');
      g.addColorStop(1, 'rgba(120,170,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R * scale, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(190,220,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * scale, 0, Math.PI * 2); ctx.stroke();

      // the star
      ctx.fillStyle = blackbodyCSS(star.T);
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();

      // scale bar
      const barPc = R > 5 ? Math.round(R / 2) : Math.round(R * 10) / 10 || 0.1;
      ctx.strokeStyle = pal.muted; ctx.lineWidth = 1;
      const bx = 20, by = H - 24;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + barPc * scale, by); ctx.stroke();
      ctx.fillStyle = pal.muted; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(`${fmt(barPc, 2)} pc`, bx, by - 6);

      // Orion Nebula comparison (R ≈ 1.2 pc, roughly), drawn as a dashed reference circle
      const orionR = 1.2;
      if (orionR * scale < Math.min(W, H)) {
        ctx.strokeStyle = pal.faint;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(cx, cy, orionR * scale, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // label on a short leader line, up and to the right, so it stays legible over the glow
        const ex = cx + orionR * scale * 0.71, ey = cy - orionR * scale * 0.71;
        const lx = Math.min(ex + 26, W - 150), ly = ey - 22;
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.fillStyle = pal.fg;
        ctx.textAlign = 'left';
        ctx.fillText('Orion Nebula (≈1.2 pc)', lx + 4, ly - 2);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = pal.fg;
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.fillText(`${star.label}:  Q = ${fmt(star.Q, 2)} photons/s`, W - 14, 22);
      ctx.fillStyle = pal.muted;
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillText(`n = ${fmt(10 ** logN, 3)} cm⁻³   R_S = ${fmt(R, 3)} pc`, W - 14, 40);
      ctx.textAlign = 'left';
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.select('Star', STARS.map((s) => ({ value: s.id, label: s.label })), star.id, (v) => { star = STARS.find((s) => s.id === v)!; loop.invalidate(); });
    panel.slider('log₁₀ n', { min: -1, max: 4, value: logN, step: 0.02, format: (v) => `${fmt(10 ** v, 3)} cm⁻³` }, (v) => { logN = v; loop.invalidate(); });

    loop.setVisible(true);
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
