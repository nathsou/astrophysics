// Secondary figure: mean-motion resonances carve gaps in the asteroid belt.
//
// Massless test asteroids orbit the Sun; Jupiter follows a fixed Keplerian ellipse (e = 0.048).
// We integrate in heliocentric coordinates with a Wisdom–Holman splitting: an exact Kepler drift
// around the Sun (f and g functions) sandwiched between two half-kicks from Jupiter's direct pull
// and the indirect term (the Sun's own acceleration towards Jupiter). Because the dominant Kepler
// motion is exact, a 0.25-yr step (≈ 1/11 of the shortest orbit) preserves the resonant dynamics
// that a plain leapfrog at the same step destroys.
//
// Resonant asteroids have their eccentricity pumped until their perihelion crosses Mars' orbit
// (q < 1.67 AU) or their aphelion approaches Jupiter (Q > 4.5 AU); we remove them there, which is
// what close encounters do in the real Solar System. Real clearing takes Myr, so Jupiter's mass
// is boosted by default to compress it into seconds.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyCSS } from '../lib/physics/blackbody';

const GM = 4 * Math.PI * Math.PI; // AU³/yr² for 1 M☉
const aJ = 5.2, eJ = 0.048;
const MJ = 1 / 1047; // Jupiter / Sun
const A_MIN = 2.0, A_MAX = 3.6;
const N = 400;
const DT = 0.25; // yr
const Q_MARS = 1.67, Q_JUP = 4.5;

export default defineSim({
  mount({ host }) {
    let pal = palette();

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;gap:2px;';
    host.append(wrap);
    const left = document.createElement('div');
    const right = document.createElement('div');
    left.style.minWidth = right.style.minWidth = '0';
    right.style.cssText += 'display:flex;flex-direction:column;';
    wrap.append(left, right);
    const stage = createStage(left, { aspect: 1 });
    const histStage = createStage(right, { aspect: 1.5 });
    const ctx = stage.canvas.getContext('2d')!;
    const layout = () => {
      const wide = host.clientWidth >= 620;
      wrap.style.gridTemplateColumns = wide ? 'minmax(0,1fr) minmax(0,1.25fr)' : 'minmax(0,1fr)';
      histStage.el.style.aspectRatio = wide ? 'auto' : '1.6';
      histStage.el.style.flex = wide ? '1 1 auto' : '';
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(host);

    const hist = new Plot(histStage.canvas, {
      x: { min: A_MIN, max: A_MAX, label: 'starting semi-major axis (AU)' },
      y: { min: 0, max: 1, label: 'surviving asteroids' },
      title: 'Survivors by starting orbit',
      grid: true,
    });

    const a0 = new Float64Array(N);
    const pos = new Float64Array(N * 2);
    const vel = new Float64Array(N * 2);
    const ecc = new Float64Array(N);
    const alive = new Uint8Array(N);
    const gone = new Float32Array(N * 3); // x, y, age (s) of recently removed asteroids
    let years = 0, lostMars = 0, lostJup = 0;

    function reset() {
      for (let i = 0; i < N; i++) {
        const a = A_MIN + ((A_MAX - A_MIN) * (i + Math.random())) / N;
        const e = 0.02 + Math.random() * 0.08;
        const M = Math.random() * 2 * Math.PI, w = Math.random() * 2 * Math.PI;
        let E = M;
        for (let k = 0; k < 12; k++) E = M + e * Math.sin(E);
        const n = Math.sqrt(GM / (a * a * a)), den = 1 - e * Math.cos(E);
        const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
        const vxp = (-a * n * Math.sin(E)) / den, vyp = (a * n * Math.sqrt(1 - e * e) * Math.cos(E)) / den;
        const c = Math.cos(w), s = Math.sin(w);
        pos[2 * i] = c * xp - s * yp; pos[2 * i + 1] = s * xp + c * yp;
        vel[2 * i] = c * vxp - s * vyp; vel[2 * i + 1] = s * vxp + c * vyp;
        a0[i] = a; ecc[i] = e; alive[i] = 1; gone[3 * i + 2] = 99;
      }
      years = 0; lostMars = 0; lostJup = 0;
    }
    reset();

    const s = { yrPerSec: 300, jupMass: 10 }; // 300 yr/s keeps the CPU integrator under ~2 ms per frame

    function jupiterAt(t: number): [number, number] {
      const n = Math.sqrt((GM * (1 + MJ * s.jupMass)) / (aJ * aJ * aJ));
      const M = n * t;
      let E = M;
      for (let k = 0; k < 6; k++) E = M + eJ * Math.sin(E);
      return [aJ * (Math.cos(E) - eJ), aJ * Math.sqrt(1 - eJ * eJ) * Math.sin(E)];
    }

    /** Half-kick from Jupiter (direct + indirect term) at time t. */
    function kick(t: number, h: number) {
      const GMJ = GM * MJ * s.jupMass;
      if (GMJ === 0) return;
      const [jx, jy] = jupiterAt(t);
      const rj = Math.hypot(jx, jy), ind = GMJ / (rj * rj * rj);
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        const dx = pos[2 * i] - jx, dy = pos[2 * i + 1] - jy;
        const d2 = dx * dx + dy * dy, id3 = GMJ / (d2 * Math.sqrt(d2));
        vel[2 * i] -= (dx * id3 + jx * ind) * h;
        vel[2 * i + 1] -= (dy * id3 + jy * ind) * h;
      }
    }

    /** Exact Kepler drift around the Sun via f and g functions (elliptic orbits only). */
    function drift(i: number, h: number): boolean {
      const x = pos[2 * i], y = pos[2 * i + 1], vx = vel[2 * i], vy = vel[2 * i + 1];
      const r0 = Math.hypot(x, y);
      const ia = 2 / r0 - (vx * vx + vy * vy) / GM;
      if (ia <= 0) return false;
      const a = 1 / ia, n = Math.sqrt(GM * ia * ia * ia), sa = Math.sqrt(a);
      const sig = (x * vx + y * vy) / Math.sqrt(GM);
      const c1 = 1 - r0 / a, c2 = sig / sa, M = n * h;
      let E = M; // ΔE: solve n h = ΔE − c1 sin ΔE + c2 (1 − cos ΔE)
      for (let k = 0; k < 10; k++) {
        const sE = Math.sin(E), cE = Math.cos(E);
        const d = (E - c1 * sE + c2 * (1 - cE) - M) / (1 - c1 * cE + c2 * sE);
        E -= d;
        if (Math.abs(d) < 1e-12) break;
      }
      const sE = Math.sin(E), cE = Math.cos(E);
      const f = 1 - (a / r0) * (1 - cE), g = h + (sE - E) / n;
      const r = a + (r0 - a) * cE + sig * sa * sE;
      const fd = (-Math.sqrt(GM * a) / (r * r0)) * sE, gd = 1 - (a / r) * (1 - cE);
      pos[2 * i] = f * x + g * vx; pos[2 * i + 1] = f * y + g * vy;
      vel[2 * i] = fd * x + gd * vx; vel[2 * i + 1] = fd * y + gd * vy;
      return true;
    }

    function remove(i: number, jup: boolean) {
      alive[i] = 0;
      gone[3 * i] = pos[2 * i]; gone[3 * i + 1] = pos[2 * i + 1]; gone[3 * i + 2] = 0;
      if (jup) lostJup++; else lostMars++;
    }

    let pending = 0;
    function step(h: number) {
      for (let i = 0; i < N; i++) gone[3 * i + 2] += h;
      pending += s.yrPerSec * h;
      while (pending >= DT) {
        pending -= DT;
        kick(years, DT / 2);
        for (let i = 0; i < N; i++) if (alive[i] && !drift(i, DT)) remove(i, true);
        kick(years + DT, DT / 2);
        years += DT;
        for (let i = 0; i < N; i++) {
          if (!alive[i]) continue;
          const x = pos[2 * i], y = pos[2 * i + 1], vx = vel[2 * i], vy = vel[2 * i + 1];
          const r = Math.hypot(x, y), ia = 2 / r - (vx * vx + vy * vy) / GM;
          if (ia <= 0) { remove(i, true); continue; }
          const a = 1 / ia, hz = x * vy - y * vx;
          const e = Math.sqrt(Math.max(0, 1 - (hz * hz) / (GM * a)));
          ecc[i] = e;
          if (a * (1 - e) < Q_MARS) remove(i, false);
          else if (a * (1 + e) > Q_JUP) remove(i, true);
        }
      }
    }

    const BINS = 40;
    const counts = new Float64Array(BINS);
    const resonances: [number, string][] = [
      [aJ * Math.pow(1 / 3, 2 / 3), '3:1'],
      [aJ * Math.pow(2 / 5, 2 / 3), '5:2'],
      [aJ * Math.pow(1 / 2, 2 / 3), '2:1'],
    ];

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const scale = (Math.min(W, H) / 2 - 14) / (aJ * (1 + eJ));
      const cx = W / 2, cy = H / 2;
      const font = '11px JetBrains Mono, ui-monospace, monospace';

      // reference circles: Mars, resonances, Jupiter's orbit
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.faint; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, 1.52 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = pal.bad; ctx.globalAlpha = 0.55;
      for (const [a] of resonances) { ctx.beginPath(); ctx.arc(cx, cy, a * scale, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
      ctx.strokeStyle = pal.faint;
      ctx.beginPath(); ctx.ellipse(cx - aJ * eJ * scale, cy, aJ * scale, aJ * Math.sqrt(1 - eJ * eJ) * scale, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = pal.muted; ctx.font = font; ctx.textAlign = 'center';
      ctx.fillText('Mars', cx, cy - 1.52 * scale - 4);

      // asteroids: blue = near-circular, orange = eccentricity pumped above 0.2 (series[1] is blue)
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        ctx.fillStyle = ecc[i] > 0.2 ? pal.accent : pal.series[1];
        ctx.fillRect(cx + pos[2 * i] * scale - 1.2, cy - pos[2 * i + 1] * scale - 1.2, 2.4, 2.4);
      }
      // recently removed: a fading red ring where each one left
      ctx.strokeStyle = pal.bad;
      for (let i = 0; i < N; i++) {
        const age = gone[3 * i + 2];
        if (age > 1.2) continue;
        ctx.globalAlpha = 1 - age / 1.2;
        ctx.beginPath(); ctx.arc(cx + gone[3 * i] * scale, cy - gone[3 * i + 1] * scale, 3 + 6 * age, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const sunR = 5;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 2.5);
      g.addColorStop(0, blackbodyCSS(5772)); g.addColorStop(0.4, blackbodyCSS(5772)); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sunR * 2.5, 0, Math.PI * 2); ctx.fill();

      const [jx, jy] = jupiterAt(years);
      const sx = cx + jx * scale, sy = cy - jy * scale;
      ctx.fillStyle = '#d9a66b';
      ctx.beginPath(); ctx.arc(sx, sy, 3 + Math.min(5, 1.2 * Math.cbrt(s.jupMass) + 2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.fg; ctx.font = font;
      ctx.textAlign = sx > cx ? 'right' : 'left';
      ctx.fillText(`Jupiter ×${fmt(s.jupMass, 2)}`, sx + (sx > cx ? -12 : 12), sy + 4);

      // histogram of survivors by starting semi-major axis
      counts.fill(0);
      for (let i = 0; i < N; i++) {
        if (!alive[i]) continue;
        const b = Math.floor(((a0[i] - A_MIN) / (A_MAX - A_MIN)) * BINS);
        if (b >= 0 && b < BINS) counts[b]++;
      }
      const full = N / BINS;
      hist.o.y.max = Math.ceil(full * 1.3);
      hist.draw(() => {
        const c = hist.ctx;
        for (let b = 0; b < BINS; b++) {
          const x0 = hist.px(A_MIN + ((A_MAX - A_MIN) * b) / BINS), x1 = hist.px(A_MIN + ((A_MAX - A_MIN) * (b + 1)) / BINS);
          const y0 = hist.py(0), y1 = hist.py(counts[b]);
          c.fillStyle = pal.series[1];
          c.globalAlpha = 0.85;
          c.fillRect(x0 + 0.5, y1, Math.max(1, x1 - x0 - 1), y0 - y1);
        }
        c.globalAlpha = 1;
        hist.hline(full, { color: pal.muted, dash: [4, 4], label: 'at start' });
        for (const [a, label] of resonances) hist.vline(a, { color: pal.bad, dash: [3, 3], label });
      });

      readout.set(
        `t = ${fmt(years, 3)} yr (${fmt(years / Math.pow(aJ, 1.5), 3)} Jupiter orbits) · removed ${lostMars + lostJup} of ${N}: ` +
        `${lostMars} crossed Mars, ${lostJup} approached Jupiter`,
      );
    }

    const loop = new Loop(step, render, 1 / 60);
    stage.onResize(() => loop.invalidate());
    histStage.onResize((w, h, d) => { hist.resize(w, h, d); loop.invalidate(); });
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const panel = new Panel(host);
    panel.playPause(() => loop.paused, (p) => (loop.paused = p));
    panel.button('Reset', () => { reset(); loop.invalidate(); });
    panel.slider('Speed', { min: 50, max: 1000, value: s.yrPerSec, log: true, step: 1, unit: 'yr/s' }, (v) => (s.yrPerSec = v));
    panel.slider('Jupiter mass ×', { min: 0, max: 20, value: s.jupMass, step: 0.5 }, (v) => { s.jupMass = v; loop.invalidate(); });
    const readout = panel.readout('');

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => { loop.destroy(); ro.disconnect(); },
    };
  },
});
