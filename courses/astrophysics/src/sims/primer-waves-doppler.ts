// Appendix A8: the Doppler effect. A source moving at speed v emits a crest every period;
// each crest is a circle expanding at the wave speed from the point where it was emitted.
// Sound: crests bunch up ahead, stretch out behind, and pile into a Mach cone for v > c_s.
// Light: the same geometry, plus time dilation of the source's clock (emission period γT₀),
// which gives the relativistic formula and a transverse redshift.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';
import { wavelengthRGB } from '../lib/physics/blackbody';

type Mode = 'sound' | 'light';

export default defineSim({
  mount({ host }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;

    // World units: the view is 16 × 9 units, wave speed 1.6 units/s, rest period 0.45 s.
    // On a phone the view is narrower (10 units) and squarer, so the crests stay a readable size.
    let VW = 16;
    const C = 1.6, T0 = 0.45;
    let mode: Mode = 'sound';
    let beta = 0.5;
    let t = 0, sx = 2, lastEmit = -1e9;
    const MAXF = 200;
    const fx = new Float64Array(MAXF), ft = new Float64Array(MAXF);
    let nf = 0, head = 0;

    function reset() { t = 0; sx = 1.5; lastEmit = -1e9; nf = 0; head = 0; }

    const gamma = () => (mode === 'light' ? 1 / Math.sqrt(1 - beta * beta) : 1);

    const loop = new Loop((dt) => {
      t += dt;
      sx += beta * C * dt;
      if (sx > VW + 1.5) { sx = -1.5; }
      const period = T0 * gamma();
      if (t - lastEmit >= period) {
        lastEmit = t;
        fx[head] = sx; ft[head] = t;
        head = (head + 1) % MAXF; nf = Math.min(nf + 1, MAXF);
      }
    }, render, 1 / 120);

    // observed frequency ratio f/f0 for an observer far away at angle θ from the direction of motion
    function ratio(cosTheta: number) {
      if (mode === 'sound') {
        const d = 1 - beta * cosTheta;
        return d > 0 ? 1 / d : Infinity;
      }
      return 1 / (gamma() * (1 - beta * cosTheta));
    }

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const s = W / VW;
      const cy = H / 2;
      // crests
      ctx.lineWidth = 1.4;
      for (let n = 0; n < nf; n++) {
        const j = (head - 1 - n + MAXF) % MAXF;
        const R = C * (t - ft[j]) * s;
        if (R > W * 1.6) continue;
        const age = (t - ft[j]) / 8;
        ctx.globalAlpha = Math.max(0.12, 0.9 - age);
        ctx.strokeStyle = mode === 'sound' ? pal.accent2 : pal.accent;
        ctx.beginPath(); ctx.arc(fx[j] * s, cy, Math.max(0.5, R), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Mach cone for supersonic sound
      if (mode === 'sound' && beta > 1) {
        const ang = Math.asin(1 / beta), L = W * 2;
        ctx.strokeStyle = pal.bad; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx * s - L * Math.cos(ang), cy - L * Math.sin(ang));
        ctx.lineTo(sx * s, cy);
        ctx.lineTo(sx * s - L * Math.cos(ang), cy + L * Math.sin(ang));
        ctx.stroke(); ctx.setLineDash([]);
      }
      // source
      ctx.fillStyle = pal.fg;
      ctx.beginPath(); ctx.arc(sx * s, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx * s + 10, cy); ctx.lineTo(sx * s + 10 + 22 * Math.min(beta, 1.5), cy); ctx.stroke();

      // observers: ahead (right), behind (left), side (top)
      const obs: [string, number, number, number][] = [
        ['ahead', W - 22, cy, 1],
        ['behind', 22, cy, -1],
        ['side', W / 2, 22, 0],
      ];
      ctx.font = '12px Inter, system-ui, sans-serif';
      for (const [name, X, Y, cosT] of obs) {
        const r = ratio(cosT);
        let col = pal.fg;
        if (mode === 'light') {
          const nm = 550 / r;
          if (nm >= 380 && nm <= 780) {
            const [R, G, B] = wavelengthRGB(nm).map((v) => Math.max(0, Math.min(1, v)) * 255);
            col = `rgb(${R | 0},${G | 0},${B | 0})`;
          } else col = pal.muted;
        }
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(X, Y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 1; ctx.stroke();
        const label = !Number.isFinite(r) ? `${name}: shock` : mode === 'light'
          ? `${name}: ${fmt(550 / r, 3)} nm`
          : `${name}: f = ${fmt(r, 3)} f₀`;
        ctx.fillStyle = pal.fg;
        ctx.textAlign = X > W * 0.7 ? 'right' : X < W * 0.3 ? 'left' : 'center';
        ctx.textBaseline = Y < H / 3 ? 'top' : 'bottom';
        ctx.fillText(label, X + (ctx.textAlign === 'right' ? -2 : ctx.textAlign === 'left' ? 2 : 0), Y < H / 3 ? Y + 12 : Y - 12);
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = pal.muted;
      ctx.fillText(mode === 'sound' ? `v = ${fmt(beta, 3)} × sound speed` : `v = ${fmt(beta, 3)} c   (source emits 550 nm)`, 12, H - 12);
    }

    stage.onResize((w) => {
      const narrow = w < 520;
      VW = narrow ? 10 : 16;
      const a = narrow ? '1.25' : String(16 / 9);
      if (stage.el.style.aspectRatio !== a) stage.el.style.aspectRatio = a;
      loop.invalidate();
    });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.select<Mode>('Wave', [
      { value: 'sound', label: 'Sound (in air)' },
      { value: 'light', label: 'Light (relativistic)' },
    ], mode, (v) => {
      mode = v;
      if (mode === 'light' && beta > 0.95) speed.set(0.95, true);
      reset(); update();
    });
    const speed = panel.slider('Source speed v / wave speed', { min: 0, max: 1.6, value: beta, step: 0.01 }, (v) => {
      beta = mode === 'light' ? Math.min(v, 0.95) : v;
      if (beta !== v) speed.set(beta);
      update();
    });
    const ra = panel.readout('Ahead');
    const rb = panel.readout('Behind');
    function update() {
      const a = ratio(1), b = ratio(-1);
      ra.set(Number.isFinite(a) ? `f = ${fmt(a, 3)} f₀` : 'shock wave (v ≥ c)');
      rb.set(mode === 'light' ? `f = ${fmt(b, 3)} f₀ (z = ${fmt(1 / b - 1, 3)})` : `f = ${fmt(b, 3)} f₀`);
      loop.invalidate();
    }
    update();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
