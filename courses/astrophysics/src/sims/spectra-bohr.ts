// Interactive Bohr hydrogen energy-level diagram. Click any two levels (or a preset series
// button) to see the transition: photon wavelength, colour, and which series it belongs to.
import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { bohrLevelEV, bohrWavelengthNM, SERIES } from './spectra/physics';
import { wavelengthRGB } from '../lib/physics/blackbody';

const N_MAX = 6;

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); draw(); });

    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { aspect: narrow ? 1.1 : 16 / 8 });
    const panel = new Panel(host);
    const info = panel.readout('Transition');
    panel.button('Clear', () => { picked = []; draw(); });

    let picked: number[] = [];
    let hoverN = -1;

    const yFor = (n: number, _h: number, top: number, bot: number) => {
      // E_n ∝ −1/n² crowds the upper levels against E = 0, so the vertical axis is stretched there:
      // height ∝ 1 − 1/n = 1 − √(E_n/E_1), monotonic in energy, with n → ∞ at the top line.
      const t = 1 - 1 / n;
      return bot - t * (bot - top);
    };

    function draw() {
      const dpr = stage.dpr;
      const w = stage.width, h = stage.height;
      const ctx = stage.canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const left = 60, right = w - 170, top = 20, bot = h - 30;

      ctx.strokeStyle = pal.grid;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      for (let n = 1; n <= N_MAX; n++) {
        const y = yFor(n, h, top, bot);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.strokeStyle = picked.includes(n) ? pal.accent : hoverN === n ? pal.fg : pal.grid;
        ctx.lineWidth = picked.includes(n) ? 2.5 : 1.25;
        ctx.stroke();
        ctx.fillStyle = pal.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`n=${n}`, left - 8, y);
        ctx.textAlign = 'left';
        ctx.fillText(`${bohrLevelEV(n).toFixed(2)} eV`, right + 8, y);
      }
      // Ionisation limit
      ctx.strokeStyle = pal.bad;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(right, top); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.bad;
      ctx.textAlign = 'left';
      ctx.fillText('n → ∞ (0 eV, ionised)', right + 8, top);

      // Series highlight (draw arrows for the currently hovered/selected series' first few lines)
      if (picked.length === 2) {
        const [a, b] = picked.slice().sort((x, y) => x - y);
        // emission: the electron drops from the upper level b to the lower level a; arrow in the photon's colour
        const nm = bohrWavelengthNM(a, b);
        const col = nm >= 380 && nm <= 780 ? `rgb(${wavelengthRGB(nm).map((v) => Math.round(v * 255)).join(',')})` : pal.accent;
        drawArrow(ctx, left, right, yFor(b, h, top, bot), yFor(a, h, top, bot), col);
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = pal.faint;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillText('energy axis stretched near 0 eV so the upper levels stay apart · click a level', left, bot + 20);
    }

    function drawArrow(ctx: CanvasRenderingContext2D, left: number, right: number, yHi: number, yLo: number, color: string) {
      const x = (left + right) / 2;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, yHi);
      ctx.lineTo(x, yLo);
      ctx.stroke();
      const dir = yLo > yHi ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x, yLo);
      ctx.lineTo(x - 5, yLo - 8 * dir);
      ctx.lineTo(x + 5, yLo - 8 * dir);
      ctx.closePath();
      ctx.fill();
    }

    function updateInfo() {
      if (picked.length !== 2) { info.set('click two levels'); return; }
      const [a, b] = picked.slice().sort((x, y) => x - y);
      const nm = bohrWavelengthNM(a, b);
      const [r, g, bl] = nm >= 380 && nm <= 780 ? wavelengthRGB(nm) : [0.6, 0.6, 0.6];
      const series = SERIES.find((s) => s.nLo === a)?.name ?? `n=${a} series`;
      info.el.querySelector('b')!.innerHTML =
        `${nm.toFixed(1)} nm · ${series} (n=${b}→${a}) <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:rgb(${(r * 255) | 0},${(g * 255) | 0},${(bl * 255) | 0});vertical-align:-1px;margin-left:4px"></span>`;
    }

    stage.canvas.addEventListener('pointerdown', (ev) => {
      const rect = stage.canvas.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      let best = -1, bestD = 1e9;
      const top = 20, bot = stage.height - 30;
      for (let n = 1; n <= N_MAX; n++) {
        const d = Math.abs(yFor(n, stage.height, top, bot) - y);
        if (d < bestD) { bestD = d; best = n; }
      }
      if (bestD > 24) return;
      if (picked.includes(best)) picked = picked.filter((n) => n !== best);
      else if (picked.length < 2) picked = [...picked, best];
      else picked = [best];
      updateInfo();
      draw();
    });

    for (const s of SERIES.slice(0, 3)) {
      panel.button(s.name, () => { picked = [s.nLo, s.nLo + 1]; updateInfo(); draw(); });
    }

    stage.onResize(() => draw());
    picked = [2, 3]; // start on Hα, the red Balmer line
    updateInfo();
    onDestroy(() => {});
    return { setVisible(v) { if (v) draw(); }, destroy() {} };
  },
});
