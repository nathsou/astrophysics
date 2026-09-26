// Secondary figure: a horizontal log-time cosmic timeline scroller, 10^-43 s to today.
// Drag / scroll to pan; shows temperature, characteristic energy and named events.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { tempAtTime, MEV_TO_KELVIN } from './big-bang/cosmo';

const AGE_S = 4.35e17; // ~13.8 Gyr in seconds
const LOG_MIN = -43, LOG_MAX = Math.log10(AGE_S);

interface Event { logt: number; label: string; detail: string; __x?: number }
const EVENTS: Event[] = [
  { logt: -43, label: 'Planck time', detail: 'Quantum gravity regime; below this, no known theory applies.' },
  { logt: -36, label: 'Inflation (illustrative)', detail: 'Exponential expansion smooths and flattens the universe.' },
  { logt: -11, label: 'Electroweak transition', detail: 'T ~ 100 GeV; the weak and EM forces separate.' },
  { logt: -5, label: 'QCD transition', detail: 'T ~ 150 MeV, t ~ 10 μs; quarks bind into protons and neutrons.' },
  { logt: 0, label: 'ν decoupling', detail: 'T ~ 1 MeV, t ~ 1 s; neutrinos free-stream from here on (the CνB).' },
  { logt: 0.5, label: 'e⁺e⁻ annihilation', detail: 'T ~ 0.5 MeV; positrons and electrons annihilate, heating photons relative to neutrinos.' },
  { logt: Math.log10(180), label: 'BBN', detail: 't ~ 3–20 min; light nuclei (D, He, Li) form.' },
  { logt: Math.log10(1.6e12), label: 'Matter–radiation equality', detail: 't ~ 50,000 yr; matter starts to dominate the energy density.' },
  { logt: Math.log10(1.2e13), label: 'Recombination / last scattering', detail: 't ~ 380,000 yr, T ~ 3000 K; the CMB is released.' },
  { logt: Math.log10(3e15), label: 'Cosmic dawn', detail: 'First stars and galaxies, z ~ 15–20.' },
  { logt: Math.log10(1.5e16), label: 'Reionisation ends', detail: 'z ~ 6; the intergalactic medium is fully ionised again.' },
  { logt: Math.log10(AGE_S), label: 'Today', detail: 't ~ 13.8 Gyr.' },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 21 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let viewMin = LOG_MIN, viewMax = LOG_MAX;
    let hoverIdx = -1;

    function logtToX(logt: number, W: number) {
      return ((logt - viewMin) / (viewMax - viewMin)) * W;
    }
    function xToLogt(x: number, W: number) {
      return viewMin + (x / W) * (viewMax - viewMin);
    }

    const loop = new Loop(null, render, 1 / 30);

    function tempLabel(logt: number): string {
      const t = 10 ** logt;
      if (t < 1) return '';
      try {
        const T = tempAtTime(Math.max(t, 1e-2));
        const K = T * MEV_TO_KELVIN;
        return `T ≈ ${fmt(K, 3)} K`;
      } catch { return ''; }
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const axisY = H * 0.55;
      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(W, axisY); ctx.stroke();

      // decade ticks
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted;
      for (let d = Math.floor(viewMin); d <= Math.ceil(viewMax); d++) {
        const x = logtToX(d, W);
        if (x < -20 || x > W + 20) continue;
        ctx.strokeStyle = pal.grid;
        ctx.beginPath(); ctx.moveTo(x, axisY - 6); ctx.lineTo(x, axisY + 6); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(`10${d}`.replace(/-?\d+$/, (m) => superscriptNum(+m)), x, axisY + 20);
      }

      hoverIdx = -1;
      EVENTS.forEach((e, i) => {
        const x = logtToX(e.logt, W);
        if (x < -40 || x > W + 40) return;
        const up = i % 2 === 0;
        const y0 = axisY, y1 = up ? axisY - 70 : axisY + 70;
        ctx.strokeStyle = pal.faint;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(x, axisY, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.fg;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = up ? 'bottom' : 'top';
        ctx.save();
        ctx.translate(x + 4, y1);
        ctx.fillText(e.label, 0, 0);
        ctx.restore();
        e.__x = x;
      });

      ctx.fillStyle = pal.muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('Scroll or drag to zoom/pan · time since the Big Bang, seconds (log scale)', 8, 8);

      if (hoverEvent) {
        const e = hoverEvent;
        ctx.fillStyle = pal.bg2 ?? pal.grid;
        const bw = Math.min(340, W - 16);
        ctx.globalAlpha = 0.95;
        ctx.fillRect(8, H - 54, bw, 46);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.axis; ctx.strokeRect(8, H - 54, bw, 46);
        ctx.fillStyle = pal.fg;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${e.label} — t ≈ 10^${e.logt.toFixed(1)} s  ${tempLabel(e.logt)}`, 14, H - 48);
        wrapText(ctx, e.detail, 14, H - 32, bw - 12, 13);
      }
    }

    function superscriptNum(n: number): string {
      const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
      return String(n).split('').map((c) => SUP[c] ?? c).join('');
    }
    function wrapText(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
      const words = text.split(' ');
      let line = '';
      let yy = y;
      for (const w of words) {
        const test = line + w + ' ';
        if (c.measureText(test).width > maxW && line) { c.fillText(line, x, yy); line = w + ' '; yy += lh; } else line = test;
      }
      c.fillText(line, x, yy);
    }

    let hoverEvent: (Event & { __x?: number }) | null = null;
    stage.canvas.addEventListener('pointermove', (ev) => {
      const rect = stage.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      let best: Event | null = null, bestD = 14;
      for (const e of EVENTS as (Event & { __x?: number })[]) {
        if (e.__x === undefined) continue;
        const d = Math.abs(e.__x - x);
        if (d < bestD) { bestD = d; best = e; }
      }
      hoverEvent = best;
      loop.invalidate();
    });
    stage.canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const span = viewMax - viewMin;
      const factor = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
      const rect = stage.canvas.getBoundingClientRect();
      const frac = (ev.clientX - rect.left) / rect.width;
      const center = viewMin + frac * span;
      const newSpan = Math.min(LOG_MAX - LOG_MIN, Math.max(2, span * factor));
      viewMin = Math.max(LOG_MIN, center - frac * newSpan);
      viewMax = Math.min(LOG_MAX, viewMin + newSpan);
      viewMin = viewMax - newSpan;
      loop.invalidate();
    }, { passive: false });
    let dragging = false, lastX = 0;
    stage.canvas.addEventListener('pointerdown', (ev) => { dragging = true; lastX = ev.clientX; stage.canvas.setPointerCapture(ev.pointerId); });
    stage.canvas.addEventListener('pointerup', () => (dragging = false));
    stage.canvas.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const rect = stage.canvas.getBoundingClientRect();
      const dx = (ev.clientX - lastX) / rect.width * (viewMax - viewMin);
      lastX = ev.clientX;
      viewMin -= dx; viewMax -= dx;
      const span = viewMax - viewMin;
      if (viewMin < LOG_MIN) { viewMin = LOG_MIN; viewMax = LOG_MIN + span; }
      if (viewMax > LOG_MAX) { viewMax = LOG_MAX; viewMin = LOG_MAX - span; }
      loop.invalidate();
    });

    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    panel.button('Reset view', () => { viewMin = LOG_MIN; viewMax = LOG_MAX; loop.invalidate(); });
    panel.button('Zoom: first second', () => { viewMin = -43; viewMax = 1; loop.invalidate(); });
    panel.button('Zoom: BBN → CMB', () => { viewMin = 0; viewMax = 13.5; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
