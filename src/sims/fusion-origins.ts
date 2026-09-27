// Secondary figure: a periodic table (Z = 1–94) coloured by the dominant cosmic origin of each
// element in the Solar System, in the style of Johnson (2019, Science 363, 474). Most elements
// have several sources; we colour by the largest one and say so in the note. Click an element.

import { defineSim, createStage, Loop } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Origin = 'bigbang' | 'cosmic' | 'lowmass' | 'massive' | 'wd' | 'ns' | 'decay' | 'human';
const ORIGINS: { id: Origin; label: string; color: string; ink: string }[] = [
  { id: 'bigbang', label: 'Big Bang', color: '#7cb7ff', ink: '#0b0d12' },
  { id: 'cosmic', label: 'Cosmic-ray spallation', color: '#b89cff', ink: '#0b0d12' },
  { id: 'lowmass', label: 'Dying low-mass stars (AGB, s-process)', color: '#7fcf9a', ink: '#0b0d12' },
  { id: 'massive', label: 'Exploding massive stars', color: '#f0b35a', ink: '#0b0d12' },
  { id: 'wd', label: 'Exploding white dwarfs (Type Ia)', color: '#6fd0cf', ink: '#0b0d12' },
  { id: 'ns', label: 'Merging neutron stars (r-process)', color: '#e68aab', ink: '#0b0d12' },
  { id: 'decay', label: 'Only as decay products of U/Th', color: '#77746d', ink: '#f2f0ea' },
  { id: 'human', label: 'Made by humans (traces natural)', color: '#d9d6cf', ink: '#0b0d12' },
];
const ORIGIN = Object.fromEntries(ORIGINS.map((o) => [o.id, o])) as Record<Origin, (typeof ORIGINS)[number]>;

const SYMBOLS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
  'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
  'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu').split(' ');

// Dominant origin by Z (approximate; after Johnson 2019). Ranges are inclusive.
const RANGES: [number, number, Origin][] = [
  [1, 2, 'bigbang'], [3, 3, 'lowmass'], [4, 5, 'cosmic'], [6, 7, 'lowmass'], [8, 8, 'massive'], [9, 9, 'lowmass'],
  [10, 23, 'massive'], [24, 26, 'wd'], [27, 27, 'massive'], [28, 28, 'wd'], [29, 36, 'massive'],
  [37, 42, 'lowmass'], [43, 43, 'human'], [44, 47, 'ns'], [48, 50, 'lowmass'], [51, 55, 'ns'], [56, 60, 'lowmass'],
  [61, 61, 'human'], [62, 71, 'ns'], [72, 72, 'lowmass'], [73, 73, 'lowmass'], [74, 74, 'lowmass'], [75, 79, 'ns'],
  [80, 83, 'lowmass'], [84, 89, 'decay'], [90, 90, 'ns'], [91, 91, 'decay'], [92, 92, 'ns'], [93, 94, 'human'],
];
const NOTES: Record<number, string> = {
  1: 'Almost entirely primordial: made in the first few minutes after the Big Bang (Chapter 26).',
  2: 'About 25% of all mass was helium from the Big Bang; stars have added only a few per cent since.',
  3: 'A mixed bag: some primordial, some from cosmic rays, most from dying low-mass stars and novae.',
  4: 'Cosmic rays smashing interstellar C, N and O nuclei apart (spallation); stars destroy Be rather than make it.',
  5: 'Cosmic-ray spallation: with Li and Be, the exceptions to "made in stars".',
  6: 'Triple-alpha burning; roughly half from dying low-mass stars (AGB winds, planetary nebulae), half from massive stars.',
  7: 'A CNO-cycle by-product, dredged up and blown off by intermediate-mass AGB stars.',
  8: 'Helium burning in massive stars, ejected by core-collapse supernovae. The most abundant element after H and He.',
  14: 'Oxygen burning in massive stars and their supernovae; Type Ia explosions add a substantial share.',
  20: 'Explosive oxygen and silicon burning in core-collapse supernovae, plus a Type Ia share.',
  26: 'The iron peak: a bit over half of the Sun\'s iron came from Type Ia white-dwarf explosions, the rest from core collapse.',
  28: 'Made as radioactive ⁵⁶Ni, which powers supernova light curves and decays via ⁵⁶Co to ⁵⁶Fe; stable Ni is mostly Type Ia.',
  25: 'Manganese is the cleanest Type Ia signature: core-collapse supernovae make comparatively little.',
  38: 'The slow neutron-capture (s) process in AGB stars; strontium was also seen forming in the kilonova of GW170817.',
  43: 'No stable isotope. Its detection in red giants (Merrill, 1952) proved that stars forge elements now.',
  56: 'The classic s-process element, built in AGB stars.',
  61: 'No stable isotope; any made in stars has long since decayed.',
  63: 'The textbook r-process tracer, mostly from neutron-star mergers (and possibly rare supernovae).',
  79: 'Almost pure r-process. The kilonova of GW170817 (2017) made several Earth masses of heavy r-process elements.',
  78: 'r-process, neutron-star mergers (with some debate about rare magnetorotational supernovae).',
  82: 'The end point of the s-process in AGB stars, plus the decay of uranium and thorium.',
  90: 'r-process. Its 14-Gyr half-life makes it a cosmic clock for dating old stars.',
  92: 'r-process in neutron-star mergers; its decay (with thorium and potassium) still heats Earth\'s interior.',
  94: 'Made in reactors. A trace of ²⁴⁴Pu from a recent r-process event has been found in deep-sea crusts.',
};
const DEFAULT_NOTE: Record<Origin, string> = {
  bigbang: 'Primordial.',
  cosmic: 'Cosmic-ray spallation.',
  lowmass: 'Mostly the s-process (slow neutron capture) in AGB stars, with an r-process share.',
  massive: 'Hydrostatic and explosive burning in massive stars, ejected by core-collapse supernovae.',
  wd: 'Mostly Type Ia supernovae (exploding white dwarfs), with a core-collapse share.',
  ns: 'Mostly the rapid neutron-capture (r) process, whose main known site is merging neutron stars.',
  decay: 'No long-lived isotope: found in nature only as a short-lived link in the decay chains of uranium and thorium.',
  human: 'No stable isotope; essentially all of it on Earth was made in reactors or accelerators.',
};

interface El { Z: number; sym: string; row: number; col: number; origin: Origin }
function position(Z: number): [number, number] {
  if (Z === 1) return [1, 1];
  if (Z === 2) return [1, 18];
  if (Z <= 18) { const p = Z <= 10 ? 2 : 3, i = Z - (p === 2 ? 3 : 11); return [p, i < 2 ? i + 1 : i + 11]; }
  if (Z <= 54) { const p = Z <= 36 ? 4 : 5; return [p, Z - (p === 4 ? 18 : 36)]; }
  if (Z <= 56) return [6, Z - 54];
  if (Z <= 71) return [9, Z - 57 + 3]; // lanthanides (separate row)
  if (Z <= 86) return [6, Z - 72 + 4];
  if (Z <= 88) return [7, Z - 86];
  return [10, Z - 89 + 3]; // actinides
}
const EL: El[] = SYMBOLS.map((sym, i) => {
  const Z = i + 1;
  const [row, col] = position(Z);
  const origin = RANGES.find(([a, b]) => Z >= a && Z <= b)![2];
  return { Z, sym, row, col, origin };
});

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 1.75 });
    const ctx = stage.canvas.getContext('2d')!;
    let selected: El = EL[78]; // gold
    let hover: El | null = null;

    // HTML legend (wraps on narrow screens)
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;padding:8px 10px 0;font-family:var(--font-ui);font-size:0.74rem;color:var(--fg-muted);';
    for (const o of ORIGINS) {
      const item = document.createElement('span');
      item.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';
      const sw = document.createElement('span');
      sw.style.cssText = `width:10px;height:10px;border-radius:2px;background:${o.color};display:inline-block;`;
      item.append(sw, o.label);
      legend.append(item);
    }
    host.append(legend);

    const COLS = 18, ROWS = 10; // 7 periods, a gap row, then the two f-block rows
    function cell(e: { row: number; col: number }) {
      const cw = (stage.width - 8) / COLS, ch = (stage.height - 8) / (ROWS - 0.45);
      const y = 4 + (e.row - 1) * ch - (e.row >= 9 ? ch * 0.55 : 0);
      return { x: 4 + (e.col - 1) * cw, y, w: cw - 2, h: ch - 2 };
    }
    function hitTest(px: number, py: number): El | null {
      for (const e of EL) { const c = cell(e); if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) return e; }
      return null;
    }
    stage.canvas.addEventListener('pointermove', (ev) => {
      const r = stage.canvas.getBoundingClientRect();
      const h = hitTest(ev.clientX - r.left, ev.clientY - r.top);
      if (h !== hover) { hover = h; stage.canvas.style.cursor = hover ? 'pointer' : 'default'; loop.invalidate(); }
    });
    stage.canvas.addEventListener('pointerdown', (ev) => {
      const r = stage.canvas.getBoundingClientRect();
      const hit = hitTest(ev.clientX - r.left, ev.clientY - r.top);
      if (hit) { selected = hit; showNote(); loop.invalidate(); }
    });

    let dirty = true;
    function render() {
      if (!dirty) return;
      dirty = false;
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const c0 = cell({ row: 1, col: 1 });
      const fs = Math.max(8, Math.min(14, c0.w * 0.36));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const e of EL) {
        const c = cell(e);
        const o = ORIGIN[e.origin];
        ctx.globalAlpha = e === selected || e === hover ? 1 : 0.85;
        ctx.fillStyle = o.color;
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.globalAlpha = 1;
        if (e === selected) { ctx.strokeStyle = pal.fg; ctx.lineWidth = 2; ctx.strokeRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2); }
        ctx.fillStyle = o.ink;
        ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
        ctx.fillText(e.sym, c.x + c.w / 2, c.y + c.h / 2 + 1);
      }
      // f-block placeholders in the main table
      ctx.fillStyle = pal.faint;
      ctx.font = `${Math.max(7, fs * 0.7)}px Inter, system-ui, sans-serif`;
      for (const [row, label] of [[6, '57–71'], [7, '89–']] as const) {
        const c = cell({ row, col: 3 });
        ctx.fillText(label, c.x + c.w / 2, c.y + c.h / 2);
      }
    }

    const loop = new Loop(null, render, 1 / 15);
    const inv = loop.invalidate.bind(loop);
    loop.invalidate = () => { dirty = true; inv(); };
    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);
    const note = panel.readout('');
    function showNote() {
      const o = ORIGIN[selected.origin];
      note.set(`${selected.sym} (Z = ${selected.Z}) · ${o.label}. ${NOTES[selected.Z] ?? DEFAULT_NOTE[selected.origin]}`);
    }
    showNote();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
