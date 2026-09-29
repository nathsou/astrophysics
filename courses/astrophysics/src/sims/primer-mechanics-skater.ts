// Appendix A6: torque and angular momentum with a spinning skater, seen from above.
// Moment of inertia I = I_body + 2 m_arm r² (+ 2 m_weight r² with hand weights). Pulling the arms
// in changes I at constant L, so ω = L / I rises and rotational KE = L²/2I grows (the skater's
// muscles do the work). "Push" applies an external torque τ = dL/dt; "ice friction" a small
// retarding torque ∝ ω. Integrated with explicit Euler at 1/240 s, which is exact for L here.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const I_BODY = 0.9; // kg m², torso + legs about the spin axis
const M_ARM = 3.5; // kg per arm, lumped at radius r
const M_WEIGHT = 2; // kg per hand weight
const TORQUE = 12; // N m while "push" is held
const FRICTION = 0.08; // N m s (retarding torque = −c ω)

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const stage = createStage(wrap, { aspect: 1.15 });
    const plotStage = createStage(wrap, { aspect: 1.15 });
    const ctx = stage.canvas.getContext('2d')!;
    const plot = new Plot(plotStage.canvas, {
      x: { min: 0, max: 20, label: 'time (s)' },
      y: { min: 0, max: 40, label: 'L (kg m²/s)  ·  ω (rad/s)' },
      title: 'Angular momentum and spin rate',
    });

    let rTarget = 0.75, r = 0.75, weights = false, friction = false, pushing = false;
    let L = 0, theta = 0, t = 0, KE0 = 0;
    const sL = new Series(2400), sW = new Series(2400);
    const inertia = (rr: number) => I_BODY + 2 * (M_ARM + (weights ? M_WEIGHT : 0)) * rr * rr;

    function reset() {
      L = inertia(r) * 2 * Math.PI * 0.6; // start at 0.6 rev/s
      theta = 0; t = 0; sL.clear(); sW.clear(); plot.o.x.max = 20;
      KE0 = (L * L) / (2 * inertia(r));
    }

    let sample = 0;
    function step(h: number) {
      // arms move towards the slider target at a finite rate (about 0.5 s end to end)
      const dr = rTarget - r;
      r += Math.sign(dr) * Math.min(Math.abs(dr), 1.2 * h);
      const I = inertia(r);
      let tau = 0;
      if (pushing) tau += TORQUE;
      if (friction) tau -= FRICTION * (L / I);
      L = Math.max(0, L + tau * h);
      const omega = L / I;
      theta += omega * h;
      t += h;
      if (++sample % 12 === 0) { sL.push(t, L); sW.push(t, omega); }
      if (t > plot.o.x.max) plot.o.x.max += 20;
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 + 6;
      const px = Math.min(W, H) / 2.2; // pixels per metre
      const I = inertia(r), omega = L / I;

      // ice rink rings
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, k * 0.3 * px, 0, Math.PI * 2); ctx.stroke(); }

      // motion-blur ghost hands
      const hand = (a: number, sign: number) => [cx + sign * Math.cos(a) * r * px, cy - sign * Math.sin(a) * r * px] as const;
      for (let k = 6; k >= 1; k--) {
        const a = theta - k * Math.min(omega, 30) * 0.012;
        ctx.globalAlpha = 0.08 * (7 - k);
        ctx.fillStyle = pal.series[0];
        for (const sgn of [1, -1]) { const [hx, hy] = hand(a, sgn); ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;

      // body (top view): shoulders ellipse, arms, head
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(-theta);
      ctx.strokeStyle = pal.muted; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * px, 0); ctx.lineTo(r * px, 0); ctx.stroke();
      ctx.fillStyle = pal.faint;
      ctx.beginPath(); ctx.ellipse(0, 0, 0.2 * px, 0.11 * px, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg;
      ctx.beginPath(); ctx.arc(0, 0, 0.075 * px, 0, Math.PI * 2); ctx.fill();
      // nose, to show which way she faces
      ctx.beginPath(); ctx.arc(0, -0.08 * px, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = weights ? pal.accent : pal.series[0];
      for (const sgn of [1, -1]) { ctx.beginPath(); ctx.arc(sgn * r * px, 0, weights ? 9 : 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      ctx.lineCap = 'butt';

      // angular momentum points out of the screen: ⊙, sized by L
      const Ls = Math.min(24, 6 + L * 0.6);
      ctx.strokeStyle = pal.accent2; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W - 36, 36, Ls, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = pal.accent2; ctx.beginPath(); ctx.arc(W - 36, 36, 3, 0, Math.PI * 2); ctx.fill();
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.muted; ctx.textAlign = 'right';
      ctx.fillText('L (out of screen)', W - 64 - Math.max(0, Ls - 12), 40);
      ctx.textAlign = 'left';
      ctx.fillText(`${fmt(omega / (2 * Math.PI), 3)} rev/s`, 12, 20);
      if (pushing) { ctx.fillStyle = pal.accent; ctx.fillText('external torque on', 12, H - 12); }

      const KE = (L * L) / (2 * I);
      rI.set(`${fmt(I, 3)} kg m²`);
      rW.set(`${fmt(omega, 3)} rad/s`);
      rL.set(`${fmt(L, 3)} kg m²/s`);
      rK.set(`${fmt(KE, 3)} J (${KE >= KE0 ? '+' : '−'}${fmt(Math.abs(KE - KE0), 3)})`);

      plot.o.y.max = Math.max(40, Math.ceil((Math.max(L, omega) * 1.15) / 10) * 10);
      plot.draw(() => {
        const [lx, ly] = sL.linear();
        plot.line(lx, ly, { color: pal.accent2, width: 2 });
        const [wx, wy] = sW.linear();
        plot.line(wx, wy, { color: pal.series[0], width: 2 });
        plot.text('L', plot.px(t) + 4, plot.py(L) - 4, { color: pal.accent2 });
        plot.text('ω', plot.px(t) + 4, plot.py(omega) + 12, { color: pal.series[0] });
      });
    }

    const loop = new Loop(step, render, 1 / 240);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());
    plotStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const panel = new Panel(host);
    panel.slider('Arm reach', { min: 0.2, max: 0.8, value: rTarget, step: 0.01, unit: 'm' }, (v) => (rTarget = v));
    const push = panel.button('Hold to push (torque)', () => {});
    const start = (e: Event) => { e.preventDefault(); pushing = true; };
    const stop = () => (pushing = false);
    push.addEventListener('pointerdown', start);
    push.addEventListener('pointerup', stop);
    push.addEventListener('pointerleave', stop);
    push.addEventListener('pointercancel', stop);
    panel.toggle('Hand weights', weights, (v) => {
      // grabbing weights mid-spin: L is conserved, so ω drops
      weights = v;
    });
    panel.toggle('Ice friction', friction, (v) => (friction = v));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    const rI = panel.readout('I');
    const rW = panel.readout('ω');
    const rL = panel.readout('L');
    const rK = panel.readout('KE');

    reset();
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
