// Chapter 21 flagship: a rotation-curve fitting lab (Freeman disk + Hernquist bulge + NFW/isothermal
// halo, quadrature-summed) next to a top-down animated disk of stars that winds up a painted pattern
// according to the *current* model's differential rotation.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import {
  vBulge2, vDisk2, vHaloNFW2, vHaloISO2, vTotal, vMond, nelderMead,
  MW_DATA, NGC3198_DATA, type ModelParams,
} from './milky-way/mass-models';

const OMEGA_CONV = 1.02268e-3; // rad/Myr per (km/s / kpc)

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:0;';
    host.append(wrap);
    const curveStage = createStage(wrap, { aspect: 1.35 });
    const diskStage = createStage(wrap, { aspect: 1 });
    curveStage.el.style.borderRight = '1px solid var(--rule)';
    // side by side on wide screens, stacked on phones
    const stackRO = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)';
      curveStage.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      curveStage.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    stackRO.observe(wrap);
    onDestroy(() => stackRO.disconnect());
    const dctx = diskStage.canvas.getContext('2d')!;

    let dataset: 'mw' | 'ngc3198' = 'mw';
    const RMAX = () => (dataset === 'mw' ? 22 : 32);

    const plot = new Plot(curveStage.canvas, {
      x: { min: 0, max: RMAX(), label: 'r (kpc)' },
      y: { min: 0, max: 300, label: 'v_c (km/s)' },
      title: 'Rotation curve',
    });

    // --- model parameters ---
    const p: ModelParams = {
      bulge: { M: 1.5e10, a: 0.6 },
      disk: { M: 6e10, Rd: 3 },
      gas: { M: 1e10, Rd: 7 },
      halo: { rho0: 4e6, rs: 15 },
      haloType: 'nfw',
      noDarkMatter: false,
    };
    let showMond = false;

    function data() { return dataset === 'mw' ? MW_DATA : NGC3198_DATA; }

    function chi2(): number {
      const d = data();
      let s = 0;
      for (const pt of d) s += ((vTotal(pt.r, p) - pt.v) / pt.err) ** 2;
      return s / d.length;
    }

    function autofit() {
      // Free params: [bulgeM(log), diskM(log), Rd, haloRho0(log), haloScale]
      const halo = p.halo as any;
      const x0 = [Math.log10(p.bulge.M), Math.log10(p.disk.M), p.disk.Rd, Math.log10(halo.rho0), p.haloType === 'nfw' ? halo.rs : halo.rc];
      const cost = (x: number[]) => {
        const trial: ModelParams = {
          ...p,
          bulge: { ...p.bulge, M: 10 ** x[0] },
          disk: { ...p.disk, M: 10 ** x[1], Rd: Math.max(0.3, x[2]) },
          halo: p.haloType === 'nfw' ? { rho0: 10 ** x[3], rs: Math.max(0.5, x[4]) } : { rho0: 10 ** x[3], rc: Math.max(0.5, x[4]) },
        };
        const d = data();
        let s = 0;
        for (const pt of d) s += ((vTotal(pt.r, trial) - pt.v) / pt.err) ** 2;
        return s / d.length;
      };
      const best = nelderMead(cost, x0, { iters: 600, step: 0.15 });
      p.bulge.M = 10 ** best[0];
      p.disk.M = 10 ** best[1];
      p.disk.Rd = Math.max(0.3, best[2]);
      if (p.haloType === 'nfw') (p.halo as any) = { rho0: 10 ** best[3], rs: Math.max(0.5, best[4]) };
      else (p.halo as any) = { rho0: 10 ** best[3], rc: Math.max(0.5, best[4]) };
      refreshControls();
      loop.invalidate();
    }

    // --- disk of stars ---
    const N = 3000;
    const starR = new Float32Array(N);
    const starTheta = new Float32Array(N);
    const starTheta0 = new Float32Array(N);
    let solidBody = false;
    function resetStars() {
      for (let i = 0; i < N; i++) {
        starR[i] = Math.pow(Math.random(), 0.55) * RMAX() * 0.92 + 0.3;
        starTheta[i] = Math.random() * 2 * Math.PI;
        starTheta0[i] = starTheta[i];
      }
    }
    resetStars();

    const loop = new Loop(
      (dt) => {
        const dtMyr = dt * 25; // 1 real second ≈ 25 Myr, so galactic winding is visible in seconds
        const refR = 8.2;
        const vRef = vTotal(refR, p);
        const omegaRef = (vRef / refR) * OMEGA_CONV;
        for (let i = 0; i < N; i++) {
          const r = starR[i];
          const omega = solidBody ? omegaRef : (vTotal(Math.max(r, 0.15), p) / Math.max(r, 0.15)) * OMEGA_CONV;
          starTheta[i] += omega * dtMyr;
        }
      },
      render,
      1 / 30,
    );

    function render() {
      // --- rotation curve panel ---
      const { dpr } = curveStage;
      plot.resize(curveStage.width, curveStage.height, dpr);
      plot.o.x.max = RMAX();
      plot.draw(() => {
        plot.fn((r) => Math.sqrt(vBulge2(r, p.bulge)), { color: pal.series[0], dash: [4, 3], width: 1.3 });
        plot.fn((r) => Math.sqrt(vDisk2(r, p.disk)), { color: pal.series[1], dash: [4, 3], width: 1.3 });
        plot.fn((r) => Math.sqrt(vDisk2(r, p.gas)), { color: pal.series[2], dash: [2, 3], width: 1.1 });
        if (!p.noDarkMatter) {
          plot.fn((r) => Math.sqrt(p.haloType === 'nfw' ? vHaloNFW2(r, p.halo as any) : vHaloISO2(r, p.halo as any)), { color: pal.series[3], dash: [4, 3], width: 1.3 });
        }
        plot.fn((r) => vTotal(r, p), { color: pal.fg, width: 2.4 });
        if (showMond) plot.fn((r) => vMond(r, p), { color: pal.bad, width: 1.8, dash: [1, 3] });
        for (const pt of data()) {
          plot.line([pt.r, pt.r], [Math.max(0, pt.v - pt.err), pt.v + pt.err], { color: pal.muted, width: 1 });
          plot.point(pt.r, pt.v, { r: 3, color: pal.fg });
        }
      });
      plot.text(dataset === 'mw' ? 'Milky Way (approximate)' : 'NGC 3198 (approximate)', plot.m.l + 8, plot.m.t + 8, { color: pal.muted, size: 11 });
      // legend
      const legend: [string, string][] = [
        ['Bulge', pal.series[0]], ['Disk', pal.series[1]], ['Gas', pal.series[2]],
        ...(p.noDarkMatter ? [] : ([['Halo', pal.series[3]]] as [string, string][])),
        ['Total', pal.fg],
        ...(showMond ? ([['MOND (baryons)', pal.bad]] as [string, string][]) : []),
      ];
      legend.forEach(([lab, col], i) => {
        const x = plot.m.l + plot.pw - 108, y = plot.m.t + 10 + i * 14;
        plot.ctx.strokeStyle = col; plot.ctx.lineWidth = 2;
        plot.ctx.beginPath(); plot.ctx.moveTo(x, y); plot.ctx.lineTo(x + 16, y); plot.ctx.stroke();
        plot.text(lab, x + 21, y, { color: pal.fg, align: 'left', baseline: 'middle', size: 10.5 });
      });

      // --- disk panel ---
      const { width: W, height: H, dpr: d2 } = diskStage;
      dctx.setTransform(d2, 0, 0, d2, 0, 0);
      dctx.clearRect(0, 0, W, H);
      const scale = (Math.min(W, H) / 2 / RMAX()) * 0.94;
      const cx = W / 2, cy = H / 2;
      // spiral guide rings
      dctx.strokeStyle = pal.faint;
      dctx.lineWidth = 1;
      for (let rr = 5; rr <= RMAX(); rr += 5) {
        dctx.beginPath(); dctx.arc(cx, cy, rr * scale, 0, 2 * Math.PI); dctx.stroke();
      }
      for (let i = 0; i < N; i++) {
        const r = starR[i], th = starTheta[i];
        const x = cx + r * scale * Math.cos(th), y = cy + r * scale * Math.sin(th);
        // colour by initial angular sector: paints a pinwheel pattern that reveals winding
        const sector = ((starTheta0[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const hue = (sector / (2 * Math.PI)) * 360;
        dctx.fillStyle = `hsl(${hue.toFixed(0)} 70% 60%)`;
        dctx.globalAlpha = 0.85;
        dctx.fillRect(x - 1, y - 1, 2, 2);
      }
      dctx.globalAlpha = 1;
      // galactic centre marker
      dctx.fillStyle = pal.accent2;
      dctx.beginPath(); dctx.arc(cx, cy, 3.5, 0, 2 * Math.PI); dctx.fill();
      dctx.fillStyle = pal.muted;
      dctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      dctx.fillText(solidBody ? 'illustration: solid-body rotation' : 'rotating per current model', 10, H - 10);

      chi2Readout.set(fmt(chi2(), 4));
    }

    curveStage.onResize(() => loop.invalidate());
    diskStage.onResize(() => loop.invalidate());

    // --- controls ---
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (v) => (loop.paused = v));
    panel.select('Dataset', [{ value: 'mw', label: 'Milky Way' }, { value: 'ngc3198', label: 'NGC 3198' }], dataset, (v) => {
      dataset = v as any; resetStars(); loop.invalidate();
    });
    panel.select('Halo model', [{ value: 'nfw', label: 'NFW' }, { value: 'iso', label: 'Pseudo-isothermal' }], p.haloType, (v) => {
      p.haloType = v as any;
      p.halo = v === 'nfw' ? { rho0: 4e6, rs: 15 } : { rho0: 5e6, rc: 4 } as any;
      refreshControls(); loop.invalidate();
    });

    const sBulgeM = panel.slider('Bulge mass', { min: 1e8, max: 3e10, value: p.bulge.M, log: true, format: (v) => fmt(v / 1e10, 2) + '×10¹⁰' }, (v) => { p.bulge.M = v; loop.invalidate(); });
    const sBulgeA = panel.slider('Bulge scale a', { min: 0.1, max: 2, value: p.bulge.a, unit: 'kpc' }, (v) => { p.bulge.a = v; loop.invalidate(); });
    const sDiskM = panel.slider('Disk mass', { min: 1e9, max: 1.5e11, value: p.disk.M, log: true, format: (v) => fmt(v / 1e10, 2) + '×10¹⁰' }, (v) => { p.disk.M = v; loop.invalidate(); });
    const sDiskR = panel.slider('Disk scale Rd', { min: 1, max: 8, value: p.disk.Rd, unit: 'kpc' }, (v) => { p.disk.Rd = v; loop.invalidate(); });
    const sGasM = panel.slider('Gas disk mass', { min: 1e8, max: 2e10, value: p.gas.M, log: true, format: (v) => fmt(v / 1e10, 2) + '×10¹⁰' }, (v) => { p.gas.M = v; loop.invalidate(); });
    let sHaloRho: any, sHaloR: any;
    function buildHaloSliders() {
      const halo = p.halo as any;
      sHaloRho = panel.slider(p.haloType === 'nfw' ? 'Halo ρ₀' : 'Halo ρ₀', { min: 1e5, max: 5e7, value: halo.rho0, log: true, format: (v) => fmt(v / 1e6, 2) + '×10⁶ M☉/kpc³' }, (v) => { (p.halo as any).rho0 = v; loop.invalidate(); });
      sHaloR = panel.slider(p.haloType === 'nfw' ? 'Halo rs' : 'Halo core rc', { min: 0.5, max: 40, value: p.haloType === 'nfw' ? halo.rs : halo.rc, unit: 'kpc' }, (v) => { (p.halo as any)[p.haloType === 'nfw' ? 'rs' : 'rc'] = v; loop.invalidate(); });
    }
    buildHaloSliders();

    function refreshControls() {
      sBulgeM.set(p.bulge.M); sBulgeA.set(p.bulge.a); sDiskM.set(p.disk.M); sDiskR.set(p.disk.Rd); sGasM.set(p.gas.M);
      const halo = p.halo as any;
      sHaloRho.set(halo.rho0); sHaloR.set(p.haloType === 'nfw' ? halo.rs : halo.rc);
    }

    panel.toggle('No dark matter (baryons only)', p.noDarkMatter, (v) => { p.noDarkMatter = v; loop.invalidate(); });
    panel.toggle('Show MOND prediction', showMond, (v) => { showMond = v; loop.invalidate(); });
    panel.toggle('Disk: solid-body illustration', solidBody, (v) => { solidBody = v; loop.invalidate(); });
    panel.button('Auto-fit (minimise χ²)', autofit, true);
    panel.button('Reset stars', () => { resetStars(); loop.invalidate(); });
    const chi2Readout = panel.readout('χ²/N =');

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
