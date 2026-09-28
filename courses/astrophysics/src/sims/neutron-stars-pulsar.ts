// Chapter 18 flagship: a 3D rotating neutron star with an inclined dipole field, sweeping emission
// beams, an observer line of sight, a live pulse-profile strip (or dispersion "waterfall"), and a
// Web Audio "listen" toggle that clicks at the true spin rate.
//
// Geometry is the textbook rotating-vector model. Spin axis = world +z. The magnetic axis is tilted
// by α from the spin axis and precesses around it at the spin phase φ(t) = 2π t / P:
//   m̂(t) = Rz(φ) · Ry(α) · ẑ = (sin α cos φ, sin α sin φ, cos α)
// The (fixed) line of sight sits at colatitude ζ from the spin axis: n̂ = (sin ζ, 0, cos ζ).
// The impact angle ψ between them, cos ψ = cos α cos ζ + sin α sin ζ cos φ, drives everything:
// pulse brightness, the waterfall, and the beam sweep. Field lines are analytic dipole curves
// r(θ) = L sin²θ in the magnetic frame, rotated into the world frame by the same R each frame.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot } from '../lib/ui/plot';
import { palette, onThemeChange, currentTheme } from '../lib/ui/theme';
import { OrbitCamera } from '../lib/runtime/camera';

const c = 2.99792458e8;
const YEAR = 3.15576e7;

interface Preset { label: string; P: number; Pdot: number; alphaDeg: number; zetaDeg: number; dm: number }
const PRESETS: Preset[] = [
  { label: 'Crab pulsar (PSR B0531+21)', P: 0.03313, Pdot: 4.21e-13, alphaDeg: 70, zetaDeg: 65, dm: 56.8 },
  { label: 'Vela pulsar (PSR B0833−45)', P: 0.08933, Pdot: 1.25e-13, alphaDeg: 65, zetaDeg: 63, dm: 67.9 },
  { label: 'PSR B1919+21 (Bell, 1967)', P: 1.3373, Pdot: 1.35e-15, alphaDeg: 30, zetaDeg: 34, dm: 12.4 },
  { label: 'PSR J1748−2446ad (716 Hz)', P: 0.0013962, Pdot: 9.6e-21, alphaDeg: 50, zetaDeg: 46, dm: 236 },
  { label: 'Magnetar (SGR 1806−20-like)', P: 7.56, Pdot: 8.3e-11, alphaDeg: 80, zetaDeg: 73, dm: 15 },
];

function deriveB(P: number, Pdot: number) {
  // Standard vacuum-dipole estimate assuming α = 90°, R = 10 km, I = 1e45 g cm² (cgs, then converted).
  const Bgauss = 3.2e19 * Math.sqrt(Math.max(P * Pdot, 0));
  const Edot_erg = 4 * Math.PI * Math.PI * 1e45 * Pdot / (P * P * P); // rotational energy loss, erg/s
  const tau_c = P / (2 * Pdot); // seconds
  return { Btesla: Bgauss * 1e-4, EdotW: Edot_erg * 1e-7, tauYr: tau_c / YEAR };
}

// beam half-width from the empirical polar-cap radius ρ(deg) ≈ 5.4 / √P(s)
const beamWidthRad = (P: number) => (Math.max(1.2, Math.min(30, 5.4 / Math.sqrt(P))) * Math.PI) / 180;

function rotAxis(x: number, y: number, z: number, alpha: number, phase: number): [number, number, number] {
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const x1 = x * ca + z * sa, y1 = y, z1 = -x * sa + z * ca;
  const cp = Math.cos(phase), sp = Math.sin(phase);
  return [x1 * cp - y1 * sp, x1 * sp + y1 * cp, z1];
}

function project(vp: Float32Array, x: number, y: number, z: number, W: number, H: number): [number, number, number, boolean] {
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (cw <= 1e-6) return [0, 0, 0, false];
  return [((cx / cw) * 0.5 + 0.5) * W, (1 - ((cy / cw) * 0.5 + 0.5)) * H, cz / cw, true];
}

export default defineSim({
  mount({ host, onDestroy }) {
    let pal = palette();
    onThemeChange(() => { pal = palette(); loop.invalidate(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:0;';
    host.append(wrap);
    const scene = createStage(wrap, { aspect: 1.1 });
    const side = createStage(wrap, { aspect: 1 / 0.92 });
    scene.el.style.borderRight = '1px solid var(--rule)';
    // side by side on wide screens, stacked on phones
    const stackRO = new ResizeObserver(() => {
      const narrow = wrap.clientWidth < 560;
      wrap.style.gridTemplateColumns = narrow ? 'minmax(0,1fr)' : 'minmax(0,1.3fr) minmax(0,1fr)';
      scene.el.style.borderRight = narrow ? '' : '1px solid var(--rule)';
      scene.el.style.borderBottom = narrow ? '1px solid var(--rule)' : '';
    });
    stackRO.observe(wrap);
    onDestroy(() => stackRO.disconnect());
    const ctx = scene.canvas.getContext('2d')!;

    const cam = new OrbitCamera(scene.canvas, { distance: 9, yaw: 0.7, pitch: 0.45, autoRotate: 0.04 });
    cam.onChange = () => loop.invalidate();

    // --- state ---
    let P = 0.03313, Pdot = 4.21e-13, alphaDeg = 70, zetaDeg = 65, dm = 56.8;
    let timeScale = Math.max(1e-4, Math.min(5, P / 1.5)), view: 'profile' | 'waterfall' = 'profile';
    let elapsed = 0; // real seconds of simulated pulsar time (before display slow-down)
    let listening = false;
    let audioCtx: AudioContext | null = null;
    let audioPhaseAcc = 0;

    // Waterfall offscreen buffer: columns = time, rows = frequency channel.
    const WF_W = 360, WF_H = 96, F_LO = 400, F_HI = 800; // MHz band, like a typical pulsar/FRB survey
    const wfCanvas = document.createElement('canvas');
    wfCanvas.width = WF_W; wfCanvas.height = WF_H;
    const wfCtx = wfCanvas.getContext('2d')!;
    wfCtx.fillStyle = '#000'; wfCtx.fillRect(0, 0, WF_W, WF_H);

    const plot = new Plot(side.canvas, {
      x: { min: 0, max: 2, label: 'pulse phase (rotations)' },
      y: { min: 0, max: 1.15, label: 'intensity' },
      title: 'Pulse profile',
    });

    function intensityAt(phase: number) {
      const alpha = (alphaDeg * Math.PI) / 180, zeta = (zetaDeg * Math.PI) / 180;
      const rho = beamWidthRad(P);
      const cospsi = Math.cos(alpha) * Math.cos(zeta) + Math.sin(alpha) * Math.sin(zeta) * Math.cos(phase);
      const psi1 = Math.acos(Math.max(-1, Math.min(1, cospsi)));
      const psi2 = Math.PI - psi1;
      const g = (psi: number) => Math.exp(-0.5 * (psi / rho) ** 2);
      return Math.max(g(psi1), g(psi2));
    }

    function reset() {
      elapsed = 0;
      audioPhaseAcc = 0;
      wfCtx.fillStyle = '#000'; wfCtx.fillRect(0, 0, WF_W, WF_H);
    }
    reset();

    // --- field-line geometry (built once per L set, in the magnetic frame) ---
    const N_MERIDIANS = 10, N_THETA = 48;
    function fieldLines(visualLC: number) {
      const fracs = [0.14, 0.22, 0.33, 0.47, 0.63, 0.8, 1.0, 1.3];
      const lines: { pts: [number, number, number][]; open: boolean }[] = [];
      for (let m = 0; m < N_MERIDIANS; m++) {
        const phim = (m / N_MERIDIANS) * Math.PI * 2;
        for (const f of fracs) {
          const L = f * visualLC;
          const open = L >= 0.62 * visualLC;
          const pts: [number, number, number][] = [];
          const thetas: number[] = [];
          if (open) {
            const n = N_THETA / 2;
            for (let i = 0; i <= n; i++) thetas.push((i / n) * 0.62 * Math.PI);
          } else {
            for (let i = 0; i <= N_THETA; i++) thetas.push(0.02 + (i / N_THETA) * (Math.PI - 0.04));
          }
          for (const th of thetas) {
            const r = L * Math.sin(th) ** 2;
            if (r > visualLC * 1.35) continue;
            pts.push([r * Math.sin(th) * Math.cos(phim), r * Math.sin(th) * Math.sin(phim), r * Math.cos(th)]);
          }
          lines.push({ pts, open });
        }
      }
      return lines;
    }

    function visualLightCylinder() {
      return Math.max(1.6, Math.min(9, 2 + 1.1 * Math.log10(P / 0.001)));
    }

    let lastPreset = 'Crab pulsar (PSR B0531+21)';

    // --- Web Audio: one click per real spin period, at the *true* spin rate ---
    function ensureAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      return audioCtx!;
    }
    function click() {
      if (!listening) return;
      const actx = ensureAudio();
      const t0 = actx.currentTime + 0.005;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 900;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.02);
      osc.connect(gain); gain.connect(actx.destination);
      osc.start(t0); osc.stop(t0 + 0.03);
    }

    const loop = new Loop((dt) => {
      elapsed += dt;
      cam.update(dt);
      // audio: real spin phase advances at the true rate regardless of the visual time scale
      const prevAudioPhase = audioPhaseAcc;
      audioPhaseAcc += dt / P;
      if (Math.floor(audioPhaseAcc) > Math.floor(prevAudioPhase)) click();
    }, render, 1 / 120);

    let uiTick = () => {};
    function render() {
      uiTick();
      const displayPhase = ((2 * Math.PI * elapsed * timeScale) / P) % (2 * Math.PI * 1000);
      const alpha = (alphaDeg * Math.PI) / 180;
      const I = intensityAt(displayPhase);
      const visualLC = visualLightCylinder();

      // --- 3D scene ---
      const { width: W, height: H, dpr } = scene;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const vp = cam.viewProj(W / H);

      const proj = (x: number, y: number, z: number) => project(vp, x, y, z, W, H);

      // spin axis
      ctx.strokeStyle = pal.faint; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      const [ax0, ay0] = proj(0, 0, -visualLC * 1.15);
      const [ax1, ay1] = proj(0, 0, visualLC * 1.15);
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke(); ctx.setLineDash([]);

      // light cylinder (a ring in the spin equatorial plane)
      ctx.strokeStyle = pal.accent3; ctx.globalAlpha = 0.65; ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * Math.PI * 2;
        const [X, Y] = proj(visualLC * Math.cos(th), visualLC * Math.sin(th), 0);
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;

      // field lines
      const lines = fieldLines(visualLC);
      for (const line of lines) {
        ctx.strokeStyle = pal.accent2; ctx.lineWidth = line.open ? 1.5 : 1;
        ctx.globalAlpha = line.open ? 0.85 : 0.4;
        ctx.beginPath();
        let started = false;
        for (const [x, y, z] of line.pts) {
          const [rx, ry, rz] = rotAxis(x, y, z, alpha, displayPhase);
          const [X, Y] = proj(rx, ry, rz);
          if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // emission beams (cones around ±m̂), drawn as translucent fans, additive-ish glow
      const rho = beamWidthRad(P);
      ctx.globalCompositeOperation = currentTheme() === 'dark' ? 'lighter' : 'source-over';
      for (const sign of [1, -1]) {
        const [mx, my, mz] = rotAxis(0, 0, sign, alpha, displayPhase);
        // build an orthonormal basis around m
        let ux = 1, uy = 0, uz = 0;
        if (Math.abs(mx) > 0.9) { ux = 0; uy = 1; }
        const dot = ux * mx + uy * my + uz * mz;
        ux -= dot * mx; uy -= dot * my; uz -= dot * mz;
        const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
        const vx = my * uz - mz * uy, vy = mz * ux - mx * uz, vz = mx * uy - my * ux;
        const len = visualLC * 0.85;
        const rad = Math.sin(rho) * len;
        const base = Math.cos(rho) * len;
        ctx.fillStyle = pal.accent;
        ctx.globalAlpha = 0.16 + 0.22 * I;
        ctx.beginPath();
        const [ex, ey] = proj(mx * 0.3, my * 0.3, mz * 0.3);
        ctx.moveTo(ex, ey);
        for (let i = 0; i <= 24; i++) {
          const t = (i / 24) * Math.PI * 2;
          const px = mx * base + (ux * Math.cos(t) + vx * Math.sin(t)) * rad;
          const py = my * base + (uy * Math.cos(t) + vy * Math.sin(t)) * rad;
          const pz = mz * base + (uz * Math.cos(t) + vz * Math.sin(t)) * rad;
          const [X, Y] = proj(px, py, pz);
          ctx.lineTo(X, Y);
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // the star itself
      const [sx, sy] = proj(0, 0, 0);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 13);
      g.addColorStop(0, '#eaf3ff'); g.addColorStop(0.5, pal.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.fill();

      // observer line of sight (fixed in world space)
      const zeta = (zetaDeg * Math.PI) / 180;
      const nx = Math.sin(zeta), ny = 0, nz = Math.cos(zeta);
      ctx.strokeStyle = pal.good; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.85;
      const [lx0, ly0] = proj(nx * 1.1, ny * 1.1, nz * 1.1);
      const [lx1, ly1] = proj(nx * visualLC * 1.5, ny * visualLC * 1.5, nz * visualLC * 1.5);
      ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1, ly1); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = pal.good; ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillText('to observer', lx1 - 60, ly1 - 6);

      // flash the star when the beam sweeps across the observer
      if (I > 0.6) {
        ctx.strokeStyle = pal.good; ctx.globalAlpha = (I - 0.6) * 2;
        ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }

      ctx.fillStyle = pal.muted; ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.fillText(`light cylinder R_LC (schematic, not to scale) · α=${Math.round(alphaDeg)}° ζ=${Math.round(zetaDeg)}°`, 10, H - 10);

      // --- side panel: profile or waterfall ---
      const rotCount = (elapsed * timeScale) / P;
      if (view === 'profile') {
        // The folded pulse profile (what a radio telescope builds up by averaging many rotations),
        // with a marker at the star's current rotational phase.
        const ph = (rotCount % 2 + 2) % 2;
        plot.draw(() => {
          plot.fn((x) => intensityAt(2 * Math.PI * x), { color: pal.accent, width: 2, samples: 600 });
          plot.vline(ph, { color: pal.good, dash: [4, 3] });
          plot.point(ph, I, { r: 5, color: pal.good });
        });
      } else {
        // shift waterfall left by 1 px, draw a fresh column at the retarded phase per channel
        wfCtx.drawImage(wfCanvas, -2, 0);
        for (let row = 0; row < WF_H; row++) {
          const f = F_HI - (row / WF_H) * (F_HI - F_LO); // MHz, high frequency at top
          const delayMs = 4.1488e3 * dm * (1 / (f * f) - 1 / (F_HI * F_HI));
          const retardedPhase = displayPhase - (2 * Math.PI * (delayMs / 1000) * timeScale) / P;
          const v = intensityAt(retardedPhase);
          const shade = Math.round(v * 255);
          wfCtx.fillStyle = `rgb(${shade * 0.3},${shade * 0.75},${shade})`;
          wfCtx.fillRect(WF_W - 2, row, 2, 1);
        }
        const { width: SW, height: SH, dpr: sdpr } = side;
        const sctx = side.canvas.getContext('2d')!;
        sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
        sctx.clearRect(0, 0, SW, SH);
        const m = { l: 48, r: 10, t: 24, b: 30 };
        sctx.imageSmoothingEnabled = false;
        sctx.drawImage(wfCanvas, 0, 0, WF_W, WF_H, m.l, m.t, SW - m.l - m.r, SH - m.t - m.b);
        sctx.fillStyle = pal.fg; sctx.font = '12px JetBrains Mono, ui-monospace, monospace';
        sctx.fillText('Dispersion waterfall', m.l, 14);
        sctx.fillStyle = pal.muted; sctx.font = '11px JetBrains Mono, ui-monospace, monospace';
        sctx.save(); sctx.translate(14, m.t + (SH - m.t - m.b) / 2); sctx.rotate(-Math.PI / 2);
        sctx.textAlign = 'center'; sctx.fillText(`frequency  (${F_LO}–${F_HI} MHz)`, 0, 0); sctx.restore();
        sctx.textAlign = 'center'; sctx.fillText('time →', m.l + (SW - m.l - m.r) / 2, SH - 6);
      }
    }

    scene.onResize(() => loop.invalidate());
    side.onResize((w, h, d) => { plot.resize(w, h, d); loop.invalidate(); });

    const derived = () => deriveB(P, Pdot);
    const panel = new Panel(host);
    panel.select(
      'Preset',
      PRESETS.map((p) => ({ value: p.label, label: p.label })),
      lastPreset,
      (v) => {
        const p = PRESETS.find((q) => q.label === v)!;
        P = p.P; Pdot = p.Pdot; alphaDeg = p.alphaDeg; zetaDeg = p.zetaDeg; dm = p.dm;
        periodCtl.set(P); alphaCtl.set(alphaDeg); zetaCtl.set(zetaDeg); dmCtl.set(dm);
        timeScale = Math.max(1e-4, Math.min(5, P / 1.5)); tsCtl.set(timeScale);
        reset(); loop.invalidate();
      },
    );
    panel.playPause(() => loop.paused, (v) => (loop.paused = v));
    panel.button('Reset phase', () => { reset(); loop.invalidate(); });
    const periodCtl = panel.slider('Period P', { min: 0.0014, max: 10, value: P, log: true, format: (v) => (v < 1 ? `${fmt(v * 1000, 3)} ms` : `${fmt(v, 3)} s`) }, (v) => { P = v; loop.invalidate(); });
    const alphaCtl = panel.slider('Inclination α', { min: 0, max: 90, value: alphaDeg, step: 1, unit: '°' }, (v) => { alphaDeg = v; loop.invalidate(); });
    const zetaCtl = panel.slider('Viewing angle ζ', { min: 0, max: 90, value: zetaDeg, step: 1, unit: '°' }, (v) => { zetaDeg = v; loop.invalidate(); });
    const tsCtl = panel.slider('Time scale', { min: 1e-4, max: 5, value: timeScale, log: true }, (v) => (timeScale = v));
    const dmCtl = panel.slider('DM (waterfall)', { min: 0, max: 300, value: dm, step: 1, unit: 'pc cm⁻³' }, (v) => (dm = v));
    panel.select('View', [{ value: 'profile', label: 'Pulse profile' }, { value: 'waterfall', label: 'Dispersion waterfall' }], view, (v) => { view = v; loop.invalidate(); });
    panel.toggle('Listen (spin-rate clicks)', listening, (v) => { listening = v; if (v) ensureAudio(); });
    const bOut = panel.readout('B ≈');
    const edotOut = panel.readout('Ė ≈');
    const ageOut = panel.readout('τc ≈');

    uiTick = () => {
      const d = derived();
      bOut.set(`${fmt(d.Btesla, 3)} T (${fmt(d.Btesla * 1e4, 3)} G)`);
      edotOut.set(`${fmt(d.EdotW, 3)} W`);
      ageOut.set(d.tauYr > 1e3 ? `${fmt(d.tauYr, 3)} yr` : `${fmt(d.tauYr * 365.25, 3)} days`);
    };
    uiTick();

    return {
      setVisible: (v) => loop.setVisible(v),
      destroy: () => { loop.destroy(); audioCtx?.close(); },
    };
  },
});
