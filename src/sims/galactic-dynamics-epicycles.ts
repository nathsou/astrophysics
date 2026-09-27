// Chapter 22: a star's orbit in a galactic potential with a power-law rotation curve v_c ∝ R^β.
// Left: inertial frame (a rosette). Right: the same orbit seen from a rotating frame — either the
// guiding centre's frame (the orbit becomes a small retrograde epicycle ellipse) or a frame
// rotating at Ω − κ/2 (where, for near-flat rotation curves, the orbit almost closes into an oval:
// the seed of bars and the inner Lindblad resonance). CPU, f64, leapfrog.
// Units: R₀ = 1 (8 kpc), v₀ = v_c(R₀) = 1 (220 km/s).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const TRAIL = 4000;
const R_KPC = 8, V_KMS = 220;
const T_MYR = (R_KPC * 3.0857e16) / V_KMS / 3.156e13; // time unit in Myr (≈ 35.6)

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    const left = createStage(wrap, { aspect: 1 });
    const right = createStage(wrap, { aspect: 1 });
    left.el.style.borderRight = '1px solid var(--rule)';
    const lctx = left.canvas.getContext('2d')!, rctx = right.canvas.getContext('2d')!;

    let beta = 0;     // rotation-curve slope: 0 = flat, −0.5 = Kepler, 1 = solid body
    let kick = 0.2;   // initial radial velocity / v_c
    let frame: 'guide' | 'ilr' = 'guide';
    const s = new Float64Array(4);
    let t = 0;
    const tx = new Float64Array(TRAIL), ty = new Float64Array(TRAIL), tt = new Float64Array(TRAIL);
    let head = 0, count = 0, sub = 0;

    const vc2 = (R: number) => Math.pow(R, 2 * beta);
    const accel = (x: number, y: number): [number, number] => {
      const R2 = x * x + y * y;
      const f = vc2(Math.sqrt(R2)) / R2; // a = −v_c²/R · r̂
      return [-f * x, -f * y];
    };
    // guiding-centre quantities from angular momentum L = R_g v_c(R_g) = R_g^(1+β)
    let Rg = 1, Om = 1, kap = 1;
    function reset() {
      s.set([1, 0, kick, 1]);
      const L = 1;
      Rg = Math.pow(L, 1 / (1 + beta));
      Om = Math.pow(Rg, beta - 1);
      kap = Om * Math.sqrt(2 * (1 + beta));
      t = 0; head = 0; count = 0; sub = 0;
      loop.invalidate();
    }

    const DT = 0.004;
    function step() {
      for (let k = 0; k < 6; k++) {
        let [ax, ay] = accel(s[0], s[1]);
        s[2] += 0.5 * DT * ax; s[3] += 0.5 * DT * ay;
        s[0] += DT * s[2]; s[1] += DT * s[3];
        [ax, ay] = accel(s[0], s[1]);
        s[2] += 0.5 * DT * ax; s[3] += 0.5 * DT * ay;
        t += DT;
        if (++sub % 4 === 0) {
          tx[head] = s[0]; ty[head] = s[1]; tt[head] = t;
          head = (head + 1) % TRAIL; count = Math.min(count + 1, TRAIL);
        }
      }
    }

    function drawPanel(ctx: CanvasRenderingContext2D, st: typeof left, rot: number | null, title: string) {
      const { width: W, height: H, dpr } = st;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, sc = Math.min(W, H) / 3.4;
      // reference circle at the guiding radius
      ctx.strokeStyle = pal.faint; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, Rg * sc, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      // galactic centre
      ctx.fillStyle = pal.accent;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 2 * Math.PI); ctx.fill();
      // trail
      const start = (head - count + TRAIL) % TRAIL;
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = rot === null ? pal.series[1] : pal.series[0];
      ctx.beginPath();
      let X = 0, Y = 0;
      for (let k = 0; k < count; k++) {
        const j = (start + k) % TRAIL;
        let x = tx[j], y = ty[j];
        if (rot !== null) { const a = -rot * tt[j], c = Math.cos(a), sn = Math.sin(a); [x, y] = [x * c - y * sn, x * sn + y * c]; }
        X = cx + x * sc; Y = cy - y * sc;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
      // star
      if (count) {
        ctx.fillStyle = pal.fg;
        ctx.beginPath(); ctx.arc(X, Y, 4, 0, 2 * Math.PI); ctx.fill();
      }
      if (rot !== null && frame === 'guide') {
        ctx.strokeStyle = pal.accent2; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx + Rg * sc - 5, cy); ctx.lineTo(cx + Rg * sc + 5, cy); ctx.moveTo(cx + Rg * sc, cy - 5); ctx.lineTo(cx + Rg * sc, cy + 5); ctx.stroke();
      }
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(title, 12, 10);
    }

    function render() {
      const rot = frame === 'guide' ? Om : Om - kap / 2;
      drawPanel(lctx, left, null, 'Inertial frame');
      drawPanel(rctx, right, rot, frame === 'guide' ? 'Rotating with the guiding centre (Ω)' : 'Rotating at Ω − κ/2');
      ctx2Label();
      rRatio.set(`κ/Ω = ${fmt(kap / Om, 3)}`);
      rAdv.set(`${fmt((360 * Om) / kap, 3)}° per radial cycle`);
      rT.set(`${fmt((t * T_MYR) / 1000, 3)} Gyr`);
    }
    function ctx2Label() {
      const { width: W, height: H } = left;
      lctx.fillStyle = pal.muted; lctx.font = '11px Inter, system-ui, sans-serif'; lctx.textBaseline = 'bottom';
      lctx.fillText(beta === 0 ? 'flat rotation curve' : beta <= -0.49 ? 'Kepler (point mass)' : beta >= 0.99 ? 'solid body (uniform sphere)' : `v_c ∝ R^${fmt(beta, 2)}`, 12, H - 10);
      void W;
    }

    const loop = new Loop(step, render, 1 / 60);
    left.onResize(() => loop.invalidate());
    right.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', reset);
    panel.slider('Rotation curve slope β', { min: -0.5, max: 1, value: beta, step: 0.05, format: (v) => fmt(v, 2) }, (v) => { beta = v; reset(); });
    panel.slider('Radial kick', { min: 0, max: 0.6, value: kick, step: 0.01, format: (v) => `${Math.round(v * V_KMS)} km/s` }, (v) => { kick = v; reset(); });
    panel.select('Right frame', [{ value: 'guide', label: 'Ω (guiding centre)' }, { value: 'ilr', label: 'Ω − κ/2 (bar pattern)' }], frame, (v) => { frame = v; loop.invalidate(); });
    const rRatio = panel.readout('');
    const rAdv = panel.readout('');
    const rT = panel.readout('t =');
    reset();
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
