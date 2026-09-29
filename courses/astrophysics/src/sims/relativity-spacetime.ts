// Chapter 17: interactive Minkowski diagram (Canvas2D).
// Mode "frames": the S and S′ grids, light cone, invariant hyperbolae and a draggable event whose
// coordinates are shown in both frames. Mode "twins": the twin paradox with proper-time ticks and the
// traveller's lines of simultaneity just before and after turnaround. Everything can be redrawn in the
// frame S′ (an active Lorentz boost of every event). Units: years and light-years, c = 1.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange, haloText } from '../lib/ui/theme';

type Mode = 'frames' | 'twins';
const D_TWIN = 3; // ly to the turnaround star

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 1.35 });
    const ctx = stage.canvas.getContext('2d')!;

    let mode: Mode = params.mode === 'twins' ? 'twins' : 'frames';
    let beta = 0.5;
    let inPrime = false;
    const ev = { x: 2.2, t: 3.2 }; // draggable event, S coordinates
    let tAnim = 0;

    const g = () => 1 / Math.sqrt(1 - beta * beta);
    // boost into a frame moving at b (active transform of coordinates)
    const boost = (x: number, t: number, b: number): [number, number] => {
      const gg = 1 / Math.sqrt(1 - b * b);
      return [gg * (x - b * t), gg * (t - b * x)];
    };
    // the frame used for drawing
    const viewB = () => (inPrime ? (mode === 'twins' ? Math.max(0.05, Math.abs(beta)) : beta) : 0);
    const toView = (x: number, t: number) => boost(x, t, viewB());
    const fromView = (x: number, t: number) => boost(x, t, -viewB());

    // screen mapping (equal scale so light rays are at 45°)
    let sc = 40, ox = 0, oy = 0;
    function fit(x0: number, x1: number, t0: number, t1: number) {
      const W = stage.width, H = stage.height, m = 28;
      sc = Math.min((W - 2 * m) / (x1 - x0), (H - 2 * m) / (t1 - t0));
      ox = W / 2 - ((x0 + x1) / 2) * sc;
      oy = H / 2 + ((t0 + t1) / 2) * sc;
    }
    const X = (x: number) => ox + x * sc;
    const Y = (t: number) => oy - t * sc;

    function seg(a: [number, number], b: [number, number]) {
      ctx.moveTo(X(a[0]), Y(a[1]));
      ctx.lineTo(X(b[0]), Y(b[1]));
    }
    // A straight line in S between two S-events, drawn in the view frame (boosts map lines to lines).
    function lineS(x0: number, t0: number, x1: number, t1: number) { seg(toView(x0, t0), toView(x1, t1)); }
    // Line of events in the frame moving at b: param by s from (x′,t′) = p + s d
    function lineFrame(b: number, px: number, pt: number, dx: number, dt: number, L = 60) {
      const a = boost(px - L * dx, pt - L * dt, -b), c = boost(px + L * dx, pt + L * dt, -b);
      lineS(a[0], a[1], c[0], c[1]);
    }
    function label(s: string, x: number, t: number, col: string, align: CanvasTextAlign = 'left', dy = -4) {
      const [vx, vt] = toView(x, t);
      ctx.textAlign = align; ctx.textBaseline = 'bottom';
      const lx = X(vx) + (align === 'left' ? 5 : align === 'right' ? -5 : 0), ly = Y(vt) + dy;
      haloText(ctx, s, lx, ly, pal.bg);
      ctx.fillStyle = col;
      ctx.fillText(s, lx, ly);
    }
    function dot(x: number, t: number, col: string, r = 4) {
      const [vx, vt] = toView(x, t);
      ctx.beginPath(); ctx.arc(X(vx), Y(vt), r, 0, 2 * Math.PI); ctx.fillStyle = col; ctx.fill();
    }

    function drawGrid(b: number, col: string, alpha: number, range: number) {
      ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -range; k <= range; k++) {
        if (k === 0) continue;
        lineFrame(b, 0, k, 1, 0); // simultaneity lines t′ = k
        lineFrame(b, k, 0, 0, 1); // worldlines x′ = k
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.lineWidth = 2; ctx.beginPath();
      lineFrame(b, 0, 0, 1, 0); lineFrame(b, 0, 0, 0, 1);
      ctx.stroke();
    }

    function drawLightCone() {
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); lineS(-50, -50, 50, 50); lineS(50, -50, -50, 50); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.07; ctx.fillStyle = pal.accent;
      // future cone fill (lines through origin are invariant, so fill in view coords directly)
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(-50), Y(50)); ctx.lineTo(X(50), Y(50)); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(-50), Y(-50)); ctx.lineTo(X(50), Y(-50)); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    function hyperbolae() {
      ctx.strokeStyle = pal.faint; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      for (const k of [1, 2, 3, 4, 5]) {
        ctx.beginPath();
        for (let i = -60; i <= 60; i++) {
          const r = i / 15; const [vx, vt] = [k * Math.sinh(r), k * Math.cosh(r)]; // invariant under boosts
          i === -60 ? ctx.moveTo(X(vx), Y(vt)) : ctx.lineTo(X(vx), Y(vt));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    let handle: [number, number] | null = null; // screen pos of β handle

    function drawFrames() {
      fit(-4.2, 4.2, -1.2, 5.6);
      hyperbolae();
      drawLightCone();
      const sCol = pal.series[0], pCol = pal.series[1];
      drawGrid(0, sCol, 0.22, 12);
      drawGrid(beta, pCol, 0.28, 12);
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      label('ct', 0, 5.2, sCol, 'left');
      label('x', 4.0, 0, sCol, 'center');
      const gg = g();
      label("ct′", 5 * beta * 0.98, 5 * 0.98, pCol, 'left');
      label("x′", 3.9, 3.9 * beta, pCol, 'center');
      // β handle on the ct′ axis
      const [hx, ht] = toView(4.6 * beta, 4.6);
      handle = inPrime ? null : [X(hx), Y(ht)];
      if (handle) {
        ctx.beginPath(); ctx.arc(handle[0], handle[1], 7, 0, 2 * Math.PI);
        ctx.fillStyle = pCol; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = pCol; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // the event
      const [xp, tp] = boost(ev.x, ev.t, beta);
      ctx.strokeStyle = pal.muted; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath();
      // projections onto S′ axes: along S′ grid directions
      { const a = boost(0, tp, -beta); lineS(a[0], a[1], ev.x, ev.t); }
      { const a = boost(xp, 0, -beta); lineS(a[0], a[1], ev.x, ev.t); }
      ctx.stroke(); ctx.setLineDash([]);
      dot(ev.x, ev.t, pal.accent2, 6);
      const s2 = ev.t * ev.t - ev.x * ev.x;
      label('E', ev.x, ev.t, pal.fg, 'left', -8);
      readA.set(`γ = ${fmt(gg, 4)} · E: (x, ct) = (${fmt(ev.x, 2)}, ${fmt(ev.t, 2)}), (x′, ct′) = (${fmt(xp, 2)}, ${fmt(tp, 2)})`);
      readB.set(`s² = (ct)² − x² = ${fmt(s2, 3)} ly² → ${Math.abs(s2) < 0.05 ? 'lightlike' : s2 > 0 ? 'timelike' : 'spacelike'}`);
      readC.set(`in S′, E is ${tp < 0 ? 'before' : 'after'} the origin (t′ = ${fmt(tp, 3)} yr)`);
    }

    function drawTwins(dt: number) {
      const b = Math.max(0.05, Math.abs(beta));
      const T = (2 * D_TWIN) / b, gg = 1 / Math.sqrt(1 - b * b);
      // fit the key events in the view frame
      const pts = [[0, 0], [D_TWIN, T / 2], [0, T], [-1, 0], [D_TWIN + 1, 0]].map(([x, t]) => toView(x, t));
      const xs = pts.map((p) => p[0]), ts = pts.map((p) => p[1]);
      fit(Math.min(...xs) - 0.6, Math.max(...xs) + 0.6, Math.min(...ts) - 0.5, Math.max(...ts) + 0.5);
      drawLightCone();
      const homeCol = pal.series[0], travCol = pal.series[2];
      // turnaround star worldline
      ctx.strokeStyle = pal.faint; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); lineS(D_TWIN, -5, D_TWIN, T + 5); ctx.stroke(); ctx.setLineDash([]);
      // simultaneity lines of the traveller at turnaround
      const tHalf = T / 2;
      ctx.lineWidth = 1.2;
      // outbound frame (β): line through turnaround event with slope β → hits x=0 at t = T/2 − βD
      const tOut = tHalf - b * D_TWIN, tIn = tHalf + b * D_TWIN;
      ctx.strokeStyle = pal.series[3]; ctx.beginPath(); lineS(-0.5, tOut - b * 0.5, D_TWIN + 0.5, tHalf + b * 0.5); ctx.stroke();
      ctx.strokeStyle = pal.series[4]; ctx.beginPath(); lineS(-0.5, tIn + b * 0.5, D_TWIN + 0.5, tHalf - b * 0.5); ctx.stroke();
      // the gap
      ctx.strokeStyle = pal.bad; ctx.lineWidth = 4; ctx.globalAlpha = 0.45;
      ctx.beginPath(); lineS(0, tOut, 0, tIn); ctx.stroke(); ctx.globalAlpha = 1;
      // worldlines
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = homeCol; ctx.beginPath(); lineS(0, -0.5, 0, T + 0.5); ctx.stroke();
      ctx.strokeStyle = travCol; ctx.beginPath(); lineS(0, 0, D_TWIN, tHalf); lineS(D_TWIN, tHalf, 0, T); ctx.stroke();
      // proper-time ticks (every year of each twin's own clock)
      for (let k = 1; k < T; k++) dot(0, k, homeCol, 2.4);
      const tauHalf = tHalf / gg;
      for (let k = 1; k < 2 * tauHalf; k++) {
        const tt = k <= tauHalf ? k * gg : T - (2 * tauHalf - k) * gg;
        const xx = tt <= tHalf ? b * tt : b * (T - tt);
        dot(xx, tt, travCol, 2.4);
      }
      // animation
      tAnim += dt * Math.max(1, T / 8);
      if (tAnim > T + 1.5) tAnim = 0;
      const ta = Math.min(tAnim, T);
      const xa = ta <= tHalf ? b * ta : b * (T - ta);
      dot(0, ta, homeCol, 5.5);
      dot(xa, ta, travCol, 5.5);
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      label(`home: ${fmt(ta, 3)} yr`, 0, ta, homeCol, 'right', 4);
      label(`traveller: ${fmt(ta / gg, 3)} yr`, xa, ta, travCol, 'left', 4);
      label('turnaround', D_TWIN, tHalf, pal.muted, 'left', -8);
      label('Earth', 0, -0.4, homeCol, 'center', 16);
      label(`${D_TWIN} ly`, D_TWIN, -0.4, pal.muted, 'center', 16);
      label('the jump', 0, (tOut + tIn) / 2, pal.bad, 'right', 6);
      readA.set(`γ = ${fmt(gg, 4)} · red bar: home time the traveller's "now" skips at turnaround = ${fmt(tIn - tOut, 3)} yr`);
      readB.set(`home twin ages ${fmt(T, 3)} yr`);
      readC.set(`traveller ages ${fmt(T / gg, 3)} yr`);
    }

    function render(_a: number, frameDt: number) {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
      if (mode === 'frames') drawFrames(); else drawTwins(frameDt);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const frameNote = inPrime ? 'drawn in frame S′ (moving at β relative to S)' : 'drawn in frame S';
      haloText(ctx, frameNote, 10, 8, pal.bg);
      ctx.fillStyle = pal.muted;
      ctx.fillText(frameNote, 10, 8);
    }

    const loop = new Loop(null, render);
    stage.onResize(() => loop.invalidate());
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    // pointer: drag β handle or the event
    let drag: 'beta' | 'event' | null = null;
    const cv = stage.canvas;
    cv.style.touchAction = 'none';
    const local = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      const [px, py] = local(e);
      if (mode !== 'frames') return;
      if (handle && Math.hypot(px - handle[0], py - handle[1]) < 16) drag = 'beta';
      else drag = 'event';
      cv.setPointerCapture(e.pointerId);
      move(px, py);
    });
    function move(px: number, py: number) {
      const vx = (px - ox) / sc, vt = (oy - py) / sc;
      if (drag === 'beta') {
        setBeta(Math.max(-0.95, Math.min(0.95, vx / Math.max(vt, 0.5))));
      } else if (drag === 'event') {
        const [x, t] = fromView(vx, vt);
        ev.x = x; ev.t = t;
      }
    }
    cv.addEventListener('pointermove', (e) => {
      const [px, py] = local(e);
      if (drag) move(px, py);
      else if (mode === 'frames') cv.style.cursor = handle && Math.hypot(px - handle[0], py - handle[1]) < 16 ? 'ew-resize' : 'crosshair';
    });
    const up = () => { drag = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    const panel = new Panel(host);
    panel.select('Show', [{ value: 'frames', label: 'Two frames' }, { value: 'twins', label: 'Twin paradox' }], mode, (v) => { mode = v; tAnim = 0; });
    const bs = panel.slider('β', { min: -0.95, max: 0.95, value: beta, step: 0.01 }, (v) => { beta = v; });
    const setBeta = (v: number) => { beta = Math.round(v * 100) / 100; bs.set(beta); };
    panel.toggle('Draw in frame S′', inPrime, (v) => { inPrime = v; });
    const readA = panel.readout('');
    const readB = panel.readout('');
    const readC = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
