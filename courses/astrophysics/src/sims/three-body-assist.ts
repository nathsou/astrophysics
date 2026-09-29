// Chapter 3 secondary figure: gravitational slingshot / flyby geometry.
// In the planet's frame a flyby just turns the spacecraft's velocity vector — speed in, speed out
// are equal (elastic-collision-like), only the direction bends by δ (set by the impact parameter
// b and the planet's GM). Add back the planet's orbital velocity to get the heliocentric picture:
// same turn, but now speed *does* change, because the turn can point the outgoing velocity more
// or less along the planet's own motion. Drag the incoming relative-velocity arrow to explore it.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const rot = (v: [number, number], a: number): [number, number] => {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};
const add = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];
const mag = (v: [number, number]) => Math.hypot(v[0], v[1]);

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1.1 : 16 / 9, maxDpr: 2 });
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'grab';
    const ctx = stage.canvas.getContext('2d')!;

    const vp = 1; // planet orbital speed (fixed unit)
    let GMp = 0.5;
    let b = -1.0; // trailing-side pass: a boost
    let vIn: [number, number] = [-0.8, 0.9]; // incoming relative velocity (planet frame)

    const SCALE = () => Math.min(stage.width / 5, stage.height / 3.6);
    const center = (): [number, number] => [stage.width / 2, stage.height * 0.6];

    function turning(): { delta: number; vOutRel: [number, number] } {
      const vInf = mag(vIn);
      const e = Math.sqrt(1 + (b * vInf * vInf / GMp) ** 2);
      const delta = 2 * Math.asin(1 / e);
      const vOutRel = rot(vIn, Math.sign(b || 1) * delta);
      return { delta, vOutRel };
    }

    function arrow(from: [number, number], to: [number, number], color: string, width = 2, dash: number[] = []) {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(to[0], to[1]); ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
      const ah = 8;
      ctx.beginPath();
      ctx.moveTo(to[0], to[1]);
      ctx.lineTo(to[0] - ah * Math.cos(ang - 0.4), to[1] - ah * Math.sin(ang - 0.4));
      ctx.lineTo(to[0] - ah * Math.cos(ang + 0.4), to[1] - ah * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
      const s = SCALE();
      const [cx, cy] = center();
      const toPx = (v: [number, number]): [number, number] => [cx + v[0] * s, cy - v[1] * s];

      // turning angle δ between v∞ in and v∞ out, drawn as an arc at the planet
      const { delta, vOutRel } = turning();
      const vOutHelio = add(vOutRel, [vp, 0]);
      const vInHelio = add(vIn, [vp, 0]);
      const aIn = Math.atan2(-vIn[1], vIn[0]), aOut = Math.atan2(-vOutRel[1], vOutRel[0]);
      ctx.strokeStyle = pal.series[0]; ctx.globalAlpha = 0.45; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 0.38 * s, aIn, aOut, (b || 1) > 0); ctx.stroke();
      ctx.globalAlpha = 1;
      const aMid = Math.atan2(Math.sin(aIn) + Math.sin(aOut), Math.cos(aIn) + Math.cos(aOut));
      ctx.fillStyle = pal.series[0]; ctx.font = '12px JetBrains Mono, ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`δ = ${Math.round((delta * 180) / Math.PI)}°`, cx + Math.cos(aMid) * 0.52 * s, cy + Math.sin(aMid) * 0.52 * s + 4);

      // planet marker
      ctx.fillStyle = 'rgba(140,190,255,0.95)';
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.muted; ctx.textAlign = 'right';
      ctx.fillText('planet', cx - 12, cy + 18);

      // planet's own velocity (heliocentric reference)
      arrow([cx, cy], toPx([vp, 0]), pal.muted, 1.6);
      label(toPx([vp, 0]), [vp, 0], 'planet velocity', pal.muted);
      // planet-frame vectors
      arrow([cx, cy], toPx(vIn), pal.series[0], 2.2);
      label(toPx(vIn), vIn, 'v∞ in (planet frame)', pal.series[0]);
      arrow([cx, cy], toPx(vOutRel), pal.series[0], 2.2, [5, 4]);
      label(toPx(vOutRel), vOutRel, 'v∞ out (planet frame)', pal.series[0]);
      // heliocentric velocities = planet-frame velocity + planet velocity
      arrow([cx, cy], toPx(vInHelio), pal.faint, 1.6, [2, 3]);
      label(toPx(vInHelio), vInHelio, 'before (Sun frame)', pal.muted);
      arrow([cx, cy], toPx(vOutHelio), pal.bad, 2.6);
      label(toPx(vOutHelio), vOutHelio, 'after (Sun frame)', pal.bad);
      ctx.textAlign = 'left';

      // drag handle on v_in tip
      const [hx, hy] = toPx(vIn);
      ctx.strokeStyle = pal.series[0]; ctx.fillStyle = pal.bg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.faint; ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillText('drag the ring to change the approach', 12, H - 12);

      const dE = 0.5 * (mag(vOutHelio) ** 2 - mag(vInHelio) ** 2);
      ro.set(`turn δ = ${Math.round((delta * 180) / Math.PI)}° · |v| helio: ${fmt(mag(vInHelio), 3)} → ${fmt(mag(vOutHelio), 3)} · ΔE/m = ${fmt(dE, 3)} ${dE >= 0 ? '(boost)' : '(brake)'}`);
    }
    /** Label placed just beyond an arrow tip, on the side the arrow points to. */
    function label(tip: [number, number], dir: [number, number], text: string, color: string) {
      const L = mag(dir) || 1, ux = dir[0] / L, uy = -dir[1] / L;
      ctx.fillStyle = color;
      ctx.textAlign = ux < -0.3 ? 'right' : ux > 0.3 ? 'left' : 'center';
      ctx.fillText(text, tip[0] + ux * 10, tip[1] + uy * 12 + 4);
    }

    const loop = new Loop(null, render);
    stage.onResize(() => loop.invalidate());

    // drag the v_in arrow tip
    let dragging = false;
    stage.canvas.addEventListener('pointerdown', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      const [cx, cy] = center();
      const px = e.clientX - r.left - cx, py = cy - (e.clientY - r.top);
      const s = SCALE();
      const dist = Math.hypot(px / s - vIn[0], py / s - vIn[1]);
      if (dist < 0.5) { dragging = true; stage.canvas.setPointerCapture(e.pointerId); stage.canvas.style.cursor = 'grabbing'; }
    });
    stage.canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = stage.canvas.getBoundingClientRect();
      const [cx, cy] = center();
      const s = SCALE();
      vIn = [(e.clientX - r.left - cx) / s, (cy - (e.clientY - r.top)) / s];
      loop.invalidate();
    });
    const up = () => { dragging = false; stage.canvas.style.cursor = 'grab'; };
    stage.canvas.addEventListener('pointerup', up);
    stage.canvas.addEventListener('pointercancel', up);

    const panel = new Panel(host);
    panel.slider('Planet GM', { min: 0.05, max: 3, value: GMp, log: true }, (v) => { GMp = v; loop.invalidate(); });
    const bSlider = panel.slider('Impact parameter b', { min: -3, max: 3, value: b, step: 0.02 }, (v) => { b = v; loop.invalidate(); });
    // b < 0 here rotates v∞ clockwise, towards the planet's motion (+x): the craft passes
    // behind the planet (trailing side) and gains energy; b > 0 passes in front and loses it.
    panel.button('Trailing boost', () => { b = -1.4; bSlider.set(b); vIn = [-0.7, 0.5]; loop.invalidate(); });
    panel.button('Leading brake', () => { b = 1.4; bSlider.set(b); vIn = [-0.7, 0.5]; loop.invalidate(); });
    const ro = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
