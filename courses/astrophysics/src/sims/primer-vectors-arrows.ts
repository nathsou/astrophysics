// Appendix A3: two draggable vectors a and b, with their sum, difference, dot product (projection)
// and cross product (signed parallelogram area, pointing out of or into the screen).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Mode = 'sum' | 'diff' | 'dot' | 'cross';
type V = [number, number];

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    let mode: Mode = (params.mode as Mode) || 'sum';
    let snap = true;
    const a: V = [3, 1];
    const b: V = [1, 2.5];
    let drag: V | null = null;
    let hot: V | null = null;

    const stage = createStage(host, { aspect: 16 / 10 });
    const ctx = stage.canvas.getContext('2d')!;
    const loop = new Loop(null, render);
    loop.onDemand = true;
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());

    const view = () => {
      const { width: W, height: H } = stage;
      const u = Math.min(W / 14, H / 9); // pixels per unit
      return { u, ox: W / 2 - u, oy: H / 2 + u * 1.2 };
    };
    const toPx = (v: V): V => { const { u, ox, oy } = view(); return [ox + v[0] * u, oy - v[1] * u]; };

    function arrow(from: V, to: V, color: string, label?: string, width = 2.5, dash?: number[]) {
      const [x0, y0] = toPx(from), [x1, y1] = toPx(to);
      const L = Math.hypot(x1 - x0, y1 - y0);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      if (L > 1) {
        const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = Math.min(12, L * 0.4);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hl * 0.8, y1 - uy * hl * 0.8); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - ux * hl - uy * hl * 0.45, y1 - uy * hl + ux * hl * 0.45);
        ctx.lineTo(x1 - ux * hl + uy * hl * 0.45, y1 - uy * hl - ux * hl * 0.45);
        ctx.closePath(); ctx.fill();
      }
      ctx.setLineDash([]);
      if (label) {
        ctx.font = 'italic 600 15px Newsreader, Georgia, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const nx = L ? -(y1 - y0) / L : 0, ny = L ? (x1 - x0) / L : 0;
        ctx.fillText(label, mx + nx * 14, my + ny * 14);
      }
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      const { u, ox, oy } = view();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // grid
      ctx.lineWidth = 1; ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      for (let x = ox % u; x < W; x += u) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
      for (let y = oy % u; y < H; y += u) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
      ctx.stroke();
      ctx.strokeStyle = pal.axis;
      ctx.beginPath(); ctx.moveTo(0, oy + 0.5); ctx.lineTo(W, oy + 0.5); ctx.moveTo(ox + 0.5, 0); ctx.lineTo(ox + 0.5, H); ctx.stroke();
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace'; ctx.fillStyle = pal.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('x', W - 12, oy + 4); ctx.fillText('y', ox + 6, 4);

      const O: V = [0, 0];
      const dot = a[0] * b[0] + a[1] * b[1];
      const cross = a[0] * b[1] - a[1] * b[0];
      const la = Math.hypot(...a), lb = Math.hypot(...b);
      const ang = Math.acos(Math.max(-1, Math.min(1, dot / (la * lb || 1))));

      if (mode === 'sum') {
        const s: V = [a[0] + b[0], a[1] + b[1]];
        arrow(a, s, pal.series[1], undefined, 1.5, [5, 4]);
        arrow(b, s, pal.series[0], undefined, 1.5, [5, 4]);
        arrow(O, s, pal.series[2], 'a + b', 3);
        rRes.set(`a + b = (${fmt(s[0], 3)}, ${fmt(s[1], 3)}), |a + b| = ${fmt(Math.hypot(...s), 3)}`);
      } else if (mode === 'diff') {
        const d: V = [a[0] - b[0], a[1] - b[1]];
        arrow(b, a, pal.series[2], 'a − b', 3);
        arrow(O, d, pal.series[2], undefined, 1.5, [5, 4]);
        rRes.set(`a − b = (${fmt(d[0], 3)}, ${fmt(d[1], 3)}), |a − b| = ${fmt(Math.hypot(...d), 3)}`);
      } else if (mode === 'dot') {
        // projection of b onto the direction of a
        const k = dot / (la * la || 1);
        const foot: V = [a[0] * k, a[1] * k];
        const [fx, fy] = toPx(foot), [bx, by] = toPx(b);
        ctx.strokeStyle = pal.faint; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(fx, fy); ctx.stroke(); ctx.setLineDash([]);
        // extend a's line
        const [e0x, e0y] = toPx([-a[0] * 10, -a[1] * 10]), [e1x, e1y] = toPx([a[0] * 10, a[1] * 10]);
        ctx.strokeStyle = pal.grid; ctx.beginPath(); ctx.moveTo(e0x, e0y); ctx.lineTo(e1x, e1y); ctx.stroke();
        ctx.strokeStyle = dot >= 0 ? pal.good : pal.bad; ctx.lineWidth = 6; ctx.globalAlpha = 0.6;
        const [ox2, oy2] = toPx(O);
        ctx.beginPath(); ctx.moveTo(ox2, oy2); ctx.lineTo(fx, fy); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = dot >= 0 ? pal.good : pal.bad; ctx.font = '12px JetBrains Mono, ui-monospace, monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`|b| cos θ = ${fmt(lb * Math.cos(ang), 3)}`, fx + 6, fy + 6);
        rRes.set(`a · b = ${fmt(a[0], 3)}×${fmt(b[0], 3)} + ${fmt(a[1], 3)}×${fmt(b[1], 3)} = ${fmt(dot, 3)} = |a||b| cos θ`);
      } else {
        const [p0x, p0y] = toPx(O), [pax, pay] = toPx(a), [pbx, pby] = toPx(b), [psx, psy] = toPx([a[0] + b[0], a[1] + b[1]]);
        ctx.fillStyle = cross >= 0 ? pal.good : pal.bad; ctx.globalAlpha = 0.18;
        ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.lineTo(pax, pay); ctx.lineTo(psx, psy); ctx.lineTo(pbx, pby); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal.faint; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pax, pay); ctx.lineTo(psx, psy); ctx.lineTo(pbx, pby); ctx.stroke(); ctx.setLineDash([]);
        // out-of-screen (⊙) or into-screen (⊗) symbol at the centre of the parallelogram
        const cx = (p0x + psx) / 2, cy = (p0y + psy) / 2, r = 11;
        ctx.strokeStyle = cross >= 0 ? pal.good : pal.bad; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        if (cross >= 0) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(cx - 7, cy - 7); ctx.lineTo(cx + 7, cy + 7); ctx.moveTo(cx + 7, cy - 7); ctx.lineTo(cx - 7, cy + 7); ctx.stroke(); }
        ctx.font = '12px JetBrains Mono, ui-monospace, monospace'; ctx.fillStyle = pal.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(cross >= 0 ? 'out of screen' : 'into screen', cx, cy + r + 4);
        rRes.set(`(a × b)_z = ${fmt(a[0], 3)}×${fmt(b[1], 3)} − ${fmt(a[1], 3)}×${fmt(b[0], 3)} = ${fmt(cross, 3)} = |a||b| sin θ (area)`);
      }
      // angle arc between a and b
      if (la > 0 && lb > 0) {
        const aa = Math.atan2(a[1], a[0]), ab = Math.atan2(b[1], b[0]);
        const [cx, cy] = toPx(O);
        ctx.strokeStyle = pal.muted; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, 26, -aa, -ab, cross > 0); ctx.stroke();
        const mid = aa + (cross > 0 ? 1 : -1) * ang / 2;
        ctx.fillStyle = pal.muted; ctx.font = 'italic 13px Newsreader, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('θ', cx + 38 * Math.cos(mid), cy - 38 * Math.sin(mid));
      }
      arrow(O, a, pal.series[0], 'a', hot === a ? 3.5 : 2.8);
      arrow(O, b, pal.series[1], 'b', hot === b ? 3.5 : 2.8);
      for (const v of [a, b]) {
        const [x, y] = toPx(v);
        ctx.strokeStyle = v === a ? pal.series[0] : pal.series[1]; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, hot === v ? 11 : 8, 0, Math.PI * 2); ctx.stroke();
      }
      rA.set(`(${fmt(a[0], 3)}, ${fmt(a[1], 3)}), |a| = ${fmt(la, 3)}`);
      rB.set(`(${fmt(b[0], 3)}, ${fmt(b[1], 3)}), |b| = ${fmt(lb, 3)}`);
      rT.set(`${fmt(ang * 180 / Math.PI, 3)}°`);
    }

    const pick = (e: PointerEvent): V | null => {
      const r = stage.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let best: V | null = null, bd = 22;
      for (const v of [b, a]) { const [px, py] = toPx(v); const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = v; } }
      return best;
    };
    const move = (e: PointerEvent) => {
      const r = stage.canvas.getBoundingClientRect();
      const { u, ox, oy } = view();
      let x = (e.clientX - r.left - ox) / u, y = (oy - (e.clientY - r.top)) / u;
      if (snap) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; }
      drag![0] = x; drag![1] = y;
      loop.invalidate();
    };
    stage.canvas.style.touchAction = 'none';
    stage.canvas.addEventListener('pointerdown', (e) => {
      drag = pick(e);
      if (drag) { stage.canvas.setPointerCapture(e.pointerId); hot = drag; move(e); }
    });
    stage.canvas.addEventListener('pointermove', (e) => {
      if (drag) move(e);
      else { const h = pick(e); stage.canvas.style.cursor = h ? 'grab' : ''; if (h !== hot) { hot = h; loop.invalidate(); } }
    });
    stage.canvas.addEventListener('pointerup', () => { drag = null; loop.invalidate(); });

    const panel = new Panel(host);
    panel.select<Mode>('Show', [
      { value: 'sum', label: 'Sum a + b' },
      { value: 'diff', label: 'Difference a − b' },
      { value: 'dot', label: 'Dot product a · b' },
      { value: 'cross', label: 'Cross product a × b' },
    ], mode, (v) => { mode = v; loop.invalidate(); });
    panel.toggle('snap to ½ grid', snap, (v) => { snap = v; });
    const rA = panel.readout('a =');
    const rB = panel.readout('b =');
    const rT = panel.readout('angle θ =');
    const rRes = panel.readout('');

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
