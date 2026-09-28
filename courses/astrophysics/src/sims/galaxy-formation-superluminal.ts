// Chapter 23: apparent superluminal motion. A blob ejected at speed βc at angle θ to the line of sight
// emits light pulses; the observer sees them arrive compressed in time, so the transverse motion looks
// faster than light. Left: geometry with emitted pulses. Right: β_app(θ) for the chosen β.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const betaApp = (b: number, th: number) => (b * Math.sin(th)) / (1 - b * Math.cos(th));

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const geo = createStage(wrap, { aspect: 1.15 });
    const pst = createStage(wrap, { aspect: 1.15 });
    const ctx = geo.canvas.getContext('2d')!;
    const plot = new Plot(pst.canvas, {
      x: { min: 0, max: 90, label: 'angle to line of sight θ (deg)' },
      y: { min: 0, max: 12, label: 'apparent speed β_app (units of c)' },
      title: 'β_app = β sin θ / (1 − β cos θ)',
    });

    let gamma = 5, thetaDeg = 12;
    const beta = () => Math.sqrt(1 - 1 / (gamma * gamma));
    let tau = 0; // time since ejection, in units where the blob reaches L=1 at τ = 1/β

    const loop = new Loop((dt) => { tau += dt * 0.35; if (tau > 1.25) tau = 0; }, render, 1 / 60);

    function render() {
      const { width: W, height: H, dpr } = geo;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const b = beta(), th = (thetaDeg * Math.PI) / 180;
      // Observer is far to the right; line of sight = +x. Core at left.
      const S = Math.min(W, H) * 0.62, ox = W * 0.14, oy = H * 0.62;
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      // line of sight
      ctx.strokeStyle = pal.faint; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(W - 8, oy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.textAlign = 'right';
      ctx.fillText('to observer →', W - 10, oy + 16);
      // jet direction
      const dx = Math.cos(th), dy = -Math.sin(th);
      ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.35; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * S * 1.05, oy + dy * S * 1.05); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
      // angle arc
      ctx.strokeStyle = pal.muted;
      ctx.beginPath(); ctx.arc(ox, oy, 34, -th, 0); ctx.stroke();
      ctx.fillStyle = pal.fg; ctx.textAlign = 'left';
      ctx.fillText(`θ = ${thetaDeg.toFixed(0)}°`, ox + 40, oy - 6);
      // wavefronts: pulses emitted every Δτ; light travels at speed 1 (blob at speed b)
      const L = Math.max(tau, 0);
      const nP = 6;
      for (let k = 0; k <= nP; k++) {
        const te = (k / nP) * Math.min(L, 1 / b) ;
        if (te > L) break;
        const ex = ox + dx * S * b * te, ey = oy + dy * S * b * te;
        const r = (L - te) * S;
        ctx.strokeStyle = pal.series[1]; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // core and blob
      ctx.fillStyle = pal.series[0];
      ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill();
      const bl = Math.min(b * L, 1);
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(ox + dx * S * bl, oy + dy * S * bl, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.muted;
      ctx.fillText('core', ox - 12, oy + 20);
      ctx.fillText('blob (βc)', ox + dx * S * bl + 8, oy + dy * S * bl - 6);
      // readouts
      const ba = betaApp(b, th);
      const dop = 1 / (gamma * (1 - b * Math.cos(th)));
      ctx.fillStyle = pal.fg;
      ctx.fillText(`β = ${b.toFixed(4)}   Γ = ${fmt(gamma, 3)}`, 12, 20);
      ctx.fillStyle = ba > 1 ? pal.accent : pal.fg;
      ctx.fillText(`apparent speed = ${fmt(ba, 3)} c`, 12, 38);
      ctx.fillStyle = pal.muted;
      ctx.fillText(`Doppler factor δ = ${fmt(dop, 3)}  (flux boost ~δ³⁻⁴ = ${fmt(dop ** 3.5, 2)})`, 12, 56);
      ctx.fillText('Wavefronts bunch up toward the observer.', 12, H - 12);

      plot.o.y.max = Math.max(4, Math.ceil(gamma * 1.15));
      plot.draw(() => {
        plot.hline(1, { label: 'speed of light', color: pal.bad });
        plot.fn((d) => betaApp(b, (d * Math.PI) / 180), { color: pal.series[1], width: 2 });
        const thMax = (Math.acos(b) * 180) / Math.PI;
        plot.vline(thMax, { label: `max at cos θ = β (${thMax.toFixed(1)}°)`, color: pal.muted });
        plot.point(thetaDeg, ba, { color: pal.accent, label: `${fmt(ba, 3)} c` });
      });
    }

    geo.onResize(() => loop.invalidate());
    pst.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    // drag on the plot to set θ
    const setFromPointer = (e: PointerEvent) => {
      const r = pst.canvas.getBoundingClientRect();
      const d = plot.dx(e.clientX - r.left);
      thetaDeg = Math.max(1, Math.min(90, d));
      thetaCtl.set(thetaDeg);
      loop.invalidate();
    };
    pst.canvas.style.touchAction = 'none';
    pst.canvas.style.cursor = 'ew-resize';
    pst.canvas.addEventListener('pointerdown', (e) => { pst.canvas.setPointerCapture(e.pointerId); setFromPointer(e); });
    pst.canvas.addEventListener('pointermove', (e) => { if (pst.canvas.hasPointerCapture(e.pointerId)) setFromPointer(e); });

    const panel = new Panel(host);
    const gammaCtl = panel.slider('Lorentz factor Γ', { min: 1.05, max: 30, value: gamma, log: true, step: 0.01 }, (v) => { gamma = v; loop.invalidate(); });
    const thetaCtl = panel.slider('Angle θ', { min: 1, max: 90, value: thetaDeg, step: 1, unit: '°' }, (v) => { thetaDeg = v; loop.invalidate(); });
    panel.button('M87 (Γ≈6, θ≈17°)', () => { gamma = 6; thetaDeg = 17; gCtl(); loop.invalidate(); });
    panel.button('3C 279 (Γ≈20, θ≈2°)', () => { gamma = 20; thetaDeg = 2; gCtl(); loop.invalidate(); });
    function gCtl() { thetaCtl.set(thetaDeg); gammaCtl.set(gamma); }

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
