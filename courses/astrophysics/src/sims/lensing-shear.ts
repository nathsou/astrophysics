// Weak lensing: randomly oriented background galaxies are coherently sheared tangentially around a mass.
// Lensed ellipticity (complex notation): eps = (eps_s + g) / (1 + g* eps_s), reduced shear g = γ/(1−κ).
// Lens: SIS with κ = γ = θ_E / (2θ). Angles in arcmin (cluster-scale weak lensing).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const FIELD = 10; // arcmin across (square)
type C = [number, number];
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);';
    host.append(wrap);
    const sky = createStage(wrap, { aspect: 1 });
    const pst = createStage(wrap, { aspect: 1 / 1.1 });
    sky.el.style.borderRight = '1px solid var(--rule)';
    sky.el.style.touchAction = 'none';
    const ctx = sky.canvas.getContext('2d')!;
    const plot = new Plot(pst.canvas, { x: { min: 0, max: 5, label: 'radius θ (arcmin)' }, y: { min: -0.1, max: 0.6, label: 'tangential ellipticity' }, title: 'Stacked shear profile' });

    const st = { thetaE: 0.5, n: 1500, sigma: 0.25, whiskers: false, lensed: true, lens: [0, 0] as C };
    let gals: { x: number; y: number; e: C; r: number }[] = [];
    function seed() {
      gals = [];
      for (let i = 0; i < st.n; i++) {
        // Gaussian intrinsic ellipticity (Box-Muller), random orientation
        const m = Math.min(0.8, Math.abs(st.sigma * Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random())));
        const ph = Math.PI * Math.random();
        gals.push({ x: (Math.random() - 0.5) * FIELD, y: (Math.random() - 0.5) * FIELD, e: [m * Math.cos(2 * ph), m * Math.sin(2 * ph)], r: 0.035 + 0.045 * Math.random() });
      }
    }
    seed();

    // shear at position (SIS): γ = θE/(2θ), tangential; complex γ = -|γ| e^{2iφ}
    const shear = (x: number, y: number): { g: C; k: number } => {
      const dx = x - st.lens[0], dy = y - st.lens[1];
      const th = Math.max(Math.hypot(dx, dy), 0.05), phi = Math.atan2(dy, dx);
      const k = st.thetaE / (2 * th);
      const gm = Math.min(k, 0.95);
      return { g: [-gm * Math.cos(2 * phi), -gm * Math.sin(2 * phi)], k: Math.min(k, 0.95) };
    };

    const NB = 10, prof = new Float64Array(NB), cnt = new Float64Array(NB), rs = new Float64Array(NB);
    function render() {
      const { width: W, height: H, dpr } = sky;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
      const k = W / FIELD;
      const P = (x: number, y: number): C => [W / 2 + x * k, H / 2 - y * k];
      prof.fill(0); cnt.fill(0);
      for (const gl of gals) {
        const { g, k: kap } = shear(gl.x, gl.y);
        const gr: C = [g[0] / (1 - kap), g[1] / (1 - kap)];
        let e = gl.e;
        if (st.lensed) {
          const num: C = [e[0] + gr[0], e[1] + gr[1]];
          const den: C = [1 + (gr[0] * e[0] + gr[1] * e[1]), gr[0] * e[1] - gr[1] * e[0]];
          e = cdiv(num, den);
        }
        const em = Math.min(Math.hypot(e[0], e[1]), 0.9), ang = 0.5 * Math.atan2(e[1], e[0]);
        const a = gl.r * Math.sqrt((1 + em) / (1 - em)), b = gl.r * Math.sqrt((1 - em) / (1 + em));
        const [X, Y] = P(gl.x, gl.y);
        if (st.whiskers) {
          // true shear whisker: length ∝ |γ|, along the stretching direction
          const gm = Math.hypot(g[0], g[1]), ga = 0.5 * Math.atan2(g[1], g[0]), L = Math.min(40, 60 * gm);
          ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(X - L * Math.cos(ga) / 2, Y + L * Math.sin(ga) / 2); ctx.lineTo(X + L * Math.cos(ga) / 2, Y - L * Math.sin(ga) / 2); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(255,236,200,0.8)';
          ctx.beginPath(); ctx.ellipse(X, Y, Math.max(0.6, a * k), Math.max(0.5, b * k), -ang, 0, 7); ctx.fill();
        }
        // tangential ellipticity about the lens: e_t = -Re(e e^{-2iφ})
        const dx = gl.x - st.lens[0], dy = gl.y - st.lens[1], r = Math.hypot(dx, dy), phi = Math.atan2(dy, dx);
        const et = -(e[0] * Math.cos(2 * phi) + e[1] * Math.sin(2 * phi));
        const bin = Math.floor((r / 5) * NB);
        if (bin >= 0 && bin < NB) { prof[bin] += et; cnt[bin]++; }
      }
      const [lx, ly] = P(st.lens[0], st.lens[1]);
      const gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, 40);
      gr.addColorStop(0, 'rgba(255,200,120,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(lx, ly, 40, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(lx, ly, st.thetaE * k, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      const title = `${FIELD}′ × ${FIELD}′ field — drag the mass`;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(4, 4, ctx.measureText(title).width + 10, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(title, 9, 17);

      for (let i = 0; i < NB; i++) rs[i] = ((i + 0.5) * 5) / NB;
      plot.draw(() => {
        plot.hline(0, { color: pal.axis, dash: [] });
        // weak-lensing prediction, valid outside the Einstein radius (inside it images are strongly lensed)
        plot.fn((t) => { if (t < st.thetaE) return NaN; const kk = st.thetaE / (2 * t); return kk / (1 - kk); }, { color: pal.series[1], dash: [4, 4] });
        plot.ctx.fillStyle = pal.faint; plot.ctx.globalAlpha = 0.15;
        plot.ctx.fillRect(plot.px(0), plot.m.t, plot.px(st.thetaE) - plot.px(0), plot.ph); plot.ctx.globalAlpha = 1;
        plot.text('strong', plot.px(st.thetaE / 2), plot.m.t + plot.ph - 8, { color: pal.muted, align: 'center', size: 10 });
        for (let i = 0; i < NB; i++) {
          if (cnt[i] < 2 || rs[i] < st.thetaE) continue;
          const m = prof[i] / cnt[i], err = st.sigma / Math.sqrt(cnt[i]);
          plot.ctx.strokeStyle = pal.series[0]; plot.ctx.lineWidth = 1.5;
          plot.ctx.beginPath(); plot.ctx.moveTo(plot.px(rs[i]), plot.py(m - err)); plot.ctx.lineTo(plot.px(rs[i]), plot.py(m + err)); plot.ctx.stroke();
          plot.point(rs[i], m, { r: 3.5, color: pal.series[0] });
        }
      });
      plot.text('dashed: true reduced shear g_t', plot.m.l + 6, plot.m.t + 14, { color: pal.series[1] });
    }
    const loop = new Loop(null, render);
    loop.onDemand = true; // static figure: redraw only on invalidate()
    sky.onResize(() => loop.invalidate());
    pst.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    let drag = false;
    const mv = (e: PointerEvent) => {
      const r = sky.canvas.getBoundingClientRect();
      st.lens = [((e.clientX - r.left) / r.width - 0.5) * FIELD, (0.5 - (e.clientY - r.top) / r.height) * FIELD];
      loop.invalidate();
    };
    sky.el.addEventListener('pointerdown', (e) => { drag = true; sky.el.setPointerCapture(e.pointerId); mv(e); });
    sky.el.addEventListener('pointermove', (e) => { if (drag) mv(e); });
    sky.el.addEventListener('pointerup', () => (drag = false));

    const panel = new Panel(host);
    panel.toggle('Lensing on', st.lensed, (v) => { st.lensed = v; loop.invalidate(); });
    panel.toggle('Shear whiskers', st.whiskers, (v) => { st.whiskers = v; loop.invalidate(); });
    panel.slider('Einstein radius', { min: 0.05, max: 1.2, value: st.thetaE, step: 0.01, unit: '′' }, (v) => { st.thetaE = v; loop.invalidate(); });
    panel.slider('Galaxies', { min: 200, max: 6000, value: st.n, log: true, step: 1, format: (v) => String(Math.round(v)) }, (v) => { st.n = Math.round(v); seed(); loop.invalidate(); });
    panel.slider('Shape noise σ_e', { min: 0, max: 0.4, value: st.sigma, step: 0.01, format: (v) => fmt(v, 2) }, (v) => { st.sigma = v; seed(); loop.invalidate(); });
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
