// Chapter 18 secondary figure: the P–Ṗ diagram. A representative (illustrative, not survey-complete)
// population of pulsars on log P vs log Ṗ axes, with constant-B and constant-age diagonals, an
// approximate death line, and a draggable pulsar you can evolve forward along its spin-down track.
//
// Magnetic dipole spin-down at fixed B gives Ṗ·P = const, i.e. d(P²)/dt = const: a pulsar climbs a
// straight diagonal line of constant B, moving down and to the right as it ages and slows.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt, superscript } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

const YEAR = 3.15576e7;
const bOf = (P: number, Pdot: number) => 3.2e19 * Math.sqrt(Math.max(P * Pdot, 0)); // Gauss
const ageOf = (P: number, Pdot: number) => P / (2 * Pdot); // s

type Cat = 'normal' | 'msp' | 'magnetar' | 'binary';
interface Pt { P: number; Pdot: number; cat: Cat; label?: string }

function population(): Pt[] {
  const pts: Pt[] = [];
  // Normal pulsars: broad band, B ~ 1e11-1e13 G, ages 1e4-1e8 yr
  for (let i = 0; i < 140; i++) {
    const P = Math.exp(Math.log(0.15) + (Math.random() - 0.5) * 2.2);
    const B = Math.pow(10, 11.3 + Math.random() * 1.9);
    const Pdot = (B / 3.2e19) ** 2 / P;
    pts.push({ P, Pdot, cat: 'normal' });
  }
  // Millisecond pulsars: P < 20 ms, very low B ~ 1e8-1e9.5 G
  for (let i = 0; i < 55; i++) {
    const P = Math.exp(Math.log(0.005) + (Math.random() - 0.5) * 1.6);
    const B = Math.pow(10, 8 + Math.random() * 1.6);
    const Pdot = (B / 3.2e19) ** 2 / P;
    pts.push({ P, Pdot, cat: 'msp' });
  }
  // Magnetars: P ~ 2-12s, B ~ 1e14-1e15.3
  for (let i = 0; i < 24; i++) {
    const P = Math.exp(Math.log(6) + (Math.random() - 0.5) * 1.3);
    const B = Math.pow(10, 14 + Math.random() * 1.3);
    const Pdot = (B / 3.2e19) ** 2 / P;
    pts.push({ P, Pdot, cat: 'magnetar' });
  }
  pts.push({ P: 0.0331, Pdot: 4.21e-13, cat: 'normal', label: 'Crab' });
  pts.push({ P: 0.0893, Pdot: 1.25e-13, cat: 'normal', label: 'Vela' });
  pts.push({ P: 1.3373, Pdot: 1.35e-15, cat: 'normal', label: 'B1919+21 (Bell)' });
  pts.push({ P: 0.0013962, Pdot: 9.6e-21, cat: 'msp', label: 'J1748−2446ad' });
  pts.push({ P: 0.05903, Pdot: 4.23e-18, cat: 'binary', label: 'Hulse–Taylor B1913+16' });
  pts.push({ P: 0.02295, Pdot: -2.65e-18, cat: 'binary', label: 'Double pulsar J0737−3039A' });
  return pts;
}

const CAT_COLOR = (pal: ReturnType<typeof palette>, cat: Cat) =>
  cat === 'normal' ? pal.series[0] : cat === 'msp' ? pal.series[1] : cat === 'magnetar' ? pal.bad : pal.good;
const CAT_LABEL: Record<Cat, string> = { normal: 'Normal pulsar', msp: 'Millisecond pulsar', magnetar: 'Magnetar', binary: 'Relativistic binary' };

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const stage = createStage(host, { aspect: 1.3 });
    const plot = new Plot(stage.canvas, {
      x: { min: 1e-3, max: 20, log: true, label: 'period P (s)' },
      y: { min: 1e-22, max: 1e-9, log: true, label: 'period derivative Ṗ (s/s)' },
      title: 'P–Ṗ diagram',
    });

    const pts = population();
    let drag: { P: number; Pdot: number } | null = { P: 0.3, Pdot: 1e-15 };
    let track: { P: number; Pdot: number }[] = [];
    let evolving = false;
    let ageMyr = 0;

    function bLine(B: number) {
      return (P: number) => (B / 3.2e19) ** 2 / P;
    }
    function ageLine(tauYr: number) {
      return (P: number) => P / (2 * tauYr * YEAR);
    }
    function deathLine(P: number) {
      return Math.pow(10, 3 * Math.log10(P) - 16.58);
    }

    const loop = new Loop((dt) => {
      if (evolving && drag) {
        const B = bOf(drag.P, drag.Pdot);
        const k = (B / 3.2e19) ** 2; // Pdot = k / P
        // dP/dt = Pdot = k/P  =>  d(P^2)/dt = 2k  => integrate exactly
        const yrPerSec = dt * ageMyrRate;
        ageMyr += yrPerSec;
        const P2 = drag.P * drag.P + 2 * k * (yrPerSec * 1e6 * YEAR);
        drag = { P: Math.sqrt(P2), Pdot: k / Math.sqrt(P2) };
        track.push({ ...drag });
        if (track.length > 400) track.shift();
        if (drag.Pdot < deathLine(drag.P) * 0.3 || drag.P > 15) evolving = false;
      }
    }, render, 1 / 30);
    let ageMyrRate = 4; // Myr of pulsar age per real second while evolving

    function render() {
      const { width: W, height: H, dpr } = stage;
      plot.resize(W, H, dpr);
      plot.draw(() => {
        // death line
        plot.fn(deathLine, { color: pal.faint, dash: [2, 3] });
        plot.text('death line (approx.)', plot.px(0.07), plot.py(deathLine(0.07)) - 6, { color: pal.muted, size: 10, align: 'left' });
        // constant-B diagonals
        for (const B of [1e9, 1e11, 1e13, 1e15]) {
          plot.fn(bLine(B), { color: pal.grid, dash: [4, 3], width: 1 });
          plot.text(`B = 10${superscript(String(Math.round(Math.log10(B))))} G`, plot.px(0.0013), plot.py(bLine(B)(0.0013)) - 3, { color: pal.muted, size: 9, align: 'left' });
        }
        // constant-age diagonals
        for (const tau of [1e3, 1e6, 1e9]) {
          plot.fn(ageLine(tau), { color: pal.grid, dash: [1, 4], width: 1 });
          plot.text(`τ = 1 ${tau === 1e3 ? 'kyr' : tau === 1e6 ? 'Myr' : 'Gyr'}`, plot.px(14), plot.py(ageLine(tau)(14)) - 4, { color: pal.muted, size: 9, align: 'right' });
        }
        // population
        for (const p of pts) {
          plot.point(p.P, Math.abs(p.Pdot), { r: p.label ? 4.5 : 2.4, color: CAT_COLOR(pal, p.cat) });
          if (p.label) plot.text(p.label, plot.px(p.P) + 6, plot.py(Math.abs(p.Pdot)) - 4, { color: pal.fg, size: 10 });
        }
        // evolving track + marker
        if (track.length > 1) {
          plot.line(track.map((t) => t.P), track.map((t) => t.Pdot), { color: pal.accent, width: 2 });
        }
        if (drag) {
          plot.point(drag.P, drag.Pdot, { r: 6, color: pal.accent, stroke: pal.fg });
          plot.text(evolving || track.length ? 'your pulsar' : 'your pulsar (click to move)', plot.px(drag.P), plot.py(drag.Pdot) + 16, { color: pal.accent, size: 10 });
        }
      });
      if (drag) {
        bOut.set(`${fmt(bOf(drag.P, drag.Pdot), 3)} G`);
        ageOut.set(`${fmt(ageOf(drag.P, drag.Pdot) / YEAR, 3)} yr`);
      }
    }

    stage.onResize(() => loop.invalidate());
    const el = stage.canvas;
    el.style.cursor = 'crosshair';
    el.addEventListener('pointerdown', (e) => {
      const b = el.getBoundingClientRect();
      const P = plot.dx(e.clientX - b.left), Pdot = plot.dy(e.clientY - b.top);
      if (P > 0 && Pdot > 0) { drag = { P, Pdot }; track = []; ageMyr = 0; evolving = false; loop.invalidate(); }
    });

    const panel = new Panel(host);
    panel.button('Evolve at constant B', () => { evolving = !evolving; loop.invalidate(); }, true);
    panel.slider('Ageing speed', { min: 0.2, max: 40, value: ageMyrRate, log: true, unit: 'Myr/s' }, (v) => (ageMyrRate = v));
    panel.button('Clear track', () => { track = []; ageMyr = 0; loop.invalidate(); });
    const bOut = panel.readout('B ≈');
    const ageOut = panel.readout('τc ≈');
    panel.spacer();
    for (const cat of ['normal', 'msp', 'magnetar', 'binary'] as Cat[]) {
      const r = panel.readout('');
      r.set(CAT_LABEL[cat]);
      r.el.style.color = CAT_COLOR(pal, cat);
    }

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
