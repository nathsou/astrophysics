// Microlensing light-curve generator. A star (plus optional planet) lenses a background star.
// The binary-lens magnification map is built on the CPU by inverse ray shooting: a dense grid of rays in
// the lens plane is mapped to the source plane and binned; ray density / unlensed density = magnification.
// Units: angles in Einstein radii of the total lens mass; time in Einstein crossing times t_E.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const N = 300;          // source-plane map resolution
const HALF = 1.6;       // map covers [-HALF, HALF]^2 in θ_E
const RAYS = 2000;      // rays per axis
const RHALF = 2.9;      // ray grid half-width in θ_E

const paczynski = (u: number) => (u * u + 2) / (u * Math.sqrt(u * u + 4));

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr);';
    host.append(wrap);
    const mapStage = createStage(wrap, { aspect: 1 });
    const lcStage = createStage(wrap, { aspect: 1.5 });
    mapStage.el.style.borderRight = '1px solid var(--rule)';
    mapStage.el.style.touchAction = 'none';
    const mctx = mapStage.canvas.getContext('2d')!;
    const plot = new Plot(lcStage.canvas, { x: { min: -1.5, max: 1.5, label: 'time (t − t₀) / t_E' }, y: { min: 1, max: 12, log: true, label: 'magnification A', format: (v) => String(v) }, title: 'Light curve' });

    const st = { u0: 0.2, planet: true, q: 1e-3, sep: 1.1, angle: 0.5, rho: 0.004 };
    const map = new Float32Array(N * N);
    const img = new ImageData(N, N);
    const off = document.createElement('canvas'); off.width = N; off.height = N;
    const octx = off.getContext('2d')!;
    const curveT = new Float64Array(600), curveA = new Float64Array(600), curveP = new Float64Array(600);
    let tNow = -1.5;

    function buildMap() {
      map.fill(0);
      const m2 = st.planet ? st.q / (1 + st.q) : 0, m1 = 1 - m2;
      // centre of mass at origin: star at -m2*sep, planet at +m1*sep (on x axis)
      const x1 = -m2 * st.sep, x2 = m1 * st.sep;
      const dr = (2 * RHALF) / RAYS, k = N / (2 * HALF);
      for (let j = 0; j < RAYS; j++) {
        const y = -RHALF + (j + 0.5) * dr, y2 = y * y;
        for (let i = 0; i < RAYS; i++) {
          const x = -RHALF + (i + 0.5) * dr;
          const dx1 = x - x1, r1 = dx1 * dx1 + y2;
          let bx = x - (m1 * dx1) / r1, by = y - (m1 * y) / r1;
          if (m2 > 0) { const dx2 = x - x2, r2 = dx2 * dx2 + y2; bx -= (m2 * dx2) / r2; by -= (m2 * y) / r2; }
          // cloud-in-cell deposit (bilinear splat) instead of nearest-bin counting: removes most of the
          // aliasing noise a regular ray grid otherwise leaves in the light curve
          const fx = (bx + HALF) * k - 0.5, fy = (by + HALF) * k - 0.5;
          const px = Math.floor(fx), py = Math.floor(fy);
          if (px >= 0 && px < N - 1 && py >= 0 && py < N - 1) {
            const u = fx - px, v = fy - py, o = py * N + px;
            map[o] += (1 - u) * (1 - v); map[o + 1] += u * (1 - v);
            map[o + N] += (1 - u) * v; map[o + N + 1] += u * v;
          }
        }
      }
      const norm = (1 / (2 * HALF / N)) ** 2 * dr * dr; // unlensed rays per source pixel = (dr/pix)^2
      for (let i = 0; i < map.length; i++) map[i] *= norm;
      // colour: log magnification
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const a = map[j * N + i];
        const t = Math.min(1, Math.max(0, Math.log10(Math.max(a, 1e-3)) / 1.3));
        const o = ((N - 1 - j) * N + i) * 4;
        img.data[o] = 255 * Math.min(1, 1.6 * t * t + 0.05);
        img.data[o + 1] = 255 * Math.min(1, t * t * t * 1.3 + 0.04);
        img.data[o + 2] = 255 * Math.min(1, 0.25 + 0.6 * t - 0.3 * t * t);
        img.data[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      buildCurve();
    }

    // bilinear sample, averaged over a finite source disc of radius rho (smooths ray noise, like real stars do)
    function sample(bx: number, by: number) {
      const k = N / (2 * HALF);
      const at = (x: number, y: number) => {
        const fx = (x + HALF) * k - 0.5, fy = (y + HALF) * k - 0.5;
        const i = Math.floor(fx), j = Math.floor(fy);
        if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return paczynski(Math.hypot(x, y));
        const u = fx - i, v = fy - j;
        return (map[j * N + i] * (1 - u) + map[j * N + i + 1] * u) * (1 - v) + (map[(j + 1) * N + i] * (1 - u) + map[(j + 1) * N + i + 1] * u) * v;
      };
      const r = Math.max(st.rho, 1.5 / k);
      let s = at(bx, by), n = 1;
      for (let a = 0; a < 8; a++) { s += at(bx + r * Math.cos(a * Math.PI / 4), by + r * Math.sin(a * Math.PI / 4)); n++; }
      return s / n;
    }
    const track = (t: number): [number, number] => {
      const c = Math.cos(st.angle), s = Math.sin(st.angle);
      return [t * c - st.u0 * s, t * s + st.u0 * c];
    };
    let Amax = 1;
    function buildCurve() {
      Amax = 1;
      for (let i = 0; i < curveT.length; i++) {
        const t = -1.5 + (3 * i) / (curveT.length - 1);
        const [bx, by] = track(t);
        curveT[i] = t; curveA[i] = sample(bx, by); curveP[i] = paczynski(Math.hypot(t, st.u0));
        Amax = Math.max(Amax, curveA[i]);
      }
      plot.o.y.max = Math.max(3, Math.min(200, Amax * 1.4));
      plot.o.y.ticks = [1, 1.5, 2, 3, 5, 7, 10, 20, 30, 50, 100, 200].filter((v) => v <= plot.o.y.max && (plot.o.y.max < 25 || ![1.5, 7].includes(v)));
    }

    let rebuild = true;
    const loop = new Loop((dt) => { tNow += dt * 0.35; if (tNow > 1.5) tNow = -1.5; }, render, 1 / 60);

    function render() {
      if (rebuild) { rebuild = false; buildMap(); }
      const { width: Wm, height: Hm, dpr } = mapStage;
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.imageSmoothingEnabled = true;
      mctx.drawImage(off, 0, 0, Wm, Hm);
      const toPx = (x: number, y: number): [number, number] => [(x + HALF) / (2 * HALF) * Wm, (HALF - y) / (2 * HALF) * Hm];
      // Einstein ring of the total mass
      const [cx, cy] = toPx(0, 0);
      mctx.strokeStyle = 'rgba(255,255,255,0.35)'; mctx.setLineDash([3, 4]);
      mctx.beginPath(); mctx.arc(cx, cy, Wm / (2 * HALF), 0, Math.PI * 2); mctx.stroke(); mctx.setLineDash([]);
      // track
      const [ax, ay] = toPx(...track(-2)), [bx2, by2] = toPx(...track(2));
      mctx.strokeStyle = 'rgba(120,220,255,0.9)'; mctx.lineWidth = 1.2;
      mctx.beginPath(); mctx.moveTo(ax, ay); mctx.lineTo(bx2, by2); mctx.stroke();
      // lenses
      const m2 = st.planet ? st.q / (1 + st.q) : 0;
      const [sx, sy] = toPx(-m2 * st.sep, 0);
      mctx.fillStyle = '#ffd98a'; mctx.beginPath(); mctx.arc(sx, sy, 4, 0, Math.PI * 2); mctx.fill();
      if (st.planet) { const [px, py] = toPx((1 - m2) * st.sep, 0); mctx.fillStyle = '#9fd4ff'; mctx.beginPath(); mctx.arc(px, py, 2.5, 0, Math.PI * 2); mctx.fill(); }
      // moving source
      const [qx, qy] = toPx(...track(tNow));
      mctx.strokeStyle = '#fff'; mctx.beginPath(); mctx.arc(qx, qy, 4, 0, Math.PI * 2); mctx.stroke();
      mctx.font = '11px JetBrains Mono, ui-monospace, monospace'; mctx.fillStyle = 'rgba(255,255,255,0.85)';
      mctx.fillText('source-plane magnification', 8, 16);
      mctx.fillText('drag to move the track', 8, Hm - 8);

      const aNow = sample(...track(tNow));
      plot.draw(() => {
        plot.line(curveT, curveP, { color: pal.muted, dash: [4, 4], width: 1.2 });
        plot.line(curveT, curveA, { color: pal.series[0] });
        plot.vline(tNow, { color: pal.faint });
        plot.point(tNow, aNow, { r: 4, color: pal.accent });
      });
      plot.text('dashed: single lens (Paczyński)', plot.m.l + 8, plot.m.t + 14, { color: pal.muted });
      roA.set(`${fmt(Amax, 3)} (single lens ${fmt(paczynski(st.u0), 3)})`);
    }
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    mapStage.onResize(() => loop.invalidate());
    lcStage.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    // drag on map: set u0 from perpendicular distance of pointer to the track direction
    let drag = false;
    const setFromPointer = (e: PointerEvent) => {
      const r = mapStage.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 * HALF - HALF, y = HALF - ((e.clientY - r.top) / r.height) * 2 * HALF;
      st.u0 = Math.max(0.005, Math.min(1.5, -x * Math.sin(st.angle) + y * Math.cos(st.angle)));
      u0sl.set(st.u0); buildCurve(); loop.invalidate();
    };
    mapStage.el.addEventListener('pointerdown', (e) => { drag = true; mapStage.el.setPointerCapture(e.pointerId); setFromPointer(e); });
    mapStage.el.addEventListener('pointermove', (e) => { if (drag) setFromPointer(e); });
    mapStage.el.addEventListener('pointerup', () => (drag = false));

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    const u0sl = panel.slider('Impact u₀', { min: 0.005, max: 1.5, value: st.u0, log: true }, (v) => { st.u0 = v; buildCurve(); loop.invalidate(); });
    panel.slider('Track angle', { min: 0, max: Math.PI, value: st.angle, step: 0.01, format: (v) => `${Math.round((v * 180) / Math.PI)}°` }, (v) => { st.angle = v; buildCurve(); loop.invalidate(); });
    panel.toggle('Planet', st.planet, (v) => { st.planet = v; rebuild = true; loop.invalidate(); });
    panel.slider('Mass ratio q', { min: 1e-5, max: 1e-2, value: st.q, log: true, format: (v) => fmt(v, 2) }, (v) => { st.q = v; rebuild = true; loop.invalidate(); });
    panel.slider('Separation s', { min: 0.4, max: 2.2, value: st.sep, step: 0.01, unit: 'θ_E' }, (v) => { st.sep = v; rebuild = true; loop.invalidate(); });
    const roA = panel.readout('Peak A');

    // Side by side when there is room, stacked on phones.
    const twoCol = wrap.style.gridTemplateColumns;
    const cols = () => {
      const narrow = host.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : twoCol;
      const first = wrap.firstElementChild as HTMLElement;
      first.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      first.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    };
    cols();
    new ResizeObserver(cols).observe(host);
    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
