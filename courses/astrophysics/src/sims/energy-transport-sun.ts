// Secondary figure: a labelled cutaway of the solar interior. Hover (or tap) a zone for facts.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Zone { name: string; rOut: number; color: (p: ReturnType<typeof palette>) => string; fact: string; }

const ZONES: Zone[] = [
  { name: 'Core', rOut: 0.25, color: (p) => p.series[3], fact: 'T ≈ 1.5×10⁷ K, ρ ≈ 150 g/cm³. Fusion (pp-chain, Ch. 12) releases ~3.8×10²⁶ W here.' },
  { name: 'Radiative zone', rOut: 0.7, color: (p) => p.series[2], fact: 'Photons random-walk outward; ℓ ~ mm–cm, diffusion time ~10⁴–10⁵ yr. Opacity falls from electron scattering to Kramers.' },
  { name: 'Tachocline', rOut: 0.735, color: (p) => p.accent2, fact: 'Thin shear layer between rigid (radiative) and differential (convective) rotation. Likely seat of the solar dynamo.' },
  { name: 'Convection zone', rOut: 0.995, color: (p) => p.series[4], fact: 'Opacity rises sharply (H⁻, bound-bound); ∇_rad > ∇_ad. Granulation cells ~1000 km, ~8 min lifetime.' },
  { name: 'Photosphere', rOut: 1.0, color: (p) => p.series[1], fact: 'τ = 2/3 surface, T_eff ≈ 5772 K. Limb darkening: I(μ) ≈ I₀(0.4 + 0.6μ).' },
];

export default defineSim({
  mount({ host, onDestroy }) {
    const stage = createStage(host, { aspect: 4 / 3, maxDpr: 2 });
    const ctx = stage.canvas.getContext('2d')!;
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const factBox = document.createElement('div');
    factBox.style.cssText = 'margin-top:8px;min-height:3.2em;font-size:0.92em;color:var(--fg-muted);';
    factBox.textContent = 'Hover or tap a zone to see its numbers.';
    host.append(factBox);

    let hover: number | null = null;
    let cx = 0, cy = 0, R = 1;

    function zoneAt(px: number, py: number): number | null {
      const dx = px - cx, dy = py - cy;
      const r = Math.hypot(dx, dy) / R;
      if (r > 1.03) return null;
      for (let i = 0; i < ZONES.length; i++) if (r <= ZONES[i].rOut + 1e-6) return i;
      return null;
    }

    function pointerPos(e: PointerEvent) {
      const r = stage.canvas.getBoundingClientRect();
      return [(e.clientX - r.left), (e.clientY - r.top)] as const;
    }
    stage.canvas.addEventListener('pointermove', (e) => {
      const [x, y] = pointerPos(e);
      const z = zoneAt(x, y);
      if (z !== hover) { hover = z; loop.invalidate(); factBox.textContent = z !== null ? `${ZONES[z].name}. ${ZONES[z].fact}` : 'Hover or tap a zone to see its numbers.'; }
    });
    stage.canvas.addEventListener('pointerleave', () => { hover = null; loop.invalidate(); factBox.textContent = 'Hover or tap a zone to see its numbers.'; });

    function render() {
      const w = stage.width, h = stage.height;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      cx = w * 0.5; cy = h * 0.52; R = Math.min(w, h) * 0.44;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h * 0.98);
      ctx.clip();
      // draw a cutaway: full disk on the right half, wedge removed on the left half
      for (let i = ZONES.length - 1; i >= 0; i--) {
        const z = ZONES[i];
        ctx.beginPath();
        ctx.arc(cx, cy, R * z.rOut, -Math.PI * 0.5, Math.PI * 1.5);
        ctx.closePath();
        ctx.fillStyle = z.color(pal);
        ctx.globalAlpha = hover === null || hover === i ? 1 : 0.55;
        ctx.fill();
      }
      // wedge cut on the upper-left quadrant to reveal the layering
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.05, Math.PI * 1.0, Math.PI * 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.restore();

      // outline rings + labels
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillStyle = pal.fg;
      for (let i = 0; i < ZONES.length; i++) {
        const z = ZONES[i];
        ctx.beginPath();
        ctx.arc(cx, cy, R * z.rOut, 0, Math.PI * 2);
        ctx.strokeStyle = pal.rule ?? pal.grid;
        ctx.lineWidth = hover === i ? 2 : 1;
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      let ly = 14;
      for (const z of ZONES) {
        ctx.fillStyle = hover !== null && ZONES[hover] === z ? pal.accent : pal.muted;
        ctx.fillText(z.name, 8, ly);
        ly += 15;
      }
      if (hover !== null) {
        ctx.textAlign = 'center';
        ctx.fillStyle = pal.fg;
        ctx.fillText(ZONES[hover].name, cx + R * 0.55, cy - R * 0.9 < 14 ? 14 : cy - R - 8);
      }
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize(() => loop.invalidate());
    onDestroy(() => {});
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
