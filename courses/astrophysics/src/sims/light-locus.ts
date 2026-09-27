// Chapter 4, figure: the blackbody colour locus — perceived colour vs. temperature, 1000–40000 K,
// with real stars placed on it. Explains "why there are no green stars": Planck spectra are broad,
// so no temperature makes the eye's medium-wavelength cones fire much harder than both others.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyRGB } from '../lib/physics/blackbody';

const T_MIN = 1000, T_MAX = 40000;

const STARS: { name: string; T: number }[] = [
  { name: 'Betelgeuse', T: 3600 },
  { name: 'Sun', T: 5772 },
  { name: 'Procyon A', T: 6530 },
  { name: 'Sirius A', T: 9940 },
  { name: 'Vega', T: 9600 },
  { name: 'Rigel', T: 12100 },
  { name: 'Spica', T: 22400 },
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 5 / 1.1 });
    const ctx = stage.canvas.getContext('2d')!;
    let T = 5772;

    function tAt(frac: number) {
      // perceptual-ish spacing: colour changes fastest at low T, so use log spacing
      return T_MIN * (T_MAX / T_MIN) ** frac;
    }
    function fracAt(Tv: number) {
      return Math.log(Tv / T_MIN) / Math.log(T_MAX / T_MIN);
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const stripY = H * 0.38, stripH = H * 0.34;
      const marL = 10, marR = 10;
      const pw = W - marL - marR;
      // draw the strip
      for (let px = 0; px < pw; px++) {
        const Tv = tAt(px / pw);
        const [r, g, b] = blackbodyRGB(Tv);
        ctx.fillStyle = `rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0})`;
        ctx.fillRect(marL + px, stripY, 1, stripH);
      }
      ctx.strokeStyle = pal.rule;
      ctx.strokeRect(marL + 0.5, stripY + 0.5, pw - 1, stripH - 1);

      // ticks
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'center';
      for (const Tv of [1000, 2000, 4000, 6000, 10000, 20000, 40000]) {
        const x = marL + fracAt(Tv) * pw;
        ctx.strokeStyle = pal.axis;
        ctx.beginPath(); ctx.moveTo(x, stripY + stripH); ctx.lineTo(x, stripY + stripH + 5); ctx.stroke();
        ctx.fillText(`${Tv >= 1000 ? Tv / 1000 + 'k' : Tv}`, x, stripY + stripH + 17);
      }

      // stars placed on the locus
      ctx.textBaseline = 'bottom';
      STARS.forEach((s, i) => {
        const x = marL + fracAt(s.T) * pw;
        const y = stripY - 8 - (i % 2) * 16;
        ctx.strokeStyle = pal.fg;
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, stripY); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal.fg;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal.muted;
        ctx.fillText(`${s.name}`, x, y - 5);
      });

      // current-T marker (draggable)
      const xT = marL + fracAt(T) * pw;
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.moveTo(xT, stripY - 2); ctx.lineTo(xT - 6, stripY - 12); ctx.lineTo(xT + 6, stripY - 12);
      ctx.closePath(); ctx.fill();

      readout.set(`T = ${fmt(T, 4)} K — drag the strip, or use the slider`);
    }

    const loop = new Loop(null, render, 1 / 30);
    stage.onResize(() => loop.invalidate());

    function setFromClientX(clientX: number) {
      const rect = stage.canvas.getBoundingClientRect();
      const marL = 10, marR = 10;
      const frac = Math.max(0, Math.min(1, (clientX - rect.left - marL) / (rect.width - marL - marR)));
      T = tAt(frac);
      slider.set(T);
      loop.invalidate();
    }
    let dragging = false;
    stage.canvas.style.cursor = 'ew-resize';
    stage.canvas.addEventListener('pointerdown', (e) => { dragging = true; setFromClientX(e.clientX); });
    window.addEventListener('pointermove', (e) => { if (dragging) setFromClientX(e.clientX); });
    window.addEventListener('pointerup', () => { dragging = false; });

    const panel = new Panel(host);
    const slider = panel.slider('Temperature', { min: T_MIN, max: T_MAX, value: T, log: true, unit: 'K', format: (v) => String(Math.round(v)) }, (v) => { T = v; loop.invalidate(); });
    const readout = panel.readout('');

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => loop.destroy(),
    };
  },
});
