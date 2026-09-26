// Appendix A3: spherical coordinates and the celestial sphere, drawn in Canvas2D with a simple
// orthographic camera (drag to rotate, z up).
//  • "Spherical" mode: a point at (r, θ, φ) with its projections, the polar angle θ from +z and the
//    azimuth φ from +x in the xy-plane, and live Cartesian components.
//  • "Sky" mode: two stars at (RA, Dec) on the unit sphere; their angular separation comes from the
//    dot product of the unit vectors (and, more robustly, from atan2(|a×b|, a·b)).

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type V3 = [number, number, number];
const D = Math.PI / 180;

const PAIRS: { label: string; a: [string, number, number]; b: [string, number, number] }[] = [
  { label: 'Betelgeuse & Rigel', a: ['Betelgeuse', 88.793, 7.407], b: ['Rigel', 78.634, -8.202] },
  { label: 'Dubhe & Merak (the Pointers)', a: ['Dubhe', 165.932, 61.751], b: ['Merak', 165.460, 56.383] },
  { label: 'Sirius & Canopus', a: ['Sirius', 101.287, -16.716], b: ['Canopus', 95.988, -52.696] },
  { label: 'Polaris & Vega', a: ['Polaris', 37.95, 89.264], b: ['Vega', 279.235, 38.784] },
  { label: 'Sgr A* & north galactic pole', a: ['Sgr A*', 266.417, -29.008], b: ['NGP', 192.859, 27.128] },
];

const sph = (r: number, th: number, ph: number): V3 => [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)];
const radec = (ra: number, dec: number): V3 => [Math.cos(dec * D) * Math.cos(ra * D), Math.cos(dec * D) * Math.sin(ra * D), Math.sin(dec * D)];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    let mode: 'sph' | 'sky' = params.mode === 'sky' ? 'sky' : 'sph';
    let yaw = 35 * D, pitch = 22 * D;
    let r = 1, th = 55 * D, ph = 40 * D;
    let A = { name: 'Betelgeuse', ra: 88.793, dec: 7.407 }, B = { name: 'Rigel', ra: 78.634, dec: -8.202 };

    const stage = createStage(host, { aspect: 16 / 10 });
    const ctx = stage.canvas.getContext('2d')!;
    const loop = new Loop(null, render);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());

    // Orthographic projection: rotate about z by yaw, tilt about the screen x-axis by pitch.
    function proj(p: V3): [number, number, number] {
      const { width: W, height: H } = stage;
      const s = Math.min(W, H) * 0.36;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const x1 = p[0] * cy + p[1] * sy;        // screen right
      const y1 = -p[0] * sy + p[1] * cy;       // into the screen (before tilt)
      const up = p[2] * cp + y1 * sp;          // camera raised by `pitch`, looking down
      const depth = y1 * cp - p[2] * sp;       // larger = farther from viewer
      return [W / 2 + x1 * s, H / 2 - up * s, depth];
    }
    function path(pts: V3[], color: string, width = 1, dashBack = true) {
      // draw with back-facing parts (depth > 0) faded
      for (let i = 1; i < pts.length; i++) {
        const p0 = proj(pts[i - 1]), p1 = proj(pts[i]);
        const back = dashBack && (p0[2] + p1[2]) / 2 > 0.02;
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = back ? 0.3 : 1;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    function seg(a: V3, b: V3, color: string, width = 1.5, dash: number[] = []) {
      const p = proj(a), q = proj(b);
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
    }
    function label(p: V3, text: string, color: string, dx = 6, dy = -6) {
      const q = proj(p);
      ctx.fillStyle = color; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(text, q[0] + dx, q[1] + dy);
    }
    function dotAt(p: V3, color: string, rad = 5) {
      const q = proj(p);
      ctx.fillStyle = color; ctx.globalAlpha = q[2] > 0.02 ? 0.45 : 1;
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    const circle = (f: (t: number) => V3, n = 96) => Array.from({ length: n + 1 }, (_, i) => f((i / n) * Math.PI * 2));
    const arcPts = (f: (t: number) => V3, t0: number, t1: number, n = 48) => Array.from({ length: n + 1 }, (_, i) => f(t0 + ((t1 - t0) * i) / n));

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // wireframe sphere
      for (let lat = -60; lat <= 60; lat += 30) path(circle((t) => [Math.cos(lat * D) * Math.cos(t), Math.cos(lat * D) * Math.sin(t), Math.sin(lat * D)]), lat === 0 ? pal.axis : pal.grid, lat === 0 ? 1.3 : 1);
      for (let lon = 0; lon < 180; lon += 30) path(circle((t) => [Math.cos(t) * Math.cos(lon * D), Math.cos(t) * Math.sin(lon * D), Math.sin(t)]), pal.grid);
      // axes
      const axes: [V3, string][] = mode === 'sph' ? [[[1.35, 0, 0], 'x'], [[0, 1.35, 0], 'y'], [[0, 0, 1.35], 'z']] : [[[1.35, 0, 0], 'RA 0h'], [[0, 1.35, 0], 'RA 6h'], [[0, 0, 1.35], 'NCP (Dec +90°)']];
      for (const [p, l] of axes) { seg([0, 0, 0], p, pal.muted, 1.2); label(p, l, pal.muted, 4, -2); }
      if (mode === 'sph') {
        const P = sph(r, th, ph);
        const F: V3 = [P[0], P[1], 0];
        seg([0, 0, 0], F, pal.faint, 1.2, [4, 4]);
        seg(F, P, pal.faint, 1.2, [4, 4]);
        seg([P[0], 0, 0], F, pal.series[1], 2);
        seg([0, 0, 0], [P[0], 0, 0], pal.series[1], 2);
        seg([P[0], 0, 0], [P[0], P[1], 0], pal.series[3], 2);
        seg(F, P, pal.series[2], 2);
        seg([0, 0, 0], P, pal.fg, 2.2);
        dotAt(P, pal.accent, 6);
        path(arcPts((t) => sph(0.32, t, ph), 0, th), pal.accent2, 2, false);
        label(sph(0.36, th / 2, ph), 'θ', pal.accent2);
        path(arcPts((t) => [0.3 * Math.cos(t), 0.3 * Math.sin(t), 0], 0, ph), pal.accent3, 2, false);
        label([0.36 * Math.cos(ph / 2), 0.36 * Math.sin(ph / 2), 0], 'φ', pal.accent3, 2, 12);
        label(P, `(r, θ, φ) = (${fmt(r, 2)}, ${fmt(th / D, 3)}°, ${fmt(ph / D, 3)}°)`, pal.fg, 8, -8);
        rOut.set(`x = ${fmt(P[0], 3)} (blue)   y = ${fmt(P[1], 3)} (green)   z = ${fmt(P[2], 3)} (pink)`);
      } else {
        const a = radec(A.ra, A.dec), b = radec(B.ra, B.dec);
        seg([0, 0, 0], a, pal.series[0], 2); seg([0, 0, 0], b, pal.series[1], 2);
        // great-circle arc: slerp from a to b
        const c = dot(a, b), omega = Math.acos(Math.max(-1, Math.min(1, c)));
        if (omega > 1e-6) {
          const pts = arcPts((t) => {
            const s0 = Math.sin(omega - t) / Math.sin(omega), s1 = Math.sin(t) / Math.sin(omega);
            return [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
          }, 0, omega);
          path(pts, pal.accent, 3);
        }
        dotAt(a, pal.series[0], 6); dotAt(b, pal.series[1], 6);
        label(a, A.name, pal.series[0]); label(b, B.name, pal.series[1], 6, 16);
        const sepDot = omega / D;
        const sepRobust = Math.atan2(norm(cross(a, b)), c) / D;
        rOut.set(`a · b = ${fmt(c, 6)}  →  separation = arccos(a · b) = ${fmt(sepDot, 4)}°   (atan2 form: ${fmt(sepRobust, 4)}°)`);
      }
      ctx.fillStyle = pal.muted; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText('drag to rotate', W - 8, H - 6);
    }

    let rot: { x: number; y: number } | null = null;
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'grab';
    stage.canvas.addEventListener('pointerdown', (e) => { rot = { x: e.clientX, y: e.clientY }; stage.canvas.setPointerCapture(e.pointerId); });
    stage.canvas.addEventListener('pointermove', (e) => {
      if (!rot) return;
      yaw -= (e.clientX - rot.x) * 0.008;
      pitch = Math.max(-80 * D, Math.min(80 * D, pitch + (e.clientY - rot.y) * 0.008));
      rot = { x: e.clientX, y: e.clientY };
      loop.invalidate();
    });
    stage.canvas.addEventListener('pointerup', () => { rot = null; });

    const panel = new Panel(host);
    panel.select('Mode', [{ value: 'sph', label: 'Spherical (r, θ, φ)' }, { value: 'sky', label: 'Sky (RA, Dec)' }], mode, (v) => { mode = v; build(); });
    const rOut = panel.readout('');
    let box: HTMLElement | null = null;

    function build() {
      box?.remove();
      const p = new Panel(host);
      box = p.el;
      if (mode === 'sph') {
        p.slider('r', { min: 0.2, max: 1.2, value: r, step: 0.01 }, (v) => { r = v; loop.invalidate(); });
        p.slider('θ (from +z)', { min: 0, max: 180, value: th / D, step: 1, format: (v) => `${Math.round(v)}°` }, (v) => { th = v * D; loop.invalidate(); });
        p.slider('φ (from +x)', { min: 0, max: 360, value: ph / D, step: 1, format: (v) => `${Math.round(v)}°` }, (v) => { ph = v * D; loop.invalidate(); });
      } else {
        const sl: ReturnType<Panel['slider']>[] = [];
        p.select('Pair', [{ value: '', label: 'choose…' }, ...PAIRS.map((q, i) => ({ value: String(i), label: q.label }))], '', (v) => {
          if (v === '') return;
          const q = PAIRS[+v];
          A = { name: q.a[0], ra: q.a[1], dec: q.a[2] }; B = { name: q.b[0], ra: q.b[1], dec: q.b[2] };
          sl[0].set(A.ra); sl[1].set(A.dec); sl[2].set(B.ra); sl[3].set(B.dec);
          loop.invalidate();
        });
        const hms = (v: number) => { const tm = Math.round((v / 15) * 60) % 1440; return `${fmt(v, 4)}° (${Math.floor(tm / 60)}h${String(tm % 60).padStart(2, '0')}m)`; };
        sl.push(p.slider('RA a', { min: 0, max: 360, value: A.ra, step: 0.1, format: hms }, (v) => { A.ra = v; A.name = 'a'; loop.invalidate(); }));
        sl.push(p.slider('Dec a', { min: -90, max: 90, value: A.dec, step: 0.1, format: (v) => `${fmt(v, 3)}°` }, (v) => { A.dec = v; A.name = 'a'; loop.invalidate(); }));
        sl.push(p.slider('RA b', { min: 0, max: 360, value: B.ra, step: 0.1, format: hms }, (v) => { B.ra = v; B.name = 'b'; loop.invalidate(); }));
        sl.push(p.slider('Dec b', { min: -90, max: 90, value: B.dec, step: 0.1, format: (v) => `${fmt(v, 3)}°` }, (v) => { B.dec = v; B.name = 'b'; loop.invalidate(); }));
      }
      loop.invalidate();
    }
    build();

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
