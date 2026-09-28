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
    // Wide: a(t) fills the full height of the right column. Narrow: stack everything.
    leftCol.style.cssText = 'display:flex;flex-direction:column;min-width:0;';
    const layout = () => {
      const wide = host.clientWidth >= 600;
      wrap.style.gridTemplateColumns = wide ? 'minmax(0,1.3fr) minmax(0,1fr)' : 'minmax(0,1fr)';
      atStage.el.style.aspectRatio = wide ? 'auto' : String(4 / 3);
      atStage.el.style.flex = wide ? '1 1 auto' : '';
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(host);

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
        // Regions from the exact (Ωr = 0) boundaries of Carroll, Press & Turner (1992):
        //  • accelerating today iff q₀ = Ωm/2 − ΩΛ < 0;
        //  • recollapse iff ΩΛ < 0 (Ωm ≤ 1) or ΩΛ < 4Ωm cos³[⅓ arccos((1−Ωm)/Ωm) + 4π/3] (Ωm > 1);
        //  • no Big Bang (a bounce in the past) iff ΩΛ > 4Ωm f³[⅓ f⁻¹((1−Ωm)/Ωm)], f = cosh (Ωm < ½) or cos.
        const { ctx } = planePlot;
        const X0 = planePlot.o.x.min, X1 = planePlot.o.x.max, Y0 = planePlot.o.y.min, Y1 = planePlot.o.y.max;
        const recollapseOL = (om: number) => om <= 1 ? 0 : 4 * om * Math.cos(Math.acos((1 - om) / om) / 3 + (4 * Math.PI) / 3) ** 3;
        const bounceOL = (om: number) => {
          if (om <= 1e-4) return 1;
          const r = (1 - om) / om;
          return 4 * om * (om < 0.5 ? Math.cosh(Math.acosh(r) / 3) : Math.cos(Math.acos(Math.min(1, r)) / 3)) ** 3;
        };
        const region = (lower: (om: number) => number, upper: (om: number) => number, fill: string, alpha: number) => {
          ctx.beginPath();
          const n = 120;
          for (let k = 0; k <= n; k++) { const om = X0 + ((X1 - X0) * k) / n; const X = planePlot.px(om), Y = planePlot.py(Math.min(Y1, Math.max(Y0, upper(om)))); k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
          for (let k = n; k >= 0; k--) { const om = X0 + ((X1 - X0) * k) / n; ctx.lineTo(planePlot.px(om), planePlot.py(Math.min(Y1, Math.max(Y0, lower(om))))); }
          ctx.closePath();
          ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
        };
        region((om) => om / 2, () => Y1, pal.accent, 0.07);                 // accelerating
        region(() => Y0, recollapseOL, pal.bad, 0.16);                       // recollapse
        region(bounceOL, () => Y1, pal.series[4], 0.2);                      // no Big Bang
        planePlot.fn((om) => om / 2, { color: pal.accent, dash: [2, 3], width: 1, alpha: 0.6 });
        planePlot.fn(recollapseOL, { color: pal.bad, dash: [2, 3], width: 1 });
        planePlot.fn(bounceOL, { color: pal.series[4], dash: [2, 3], width: 1 });
        // flat universe line: OL = 1 - Om
        planePlot.fn((om) => 1 - om, { color: pal.muted, dash: [4, 3] });
        const lab = (t: string, om: number, ol: number, color: string, align: CanvasTextAlign = 'left') =>
          planePlot.text(t, planePlot.px(om), planePlot.py(ol), { color, align, size: 10 });
        lab('flat', 1.3, 1 - 1.3 + 0.08, pal.muted);
        lab('accelerating', 0.62, 1.12, pal.accent);
        lab('decelerating', 1.55, 0.45, pal.muted, 'right');
        lab('recollapses', 0.05, -0.85, pal.bad);
        lab('no Big Bang', 0.05, 1.68, pal.series[4]);
        // approximate observational ellipses (illustrative only)
        drawEllipse(0.30, 0.70, 0.10, 0.09, pal.series[1], 'SNe Ia (approx.)');
        drawEllipse(0.31, 0.69, 0.03, 0.09, pal.series[2], 'CMB (approx.)');
        drawEllipse(0.31, 0.69, 0.05, 0.4, pal.series[3], 'BAO (approx.)');
        // current point
        planePlot.point(Om, OL, { color: pal.accent, r: 6, stroke: pal.bg ?? '#000' });
      });
      // legend for the (illustrative) constraint ellipses
      const lx = planePlot.m.l + planePlot.pw - 6;
      [['SNe Ia', pal.series[1]], ['CMB', pal.series[2]], ['BAO', pal.series[3]]].forEach(([t, c], i) =>
        planePlot.text(`◯ ${t}`, lx, planePlot.m.t + 14 + i * 13, { color: c, align: 'right', size: 10 }));

      function drawEllipse(cx: number, cy: number, rx: number, ry: number, color: string, _label: string) {
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
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
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

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => { ro.disconnect(); loop.destroy(); } };
  },
});
