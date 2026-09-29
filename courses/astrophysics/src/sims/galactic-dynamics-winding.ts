// Chapter 22: the winding problem. Two copies of the same differentially rotating disk (flat rotation
// curve, 220 km/s). Left: a *material* arm — the stars that start on a straight line are painted and
// followed; it winds up. Right: a *density wave* — a fixed logarithmic spiral pattern turning rigidly
// at Ω_p; stars flow through it and brighten while inside it, so the arm keeps its shape.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

const N = 2600;
const VC = 220;                 // km/s
const RMIN = 2, RMAX = 15;      // kpc
const KPC_PER_KMS_MYR = 1 / 977.8; // 1 km/s ≈ 1/977.8 kpc/Myr

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);';
    host.append(wrap);
    const L = createStage(wrap, { aspect: 1 });
    const Rt = createStage(wrap, { aspect: 1 });
    L.el.style.borderRight = '1px solid var(--rule)';
    const lc = L.canvas.getContext('2d')!, rc = Rt.canvas.getContext('2d')!;

    // stars: radius, initial angle, painted?
    const R = new Float64Array(N), phi0 = new Float64Array(N), painted = new Uint8Array(N);
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      R[i] = RMIN + (RMAX - RMIN) * Math.sqrt(rnd());
      phi0[i] = 2 * Math.PI * rnd();
    }
    // the material arm: extra stars along two opposite straight lines (a painted "bar")
    const NP = 500;
    const Rp = new Float64Array(NP), php = new Float64Array(NP);
    for (let i = 0; i < NP; i++) { Rp[i] = RMIN + (RMAX - RMIN) * (i / NP); php[i] = i % 2 ? 0 : Math.PI; painted[i % N] = 0; }

    let tMyr = 0;
    let pitch = 15;       // pitch angle of the density-wave spiral (deg)
    let RCR = 11;         // corotation radius (kpc) → Ω_p = V/RCR
    const Omega = (r: number) => (VC * KPC_PER_KMS_MYR) / r; // rad/Myr

    function step(dt: number) { tMyr += dt * 400; } // 400 Myr per second of wall time

    function frame(ctx: CanvasRenderingContext2D, st: typeof L) {
      const { width: W, height: H, dpr } = st;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      return { cx: W / 2, cy: H / 2, sc: (Math.min(W, H) / 2 - 10) / RMAX };
    }

    function render() {
      // ---------------- left: material arm
      {
        const { cx, cy, sc } = frame(lc, L);
        lc.fillStyle = pal.faint;
        for (let i = 0; i < N; i++) {
          const a = phi0[i] + Omega(R[i]) * tMyr;
          lc.fillRect(cx + R[i] * Math.cos(a) * sc - 0.8, cy - R[i] * Math.sin(a) * sc - 0.8, 1.6, 1.6);
        }
        lc.fillStyle = pal.series[1];
        for (let i = 0; i < NP; i++) {
          const a = php[i] + Omega(Rp[i]) * tMyr;
          lc.beginPath(); lc.arc(cx + Rp[i] * Math.cos(a) * sc, cy - Rp[i] * Math.sin(a) * sc, 1.8, 0, 2 * Math.PI); lc.fill();
        }
        lc.font = '12px JetBrains Mono, ui-monospace, monospace'; lc.fillStyle = pal.fg; lc.textAlign = 'left'; lc.textBaseline = 'top';
        lc.fillText('Material arm (painted stars)', 10, 8);
        const turns = ((Omega(RMIN) - Omega(RMAX)) * tMyr) / (2 * Math.PI);
        lc.fillStyle = pal.muted; lc.font = '11px JetBrains Mono, ui-monospace, monospace'; lc.textBaseline = 'bottom';
        lc.fillText(`inner edge ahead by ${fmt(turns, 2)} turns`, 10, L.height - 8);
      }
      // ---------------- right: density wave
      {
        const { cx, cy, sc } = frame(rc, Rt);
        const Op = (VC * KPC_PER_KMS_MYR) / RCR;
        const cotp = 1 / Math.tan((pitch * Math.PI) / 180);
        // two-armed log spiral:  φ_arm(R) = Ω_p t − cot(p) ln(R/RMIN)  (+π for the second arm)
        const armPhase = (r: number) => Op * tMyr - cotp * Math.log(r / RMIN);
        for (let i = 0; i < N; i++) {
          const a = phi0[i] + Omega(R[i]) * tMyr;
          // distance in phase to the nearest arm (m = 2 pattern)
          const d = Math.cos(2 * (a - armPhase(R[i])));
          const b = Math.pow(Math.max(d, 0), 6);
          rc.globalAlpha = 0.35 + 0.65 * b;
          rc.fillStyle = b > 0.3 ? pal.series[0] : pal.faint;
          const sz = 1.6 + 1.6 * b;
          rc.fillRect(cx + R[i] * Math.cos(a) * sc - sz / 2, cy - R[i] * Math.sin(a) * sc - sz / 2, sz, sz);
        }
        rc.globalAlpha = 1;
        // corotation circle
        rc.strokeStyle = pal.accent2; rc.setLineDash([4, 4]); rc.lineWidth = 1;
        rc.beginPath(); rc.arc(cx, cy, RCR * sc, 0, 2 * Math.PI); rc.stroke(); rc.setLineDash([]);
        rc.font = '12px JetBrains Mono, ui-monospace, monospace'; rc.fillStyle = pal.fg; rc.textAlign = 'left'; rc.textBaseline = 'top';
        rc.fillText('Density wave (pattern at Ω_p)', 10, 8);
        rc.fillStyle = pal.accent2; rc.font = '11px JetBrains Mono, ui-monospace, monospace'; rc.textBaseline = 'bottom';
        rc.fillText('corotation', cx + RCR * sc * 0.72 + 4, cy - RCR * sc * 0.72);
        rc.fillStyle = pal.muted;
        rc.fillText(`Ω_p = ${fmt(Op * 977.8, 3)} km/s/kpc`, 10, Rt.height - 8);
      }
      rT.set(`${fmt(tMyr / 1000, 3)} Gyr`);
      rO.set(`${Math.round((2 * Math.PI * 8) / (VC * KPC_PER_KMS_MYR * 1))} Myr`);
    }

    const loop = new Loop(step, render, 1 / 60);
    L.onResize(() => loop.invalidate());
    Rt.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { tMyr = 0; loop.invalidate(); });
    panel.slider('Pitch angle', { min: 5, max: 35, value: pitch, step: 1, unit: '°' }, (v) => { pitch = v; loop.invalidate(); });
    panel.slider('Corotation', { min: 4, max: 20, value: RCR, step: 0.5, unit: 'kpc' }, (v) => { RCR = v; loop.invalidate(); });
    const rT = panel.readout('t =');
    const rO = panel.readout('Orbit at 8 kpc:');
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
