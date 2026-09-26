// Secondary figure: a periodic table coloured by dominant nucleosynthesis origin
// (approximate mass-weighted contributions, in the style of Johnson 2019 / NASA's
// "Origin of the Elements" chart). Click an element for a short origin note.

import { defineSim, createStage, Loop } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Origin = 'bigbang' | 'cosmic' | 'lowmass' | 'massive' | 'exploding-wd' | 'merging-ns' | 'human';
const ORIGIN_LABEL: Record<Origin, string> = {
  bigbang: 'Big Bang nucleosynthesis',
  cosmic: 'Cosmic-ray spallation',
  lowmass: 'Low-mass stars (AGB, s-process)',
  massive: 'Massive stars (fusion + core collapse)',
  'exploding-wd': 'Exploding white dwarfs (Type Ia)',
  'merging-ns': 'Merging neutron stars (r-process, kilonovae)',
  human: 'Human-made (lab/reactor synthesis)',
};

interface El { Z: number; sym: string; row: number; col: number; origin: Origin; note: string }

// row/col follow the standard periodic table layout (1-indexed), lanthanides/actinides on rows 8-9.
const EL: El[] = [
  { Z: 1, sym: 'H', row: 1, col: 1, origin: 'bigbang', note: 'Almost entirely primordial: made in the first ~20 minutes after the Big Bang.' },
  { Z: 2, sym: 'He', row: 1, col: 18, origin: 'bigbang', note: '~25% by mass is primordial; the rest comes from H-burning in every star since.' },
  { Z: 3, sym: 'Li', row: 2, col: 1, origin: 'cosmic', note: 'A little primordial, but most is made by cosmic rays smashing into interstellar C, N, O.' },
  { Z: 4, sym: 'Be', row: 2, col: 2, origin: 'cosmic', note: 'Cosmic-ray spallation of C, N, O.' },
  { Z: 5, sym: 'B', row: 2, col: 13, origin: 'cosmic', note: 'Cosmic-ray spallation — this and Li, Be are the exceptions to "stars made it".' },
  { Z: 6, sym: 'C', row: 2, col: 14, origin: 'lowmass', note: 'Triple-alpha in low- and intermediate-mass stars, expelled by AGB winds and planetary nebulae.' },
  { Z: 7, sym: 'N', row: 2, col: 15, origin: 'lowmass', note: 'CNO-cycle byproduct, dredged up by AGB stars.' },
  { Z: 8, sym: 'O', row: 2, col: 16, origin: 'massive', note: 'Helium- and carbon-burning in massive stars, ejected by core-collapse supernovae.' },
  { Z: 9, sym: 'F', row: 2, col: 17, origin: 'massive', note: 'Trace production in massive-star burning and AGB stars.' },
  { Z: 10, sym: 'Ne', row: 2, col: 18, origin: 'massive', note: 'Carbon- and neon-burning shells in massive stars.' },
  { Z: 11, sym: 'Na', row: 3, col: 1, origin: 'massive', note: 'Carbon-burning in massive stars.' },
  { Z: 12, sym: 'Mg', row: 3, col: 2, origin: 'massive', note: 'Carbon- and neon-burning in massive stars.' },
  { Z: 13, sym: 'Al', row: 3, col: 13, origin: 'massive', note: 'Explosive nucleosynthesis in core-collapse supernovae.' },
  { Z: 14, sym: 'Si', row: 3, col: 14, origin: 'exploding-wd', note: 'Oxygen- and silicon-burning; enriched strongly by Type Ia supernovae.' },
  { Z: 15, sym: 'P', row: 3, col: 15, origin: 'massive', note: 'Oxygen-burning shells in massive stars.' },
  { Z: 16, sym: 'S', row: 3, col: 16, origin: 'exploding-wd', note: 'Explosive oxygen-burning, largely in Type Ia and core-collapse supernovae.' },
  { Z: 17, sym: 'Cl', row: 3, col: 17, origin: 'exploding-wd', note: 'Explosive burning in supernovae of both types.' },
  { Z: 18, sym: 'Ar', row: 3, col: 18, origin: 'exploding-wd', note: 'Explosive oxygen/silicon burning.' },
  { Z: 19, sym: 'K', row: 4, col: 1, origin: 'exploding-wd', note: 'Explosive burning in supernovae.' },
  { Z: 20, sym: 'Ca', row: 4, col: 2, origin: 'exploding-wd', note: 'Explosive silicon-burning, Type Ia-dominated.' },
  { Z: 21, sym: 'Sc', row: 4, col: 3, origin: 'massive', note: 'Core-collapse supernova nucleosynthesis.' },
  { Z: 22, sym: 'Ti', row: 4, col: 4, origin: 'exploding-wd', note: 'Explosive silicon-burning.' },
  { Z: 23, sym: 'V', row: 4, col: 5, origin: 'exploding-wd', note: 'Explosive silicon-burning.' },
  { Z: 24, sym: 'Cr', row: 4, col: 6, origin: 'exploding-wd', note: 'Type Ia supernovae are the dominant Galactic source.' },
  { Z: 25, sym: 'Mn', row: 4, col: 7, origin: 'exploding-wd', note: 'Type Ia supernovae are the dominant Galactic source.' },
  { Z: 26, sym: 'Fe', row: 4, col: 8, origin: 'exploding-wd', note: 'The iron peak: most Galactic iron comes from Type Ia white-dwarf explosions, some from core collapse.' },
  { Z: 27, sym: 'Co', row: 4, col: 9, origin: 'exploding-wd', note: 'Radioactive ⁵⁶Co decay in supernova ejecta (both types) powers their light curves.' },
  { Z: 28, sym: 'Ni', row: 4, col: 10, origin: 'exploding-wd', note: 'Radioactive ⁵⁶Ni is what actually explodes in a Type Ia; it decays to Co then Fe.' },
  { Z: 29, sym: 'Cu', row: 4, col: 11, origin: 'massive', note: 'Weak s-process in massive stars, plus some explosive nucleosynthesis.' },
  { Z: 30, sym: 'Zn', row: 4, col: 12, origin: 'massive', note: 'Core-collapse supernovae and the weak s-process.' },
  { Z: 31, sym: 'Ga', row: 4, col: 13, origin: 'lowmass', note: 's-process in AGB stars.' },
  { Z: 32, sym: 'Ge', row: 4, col: 14, origin: 'merging-ns', note: 'Mixed s- and r-process; the r-process fraction points to neutron-star mergers.' },
  { Z: 35, sym: 'Br', row: 4, col: 17, origin: 'merging-ns', note: 'Mixed s/r-process.' },
  { Z: 36, sym: 'Kr', row: 4, col: 18, origin: 'lowmass', note: 's-process in AGB stars, with an r-process contribution.' },
  { Z: 38, sym: 'Sr', row: 5, col: 2, origin: 'lowmass', note: 's-process in AGB stars.' },
  { Z: 39, sym: 'Y', row: 5, col: 3, origin: 'lowmass', note: 's-process in AGB stars.' },
  { Z: 40, sym: 'Zr', row: 5, col: 4, origin: 'lowmass', note: 's-process in AGB stars.' },
  { Z: 47, sym: 'Ag', row: 5, col: 11, origin: 'merging-ns', note: 'Largely r-process — neutron-star mergers and rare supernova channels.' },
  { Z: 50, sym: 'Sn', row: 5, col: 14, origin: 'lowmass', note: 's-process in AGB stars.' },
  { Z: 53, sym: 'I', row: 5, col: 17, origin: 'merging-ns', note: 'r-process.' },
  { Z: 54, sym: 'Xe', row: 5, col: 18, origin: 'merging-ns', note: 'Mixed s- and r-process.' },
  { Z: 56, sym: 'Ba', row: 6, col: 2, origin: 'lowmass', note: 's-process in AGB stars — the classic "s-process element".' },
  { Z: 57, sym: 'La', row: 8, col: 4, origin: 'lowmass', note: 's-process, AGB stars.' },
  { Z: 60, sym: 'Nd', row: 8, col: 7, origin: 'merging-ns', note: 'Mixed s/r; detected directly in the kilonova AT2017gfo (GW170817).' },
  { Z: 63, sym: 'Eu', row: 8, col: 10, origin: 'merging-ns', note: 'The textbook r-process tracer — mostly from neutron-star mergers.' },
  { Z: 74, sym: 'W', row: 9, col: 8, origin: 'merging-ns', note: 'Mixed s/r-process.' },
  { Z: 78, sym: 'Pt', row: 6, col: 12, origin: 'merging-ns', note: 'r-process, neutron-star mergers.' },
  { Z: 79, sym: 'Au', row: 6, col: 13, origin: 'merging-ns', note: 'Almost pure r-process — neutron-star mergers, as confirmed by GW170817/AT2017gfo.' },
  { Z: 82, sym: 'Pb', row: 6, col: 16, origin: 'lowmass', note: 's-process endpoint in AGB stars, plus some r-process.' },
  { Z: 92, sym: 'U', row: 9, col: 10, origin: 'merging-ns', note: 'r-process, neutron-star mergers — see Chapter 16.' },
  { Z: 94, sym: 'Pu', row: 9, col: 12, origin: 'human', note: 'Trace natural r-process abundance; bulk is human-made in reactors.' },
];

const ORIGIN_COLOR: Record<Origin, number> = { bigbang: 0, cosmic: 4, lowmass: 2, massive: 1, 'exploding-wd': 3, 'merging-ns': 0, human: 4 };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 18 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let selected: El | null = EL.find((e) => e.sym === 'Au')!;
    let hover: El | null = null;

    const COLS = 18, ROWS = 9;
    function cell(e: El) {
      const cw = (stage.width - 20) / COLS, ch = (stage.height - 40) / ROWS;
      return { x: 10 + (e.col - 1) * cw, y: 10 + (e.row - 1) * ch + (e.row >= 8 ? ch * 0.6 : 0), w: cw - 2, h: ch - 2 };
    }
    function hitTest(px: number, py: number): El | null {
      for (const e of EL) { const c = cell(e); if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) return e; }
      return null;
    }
    stage.canvas.addEventListener('pointermove', (ev) => {
      const r = stage.canvas.getBoundingClientRect();
      hover = hitTest(ev.clientX - r.left, ev.clientY - r.top);
      stage.canvas.style.cursor = hover ? 'pointer' : 'default';
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointerdown', (ev) => {
      const r = stage.canvas.getBoundingClientRect();
      const hit = hitTest(ev.clientX - r.left, ev.clientY - r.top);
      if (hit) { selected = hit; loop.invalidate(); }
    });

    // Only render on demand — this figure has no continuous animation.
    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const e of EL) {
        const c = cell(e);
        const col = pal.series[ORIGIN_COLOR[e.origin]];
        const isSel = e === selected, isHov = e === hover;
        ctx.globalAlpha = isSel ? 1 : isHov ? 0.9 : 0.75;
        ctx.fillStyle = col;
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.globalAlpha = 1;
        if (isSel) { ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2); }
        ctx.fillStyle = '#0b0b0b';
        ctx.font = `bold ${Math.max(9, Math.min(14, c.w * 0.32))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.sym, c.x + c.w / 2, c.y + c.h / 2 + 1);
      }
      // legend
      const legendY = H - 20;
      let lx = 12;
      ctx.font = '11px Inter, system-ui, sans-serif';
      const seen = new Set<Origin>();
      for (const e of EL) {
        if (seen.has(e.origin)) continue;
        seen.add(e.origin);
        ctx.fillStyle = pal.series[ORIGIN_COLOR[e.origin]];
        ctx.fillRect(lx, legendY, 10, 10);
        ctx.fillStyle = pal.muted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = ORIGIN_LABEL[e.origin];
        ctx.fillText(label, lx + 14, legendY + 5);
        lx += 14 + ctx.measureText(label).width + 18;
      }
      if (selected) {
        ctx.fillStyle = pal.fg;
        ctx.font = '13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${selected.sym} (Z=${selected.Z}): ${ORIGIN_LABEL[selected.origin]}`, 12, 6);
      }
    }

    const loop = new Loop(null, render, 1 / 15);
    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    const note = panel.readout('Note');
    const showNote = () => note.set(selected ? selected.note : '');
    showNote();
    stage.canvas.addEventListener('pointerdown', showNote);

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
