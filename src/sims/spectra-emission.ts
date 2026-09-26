// Emission-line "lamp strips": bright lines on a dark background for a few gas-discharge lamps,
// the mirror image of the dark absorption lines in stellar spectra (Kirchhoff's laws in one
// picture). Click a lamp to see it; hover a line for its wavelength.
import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { wavelengthRGB } from '../lib/physics/blackbody';

interface Lamp { name: string; lines: { nm: number; rel: number; label: string }[] }

// Representative strong visible lines (curated, not exhaustive), nm.
const LAMPS: Lamp[] = [
  { name: 'Hydrogen', lines: [
    { nm: 656.3, rel: 1, label: 'Hα' }, { nm: 486.1, rel: 0.6, label: 'Hβ' },
    { nm: 434.0, rel: 0.35, label: 'Hγ' }, { nm: 410.2, rel: 0.2, label: 'Hδ' },
  ] },
  { name: 'Helium', lines: [
    { nm: 706.5, rel: 0.5, label: 'He' }, { nm: 667.8, rel: 0.6, label: 'He' }, { nm: 587.6, rel: 1, label: 'He (D3)' },
    { nm: 501.6, rel: 0.5, label: 'He' }, { nm: 492.2, rel: 0.35, label: 'He' }, { nm: 471.3, rel: 0.4, label: 'He' },
    { nm: 447.1, rel: 0.6, label: 'He' },
  ] },
  { name: 'Sodium', lines: [{ nm: 589.0, rel: 1, label: 'Na D₂' }, { nm: 589.6, rel: 0.95, label: 'Na D₁' }] },
  { name: 'Neon', lines: [
    { nm: 585.2, rel: 0.5, label: 'Ne' }, { nm: 614.3, rel: 0.7, label: 'Ne' }, { nm: 633.4, rel: 0.6, label: 'Ne' },
    { nm: 640.2, rel: 1, label: 'Ne' }, { nm: 659.9, rel: 0.8, label: 'Ne' }, { nm: 692.9, rel: 0.5, label: 'Ne' },
  ] },
  { name: 'Mercury', lines: [
    { nm: 404.7, rel: 0.5, label: 'Hg' }, { nm: 435.8, rel: 0.9, label: 'Hg' }, { nm: 546.1, rel: 1, label: 'Hg' },
    { nm: 577.0, rel: 0.55, label: 'Hg' }, { nm: 579.1, rel: 0.55, label: 'Hg' },
  ] },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); drawAll(); });

    const panel = new Panel(host);
    const info = panel.readout('Line');

    const strips: { lamp: Lamp; canvas: HTMLCanvasElement }[] = [];
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';
    host.append(list);

    const LAM_MIN = 380, LAM_MAX = 750;

    for (const lamp of LAMPS) {
      const row = document.createElement('div');
      const label = document.createElement('div');
      label.textContent = lamp.name;
      label.style.font = '12px Inter, system-ui, sans-serif';
      label.style.marginBottom = '2px';
      label.style.color = 'var(--fg-muted)';
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '36px';
      canvas.style.display = 'block';
      canvas.style.borderRadius = '4px';
      canvas.style.cursor = 'crosshair';
      row.append(label, canvas);
      list.append(row);
      strips.push({ lamp, canvas });

      canvas.addEventListener('pointermove', (ev) => {
        const rect = canvas.getBoundingClientRect();
        const nm = LAM_MIN + ((ev.clientX - rect.left) / rect.width) * (LAM_MAX - LAM_MIN);
        let best = lamp.lines[0], bestD = 1e9;
        for (const l of lamp.lines) { const d = Math.abs(l.nm - nm); if (d < bestD) { bestD = d; best = l; } }
        if (bestD < 6) info.set(`${lamp.name} ${best.label} · ${best.nm.toFixed(1)} nm`);
      });
    }

    function drawStrip(lamp: Lamp, canvas: HTMLCanvasElement) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 400, h = 36;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, w, h);
      for (const l of lamp.lines) {
        const x = ((l.nm - LAM_MIN) / (LAM_MAX - LAM_MIN)) * w;
        const [r, g, b] = wavelengthRGB(l.nm);
        const width = 1.5 + 2 * l.rel;
        const grad = ctx.createLinearGradient(x - 4, 0, x + 4, 0);
        grad.addColorStop(0, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0)`);
        grad.addColorStop(0.5, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${l.rel})`);
        grad.addColorStop(1, `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - 4, 0, 8, h);
        ctx.fillStyle = `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${Math.min(1, l.rel * 1.2)})`;
        ctx.fillRect(x - width / 2, 0, width, h);
      }
      ctx.strokeStyle = pal.rule;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }

    function drawAll() { for (const s of strips) drawStrip(s.lamp, s.canvas); }

    const ro = new ResizeObserver(drawAll);
    ro.observe(host);
    drawAll();

    return { setVisible(v) { if (v) drawAll(); }, destroy() { ro.disconnect(); } };
  },
});
