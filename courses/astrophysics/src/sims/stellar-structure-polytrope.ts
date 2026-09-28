// Chapter 11 flagship: "build a star" from a polytropic equation of state.
//
// The user picks a polytropic index n, a total mass M and radius R. We solve the (dimensionless)
// Lane–Emden equation once for that n with RK4 (see src/sims/stellar-structure/laneemden.ts), then
// rescale the solution to physical density/pressure/temperature profiles and draw:
//   - a glowing cross-section of the star, coloured by local blackbody temperature
//   - theta(xi) and the normalised rho/P/T/m profiles vs r/R
//   - central values and the rho_c / mean-rho concentration ratio
// Re-solving Lane–Emden happens only when n changes (not every frame); rescaling for M, R is O(1).

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';
import { blackbodyRGB } from '../lib/physics/blackbody';
import { G, Msun, Rsun, mp as MP, kB } from '../lib/physics/constants';
import { solveLaneEmden, buildStar, starAt, thetaAt, type LaneEmdenProfile, type StarModel } from './stellar-structure/laneemden';

// Approximate Standard Solar Model density profile (rho/rho_c vs r/R), digitised from standard tables.
const SSM: [number, number][] = [
  [0, 1], [0.05, 0.94], [0.1, 0.77], [0.15, 0.57], [0.2, 0.4], [0.25, 0.27],
  [0.3, 0.175], [0.35, 0.11], [0.4, 0.068], [0.45, 0.041], [0.5, 0.024],
  [0.6, 0.0078], [0.7, 0.0022], [0.8, 0.00045], [0.9, 0.00006], [1.0, 0],
];
function ssmDensityRatio(x: number): number {
  const clamped = Math.min(Math.max(x, 0), 1);
  let i = 0;
  while (i < SSM.length - 2 && SSM[i + 1][0] < clamped) i++;
  const [x0, y0] = SSM[i], [x1, y1] = SSM[i + 1];
  const t = x1 > x0 ? (clamped - x0) / (x1 - x0) : 0;
  return y0 + t * (y1 - y0);
}

const PRESETS: Record<string, { n: number; M: number; R: number }> = {
  'Sun (n=3)': { n: 3, M: 1, R: 1 },
  'Convective (n=1.5)': { n: 1.5, M: 0.3, R: 0.3 },
  'Eddington std (n=3)': { n: 3, M: 5, R: 3 },
  'Isothermal core (n=5)': { n: 4.9, M: 1, R: 1 },
};

export default defineSim({
  mount({ host, onDestroy }) {
    host.style.display = 'flex';
    host.style.flexWrap = 'wrap';
    host.style.gap = '12px';

    const diskWrap = document.createElement('div');
    diskWrap.style.flex = '1 1 260px';
    diskWrap.style.minWidth = '220px';
    diskWrap.style.maxWidth = '360px';
    const plotWrap = document.createElement('div');
    plotWrap.style.flex = '2 1 420px';
    plotWrap.style.minWidth = '280px';
    host.append(diskWrap, plotWrap);

    const diskStage = createStage(diskWrap, { aspect: 1 });
    const plotStage = createStage(plotWrap, { aspect: 16 / 11 });

    let pal = palette();
    onThemeChange(() => { pal = palette(); redraw(); });

    const plot = new Plot(plotStage.canvas, {
      x: { min: 0, max: 1, label: 'r / R' },
      y: { min: 0, max: 1, label: 'normalised value' },
    });

    const diskCtx = diskStage.canvas.getContext('2d')!;

    // ---- state
    let n = 3;
    let M = 1; // Msun
    let R = 1; // Rsun
    const mu = 0.62; // ionised H/He, ~solar composition
    let logY = false;
    let showSSM = true;
    let profile: LaneEmdenProfile = solveLaneEmden(n);
    let star: StarModel = buildStar(profile, M * Msun, R * Rsun, mu, G, MP, kB);

    function rebuildProfile() {
      profile = solveLaneEmden(n);
      rebuildStar();
    }
    function rebuildStar() {
      star = buildStar(profile, M * Msun, R * Rsun, mu, G, MP, kB);
      redraw();
    }

    // ---- panel
    const panel = new Panel(host);
    const nCtl = panel.slider('Polytropic index n', { min: 0, max: 4.9, value: n, step: 0.05 }, (v) => { n = v; rebuildProfile(); });
    const mCtl = panel.slider('Mass M', { min: 0.1, max: 20, value: M, log: true, unit: 'M☉' }, (v) => { M = v; rebuildStar(); });
    const rCtl = panel.slider('Radius R', { min: 0.1, max: 10, value: R, log: true, unit: 'R☉' }, (v) => { R = v; rebuildStar(); });
    panel.select('Preset', Object.keys(PRESETS).map((k) => ({ value: k, label: k })), 'Sun (n=3)', (k) => {
      const p = PRESETS[k];
      n = p.n; M = p.M; R = p.R;
      nCtl.set(n); mCtl.set(M); rCtl.set(R);
      rebuildProfile();
    });
    panel.toggle('Log scale (density/pressure)', logY, (v) => { logY = v; redraw(); });
    panel.toggle('Show Standard Solar Model (n=3 only)', showSSM, (v) => { showSSM = v; redraw(); });

    const roXi1 = panel.readout('ξ₁ (dimensionless radius)');
    const roConc = panel.readout('ρ_c / ρ̄');
    const roRhoc = panel.readout('Central density ρ_c');
    const roPc = panel.readout('Central pressure P_c');
    const roTc = panel.readout('Central temperature T_c');

    function drawDisk() {
      const w = diskStage.width, h = diskStage.height, dpr = diskStage.dpr;
      diskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      diskCtx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const rad = Math.min(w, h) * 0.46;
      const steps = 90;
      // Colour = blackbody colour of the local temperature; brightness rises with log T, so the
      // (uniformly blue-white, T > 10⁵ K) interior still shows where the heat is concentrated.
      const lTc = Math.log10(star.Tc), lT0 = Math.log10(3000);
      for (let i = steps; i >= 1; i--) {
        const x = i / steps;
        const { T } = starAt(star, x * R * Rsun);
        const Tc = Math.max(T, 1500);
        const [cr, cg, cb] = blackbodyRGB(Tc);
        const b = 0.25 + 0.75 * Math.min(1, Math.max(0, (Math.log10(Tc) - lT0) / (lTc - lT0)));
        diskCtx.beginPath();
        diskCtx.arc(cx, cy, rad * x, 0, Math.PI * 2);
        diskCtx.fillStyle = `rgb(${(cr * b * 255) | 0},${(cg * b * 255) | 0},${(cb * b * 255) | 0})`;
        diskCtx.fill();
      }
      // isotherms
      diskCtx.font = '10px JetBrains Mono, ui-monospace, monospace';
      diskCtx.textAlign = 'left';
      for (const Tiso of [1e5, 1e6, 1e7]) {
        if (Tiso >= star.Tc) continue;
        let lo = 0, hi = 1;
        for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (starAt(star, mid * R * Rsun).T > Tiso) lo = mid; else hi = mid; }
        diskCtx.strokeStyle = 'rgba(0,0,0,0.45)'; diskCtx.lineWidth = 1; diskCtx.setLineDash([3, 3]);
        diskCtx.beginPath(); diskCtx.arc(cx, cy, rad * lo, 0, Math.PI * 2); diskCtx.stroke();
        diskCtx.setLineDash([]);
        diskCtx.fillStyle = 'rgba(0,0,0,0.7)';
        diskCtx.fillText(`10${['⁵', '⁶', '⁷'][Math.round(Math.log10(Tiso)) - 5]} K`, cx + rad * lo * 0.7071 + 3, cy - rad * lo * 0.7071 - 3);
      }
      // vignette rim
      const grad = diskCtx.createRadialGradient(cx, cy, rad * 0.85, cx, cy, rad * 1.02);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, pal.bg);
      diskCtx.beginPath();
      diskCtx.arc(cx, cy, rad * 1.05, 0, Math.PI * 2);
      diskCtx.fillStyle = grad;
      diskCtx.fill();
      diskCtx.fillStyle = pal.muted;
      diskCtx.font = '11px JetBrains Mono, ui-monospace, monospace';
      diskCtx.textAlign = 'center';
      diskCtx.fillText(`${fmt(R, 3)} R☉ · centre ${fmt(star.Tc, 2)} K`, cx, h - 8);
    }

    function drawProfiles() {
      const N = 160;
      const xs = new Float64Array(N + 1);
      const th = new Float64Array(N + 1);
      const rho = new Float64Array(N + 1);
      const P = new Float64Array(N + 1);
      const T = new Float64Array(N + 1);
      const m = new Float64Array(N + 1);
      for (let i = 0; i <= N; i++) {
        const x = i / N;
        xs[i] = x;
        const xi = x * profile.xi1;
        th[i] = thetaAt(profile, xi);
        const s = starAt(star, x * R * Rsun);
        rho[i] = s.rho / star.rhoc;
        P[i] = s.P / star.Pc;
        T[i] = s.T / star.Tc;
        m[i] = s.m / star.M;
      }
      plot.o.y.log = logY;
      plot.o.y.min = logY ? 1e-4 : 0;
      plot.o.y.max = 1.02;
      plot.draw(() => {
        plot.line(xs, th, { color: pal.muted, dash: [3, 3], width: 1.25 });
        plot.line(xs, rho, { color: pal.series[0] });
        plot.line(xs, P, { color: pal.series[1] });
        plot.line(xs, T, { color: pal.series[2] });
        plot.line(xs, m, { color: pal.series[3], dash: [1, 3] });
        if (showSSM && Math.abs(n - 3) < 1e-6) {
          const ssm = new Float64Array(N + 1);
          for (let i = 0; i <= N; i++) ssm[i] = ssmDensityRatio(xs[i]);
          plot.line(xs, ssm, { color: pal.bad, width: 1.5, dash: [6, 3] });
          plot.text('Standard Solar Model ρ/ρ_c', plot.m.l + plot.pw - 6, plot.m.t + 14, { color: pal.bad, size: 10, align: 'right' });
        }
        // curve labels, each placed beside its own curve
        const lab = (text: string, arr: Float64Array, fx: number, color: string) => {
          const i = Math.round(N * fx);
          const v = logY ? Math.max(arr[i], 1.2e-4) : arr[i];
          plot.text(text, plot.px(xs[i]) + 6, plot.py(v) - 5, { color, size: 10 });
        };
        lab('ρ/ρ_c', rho, 0.14, pal.series[0]);
        lab('P/P_c', P, 0.06, pal.series[1]);
        lab('T/T_c = θ', T, 0.45, pal.series[2]);
        lab('m(r)/M', m, 0.42, pal.series[3]);
      });
    }

    function updateReadouts() {
      roXi1.set(profile.n < 4.999 ? fmt(profile.xi1, 4) : `${fmt(profile.xi1, 3)} (truncated; n→5 ⇒ ξ₁→∞)`);
      roConc.set(fmt(profile.rhoRatio, 4));
      roRhoc.set(`${fmt(star.rhoc, 3)} kg/m³`);
      roPc.set(`${fmt(star.Pc, 3)} Pa`);
      roTc.set(`${fmt(star.Tc, 3)} K`);
    }

    function redraw() {
      drawDisk();
      drawProfiles();
      updateReadouts();
    }

    diskStage.onResize(() => redraw());
    plotStage.onResize((w, h, dpr) => { plot.resize(w, h, dpr); redraw(); });

    onDestroy(() => {});
    return { setVisible() {}, destroy() {} };
  },
});
