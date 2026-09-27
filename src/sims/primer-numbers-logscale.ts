// Appendix A1: the same set of astronomical objects on a linear axis and a logarithmic axis,
// with a slider that morphs continuously between the two. On the linear axis nearly everything
// collapses into the first pixel; on the log axis every factor of ten gets the same room.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt, superscript } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Item { name: string; v: number }
interface Dataset { label: string; unit: string; items: Item[] }

const DATA: Record<string, Dataset> = {
  length: {
    label: 'Lengths', unit: 'm',
    items: [
      { name: 'Proton', v: 1.7e-15 },
      { name: 'Hydrogen atom', v: 1.06e-10 },
      { name: 'Virus', v: 1e-7 },
      { name: 'Human', v: 1.7 },
      { name: 'Everest', v: 8.8e3 },
      { name: 'Earth', v: 1.27e7 },
      { name: 'Sun', v: 1.39e9 },
      { name: 'Earth–Sun (1 AU)', v: 1.5e11 },
      { name: 'Heliopause', v: 1.8e13 },
      { name: 'Light-year', v: 9.46e15 },
      { name: 'Nearest star', v: 4.0e16 },
      { name: 'Milky Way disc', v: 9.5e20 },
      { name: 'Andromeda', v: 2.4e22 },
      { name: 'Observable universe', v: 8.8e26 },
    ],
  },
  mass: {
    label: 'Masses', unit: 'kg',
    items: [
      { name: 'Electron', v: 9.1e-31 },
      { name: 'Proton', v: 1.67e-27 },
      { name: 'Human', v: 70 },
      { name: 'Moon', v: 7.3e22 },
      { name: 'Earth', v: 5.97e24 },
      { name: 'Jupiter', v: 1.9e27 },
      { name: 'Sun', v: 1.99e30 },
      { name: 'Sgr A*', v: 8.5e36 },
      { name: 'Milky Way', v: 2e42 },
      { name: 'Coma cluster', v: 1.2e45 },
      { name: 'Observable universe (baryons)', v: 1.5e53 },
    ],
  },
  time: {
    label: 'Times', unit: 's',
    items: [
      { name: 'Light crosses an atom', v: 3.5e-19 },
      { name: 'Fastest pulsar spin', v: 1.4e-3 },
      { name: 'Heartbeat', v: 1 },
      { name: 'Sunlight to Earth', v: 499 },
      { name: 'Day', v: 8.64e4 },
      { name: 'Year', v: 3.16e7 },
      { name: 'Human life', v: 2.5e9 },
      { name: 'Recorded history', v: 1.6e11 },
      { name: 'Sun orbits the Galaxy', v: 7.3e15 },
      { name: 'Age of the Earth', v: 1.43e17 },
      { name: 'Age of the universe', v: 4.35e17 },
    ],
  },
};

const sci = (v: number) => {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return `${m.toFixed(1)}×10${superscript(String(e))}`;
};

export default defineSim({
  mount({ host }) {
    let pal = palette();
    let key = 'length';
    let s = 1; // 0 = linear, 1 = logarithmic
    let hover = -1;

    const stage = createStage(host, { aspect: 16 / 5 });
    const ctx = stage.canvas.getContext('2d')!;

    const loop = new Loop(null, render);

    loop.onDemand = true;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize((w) => {
      const a = w < 520 ? 4 / 3 : 16 / 5;
      if (stage.el.style.aspectRatio !== String(a)) stage.el.style.aspectRatio = String(a);
      loop.invalidate();
    });

    const M = { l: 28, r: 28 };
    // Labels need more lanes on a narrow screen: keep at least ~190 px above the axis.
    const axisY = () => Math.max(stage.height * 0.68, Math.min(stage.height - 50, 190));

    function positions(ds: Dataset, W: number): number[] {
      const vs = ds.items.map((i) => i.v);
      const vmax = Math.max(...vs) * 1.05;
      const lmin = Math.floor(Math.log10(Math.min(...vs))), lmax = Math.ceil(Math.log10(Math.max(...vs)));
      const pw = W - M.l - M.r;
      return vs.map((v) => {
        const lin = v / vmax;
        const lg = (Math.log10(v) - lmin) / (lmax - lmin);
        return M.l + ((1 - s) * lin + s * lg) * pw;
      });
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const ds = DATA[key];
      const vs = ds.items.map((i) => i.v);
      const vmax = Math.max(...vs) * 1.05;
      const lmin = Math.floor(Math.log10(Math.min(...vs))), lmax = Math.ceil(Math.log10(Math.max(...vs)));
      const pw = W - M.l - M.r;
      const y0 = axisY();
      const xs = positions(ds, W);
      ctx.font = '11px Inter, system-ui, sans-serif';

      // Decade ticks (fade in as s → 1) and linear ticks (fade out).
      const map = (v: number) => M.l + ((1 - s) * (v / vmax) + s * ((Math.log10(v) - lmin) / (lmax - lmin))) * pw;
      const stride = Math.max(1, Math.ceil((lmax - lmin) / Math.min(14, Math.max(3, Math.floor(pw / 44)))));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let e = lmin; e <= lmax; e++) {
        const X = map(10 ** e);
        ctx.globalAlpha = 0.15 + 0.85 * s;
        ctx.strokeStyle = pal.grid;
        ctx.beginPath(); ctx.moveTo(X, y0 - 70); ctx.lineTo(X, y0 + 6); ctx.stroke();
        if (s > 0.5 && (e - lmin) % stride === 0) {
          ctx.globalAlpha = (s - 0.5) * 2;
          ctx.fillStyle = pal.muted;
          ctx.fillText(`10${superscript(String(e))}`, X, y0 + 8);
        }
      }
      ctx.globalAlpha = 1;
      if (s < 0.5) {
        const step = 10 ** Math.floor(Math.log10(vmax / 4));
        const nice = [1, 2, 5].map((k) => k * step).find((st) => vmax / st <= 6) ?? step * 10;
        ctx.globalAlpha = 1 - s * 2;
        ctx.fillStyle = pal.muted;
        for (let v = 0; v <= vmax; v += nice) {
          const X = v === 0 ? M.l : map(v);
          ctx.fillText(v === 0 ? '0' : sci(v), X, y0 + 8);
        }
        ctx.globalAlpha = 1;
      }
      // Axis line.
      ctx.strokeStyle = pal.axis;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(M.l, y0 + 0.5); ctx.lineTo(W - M.r, y0 + 0.5); ctx.stroke();
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'right';
      ctx.fillText(`${ds.label.toLowerCase()} (${ds.unit}) — ${s > 0.98 ? 'logarithmic' : s < 0.02 ? 'linear' : 'morphing'}`, W - M.r, y0 + 26);

      // Greedy label lanes above the axis. A label near the right edge hangs to the LEFT of its
      // leader line so it is never clipped.
      const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
      const lanes: number[] = [];
      const laneOf = new Map<number, number>();
      const startOf = new Map<number, number>();
      const nLanes = Math.max(2, Math.floor((y0 - 24) / 15));
      for (const { x, i } of order) {
        const w = ctx.measureText(ds.items[i].name).width;
        const x0 = x + 3 + w > W - 4 ? x - 3 - w : x + 3;
        let L = lanes.findIndex((end) => end < x0 - 6 && end < x - 4);
        if (L < 0 && lanes.length < nLanes) { L = lanes.length; lanes.push(-1e9); }
        if (L >= 0) { lanes[L] = Math.max(x0 + w, x); laneOf.set(i, L); startOf.set(i, x0); }
      }
      const laneY = (L: number) => y0 - 16 - L * 15;
      // Leader lines first, then dots, then haloed labels on top, so no line crosses a label.
      xs.forEach((X, i) => {
        const L = laneOf.get(i);
        if (L === undefined) return;
        ctx.strokeStyle = pal.series[i % 5]; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(X + 0.5, y0); ctx.lineTo(X + 0.5, laneY(L)); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      xs.forEach((X, i) => {
        ctx.fillStyle = pal.series[i % 5];
        ctx.beginPath(); ctx.arc(X, y0, i === hover ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = pal.bg;
      xs.forEach((_, i) => {
        const L = laneOf.get(i);
        if (L === undefined) return;
        const x0 = startOf.get(i)!, Y = laneY(L);
        ctx.strokeText(ds.items[i].name, x0, Y);
        ctx.fillStyle = i === hover ? pal.accent : pal.fg;
        ctx.fillText(ds.items[i].name, x0, Y);
      });
      ctx.lineWidth = 1;

      // How many objects share the first pixel?
      const firstPx = xs.filter((x) => x - M.l < 1).length;
      readCram.set(`${firstPx} of ${xs.length}`);
      const h = hover >= 0 ? ds.items[hover] : null;
      readObj.set(h ? `${h.name}: ${sci(h.v)} ${ds.unit} (log₁₀ = ${fmt(Math.log10(h.v), 3)})` : 'hover a dot');
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(s > 0.98 ? 'each gridline: ×10' : s < 0.02 ? 'each gridline: + the same amount' : '', M.l, H - 8);
    }

    stage.canvas.addEventListener('pointermove', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const xs = positions(DATA[key], stage.width);
      let best = -1, bd = 14;
      if (Math.abs(y - axisY()) < 40) xs.forEach((X, i) => { const d = Math.abs(X - x); if (d < bd) { bd = d; best = i; } });
      if (best !== hover) { hover = best; loop.invalidate(); }
    });
    stage.canvas.addEventListener('pointerleave', () => { hover = -1; loop.invalidate(); });

    const panel = new Panel(host);
    panel.select('Data', Object.entries(DATA).map(([k, d]) => ({ value: k, label: d.label })), key, (v) => { key = v; hover = -1; loop.invalidate(); });
    const sl = panel.slider('Linear ↔ log', { min: 0, max: 1, value: s, step: 0.01, format: (v) => (v < 0.02 ? 'linear' : v > 0.98 ? 'log' : fmt(v, 2)) }, (v) => { s = v; loop.invalidate(); });
    panel.button('Linear', () => { sl.set(0); s = 0; loop.invalidate(); });
    panel.button('Log', () => { sl.set(1); s = 1; loop.invalidate(); });
    const readCram = panel.readout('Squeezed into the first pixel:');
    const readObj = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
