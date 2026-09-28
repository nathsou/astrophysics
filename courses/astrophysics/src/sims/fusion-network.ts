// Secondary figure: an animated, clickable pp-chain / CNO-cycle reaction network.
// The pp-chain flows left to right and splits into its three branches; the CNO cycle is drawn as
// a closed loop (carbon is a catalyst). Click a step to see its Q-value, its timescale in the
// solar core and any neutrino it emits.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Branch = 'common' | 'pp1' | 'pp2' | 'pp3' | 'cno';
interface Step {
  id: string;
  from: string[];
  to: string[];
  x: number; y: number; // layout position in a virtual 1000 × 600 box
  q: string;
  timescale: string;
  neutrino?: string;
  branch: Branch;
}

const CX = 815, CY = 190, CR = 125; // CNO ring
const ring = (k: number): [number, number] => [CX + CR * Math.sin((k * Math.PI) / 3), CY - CR * Math.cos((k * Math.PI) / 3)];

const STEPS: Step[] = [
  { id: 'pp', from: ['p', 'p'], to: ['²H', 'e⁺', 'ν'], x: 70, y: 330, q: '0.42 MeV, plus 1.02 MeV when the positron annihilates', timescale: '~10¹⁰ yr per proton: a weak interaction, and the bottleneck of the whole chain', neutrino: 'pp neutrino, up to 0.42 MeV (about 91% of all solar neutrinos)', branch: 'common' },
  { id: 'pd', from: ['²H', 'p'], to: ['³He', 'γ'], x: 210, y: 330, q: '5.49 MeV', timescale: 'about a second', branch: 'common' },
  { id: 'ppI', from: ['³He', '³He'], to: ['⁴He', '2p'], x: 380, y: 170, q: '12.86 MeV', timescale: '~10⁵ yr; ends the pp-I branch (≈ 83% of solar pp terminations)', branch: 'pp1' },
  { id: 'ppII-1', from: ['³He', '⁴He'], to: ['⁷Be', 'γ'], x: 380, y: 420, q: '1.59 MeV', timescale: '~10⁶ yr; starts pp-II and pp-III (≈ 17%)', branch: 'pp2' },
  { id: 'ppII-2', from: ['⁷Be', 'e⁻'], to: ['⁷Li', 'ν'], x: 530, y: 420, q: '0.86 MeV', timescale: 'months (the lab half-life is 53 days)', neutrino: '⁷Be neutrino, 0.86 MeV, a single sharp line (measured by Borexino)', branch: 'pp2' },
  { id: 'ppII-3', from: ['⁷Li', 'p'], to: ['2 ⁴He'], x: 680, y: 420, q: '17.35 MeV', timescale: 'minutes', branch: 'pp2' },
  { id: 'ppIII-1', from: ['⁷Be', 'p'], to: ['⁸B', 'γ'], x: 530, y: 540, q: '0.14 MeV', timescale: 'rare: ≈ 0.02% of terminations', branch: 'pp3' },
  { id: 'ppIII-2', from: ['⁸B'], to: ['⁸Be', 'e⁺', 'ν'], x: 680, y: 540, q: '≈ 18 MeV including the next step', timescale: 'about a second', neutrino: '⁸B neutrino, up to 15 MeV: the one Homestake, Super-Kamiokande and SNO detected', branch: 'pp3' },
  { id: 'ppIII-3', from: ['⁸Be'], to: ['2 ⁴He'], x: 830, y: 540, q: '(included above)', timescale: 'instant (⁸Be is unbound)', branch: 'pp3' },
  { id: 'cno1', from: ['¹²C', 'p'], to: ['¹³N', 'γ'], x: ring(0)[0], y: ring(0)[1], q: '1.94 MeV', timescale: '~10⁷ yr', branch: 'cno' },
  { id: 'cno2', from: ['¹³N'], to: ['¹³C', 'e⁺', 'ν'], x: ring(1)[0], y: ring(1)[1], q: '2.22 MeV', timescale: 'about 10 minutes (β⁺ decay)', neutrino: '¹³N neutrino, up to 1.2 MeV', branch: 'cno' },
  { id: 'cno3', from: ['¹³C', 'p'], to: ['¹⁴N', 'γ'], x: ring(2)[0], y: ring(2)[1], q: '7.55 MeV', timescale: '~3×10⁶ yr', branch: 'cno' },
  { id: 'cno4', from: ['¹⁴N', 'p'], to: ['¹⁵O', 'γ'], x: ring(3)[0], y: ring(3)[1], q: '7.30 MeV', timescale: '~3×10⁸ yr: the slowest step, which sets the cycle\'s rate (so CNO stars pile up ¹⁴N)', branch: 'cno' },
  { id: 'cno5', from: ['¹⁵O'], to: ['¹⁵N', 'e⁺', 'ν'], x: ring(4)[0], y: ring(4)[1], q: '2.75 MeV', timescale: 'about 2 minutes (β⁺ decay)', neutrino: '¹⁵O neutrino, up to 1.7 MeV (CNO neutrinos first seen by Borexino, 2020)', branch: 'cno' },
  { id: 'cno6', from: ['¹⁵N', 'p'], to: ['¹²C', '⁴He'], x: ring(5)[0], y: ring(5)[1], q: '4.96 MeV', timescale: '~10⁵ yr; gives back the ¹²C, which is only a catalyst', branch: 'cno' },
];
const BY_ID = Object.fromEntries(STEPS.map((s) => [s.id, s]));
const LINKS: [string, string][] = [
  ['pp', 'pd'], ['pd', 'ppI'], ['pd', 'ppII-1'], ['ppII-1', 'ppII-2'], ['ppII-2', 'ppII-3'],
  ['ppII-1', 'ppIII-1'], ['ppIII-1', 'ppIII-2'], ['ppIII-2', 'ppIII-3'],
  ['cno1', 'cno2'], ['cno2', 'cno3'], ['cno3', 'cno4'], ['cno4', 'cno5'], ['cno5', 'cno6'], ['cno6', 'cno1'],
];
const BRANCH_COLOR: Record<Branch, number> = { common: 0, pp1: 0, pp2: 1, pp3: 3, cno: 2 };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 1000 / 620 });
    const ctx = stage.canvas.getContext('2d')!;
    let selected: Step = STEPS[0];
    let hover: Step | null = null;
    let phase = 0;

    const view = () => {
      const k = Math.min(stage.width / 1000, stage.height / 620);
      return { k, ox: (stage.width - 1000 * k) / 2, oy: (stage.height - 620 * k) / 2 + 10 * k };
    };
    function nodePx(s: { x: number; y: number }) {
      const { k, ox, oy } = view();
      return { x: ox + s.x * k, y: oy + s.y * k };
    }
    function hitTest(px: number, py: number): Step | null {
      const r = Math.max(14, 30 * view().k);
      for (const s of STEPS) {
        const { x, y } = nodePx(s);
        if ((px - x) ** 2 + (py - y) ** 2 < r * r) return s;
      }
      return null;
    }
    stage.canvas.addEventListener('pointermove', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      const h = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (h !== hover) { hover = h; stage.canvas.style.cursor = hover ? 'pointer' : 'default'; }
    });
    stage.canvas.addEventListener('pointerdown', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit) { selected = hit; showInfo(); }
    });

    function render() {
      const { width: W, height: H, dpr } = stage;
      const { k } = view();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const fs = Math.max(9, Math.round(13 * k));
      const nodeR = Math.max(5, 8 * k);

      // flowing links
      for (const [a, b] of LINKS) {
        const A = nodePx(BY_ID[a]), B = nodePx(BY_ID[b]);
        const col = pal.series[BRANCH_COLOR[BY_ID[b].branch]];
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -phase * 14;
        const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
        const ux = dx / L, uy = dy / L, gap = nodeR + 4;
        ctx.beginPath();
        ctx.moveTo(A.x + ux * gap, A.y + uy * gap);
        ctx.lineTo(B.x - ux * gap, B.y - uy * gap);
        ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead
        const hx = B.x - ux * gap, hy = B.y - uy * gap, s = 6;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - ux * s - uy * s * 0.6, hy - uy * s + ux * s * 0.6);
        ctx.lineTo(hx - ux * s + uy * s * 0.6, hy - uy * s - ux * s * 0.6);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // branch and cycle labels
      ctx.font = `600 ${fs}px JetBrains Mono, ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
        const p = nodePx({ x, y });
        ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, p.x, p.y);
      };
      label('pp-chain', 70, 250, pal.series[0], 'center');
      label('pp-I ≈ 83%', 380, 95, pal.series[0], 'center');
      label('pp-II ≈ 17%', 780, 420, pal.series[1]);
      label('pp-III ≈ 0.02%', 380, 540, pal.series[3], 'center');
      label('CNO cycle', CX, CY, pal.series[2], 'center');
      ctx.font = `${Math.max(8, fs - 2)}px JetBrains Mono, ui-monospace, monospace`;
      label('(¹²C is a catalyst)', CX, CY + 20, pal.muted, 'center');

      // nodes
      for (const s of STEPS) {
        const { x, y } = nodePx(s);
        const col = pal.series[BRANCH_COLOR[s.branch]];
        const isSel = s === selected, isHov = s === hover;
        ctx.beginPath();
        ctx.arc(x, y, isSel || isHov ? nodeR * 1.35 : nodeR, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? col : pal.bg;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (s.neutrino) { // a small ν tag on neutrino-emitting steps
          ctx.fillStyle = pal.accent2;
          ctx.font = `600 ${Math.max(8, fs - 3)}px JetBrains Mono, ui-monospace, monospace`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText('ν', x + nodeR + 3, y);
        }
        ctx.fillStyle = isSel ? pal.fg : pal.muted;
        ctx.font = `${fs}px JetBrains Mono, ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(s.from.join(' + '), x, y - nodeR - 4);
        if (W >= 560) { // on narrow screens the products live only in the readout below
          ctx.textBaseline = 'top';
          ctx.fillText('→ ' + s.to.join(' + '), x, y + nodeR + 4);
        }
      }
    }

    const loop = new Loop((dt) => { phase += dt; }, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    const rStep = panel.readout('Reaction');
    const rQ = panel.readout('Energy released');
    const rT = panel.readout('Time in the Sun\'s core');
    const rNu = panel.readout('Neutrino');
    function showInfo() {
      rStep.set(`${selected.from.join(' + ')} → ${selected.to.join(' + ')}`);
      rQ.set(selected.q);
      rT.set(selected.timescale);
      rNu.set(selected.neutrino ?? 'none');
      loop.invalidate();
    }
    showInfo();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
