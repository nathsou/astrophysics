// Secondary figure: a schematic Milky Way, face-on and edge-on, drawn to scale: an exponential thin
// disk with four logarithmic spiral arms (young blue stars) on a smooth old (yellow) disk, a puffier
// thick disk, the bar/bulge, a sparse stellar halo, globular clusters, and the Sun at R0 ≈ 8.2 kpc.
// Stars are generated once (seeded) and drawn with additive blending in the dark theme.
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel } from '../lib/ui/controls';
import { palette, onThemeChange, currentTheme } from '../lib/ui/theme';

const R0 = 8.2;          // kpc, Sun's galactocentric radius
const BAR_ANGLE = 0.47;  // rad (~27°) between the bar's long axis and the Sun–GC line
const PITCH = (12 * Math.PI) / 180;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// kind: 0 old thin disk, 1 young arm stars, 2 thick disk, 3 bar/bulge, 4 halo
interface Stars { x: Float32Array; y: Float32Array; z: Float32Array; kind: Uint8Array; b: Float32Array; n: number }

function makeStars(): Stars {
  const r = rng(2024);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const expDisk = (Rd: number) => { // radius drawn from Σ ∝ R e^{-R/Rd} (gamma k = 2)
    return -Rd * Math.log((1 - r()) * (1 - r()));
  };
  const counts = [9000, 7000, 3000, 5000, 1400];
  const n = counts.reduce((a, b) => a + b, 0);
  const s: Stars = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), kind: new Uint8Array(n), b: new Float32Array(n), n };
  let i = 0;
  const put = (x: number, y: number, z: number, k: number, b: number) => { s.x[i] = x; s.y[i] = y; s.z[i] = z; s.kind[i] = k; s.b[i] = b; i++; };
  // old thin disk: smooth, R_d ≈ 2.6 kpc, h_z ≈ 0.3 kpc, with a hole where the bar dominates
  for (let k = 0; k < counts[0]; k++) {
    let R = expDisk(2.6);
    if (R > 17) R = 17 * r();
    const th = 2 * Math.PI * r();
    put(R * Math.cos(th), R * Math.sin(th), 0.3 * gauss() * 0.7, 0, 0.5 + r());
  }
  // young stars and H II regions along four logarithmic arms: θ = θ_k + ln(R/R_ref)/tan(pitch)
  for (let k = 0; k < counts[1]; k++) {
    const R = 3.2 + expDisk(3.2) * 0.9;
    if (R > 16) { k--; continue; }
    const arm = Math.floor(r() * 4);
    const th = BAR_ANGLE + (arm * Math.PI) / 2 + Math.log(R / 3.2) / Math.tan(PITCH) + 0.16 * gauss();
    const spread = 0.35 * gauss();
    put(R * Math.cos(th) + spread * Math.sin(th), R * Math.sin(th) - spread * Math.cos(th), 0.1 * gauss(), 1, 0.5 + 1.5 * r() ** 3);
  }
  // thick disk: R_d ≈ 2 kpc, h_z ≈ 0.9 kpc
  for (let k = 0; k < counts[2]; k++) {
    const R = Math.min(expDisk(2.0), 15), th = 2 * Math.PI * r();
    put(R * Math.cos(th), R * Math.sin(th), 0.9 * gauss() * 0.8, 2, 0.4 + 0.5 * r());
  }
  // bar/bulge: a triaxial Gaussian, half-length ~4.5 kpc, rotated by BAR_ANGLE, with a boxy/peanut z extent
  for (let k = 0; k < counts[3]; k++) {
    const a = 1.9 * gauss(), bb = 0.7 * gauss(), z = 0.55 * gauss() * (0.6 + 0.4 * Math.min(1, Math.abs(a) / 2));
    const c = Math.cos(BAR_ANGLE + Math.PI), sn = Math.sin(BAR_ANGLE + Math.PI);
    put(a * c - bb * sn, a * sn + bb * c, z, 3, 0.6 + r());
  }
  // stellar halo: ρ ∝ r^-3.5 between 2 and 40 kpc
  for (let k = 0; k < counts[4]; k++) {
    const u = r(), rr = 2 * Math.pow(1 - u * (1 - Math.pow(20, -2.5)), -1 / 2.5); // inverse CDF of r^-3.5 shell
    const ct = 2 * r() - 1, ph = 2 * Math.PI * r(), st = Math.sqrt(1 - ct * ct);
    put(rr * st * Math.cos(ph), rr * st * Math.sin(ph), rr * ct * 0.8, 4, 0.5 + r());
  }
  return s;
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 16 / 9 });
    const ctx = stage.canvas.getContext('2d')!;
    let view: 'edge' | 'face' = 'face';

    const stars = makeStars();
    const gr = rng(77);
    const NGLOB = 24;
    const glob = Array.from({ length: NGLOB }, () => {
      const rr = 2 + 18 * gr() ** 1.5, ct = 2 * gr() - 1, ph = 2 * Math.PI * gr(), st = Math.sqrt(1 - ct * ct);
      return [rr * st * Math.cos(ph), rr * st * Math.sin(ph), rr * ct];
    });

    // colours per kind (dark theme: physical-ish star colours; light theme: ink tones)
    function kindColour(k: number, dark: boolean): string {
      if (dark) return ['#ffe2b0', '#9cc7ff', '#ffc78a', '#ffb45e', '#c9b6a0'][k];
      return ['#8a6a2c', '#1f5fb8', '#a0662a', '#b4690e', '#6e675c'][k];
    }

    const loop = new Loop(null, render, 1 / 30);
    loop.onDemand = true; // static figure: redraw only when something changes

    function render() {
      const { width: W, height: H, dpr } = stage;
      const dark = currentTheme() === 'dark';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 + (view === 'face' ? 0 : 0);
      const scale = view === 'face' ? (Math.min(W, H * 1.4) / 2 / 17.5) : (W / 2 / 19);
      // Sun on the left of the GC along −x in the face-on view, as in most maps (GC → Sun points "down" in l = 0)
      const proj = (x: number, y: number, z: number): [number, number] =>
        view === 'face' ? [cx + y * scale, cy + x * scale] : [cx + x * scale, cy - z * scale]; // edge-on: seen from 90° to the Sun–GC line

      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      // diffuse glow of the old disk and bar
      const glow = (x: number, y: number, rx: number, ry: number, rot: number, col: string, a: number) => {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot); ctx.scale(rx, ry);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = a; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, 2 * Math.PI); ctx.fill();
        ctx.restore();
      };
      const diskCol = dark ? '#ffdca0' : '#caa15a';
      const barCol = dark ? '#ffb25a' : '#c9791e';
      if (view === 'face') {
        glow(cx, cy, 11 * scale, 11 * scale, 0, diskCol, dark ? 0.10 : 0.16);
        // bar long axis at BAR_ANGLE from the GC→Sun line (x axis → screen y)
        glow(cx, cy, 4.6 * scale, 1.7 * scale, Math.PI / 2 - BAR_ANGLE, barCol, dark ? 0.55 : 0.4);
      } else {
        glow(cx, cy, 15 * scale, 0.7 * scale, 0, diskCol, dark ? 0.16 : 0.22);
        glow(cx, cy, 3.4 * scale, 2.0 * scale, 0, barCol, dark ? 0.55 : 0.45);
      }
      // stars
      const size = Math.max(1, Math.min(2, scale / 14));
      for (let i = 0; i < stars.n; i++) {
        const k = stars.kind[i];
        const [X, Y] = proj(stars.x[i], stars.y[i], stars.z[i]);
        if (X < -2 || X > W + 2 || Y < -2 || Y > H + 2) continue;
        ctx.fillStyle = kindColour(k, dark);
        ctx.globalAlpha = (dark ? [0.35, 0.7, 0.22, 0.4, 0.4][k] : [0.35, 0.6, 0.25, 0.35, 0.45][k]) * Math.min(1, stars.b[i]) * (view === 'edge' && k < 2 ? 0.35 : 1);
        const sz = k === 1 ? size * (0.8 + 0.6 * stars.b[i]) : size;
        ctx.fillRect(X - sz / 2, Y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // globular clusters
      ctx.fillStyle = pal.bad;
      for (const [x, y, z] of glob) {
        const [X, Y] = proj(x, y, z);
        ctx.beginPath(); ctx.arc(X, Y, 2.2, 0, 2 * Math.PI); ctx.fill();
      }
      // Sun and GC
      const [sx, sy] = proj(R0, 0, 0.02);
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.fillStyle = dark ? '#fff6d8' : pal.fg;
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 2 * Math.PI); ctx.stroke();
      ctx.font = '12px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const label = (t: string, x: number, y: number, col = pal.fg, align: CanvasTextAlign = 'left') => {
        ctx.textAlign = align; ctx.fillStyle = col;
        ctx.lineWidth = 3; ctx.strokeStyle = dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
        ctx.strokeText(t, x, y); ctx.fillText(t, x, y);
      };
      if (view === 'face') {
        label('Sun (R₀ ≈ 8.2 kpc)', sx + 12, sy);
        label('Galactic Centre and bar', cx + 3.2 * scale, cy - 2.6 * scale, pal.fg);
      } else {
        label('Sun, ~20 pc above the midplane', sx + 4, sy - 16);
        label('thin disk (h ≈ 0.3 kpc)', cx - 16 * scale, cy - 1.1 * scale, pal.fg);
        label('thick disk (h ≈ 0.9 kpc)', cx - 16 * scale, cy - 2.4 * scale, pal.muted);
        label('bulge/bar', cx, cy - 3.6 * scale, pal.fg, 'center');
      }
      label('globular clusters (red) and the faint stellar halo reach far beyond the disk', 10, H - 14, pal.muted);
      // scale bar
      const bar = 5 * scale;
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W - 14 - bar, 18); ctx.lineTo(W - 14, 18); ctx.stroke();
      label('5 kpc', W - 14 - bar / 2, 30, pal.fg, 'center');
      ctx.textBaseline = 'alphabetic';
    }

    stage.onResize(() => loop.invalidate());
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    const panel = new Panel(host);
    panel.select('View', [{ value: 'face', label: 'Face-on' }, { value: 'edge', label: 'Edge-on' }], view, (v) => { view = v as 'edge' | 'face'; loop.invalidate(); });

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
