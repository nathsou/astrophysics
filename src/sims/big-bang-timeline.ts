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

    if (host.clientWidth < 560) stage.el.style.aspectRatio = '1.1'; // taller on phones
    let hoverEvent: Event | null = null;
    const ctx = stage.canvas.getContext('2d')!;
    let viewMin = LOG_MIN, viewMax = LOG_MAX;

    function logtToX(logt: number, W: number) {
      return ((logt - viewMin) / (viewMax - viewMin)) * W;
    }
    function xToLogt(x: number, W: number) {
      return viewMin + (x / W) * (viewMax - viewMin);
    }

    const loop = new Loop(null, render, 1 / 30);

    function tempLabel(logt: number): string {
      const t = 10 ** logt;
      if (t < 1e-2) return '';
      let K: number;
      if (t < 1e12) K = tempAtTime(t) * MEV_TO_KELVIN; // radiation era
      else {
        // matter + Λ era (flat ΛCDM, radiation neglected): 1+z from t, then T = T₀(1+z)
        const H0 = 2.184e-18, OL = 0.685, OM = 0.315;
        const onePlusZ = (Math.sqrt(OL / OM) / Math.sinh(1.5 * H0 * Math.sqrt(OL) * t)) ** (2 / 3);
        K = 2.725 * onePlusZ;
      }
      return `T ≈ ${fmt(K, 2)} K`;
    }

    // Friendly time landmarks drawn just above the axis.
    const HUMAN: [number, string][] = [
      [0, '1 s'], [Math.log10(60), '1 min'], [Math.log10(3600), '1 hr'], [Math.log10(86400), '1 day'], [Math.log10(3.156e7), '1 yr'],
      [Math.log10(3.156e10), '1,000 yr'], [Math.log10(3.156e13), '1 Myr'], [Math.log10(3.156e16), '1 Gyr'],
    ];
    // Eras by what dominates the energy budget (equality at ~50 kyr; matter–Λ equality at z ≈ 0.3, ~10 Gyr).
    const ERAS: [number, number, string, number][] = [
      [LOG_MIN, Math.log10(1.6e12), 'radiation era', 0],
      [Math.log10(1.6e12), Math.log10(3.1e17), 'matter era', 1],
      [Math.log10(3.1e17), LOG_MAX + 1, 'Λ era', 2],
    ];
    const ROWS = [1, -1, 2, -2, 3, -3, 4, -4]; // +above / −below the axis, in units of row height

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const axisY = Math.round(H * 0.5);
      const rowH = Math.max(24, Math.min(38, (H * 0.5 - 56) / 4));
      const pad = 10; // keep labels off the canvas edges

      // era bands
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      for (const [a, b, name, k] of ERAS) {
        const x0 = Math.max(0, logtToX(a, W)), x1 = Math.min(W, logtToX(b, W));
        if (x1 <= x0) continue;
        ctx.fillStyle = [pal.series[1], pal.series[0], pal.series[2]][k];
        ctx.globalAlpha = 0.07;
        ctx.fillRect(x0, 26, x1 - x0, H - 26);
        ctx.globalAlpha = 1;
        if (x1 - x0 > ctx.measureText(name).width + 12) {
          ctx.fillStyle = pal.muted;
          ctx.textAlign = 'left';
          ctx.fillText(name, x0 + 6, 30);
        }
      }

      // axis
      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(W, axisY); ctx.stroke();

      // decade ticks: every decade gets a tick, labels thinned to stay ≥ 48 px apart
      const pxPerDec = W / (viewMax - viewMin);
      const every = [1, 2, 3, 5, 10, 20].find((k) => k * pxPerDec >= 48) ?? 20;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.lineWidth = 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let d = Math.ceil(viewMin); d <= Math.floor(viewMax); d++) {
        const x = logtToX(d, W);
        const major = d % every === 0;
        ctx.strokeStyle = major ? pal.axis : pal.grid;
        ctx.beginPath(); ctx.moveTo(x, axisY - (major ? 5 : 3)); ctx.lineTo(x, axisY + (major ? 5 : 3)); ctx.stroke();
        if (major && x > 14 && x < W - 14) {
          ctx.fillStyle = pal.muted;
          ctx.fillText(d === 0 ? '1 s' : `10${superscriptNum(d)}`, x, axisY + 8);
        }
      }
      // human landmarks just above the axis
      ctx.textBaseline = 'bottom';
      let lastHx = -1e9;
      for (const [lt, name] of HUMAN) {
        const x = logtToX(lt, W);
        if (x < 14 || x > W - 14 || x - lastHx < 44 || lt === 0) continue;
        lastHx = x;
        ctx.fillStyle = pal.faint;
        ctx.fillText(name, x, axisY - 6);
      }

      // events: greedy row assignment so labels never overlap each other or other leaders
      ctx.font = '11px Inter, system-ui, sans-serif';
      const placed: { row: number; x0: number; x1: number }[] = [];
      for (const e of EVENTS) {
        const x = logtToX(e.logt, W);
        e.__x = undefined;
        if (x < -2 || x > W + 2) continue;
        const tw = ctx.measureText(e.label).width;
        // label runs right of its leader, or left of it near the right edge
        const right = x + tw + 8 < W - pad;
        const lx0 = right ? x - 2 : x - tw - 6, lx1 = right ? x + tw + 6 : x + 2;
        let row = 0; // 0 = no free row: draw the dot only (tap/hover still shows the details)
        for (const r of ROWS) {
          const clash = placed.some((p) => Math.sign(p.row) === Math.sign(r) && (
            (p.row === r && lx0 < p.x1 && lx1 > p.x0) ||                 // label vs label
            (Math.abs(p.row) < Math.abs(r) && x >= p.x0 && x <= p.x1)));  // our leader crosses a nearer label
          if (!clash) { row = r; break; }
        }
        const hot = hoverEvent === e;
        if (!row) {
          ctx.fillStyle = pal.accent;
          ctx.beginPath(); ctx.arc(x, axisY, hot ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
          e.__x = x;
          continue;
        }
        placed.push({ row, x0: lx0, x1: lx1 });
        const y1 = axisY - row * rowH - Math.sign(row) * (row > 0 ? 8 : 18);
        ctx.strokeStyle = pal.faint;
        ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, y1); ctx.stroke();
        ctx.fillStyle = pal.accent;
        ctx.beginPath(); ctx.arc(x, axisY, hot ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hot ? pal.accent : pal.fg;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.textBaseline = row > 0 ? 'bottom' : 'top';
        ctx.fillText(e.label, right ? x + 4 : x - 4, y1);
        e.__x = x;
      }

      ctx.fillStyle = pal.muted;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(W < 640 ? 'Time since the Big Bang (s, log) · drag to pan, tap an event' : 'Time since the Big Bang (seconds, log scale) · scroll or drag to zoom and pan · hover an event', 8, 8);

      const hx = hoverEvent?.__x;
      if (hoverEvent && hx !== undefined) {
        const e = hoverEvent;
        ctx.font = '11px Inter, system-ui, sans-serif';
        const bw = Math.min(360, W - 16);
        const bx = Math.max(8, Math.min(W - bw - 8, hx - bw / 2));
        const lines = wrapLines(ctx, e.detail, bw - 16);
        const bh = 26 + lines.length * 14;
        const by = H - bh - 8;
        ctx.fillStyle = pal.bg || '#000';
        ctx.globalAlpha = 0.94;
        ctx.fillRect(bx, by, bw, bh);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.axis; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = pal.fg;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        ctx.fillText(`${e.label} · t ≈ ${timeLabel(e.logt)}${tempLabel(e.logt) ? ' · ' + tempLabel(e.logt) : ''}`, bx + 8, by + 7);
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = pal.muted;
        lines.forEach((l, i) => ctx.fillText(l, bx + 8, by + 24 + i * 14));
      }
    }

    function timeLabel(logt: number): string {
      const t = 10 ** logt;
      if (t < 1) return `10${superscriptNum(Math.round(logt))} s`;
      if (t < 600) return `${fmt(t, 2)} s`;
      if (t < 3.156e7) return `${fmt(t / 60, 2)} min`;
      if (t < 3.156e13) return `${fmt(t / 3.156e7, 2)} yr`;
      if (t < 3.156e16) return `${fmt(t / 3.156e13, 2)} Myr`;
      return `${fmt(t / 3.156e16, 3)} Gyr`;
    }
    function wrapLines(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
      const out: string[] = [];
      let line = '';
      for (const w of text.split(' ')) {
        const test = line ? line + ' ' + w : w;
        if (c.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      if (line) out.push(line);
      return out;
    }

    function superscriptNum(n: number): string {
      const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
      return String(n).split('').map((c) => SUP[c] ?? c).join('');
    }
    stage.canvas.addEventListener('pointermove', (ev) => {
      const rect = stage.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      let best: Event | null = null, bestD = ev.pointerType === 'mouse' ? 14 : 24;
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
    stage.canvas.addEventListener('pointerleave', () => { if (!dragging) { hoverEvent = null; loop.invalidate(); } });
    stage.canvas.addEventListener('pointercancel', () => (dragging = false));
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

    host.style.minHeight = ''; // drop the loader's placeholder height: the mounted content now sizes the figure
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
