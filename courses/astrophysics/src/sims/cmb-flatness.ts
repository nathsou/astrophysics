// Chapter 27: what "flat" means. A standard ruler (the sound horizon r_s ≈ 144 Mpc at z* ≈ 1090)
// seen across 14 Gpc of curved space. Positive curvature (closed, Ω_k < 0) focuses light rays, so the
// ruler looks bigger and the first peak moves to lower ℓ; negative curvature does the opposite.
// Ray bending in the left panel is exaggerated for visibility; the numbers are computed properly.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { spectrum, PLANCK, PLANCK_POINTS } from './cmb/model';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));';
    host.append(wrap);
    const s1 = createStage(wrap, { aspect: 1.2 });
    const s2 = createStage(wrap, { aspect: 1.2 });
    const ctx = s1.canvas.getContext('2d')!;
    const plot = new Plot(s2.canvas, { x: { min: 2, max: 1500, label: 'multipole ℓ' }, y: { min: 0, max: 7000, label: 'D_ℓ (μK²)' }, title: 'Where the first peak lands' });

    let omk = 0;
    const L = 1500, D = new Float64Array(L + 1);
    const flatD = new Float64Array(L + 1);
    const flat = spectrum(PLANCK, L, flatD);
    let d = spectrum({ ...PLANCK, omk }, L, D);

    let dirty = true;
    const inval = () => { dirty = true; loop.invalidate(); };
    const loop = new Loop(null, render);
    loop.onDemand = true; // static figure: redraw only on invalidate()
    function render() {
      if (!dirty) return;
      dirty = false;
      const { width: W, height: H, dpr } = s1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const ox = W / 2, oy = H - 34, top = 70, hgt = oy - top;
      const w = W * 0.16;
      // apparent half-angle, exaggerated: ratio θ*(Ω_k)/θ*(flat) drives the bend
      const ratio = d.theta / flat.theta;
      const ex = 1 + (ratio - 1) * 6;
      const alpha = Math.atan((w / hgt) * ex);
      const xc = (hgt / 2) * Math.tan(alpha);
      // rays
      ctx.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        ctx.strokeStyle = pal.accent;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox + s * xc, oy - hgt / 2, ox + s * w, top);
        ctx.stroke();
        // apparent direction (dashed straight continuation of the arriving ray)
        ctx.strokeStyle = pal.faint;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + s * Math.tan(alpha) * hgt, top);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // ruler + observer
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ox - w, top); ctx.lineTo(ox + w, top); ctx.stroke();
      ctx.fillStyle = pal.fg;
      ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`sound horizon r_s ≈ ${fmt(d.rs, 3)} Mpc (z* ≈ 1090)`, ox, top - 12);
      ctx.textAlign = 'left'; ctx.fillText('us', ox + 10, oy + 4); ctx.textAlign = 'center';
      ctx.fillStyle = pal.muted;
      const geo = omk < -0.002 ? 'closed (Ω_k < 0): rays focus, ruler looks bigger' : omk > 0.002 ? 'open (Ω_k > 0): rays diverge, ruler looks smaller' : 'flat: straight rays';
      ctx.fillText(geo, ox, H - 6);
      ctx.textAlign = 'left';
      ctx.fillText(`θ* = ${fmt((d.theta * 180) / Math.PI, 4)}°`, 10, 18);
      ctx.fillText(`D_M = ${fmt(d.DM / 1000, 4)} Gpc`, 10, 34);

      let lp = 0, best = 0;
      for (let l = 100; l < 400; l++) if (D[l] > best) { best = D[l]; lp = l; }
      plot.draw(() => {
        plot.scatter(PLANCK_POINTS.map((p) => p[0]), PLANCK_POINTS.map((p) => p[1]), { size: 3.5, color: pal.muted });
        plot.fn((l) => flatD[Math.round(l)] ?? 0, { color: pal.faint, dash: [4, 4], width: 1.2 });
        plot.fn((l) => D[Math.round(l)] ?? 0, { color: pal.accent, width: 2 });
        plot.vline(lp, { label: `ℓ₁ ≈ ${lp}`, color: pal.accent });
      });
    }

    s1.onResize(() => inval());
    s2.onResize((w, h, dp) => { plot.resize(w, h, dp); inval(); });
    onThemeChange(() => { pal = palette(); inval(); });

    const panel = new Panel(host);
    panel.slider('Curvature Ω_k', { min: -0.15, max: 0.15, value: 0, step: 0.005, format: (v) => (v > 0 ? '+' : '') + v.toFixed(3) }, (v) => {
      omk = v; d = spectrum({ ...PLANCK, omk }, L, D); inval();
    });
    panel.button('Flat', () => { omk = 0; d = spectrum({ ...PLANCK, omk }, L, D); (panel.el.querySelector('input[type=range]') as HTMLInputElement).value = '500'; panel.el.querySelector('output')!.textContent = '0.000'; inval(); });

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
