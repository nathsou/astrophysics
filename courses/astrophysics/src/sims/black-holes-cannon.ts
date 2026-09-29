// Chapter 19: a 2D "geodesic cannon". Drag on the canvas to fire photons or massive particles past a
// Schwarzschild black hole and watch capture, escape, photon-sphere whirls and precessing orbits.
//
// Units r_s = 1, c = 1. In Cartesian form (in the orbital plane) both cases are a central force:
//   particle:  d²x/dτ² = −[ 1/(2r²) + 3L²/(2r⁴) ] r̂      (exact radial equation, L = |x × dx/dτ|)
//   photon:    d²x/dλ² = −[ 3h²/(2r⁴) ] r̂                  (Binet: u'' + u = (3/2)u²)
// integrated with RK4 at an adaptive step ∝ r^{3/2}.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Kind = 'photon' | 'particle';
interface Shot { kind: Kind; s: Float64Array; xs: Float32Array; ys: Float32Array; n: number; alive: boolean; fate: string; L: number; E: number; hue: number; t: number }
const MAXPTS = 6000;

function acc(kind: Kind, x: number, y: number, L2: number, out: Float64Array, o: number) {
  const r2 = x * x + y * y, r = Math.sqrt(r2);
  const f = kind === 'photon' ? (1.5 * L2) / (r2 * r2) : 0.5 / r2 + (1.5 * L2) / (r2 * r2);
  out[o] = (-f * x) / r; out[o + 1] = (-f * y) / r;
}

const k = new Float64Array(8), tmp = new Float64Array(4);
const d1 = new Float64Array(4), d2 = new Float64Array(4), d3 = new Float64Array(4), d4 = new Float64Array(4);
function rk4(kind: Kind, s: Float64Array, h: number, L2: number) {
  const deriv = (st: Float64Array, o: number) => { k[o] = st[2]; k[o + 1] = st[3]; acc(kind, st[0], st[1], L2, k, o + 2); };
  const ev = (st: Float64Array, d: Float64Array) => { deriv(st, 0); d.set(k.subarray(0, 4)); };
  ev(s, d1);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * d1[i];
  ev(tmp, d2);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * d2[i];
  ev(tmp, d3);
  for (let i = 0; i < 4; i++) tmp[i] = s[i] + h * d3[i];
  ev(tmp, d4);
  for (let i = 0; i < 4; i++) s[i] += (h / 6) * (d1[i] + 2 * d2[i] + 2 * d3[i] + d4[i]);
}

const PRESETS: { label: string; kind: Kind; x: number; y: number; vx: number; vy: number }[] = [
  // photon from far away with impact parameter just above √27/2 ≈ 2.598 → several whirls round the photon sphere
  { label: 'Photon whirl', kind: 'photon', x: 18, y: 2.5981, vx: -1, vy: 0 },
  // particle with L = 1.9 dropped from r = 15 (E² just below the barrier top) → zoom-whirl
  { label: 'Zoom-whirl', kind: 'particle', x: 15, y: 0, vx: 0, vy: 1.9 / 15 },
  // L = 2.3 from r = 30: a strongly precessing rosette
  { label: 'Precessing orbit', kind: 'particle', x: 30, y: 0, vx: 0, vy: 2.3 / 30 },
  // a circular orbit at the ISCO, nudged: it cannot recover
  { label: 'Nudged ISCO', kind: 'particle', x: 3, y: 0, vx: -0.002, vy: Math.sqrt(3) / 3 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const stage = createStage(host, { aspect: 4 / 3 });
    const ctx = stage.canvas.getContext('2d')!;
    let kind: Kind = 'photon';
    let view = 22; // half-width of view in r_s
    const shots: Shot[] = [];
    let aim: { x0: number; y0: number; x1: number; y1: number } | null = null;
    let speed = 1;

    const toWorld = (px: number, py: number) => {
      const sc = Math.min(stage.width, stage.height) / (2 * view);
      return [(px - stage.width / 2) / sc, -(py - stage.height / 2) / sc];
    };

    function fire(kd: Kind, x: number, y: number, vx: number, vy: number) {
      if (Math.hypot(x, y) < 1.02) return;
      if (kd === 'photon') { const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n; }
      const L = x * vy - y * vx, r = Math.hypot(x, y), vr = (x * vx + y * vy) / r;
      const E = kd === 'particle' ? Math.sqrt(vr * vr + (1 - 1 / r) * (1 + (L * L) / (r * r))) : NaN;
      const sh: Shot = { kind: kd, s: Float64Array.of(x, y, vx, vy), xs: new Float32Array(MAXPTS), ys: new Float32Array(MAXPTS), n: 0, alive: true, fate: 'in flight', L, E, hue: shots.length % 5, t: 0 };
      shots.push(sh);
      if (shots.length > 12) shots.shift();
      last = sh;
      loop.invalidate();
    }
    let last: Shot | null = null;

    const loop = new Loop((dt) => {
      for (const sh of shots) {
        if (!sh.alive) continue;
        const L2 = sh.L * sh.L;
        // advance by a budget of "coordinate distance" per frame so fast and slow shots both animate
        let budget = (sh.kind === 'photon' ? 14 : 6) * dt * 60 * speed / 60;
        let guard = 0;
        while (budget > 0 && sh.alive && guard++ < 4000) {
          const r = Math.hypot(sh.s[0], sh.s[1]);
          const v = Math.hypot(sh.s[2], sh.s[3]) || 1e-9;
          const h = Math.min(0.02 * r ** 1.5 / Math.max(v, 0.05), 0.5 * r / v);
          rk4(sh.kind, sh.s, h, L2);
          budget -= h * v;
          sh.t += h;
          if (sh.n < MAXPTS && (sh.n === 0 || Math.hypot(sh.s[0] - sh.xs[sh.n - 1], sh.s[1] - sh.ys[sh.n - 1]) > 0.04)) {
            sh.xs[sh.n] = sh.s[0]; sh.ys[sh.n] = sh.s[1]; sh.n++;
          }
          const rn = Math.hypot(sh.s[0], sh.s[1]);
          if (rn < 1) { sh.alive = false; sh.fate = 'captured: crossed the horizon'; }
          else if (rn > 4 * view && sh.s[0] * sh.s[2] + sh.s[1] * sh.s[3] > 0) { sh.alive = false; sh.fate = 'escaped to infinity'; }
          else if (sh.n >= MAXPTS) { sh.alive = false; sh.fate = 'still orbiting (trail full)'; }
        }
      }
    }, render, 1 / 60);

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sc = Math.min(W, H) / (2 * view);
      const cx = W / 2, cy = H / 2;
      const circle = (r: number, stroke: string, dash: number[] = [], fill?: string) => {
        ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, Math.PI * 2);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.setLineDash(dash); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      };
      circle(3, pal.accent3, [4, 4]);
      circle(1.5, pal.accent, [2, 3]);
      circle(1, pal.fg, [], '#000');
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.accent3; ctx.fillText('ISCO', cx + 3 * sc * 0.72 + 3, cy - 3 * sc * 0.72);
      ctx.fillStyle = pal.accent; ctx.fillText('photon sphere', cx + 1.5 * sc * 0.72 + 3, cy + 1.5 * sc * 0.72 + 10);

      for (const sh of shots) {
        const col = sh.kind === 'photon' ? pal.accent2 : pal.series[sh.hue];
        ctx.strokeStyle = col; ctx.lineWidth = sh === last ? 1.8 : 1.1; ctx.globalAlpha = sh === last ? 1 : 0.55;
        ctx.beginPath();
        for (let i = 0; i < sh.n; i++) {
          const X = cx + sh.xs[i] * sc, Y = cy - sh.ys[i] * sc;
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke();
        if (sh.alive) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + sh.s[0] * sc, cy - sh.s[1] * sc, 3.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (aim) {
        ctx.strokeStyle = pal.fg; ctx.setLineDash([3, 3]); ctx.beginPath();
        ctx.moveTo(aim.x0, aim.y0); ctx.lineTo(aim.x1, aim.y1); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = pal.fg; ctx.beginPath(); ctx.arc(aim.x0, aim.y0, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = pal.muted;
      ctx.fillText(`scale: ${view * 2} r_s across`, 10, H - 10);
      if (last) {
        const r0 = `${last.kind === 'photon' ? 'b' : 'L'} = ${fmt(Math.abs(last.L), 4)} ${last.kind === 'photon' ? 'r_s' : 'r_s c'}`;
        Lout.set(r0);
        Eout.set(last.kind === 'particle' ? `${fmt(last.E, 4)} mc²${last.E < 1 ? ' (bound)' : ' (unbound)'}` : '—');
        fateOut.set(last.fate);
      }
    }

    stage.onResize(() => loop.invalidate());

    // aim & fire with pointer drag: press at the launch point, drag in the direction of motion
    const el = stage.canvas;
    el.style.touchAction = 'none'; el.style.cursor = 'crosshair';
    const local = (e: PointerEvent) => { const b = el.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); const [x, y] = local(e); aim = { x0: x, y0: y, x1: x, y1: y }; loop.invalidate(); });
    el.addEventListener('pointermove', (e) => { if (!aim) return; const [x, y] = local(e); aim.x1 = x; aim.y1 = y; loop.invalidate(); });
    el.addEventListener('pointerup', () => {
      if (!aim) return;
      const [x, y] = toWorld(aim.x0, aim.y0);
      const sc = Math.min(stage.width, stage.height) / (2 * view);
      let dx = (aim.x1 - aim.x0) / sc, dy = -(aim.y1 - aim.y0) / sc;
      if (Math.hypot(dx, dy) < 0.05) { dx = -y; dy = x; } // a click fires tangentially
      // particle speed: drag length ↦ proper speed, ~0.02 c per r_s of drag
      const f = kind === 'particle' ? 0.025 : 1;
      fire(kind, x, y, dx * f, dy * f);
      aim = null;
    });
    el.addEventListener('pointercancel', () => (aim = null));

    const panel = new Panel(host);
    panel.select('Fire', [{ value: 'photon', label: 'Photons' }, { value: 'particle', label: 'Particles' }], kind, (v) => (kind = v));
    panel.select('Preset', [{ value: '-', label: 'Presets…' }, ...PRESETS.map((p, i) => ({ value: String(i), label: p.label }))], '-', (v) => {
      if (v === '-') return;
      const p = PRESETS[+v];
      fire(p.kind, p.x, p.y, p.vx, p.vy);
    });
    panel.slider('Zoom', { min: 6, max: 60, value: view, log: true, step: 1, unit: 'r_s', format: (v) => String(Math.round(v)) }, (v) => { view = v; loop.invalidate(); });
    panel.slider('Speed', { min: 0.2, max: 5, value: speed, log: true }, (v) => (speed = v));
    const fan = () => { for (let i = 0; i < 12; i++) fire('photon', 20, -3.6 + i * 0.6, -1, 0); };
    panel.button('Fan of photons', fan);
    panel.button('Clear', () => { shots.length = 0; last = null; loop.invalidate(); });
    const Lout = panel.readout('');
    const Eout = panel.readout('E =');
    const fateOut = panel.readout('Fate:');

    fan(); // start with something to look at

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
