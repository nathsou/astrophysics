// Secondary figure: an animated, clickable pp-chain / CNO-cycle reaction network.
// Click a step to see its Q-value, solar-core timescale and neutrino emission.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

interface Step {
  id: string;
  from: string[];
  to: string[];
  x: number; y: number; // layout position, 0..1
  q: string; // energy release
  timescale: string;
  neutrino?: string;
  branch: 'pp1' | 'pp2' | 'pp3' | 'cno' | 'common';
}

const STEPS: Step[] = [
  { id: 'pp', from: ['p', 'p'], to: ['²H', 'e⁺', 'ν_e'], x: 0.06, y: 0.5, q: '0.42 MeV + 1.02 MeV (e⁺e⁻ annihilation)', timescale: '~10¹⁰ yr per proton (weak interaction — the bottleneck)', neutrino: 'pp neutrino, E ≤ 0.42 MeV', branch: 'common' },
  { id: 'pd', from: ['²H', 'p'], to: ['³He', 'γ'], x: 0.22, y: 0.5, q: '5.49 MeV', timescale: '~1 s', branch: 'common' },
  { id: 'ppI', from: ['³He', '³He'], to: ['⁴He', 'p', 'p'], x: 0.42, y: 0.28, q: '12.86 MeV', timescale: '~10⁵ yr; dominant branch (≈ 86%) below 18 MK', branch: 'pp1' },
  { id: 'ppII-1', from: ['³He', '⁴He'], to: ['⁷Be', 'γ'], x: 0.42, y: 0.55, q: '1.59 MeV', timescale: '~10⁶ yr', branch: 'pp2' },
  { id: 'ppII-2', from: ['⁷Be', 'e⁻'], to: ['⁷Li', 'ν_e'], x: 0.6, y: 0.55, q: '0.86 MeV', timescale: '~53 days', neutrino: '⁷Be neutrino, 0.86 MeV (mono-energetic; Borexino)', branch: 'pp2' },
  { id: 'ppII-3', from: ['⁷Li', 'p'], to: ['⁴He', '⁴He'], x: 0.78, y: 0.55, q: '17.35 MeV', timescale: 'fast', branch: 'pp2' },
  { id: 'ppIII-1', from: ['⁷Be', 'p'], to: ['⁸B', 'γ'], x: 0.6, y: 0.8, q: '0.14 MeV', timescale: 'rare (≈ 0.02%)', branch: 'pp3' },
  { id: 'ppIII-2', from: ['⁸B'], to: ['⁸Be', 'e⁺', 'ν_e'], x: 0.78, y: 0.8, q: '17.98 MeV total', timescale: '~1 s', neutrino: '⁸B neutrino, up to 15 MeV — the one Homestake/SNO/Super-K detected', branch: 'pp3' },
  { id: 'ppIII-3', from: ['⁸Be'], to: ['⁴He', '⁴He'], x: 0.92, y: 0.8, q: '(included above)', timescale: 'instant (unbound)', branch: 'pp3' },
  { id: 'cno1', from: ['¹²C', 'p'], to: ['¹³N', 'γ'], x: 0.42, y: 0.02, q: '1.94 MeV', timescale: '~1.3×10⁷ yr', branch: 'cno' },
  { id: 'cno2', from: ['¹³N'], to: ['¹³C', 'e⁺', 'ν_e'], x: 0.55, y: 0.02, q: '2.22 MeV', timescale: '~7 min', neutrino: '¹³N neutrino', branch: 'cno' },
  { id: 'cno3', from: ['¹³C', 'p'], to: ['¹⁴N', 'γ'], x: 0.68, y: 0.02, q: '7.55 MeV', timescale: '~3×10⁶ yr', branch: 'cno' },
  { id: 'cno4', from: ['¹⁴N', 'p'], to: ['¹⁵O', 'γ'], x: 0.81, y: 0.02, q: '7.30 MeV', timescale: '~3×10⁸ yr — slowest CNO step, sets the cycle rate', branch: 'cno' },
  { id: 'cno5', from: ['¹⁵O'], to: ['¹⁵N', 'e⁺', 'ν_e'], x: 0.9, y: 0.02, q: '2.75 MeV', timescale: '~2 min', neutrino: '¹⁵O neutrino', branch: 'cno' },
  { id: 'cno6', from: ['¹⁵N', 'p'], to: ['¹²C', '⁴He'], x: 0.98, y: 0.02, q: '4.96 MeV', timescale: '~1×10⁵ yr; regenerates ¹²C (catalyst)', branch: 'cno' },
];

const BRANCH_COLOR: Record<Step['branch'], number> = { common: 0, pp1: 0, pp2: 1, pp3: 3, cno: 2 };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 10 });
    const ctx = stage.canvas.getContext('2d')!;
    let selected: Step | null = STEPS[0];
    let hover: Step | null = null;
    let phase = 0;

    function nodePx(s: Step) {
      return { x: 40 + s.x * (stage.width - 80), y: 40 + s.y * (stage.height - 80) };
    }
    function hitTest(px: number, py: number): Step | null {
      for (const s of STEPS) {
        const { x, y } = nodePx(s);
        if ((px - x) ** 2 + (py - y) ** 2 < 22 * 22) return s;
      }
      return null;
    }

    stage.canvas.addEventListener('pointermove', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      hover = hitTest(e.clientX - r.left, e.clientY - r.top);
      stage.canvas.style.cursor = hover ? 'pointer' : 'default';
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointerdown', (e) => {
      const r = stage.canvas.getBoundingClientRect();
      const hit = hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit) { selected = hit; loop.invalidate(); }
    });

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted;
      ctx.fillText('pp-chain branches (I lower, III upper)', 40, 20);
      ctx.fillText('CNO cycle', 40, H - 14);

      for (const s of STEPS) {
        const { x, y } = nodePx(s);
        const col = pal.series[BRANCH_COLOR[s.branch]];
        const isSel = s === selected, isHov = s === hover;
        // flowing dashes to suggest reaction progress
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = isSel ? 2.5 : 1.5;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -phase * 12;
        ctx.beginPath();
        ctx.moveTo(x - 20, y);
        ctx.lineTo(x + 20, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.arc(x, y, isHov || isSel ? 9 : 6.5, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? col : pal.bg;
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = pal.fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${s.from.join('+')}`, x, y - 12);
        ctx.textBaseline = 'top';
        ctx.fillText(`→ ${s.to.join('+')}`, x, y + 12);
      }

      if (selected) {
        const boxY = H - 78;
        ctx.fillStyle = pal.faint;
        ctx.fillRect(0, boxY, W, 78);
        ctx.fillStyle = pal.fg;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '13px Inter, system-ui, sans-serif';
        ctx.fillText(`${selected.from.join(' + ')}  →  ${selected.to.join(' + ')}`, 16, boxY + 8);
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillStyle = pal.muted;
        ctx.fillText(`Q ≈ ${selected.q}   ·   solar-core timescale: ${selected.timescale}`, 16, boxY + 30);
        if (selected.neutrino) ctx.fillText(`Neutrino: ${selected.neutrino}`, 16, boxY + 50);
      }
    }

    const loop = new Loop((dt) => { phase += dt; }, render, 1 / 24);
    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
