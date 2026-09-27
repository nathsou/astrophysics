// Chapter 1: the magnitude scale. Two objects on the (reversed, logarithmic) magnitude axis,
// their flux ratio 10^(0.4 Δm), and the distance modulus: drag star A to a new distance.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

// name, apparent V magnitude, distance pc (0 = not a star / not meaningful), Teff
type Obj = [string, number, number, number];
const OBJ: Obj[] = [
  ['Sun', -26.74, 4.848e-6, 5772], ['Sirius', -1.46, 2.64, 9940], ['Canopus', -0.74, 95, 7350],
  ['α Centauri A', 0.01, 1.34, 5790], ['Arcturus', -0.05, 11.3, 4286], ['Vega', 0.03, 7.68, 9602],
  ['Rigel', 0.13, 260, 12100], ['Betelgeuse', 0.5, 168, 3600], ['Deneb', 1.25, 800, 8500],
  ['Polaris', 1.98, 133, 6015], ['τ Ceti', 3.5, 3.65, 5344], ['Proxima Centauri', 11.13, 1.3, 3042],
];
const MARKS: [number, string][] = [
  [-12.7, 'Full Moon'], [-4.6, 'Venus (max)'], [6, 'Naked-eye limit'], [3.44, 'Andromeda galaxy'],
  [14, 'Pluto'], [21, 'Gaia limit'], [24.5, 'Rubin 1 visit'], [30, 'Hubble UDF'], [31.5, 'JWST deepest'],
];

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const narrow = host.getBoundingClientRect().width < 560; // phones: stack the panels / taller plots
    const stage = createStage(host, { height: narrow ? 250 : 210 });
    const ctx = stage.canvas.getContext('2d')!;
    let a = 1, b = 9, dA = OBJ[1][2];
    const M = (o: Obj) => o[1] - 5 * Math.log10(o[2] / 10);
    const mA = () => M(OBJ[a]) + 5 * Math.log10(dA / 10);

    const lo = -28, hi = 33;
    const X = (m: number) => 20 + ((m - lo) / (hi - lo)) * (stage.width - 90); // right margin leaves room for the slanted labels

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const y0 = 120;
      // brightness gradient bar: bright on the left
      const g = ctx.createLinearGradient(X(lo), 0, X(hi), 0);
      g.addColorStop(0, pal.accent); g.addColorStop(0.5, pal.faint); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.globalAlpha = 0.25;
      ctx.fillRect(X(lo), y0 - 3, X(hi) - X(lo), 6);
      ctx.globalAlpha = 1;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let m = -25; m <= 30; m += 5) {
        ctx.strokeStyle = pal.axis;
        ctx.beginPath(); ctx.moveTo(X(m), y0 + 4); ctx.lineTo(X(m), y0 + 10); ctx.stroke();
        ctx.fillStyle = pal.muted; ctx.fillText(String(m).replace('-', '−'), X(m), y0 + 23);
      }
      ctx.fillStyle = pal.faint;
      ctx.fillText('apparent magnitude m  (← brighter · fainter →)', W / 2, y0 + 40);
      ctx.textAlign = 'left';
      let lastMark = -1e9;
      MARKS.slice().sort((p, q) => p[0] - q[0]).forEach(([m, name], i) => {
        const x = X(m);
        if (x - lastMark < 13) return; // slanted labels need ~13 px of spacing
        lastMark = x;
        ctx.fillStyle = pal.faint;
        ctx.fillRect(x - 0.5, y0 - 10, 1, 10);
        ctx.save(); ctx.translate(x + 3, y0 - 12); ctx.rotate(-0.6);
        ctx.fillStyle = pal.muted; ctx.fillText(name, 0, 0); ctx.restore();
        void i;
      });
      // each label hangs away from the other star's marker so it never crosses its dashed line
      const drawStar = (m: number, other: number, o: Obj, col: string, label: string, up: boolean) => {
        const x = X(m), tw = ctx.measureText(label).width;
        ctx.fillStyle = blackbodyCSS(o[3]);
        ctx.beginPath(); ctx.arc(x, y0, 6, 0, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = col;
        let left = m < other || (m === other && up);
        if (left && x - 5 - tw < 4) left = false;
        if (!left && x + 5 + tw > stage.width - 4) left = true;
        ctx.textAlign = left ? 'right' : 'left';
        ctx.fillText(label, left ? x - 5 : x + 5, up ? y0 + 58 : y0 + 74);
        ctx.textAlign = 'left';
      };
      const ma = mA(), mb = OBJ[b][1];
      // bracket showing Δm
      const xa = X(ma), xb = X(mb);
      ctx.strokeStyle = pal.accent; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(xa, y0 + 8); ctx.lineTo(xa, H - 8); ctx.moveTo(xb, y0 + 8); ctx.lineTo(xb, H - 8); ctx.stroke();
      ctx.setLineDash([]);
      drawStar(ma, mb, OBJ[a], pal.series[0], `A: ${OBJ[a][0]} (m = ${ma.toFixed(2).replace('-', '−')})`, true);
      drawStar(mb, ma, OBJ[b], pal.series[1], `B: ${OBJ[b][0]} (m = ${mb.toFixed(2).replace('-', '−')})`, false);
      const dm = mb - ma;
      ctx.fillStyle = pal.fg; ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.fillText(`Δm = ${Math.abs(dm).toFixed(2)}  ⇒  ${dm >= 0 ? 'A' : 'B'} is ${fmt(10 ** (0.4 * Math.abs(dm)), 3)}× brighter${narrow ? '' : ` than ${dm >= 0 ? 'B' : 'A'}`}`, 14, 22);
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = pal.muted;
      const MA = M(OBJ[a]), MB = M(OBJ[b]);
      const mm = (v: number) => v.toFixed(2).replace('-', '−');
      ctx.fillText(narrow ? `M = ${mm(MA)} (A), ${mm(MB)} (B) ⇒ L_A : L_B = ${fmt(10 ** (0.4 * (MB - MA)), 3)}` : `Absolute magnitudes: M = ${mm(MA)} (A), ${mm(MB)} (B)  ⇒  luminosity ratio A : B = ${fmt(10 ** (0.4 * (MB - MA)), 3)}`, 14, 40);
      ctx.fillText(narrow ? `A at ${fmt(dA, 3)} pc: m − M = ${mm(ma - MA)}` : `A at ${fmt(dA, 3)} pc: distance modulus m − M = 5 log₁₀(d / 10 pc) = ${mm(ma - MA)}`, 14, 56);
    }

    const loop = new Loop(null, render);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());

    const panel = new Panel(host);
    const opts = OBJ.map((o, i) => ({ value: String(i), label: o[0] }));
    let dSlider: ReturnType<Panel['slider']>;
    panel.select('Star A', opts, String(a), (v) => { a = +v; dA = OBJ[a][2]; dSlider.set(dA); loop.invalidate(); });
    panel.select('Star B', opts, String(b), (v) => { b = +v; loop.invalidate(); });
    dSlider = panel.slider('Move A to', { min: 4.848e-6, max: 1e6, value: dA, log: true, unit: 'pc', format: (v) => fmt(v, 3) }, (v) => { dA = v; loop.invalidate(); });
    panel.button('Real distance', () => { dA = OBJ[a][2]; dSlider.set(dA); loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
