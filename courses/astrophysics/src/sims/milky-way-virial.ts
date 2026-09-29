// Secondary figure: Zwicky's (1933) virial-mass estimate for a galaxy cluster. Drag the velocity
// dispersion σ and the cluster radius R and watch the inferred virial mass — and the huge gap
// between it and the visible (stellar + gas) mass — update live.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { G_ASTRO } from './milky-way/mass-models';

const MPC_TO_KPC = 1000;

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);';
    host.append(wrap);
    const clusterStage = createStage(wrap, { aspect: 1 });
    const histStage = createStage(wrap, { aspect: 1.2 });
    clusterStage.el.style.borderRight = '1px solid var(--rule)';
    // side by side on wide screens, stacked on phones
    const stackRO = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1.1fr)';
      clusterStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      clusterStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    stackRO.observe(wrap);
    onDestroy(() => stackRO.disconnect());
    const cctx = clusterStage.canvas.getContext('2d')!;

    let sigma = 1000; // km/s, line-of-sight velocity dispersion
    let Rmpc = 1.5; // cluster radius, Mpc
    const Lgalaxy = 3e10; // Msun of light per galaxy analogue (visible matter)
    const NG = 60;
    const gx = new Float32Array(NG), gy = new Float32Array(NG), gv = new Float32Array(NG);
    function reroll() {
      for (let i = 0; i < NG; i++) {
        const r = Math.sqrt(Math.random()) , th = Math.random() * 2 * Math.PI;
        gx[i] = r * Math.cos(th); gy[i] = r * Math.sin(th);
        // Box-Muller for a Gaussian velocity distribution with dispersion sigma
        const u1 = Math.random() || 1e-9, u2 = Math.random();
        gv[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      }
    }
    reroll();

    const plot = new Plot(histStage.canvas, {
      x: { min: -4, max: 4, label: 'v_LOS − ⟨v⟩ (σ units)' },
      y: { min: 0, max: 0.5, label: 'fraction' },
      title: 'Line-of-sight velocity distribution',
    });

    function virialMass() {
      // Isotropic virial estimator for a self-gravitating sphere: M ≈ 5 σ_r² R / G.
      const R_kpc = Rmpc * MPC_TO_KPC;
      return (5 * sigma * sigma * R_kpc) / G_ASTRO;
    }

    const loop = new Loop(null, render, 1 / 30);

    loop.onDemand = true;

    function render() {
      const { width: W, height: H, dpr } = clusterStage;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cctx.clearRect(0, 0, W, H);
      const scale = Math.min(W, H) * 0.42;
      const cx = W / 2, cy = H / 2;
      cctx.strokeStyle = pal.faint;
      cctx.beginPath(); cctx.arc(cx, cy, scale, 0, 2 * Math.PI); cctx.stroke();
      for (let i = 0; i < NG; i++) {
        const x = cx + gx[i] * scale, y = cy + gy[i] * scale;
        const t = Math.max(0, Math.min(1, (gv[i] + 3) / 6));
        // diverging colour map: blue (approaching) → grey (systemic) → red (receding)
        const [c0, c1] = t < 0.5 ? [[80, 145, 255], [165, 165, 170]] : [[165, 165, 170], [255, 95, 75]];
        const f = t < 0.5 ? t * 2 : t * 2 - 1;
        cctx.fillStyle = `rgb(${c0.map((a, k) => Math.round(a + (c1[k] - a) * f)).join(',')})`;
        cctx.beginPath(); cctx.arc(x, y, 4, 0, 2 * Math.PI); cctx.fill();
      }
      cctx.fillStyle = pal.muted;
      cctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      cctx.fillText(`${NG} galaxies · blue approaching, red receding`, 10, H - 12);
      cctx.fillText(`R ≈ ${fmt(Rmpc, 2)} Mpc`, 10, 18);

      plot.resize(histStage.width, histStage.height, histStage.dpr);
      plot.draw(() => {
        const nbins = 24, counts = new Array(nbins).fill(0);
        for (let i = 0; i < NG; i++) {
          const b = Math.min(nbins - 1, Math.max(0, Math.floor(((gv[i] + 4) / 8) * nbins)));
          counts[b]++;
        }
        const w = 8 / nbins;
        for (let b = 0; b < nbins; b++) {
          const x0 = -4 + b * w, x1 = x0 + w * 0.9;
          const y = counts[b] / NG;
          const X0 = plot.px(x0), X1 = plot.px(x1), Y0 = plot.py(0), Y1 = plot.py(y);
          plot.ctx.fillStyle = pal.accent;
          plot.ctx.globalAlpha = 0.75;
          plot.ctx.fillRect(X0, Y1, Math.max(1, X1 - X0), Y0 - Y1);
          plot.ctx.globalAlpha = 1;
        }
        plot.fn((x) => (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-x * x / 2) * (8 / nbins), { color: pal.fg, width: 1.5 });
      });

      const Mvir = virialMass();
      const Mlight = NG * Lgalaxy;
      mvirOut.set(`${fmt(Mvir, 3)} M☉`);
      mlightOut.set(`${fmt(Mlight, 3)} M☉`);
      ratioOut.set(`${fmt(Mvir / Mlight, 3)}×`);
    }

    clusterStage.onResize(() => loop.invalidate());
    histStage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.slider('Velocity dispersion σ', { min: 200, max: 2000, value: sigma, unit: 'km/s' }, (v) => { sigma = v; loop.invalidate(); });
    panel.slider('Cluster radius R', { min: 0.2, max: 4, value: Rmpc, step: 0.05, unit: 'Mpc' }, (v) => { Rmpc = v; loop.invalidate(); });
    panel.button('Re-roll galaxies', () => { reroll(); loop.invalidate(); });
    const mvirOut = panel.readout('Virial mass:');
    const mlightOut = panel.readout('Luminous mass (60 gal.):');
    const ratioOut = panel.readout('M_vir / M_light =');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
