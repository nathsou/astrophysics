// Chapter 25 flagship: build your own Friedmann universe.
// Three linked views: a(t) history with fate classification, the Ωm–ΩΛ plane with a draggable
// point, and an animated comoving grid of galaxies with a redshifting photon.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import {
  type OmegaParams, Ok, E2, q0, computeHistory, aAtT, type History,
} from './expansion/cosmology';

export default defineSim({
  mount({ host }) {
    let pal = palette();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:2px;';
    host.append(wrap);

    const leftCol = document.createElement('div');
    const rightCol = document.createElement('div');
    rightCol.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    wrap.append(leftCol, rightCol);

    const atStage = createStage(leftCol, { aspect: 4 / 3 });
    const planeStage = createStage(rightCol, { aspect: 1.15 });
    const gridStage = createStage(rightCol, { aspect: 1.7 });

    const atPlot = new Plot(atStage.canvas, {
      x: { min: -20, max: 20, label: 't − t₀ (Gyr)' },
      y: { min: 0, max: 3, label: 'scale factor a' },
      title: 'a(t)',
    });
    const planePlot = new Plot(planeStage.canvas, {
      x: { min: 0, max: 1.6, label: 'Ωm' },
      y: { min: -1, max: 1.8, label: 'ΩΛ' },
      title: 'Ωm – ΩΛ plane',
    });

    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    // ---- Parameters ----
    let Om = 0.315, OL = 0.685, Or = 9.1e-5, H0 = 67.4;
    let hist: History;
    let dragging: 'plane' | null = null;

    function params(): OmegaParams { return { Om, OL, Or }; }
    function recompute() { hist = computeHistory(params(), H0); }
    recompute();

    const loop = new Loop((dt) => {
      // advance the animation clock through the precomputed history, looping
      animT += dt * animSpeed;
      const span = hist.ts[hist.ts.length - 1] - hist.ts[0];
      if (span > 0) {
        const rel = ((animT % span) + span) % span;
        animT = hist.ts[0] + rel;
      }
    }, render, 1 / 30);

    let animT = 0;
    let animSpeed = 2; // Gyr per second

    function render() {
      drawAtPlot();
      drawPlane();
      drawGrid();
    }

    function drawAtPlot() {
      const { dpr } = atStage;
      atPlot.resize(atStage.width, atStage.height, dpr);
      const nowT = 0; // convention: t measured relative to "now" for display
      const t0 = hist.ts[hist.nowIndex];
      atPlot.o.x.min = Math.max(hist.ts[0] - t0, -60);
      atPlot.o.x.max = Math.min(hist.ts[hist.ts.length - 1] - t0, 60);
      let amax = 0;
      for (const a of hist.as) amax = Math.max(amax, Math.min(a, 5));
      atPlot.o.y.max = Math.max(1.5, amax * 1.1);
      atPlot.draw(() => {
        const xs = new Float64Array(hist.ts.length);
        for (let i = 0; i < xs.length; i++) xs[i] = hist.ts[i] - t0;
        atPlot.line(xs, hist.as, { color: pal.series[0], width: 2 });
        atPlot.hline(1, { color: pal.faint });
        atPlot.vline(0, { color: pal.muted, label: 'now' });
        const aNow = 1;
        atPlot.point(0, aNow, { color: pal.accent, r: 5 });
        // animated marker
        const aAnim = aAtT(hist, animT);
        atPlot.point(animT - t0, aAnim, { color: pal.accent2, r: 4.5 });
        if (hist.fate === 'crunch' && hist.tTurnGyr !== undefined) {
          atPlot.vline(hist.tTurnGyr - t0, { color: pal.bad, label: 'turnaround' });
        }
      });
    }

    function drawPlane() {
      const { dpr } = planeStage;
      planePlot.resize(planeStage.width, planeStage.height, dpr);
      planePlot.draw(() => {
        // shaded regions via dense scatter classification (cheap, looks like a heatmap)
        const N = 46;
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const om = planePlot.o.x.min + (planePlot.o.x.max - planePlot.o.x.min) * (i + 0.5) / N;
            const ol = planePlot.o.y.min + (planePlot.o.y.max - planePlot.o.y.min) * (j + 0.5) / N;
            const p: OmegaParams = { Om: om, OL: ol, Or: 0 };
            const decel = q0(p) > 0;
            // recollapse test: does E2(a) go negative for some a>1?
            let recollapse = false;
            for (let k = 1; k <= 40; k++) { const a = 1 + k * 0.5; if (E2(a, p) < 0) { recollapse = true; break; } }
            let color = decel ? pal.faint : pal.grid;
            if (recollapse) color = 'rgba(220,90,90,0.16)';
            const x0 = planePlot.px(om - (planePlot.o.x.max - planePlot.o.x.min) / N / 2);
            const y0 = planePlot.py(ol + (planePlot.o.y.max - planePlot.o.y.min) / N / 2);
            const cellW = planePlot.pw / N, cellH = planePlot.ph / N;
            planePlot.ctx.fillStyle = color;
            planePlot.ctx.fillRect(x0, y0, cellW + 1, cellH + 1);
          }
        }
        // flat universe line: OL = 1 - Om
        planePlot.fn((om) => 1 - om, { color: pal.muted, dash: [4, 3] });
        planePlot.text('flat', planePlot.px(1.3), planePlot.py(1 - 1.3) - 6, { color: pal.muted });
        // no-big-bang / recollapse boundary trace (numeric)
        {
          const xs: number[] = [], ys: number[] = [];
          for (let om = 0.02; om <= 1.6; om += 0.02) {
            const aRoot = findTangentA(om);
            if (aRoot) { xs.push(om); ys.push(0.5 * om / (aRoot * aRoot * aRoot)); }
          }
          planePlot.line(Float64Array.from(xs), Float64Array.from(ys), { color: pal.bad, dash: [2, 3] });
        }
        // approximate observational ellipses (illustrative only)
        drawEllipse(0.30, 0.70, 0.10, 0.09, pal.series[1], 'SNe Ia (approx.)');
        drawEllipse(0.31, 0.69, 0.03, 0.09, pal.series[2], 'CMB (approx.)');
        drawEllipse(0.31, 0.69, 0.05, 0.4, pal.series[3], 'BAO (approx.)');
        // current point
        planePlot.point(Om, OL, { color: pal.accent, r: 6, stroke: pal.bg ?? '#000' });
      });

      function drawEllipse(cx: number, cy: number, rx: number, ry: number, color: string, label: string) {
        const { ctx } = planePlot;
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) {
          const th = (k / 40) * Math.PI * 2;
          const X = planePlot.px(cx + rx * Math.cos(th));
          const Y = planePlot.py(cy + ry * Math.sin(th));
          k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
        void label;
      }

      function findTangentA(om: number): number | null {
        // find a>1 where E2(a)=0 and dE2/da=0 simultaneously for Or=0: Ok=-1.5*Om/a
        // solve 1-om-0.5*om/a^3 = -1.5*om/a  for a, by bisection over a in (1,60)
        const f = (a: number) => (1 - om - 0.5 * om / (a * a * a)) + 1.5 * om / a;
        let lo = 1.001, hi = 60, flo = f(lo), fhi = f(hi);
        if (flo * fhi > 0) return null;
        for (let it = 0; it < 40; it++) {
          const mid = 0.5 * (lo + hi), fm = f(mid);
          if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        }
        return 0.5 * (lo + hi);
      }
    }

    function drawGrid() {
      const { width: W, height: H, dpr } = gridStage;
      const ctx = gridStage.canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const aNow = aAtT(hist, animT);
      const scale = Math.min(W, H) * 0.42 / 2.2; // comoving half-range ~2.2
      const cx = W / 2, cy = H / 2;
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      const N = 5;
      for (let i = -N; i <= N; i++) {
        ctx.beginPath();
        const x = cx + (i / N) * (N * scale) * aNow;
        ctx.moveTo(x, cy - N * scale * aNow);
        ctx.lineTo(x, cy + N * scale * aNow);
        const y = cy + (i / N) * (N * scale) * aNow;
        ctx.moveTo(cx - N * scale * aNow, y);
        ctx.lineTo(cx + N * scale * aNow, y);
        ctx.stroke();
      }
      // galaxies at fixed comoving positions, physical position = comoving * a(t)
      ctx.fillStyle = pal.fg;
      for (let i = -N; i <= N; i += 1) {
        for (let j = -N; j <= N; j += 1) {
          if (i === 0 && j === 0) continue;
          const px = cx + (i / N) * (N * scale) * aNow;
          const py = cy + (j / N) * (N * scale) * aNow;
          if (px < 0 || px > W || py < 0 || py > H) continue;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // center galaxy (us)
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

      // photon: emitted periodically from a distant galaxy, travels inward at fixed comoving
      // speed (illustrative, not literally dχ/dt = c/a); its colour reddens with 1+z = a_now/a_emit.
      const period = 6; // seconds of wall-clock animation per photon journey
      const frac = (performance.now() / 1000 / period) % 1;
      const emitComoving = N * 0.92;
      const travelled = emitComoving * frac;
      const aEmit = aAtT(hist, animT - period * (1 - frac) * animSpeed * 0.15);
      const z = Math.max(aNow / Math.max(aEmit, 1e-3) - 1, 0);
      const hue = Math.max(0, 220 - z * 300); // blue -> red as redshift grows
      ctx.fillStyle = `hsl(${hue}, 85%, 60%)`;
      const photonX = cx - (emitComoving - travelled) * scale * aNow;
      ctx.beginPath();
      ctx.arc(photonX, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pal.muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(`a = ${fmt(aNow, 3)}`, 8, 14);
    }

    atStage.onResize(() => loop.invalidate());
    planeStage.onResize(() => loop.invalidate());
    gridStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    const omCtl = panel.slider('Ωm', { min: 0, max: 1.6, value: Om, step: 0.005 }, (v) => { Om = v; recompute(); updateReadouts(); loop.invalidate(); });
    const olCtl = panel.slider('ΩΛ', { min: -1, max: 1.8, value: OL, step: 0.005 }, (v) => { OL = v; recompute(); updateReadouts(); loop.invalidate(); });
    const orCtl = panel.slider('Ωr', { min: 0, max: 0.002, value: Or, step: 0.00001, format: (v) => v.toExponential(1) }, (v) => { Or = v; recompute(); updateReadouts(); loop.invalidate(); });
    const h0Ctl = panel.slider('H₀ (km/s/Mpc)', { min: 50, max: 90, value: H0, step: 0.1 }, (v) => { H0 = v; recompute(); updateReadouts(); loop.invalidate(); });
    panel.slider('Animation speed', { min: 0.2, max: 10, value: animSpeed, log: true, step: 0.1, format: (v) => `${fmt(v, 2)} Gyr/s` }, (v) => { animSpeed = v; });
    panel.button('Flat ΛCDM (Planck)', () => { Om = 0.315; OL = 0.685; Or = 9.1e-5; H0 = 67.4; syncSliders(); });
    panel.button('Matter only (EdS)', () => { Om = 1; OL = 0; Or = 0; syncSliders(); });
    panel.button('Closed, recollapse', () => { Om = 2.2; OL = 0; Or = 0; syncSliders(); });
    panel.button('No Big Bang', () => { Om = 0.1; OL = 1.6; Or = 0; syncSliders(); });

    const ageR = panel.readout('Age of the universe');
    const fateR = panel.readout('Fate');
    const q0R = panel.readout('q₀ (deceleration)');
    const okR = panel.readout('Ωk (curvature)');
    const zaR = panel.readout('Acceleration began at z');

    function updateReadouts() {
      ageR.set(`${fmt(hist.ageGyr, 4)} Gyr`);
      const fateNames: Record<string, string> = {
        crunch: 'Big Crunch', 'eternal-accel': 'Eternal, accelerating', 'eternal-coast': 'Eternal, decelerating',
        bounce: 'No Big Bang (bounce)', loitering: 'Loitering (near-static phase)',
      };
      fateR.set(fateNames[hist.fate]);
      q0R.set(fmt(q0(params()), 3));
      okR.set(fmt(Ok(params()), 3));
      zaR.set(Number.isFinite(hist.zAccel) ? fmt(hist.zAccel, 3) : 'never (in this window)');
    }
    updateReadouts();

    // draggable point on the plane
    planeStage.canvas.style.touchAction = 'none';
    planeStage.canvas.addEventListener('pointerdown', (e) => {
      dragging = 'plane';
      planeStage.canvas.setPointerCapture(e.pointerId);
    });
    planeStage.canvas.addEventListener('pointermove', (e) => {
      if (dragging !== 'plane') return;
      const rect = planeStage.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      Om = Math.min(Math.max(planePlot.dx(x), 0), 1.6);
      OL = Math.min(Math.max(planePlot.dy(y), -1), 1.8);
      recompute(); updateReadouts();
      omCtl.set(Om); olCtl.set(OL);
      loop.invalidate();
    });
    window.addEventListener('pointerup', () => { dragging = null; });

    function syncSliders() {
      recompute(); updateReadouts();
      omCtl.set(Om); olCtl.set(OL); orCtl.set(Or); h0Ctl.set(H0);
      loop.invalidate();
    }

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
