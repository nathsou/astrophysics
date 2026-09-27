// Chapter 1: a pannable, zoomable logarithmic ruler of sizes, masses and times in the universe.
// Canvas2D. Drag to pan, wheel/pinch (or the slider) to zoom, hover a tick for details.

import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, superscript } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Item = [number, string, string];
const DATA: Record<'size' | 'mass' | 'time', { unit: string; items: Item[] }> = {
  size: { unit: 'm', items: [
    [1.6e-35, 'Planck length', '√(ħG/c³). Below this, "length" probably stops meaning anything.'],
    [1.7e-15, 'Proton', 'Charge diameter ≈ 1.7 fm. Nuclei are a few of these.'],
    [1.06e-10, 'Hydrogen atom', 'Twice the Bohr radius, a₀ = 0.53 Å. Derived from ħ, mₑ and e in this chapter.'],
    [5e-7, 'Wavelength of green light', 'Visible light spans 0.38–0.75 μm.'],
    [8e-5, 'Human hair', 'About 80 μm thick.'],
    [1.7, 'Human', 'You are here: almost exactly halfway (logarithmically) between the Planck length and the universe… not quite.'],
    [8.8e3, 'Mount Everest', 'Mountains on Earth can’t be much taller: rock would flow at the base. See the Fermi box.'],
    [2.4e4, 'Neutron star', 'Diameter ~24 km, with 1.4 M☉ inside. Chapter 18.'],
    [1.4e7, 'White dwarf / Earth', 'Earth diameter 12,742 km. A white dwarf packs a solar mass into the same size.'],
    [1.4e8, 'Jupiter', '11 Earth diameters; about the largest a cold ball of hydrogen can be.'],
    [1.39e9, 'Sun', 'Diameter 1.39 × 10⁹ m = 109 Earths.'],
    [2.4e10, 'Sgr A* horizon', 'Schwarzschild diameter of the Milky Way’s 4.3 × 10⁶ M☉ black hole ≈ 0.17 AU.'],
    [3e11, 'Earth’s orbit', 'Diameter 2 AU. 1 AU = 1.496 × 10¹¹ m.'],
    [9e12, 'Neptune’s orbit', 'Diameter 60 AU.'],
    [2.5e13, 'Voyager 1 distance', '~169 AU in 2026, about 23 light-hours.'],
    [9.46e15, 'Light-year', 'c × 1 yr = 9.46 × 10¹⁵ m = 63,000 AU.'],
    [3e16, 'Oort cloud / parsec', 'The Oort cloud extends to ~10⁵ AU; 1 pc = 3.09 × 10¹⁶ m = 206,265 AU.'],
    [4.0e16, 'Proxima Centauri', 'The nearest star: 1.30 pc = 4.24 ly.'],
    [4.2e18, 'Pleiades', '136 pc away, the nearest well-known open cluster.'],
    [9e20, 'Milky Way disc', '~30 kpc across; the Sun is 8.2 kpc from the centre.'],
    [2.4e22, 'Distance to Andromeda', '0.77 Mpc = 2.5 million ly.'],
    [5e23, 'Virgo Cluster distance', '16.5 Mpc: the nearest big galaxy cluster.'],
    [5e24, 'Laniakea supercluster', '~160 Mpc across; our home supercluster (2014).'],
    [8.8e26, 'Observable universe', 'Diameter ~93 billion ly (28.5 Gpc) in today’s comoving distance.'],
  ] },
  mass: { unit: 'kg', items: [
    [9.1e-31, 'Electron', 'mₑ = 9.11 × 10⁻³¹ kg.'],
    [1.67e-27, 'Proton', 'mₚ = 1836 mₑ. Stars are ~10⁵⁷ of these.'],
    [1e-18, 'Virus', 'Order of attograms.'],
    [1e-6, 'Grain of sand', 'About a milligram.'],
    [70, 'Human', ''],
    [1e15, 'Mount Everest', 'Roughly 10¹⁵ kg of rock.'],
    [1e20, 'Large asteroid (Vesta: 2.6 × 10²⁰)', 'Bodies above ~10²⁰ kg pull themselves round.'],
    [7.3e22, 'Moon', '1/81 Earth masses.'],
    [5.97e24, 'Earth', 'M⊕'],
    [1.9e27, 'Jupiter', '318 M⊕ = M☉/1047.'],
    [1.6e29, 'Smallest star', '~0.08 M☉: below this, no sustained hydrogen fusion (brown dwarfs).'],
    [1.99e30, 'Sun', 'M☉ = 1.989 × 10³⁰ kg, weighed with Kepler III (Chapter 2).'],
    [2.8e30, 'Chandrasekhar mass', '1.4 M☉: the maximum white dwarf. Derived from constants below.'],
    [3e32, 'Most massive stars', '~150–300 M☉ (R136a1).'],
    [8.5e36, 'Sgr A*', '4.3 × 10⁶ M☉.'],
    [1.3e40, 'M87*', '6.5 × 10⁹ M☉, the first black hole imaged by the EHT (2019).'],
    [2e42, 'Milky Way (with dark matter)', '~10¹² M☉ total; stars ~6 × 10¹⁰ M☉.'],
    [2e45, 'Virgo Cluster', '~10¹⁵ M☉.'],
    [1.5e53, 'Observable universe (ordinary matter)', '~10⁵³ kg of baryons, ~10⁸⁰ protons.'],
  ] },
  time: { unit: 's', items: [
    [5.4e-44, 'Planck time', '√(ħG/c⁵).'],
    [1e-23, 'Strong interaction', 'Time for light to cross a proton.'],
    [2e-15, 'Period of visible light', 'One oscillation of a green photon’s field.'],
    [3e-10, 'CPU clock tick', '3 GHz.'],
    [1e-3, 'Millisecond pulsar spin', 'Fastest known: 1.4 ms (PSR J1748−2446ad).'],
    [1, 'Heartbeat', ''],
    [1.8e3, 'Sun’s free-fall time', '~(Gρ)^−½ ≈ 30 min: how fast the Sun would collapse without pressure.'],
    [8.64e4, 'Day', ''],
    [3.156e7, 'Year', '≈ π × 10⁷ s.'],
    [2.5e9, 'Human lifetime', '~80 yr.'],
    [1.6e11, 'Recorded history', '~5,000 yr.'],
    [1e15, 'Sun’s Kelvin–Helmholtz time', '~30 Myr: how long gravity alone could power the Sun (Chapter 11).'],
    [7.3e15, 'Galactic year', 'The Sun orbits the Milky Way in ~230 Myr.'],
    [1.44e17, 'Age of the Earth', '4.54 Gyr.'],
    [4.35e17, 'Age of the Universe', '13.8 Gyr.'],
    [3.2e17, 'Sun’s main-sequence life', '~10 Gyr.'],
    [3e20, 'Red dwarf lifetime', '~10¹³ yr; no red dwarf has yet died.'],
    [3e41, 'Proton lifetime (lower limit)', '> 10³⁴ yr (Super-Kamiokande).'],
  ] },
};

// the greedy label stacking below assumes each list is sorted by value
for (const d of Object.values(DATA)) d.items.sort((a, b) => a[0] - b[0]);

export default defineSim({
  mount({ host, params }) {
    let pal = palette();
    const stage = createStage(host, { height: 250 });
    const ctx = stage.canvas.getContext('2d')!;
    let mode: keyof typeof DATA = (params.mode as keyof typeof DATA) in DATA ? (params.mode as keyof typeof DATA) : 'size';
    const full = () => { const it = DATA[mode].items; return [Math.log10(it[0][0]) - 2, Math.log10(it[it.length - 1][0]) + 2]; };
    let [lo, hi] = full();
    let hover = -1;

    const X = (lg: number) => 24 + ((lg - lo) / (hi - lo)) * (stage.width - 48);
    const inv = (x: number) => lo + ((x - 24) / (stage.width - 48)) * (hi - lo);

    function render() {
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const y0 = H - 46;
      // decade ticks
      const span = hi - lo, stepD = span > 40 ? 5 : span > 16 ? 2 : 1;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let d = Math.ceil(lo); d <= hi; d++) {
        const x = X(d);
        ctx.strokeStyle = pal.grid;
        ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, y0); ctx.stroke();
        ctx.strokeStyle = pal.axis;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + (d % stepD === 0 ? 8 : 4)); ctx.stroke();
        if (d % stepD === 0) { ctx.fillStyle = pal.muted; ctx.fillText(`10${superscript(String(d))}`, x, y0 + 21); }
      }
      ctx.strokeStyle = pal.axis;
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
      ctx.fillStyle = pal.faint;
      ctx.textAlign = 'right';
      ctx.fillText(`${DATA[mode].unit}  ·  ${span.toFixed(0)} decades shown`, W - 10, H - 8);
      // items, greedily stacked in rows so labels do not collide
      const rows: number[] = [];
      ctx.textAlign = 'left';
      const items = DATA[mode].items;
      items.forEach((it, i) => {
        const x = X(Math.log10(it[0]));
        if (x < -100 || x > W + 10) return;
        const tw = ctx.measureText(it[1]).width + 8;
        // labels near the right edge hang to the left of their tick instead of being clipped
        const flip = x + tw > W - 4;
        const start = flip ? x - tw : x;
        let row = 0;
        while (row < rows.length && rows[row] > start) row++;
        if (row > 7) return;
        rows[row] = flip ? x + 4 : x + tw;
        const y = y0 - 16 - row * 20;
        const col = i === hover ? pal.accent : pal.series[i % 5];
        ctx.strokeStyle = col; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y0); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y0, i === hover ? 4.5 : 3, 0, 7); ctx.fill();
        ctx.fillStyle = i === hover ? pal.accent : pal.fg;
        ctx.textAlign = flip ? 'right' : 'left';
        ctx.fillText(it[1], flip ? x - 3 : x + 3, y);
      });
      if (hover >= 0) {
        const it = items[hover];
        const e = Math.floor(Math.log10(it[0])), m = it[0] / 10 ** e;
        tip.innerHTML = `<b>${it[1]}</b> · ${m.toFixed(m < 9.95 ? 2 : 1)} × 10<sup>${e}</sup> ${DATA[mode].unit}<br>${it[2]}`;
        tip.style.display = 'block';
        const x = X(Math.log10(it[0]));
        tip.style.left = `${Math.max(4, Math.min(W - 264, x - 130))}px`;
      } else tip.style.display = 'none';
    }

    const tip = document.createElement('div');
    tip.style.cssText = 'position:absolute;top:6px;width:260px;padding:6px 8px;border-radius:6px;background:var(--bg-elev);border:1px solid var(--rule);color:var(--fg);font-size:.72rem;line-height:1.35;display:none;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    stage.overlay.append(tip);

    const loop = new Loop(null, render);
    onThemeChange(() => { pal = palette(); loop.invalidate(); });
    stage.onResize(() => loop.invalidate());

    // pointer: drag to pan, wheel/pinch to zoom, hover to inspect
    const cv = stage.canvas;
    cv.style.touchAction = 'none';
    cv.style.cursor = 'grab';
    const pts = new Map<number, number>();
    let pinch = 0;
    const clampView = () => {
      const [a, b] = full();
      const span = Math.min(b - a, Math.max(3, hi - lo));
      lo = Math.max(a, Math.min(b - span, lo)); hi = lo + span;
    };
    const zoomAt = (x: number, f: number) => {
      const c = inv(x);
      lo = c + (lo - c) * f; hi = c + (hi - c) * f;
      clampView(); loop.invalidate();
    };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, e.offsetX); });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (p === undefined) {
        // hover: nearest item within 10 px
        let best = -1, bd = 10;
        DATA[mode].items.forEach((it, i) => { const d = Math.abs(X(Math.log10(it[0])) - e.offsetX); if (d < bd) { bd = d; best = i; } });
        if (best !== hover) { hover = best; loop.invalidate(); }
        return;
      }
      if (pts.size === 1) {
        const d = ((p - e.offsetX) / (stage.width - 48)) * (hi - lo);
        lo += d; hi += d; clampView();
      } else {
        const xs = [...pts.values()];
        const dist = Math.abs(xs[0] - xs[1]);
        if (pinch && dist > 0) zoomAt((xs[0] + xs[1]) / 2, pinch / dist);
        pinch = dist;
      }
      pts.set(e.pointerId, e.offsetX);
      loop.invalidate();
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; loop.invalidate(); } });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, Math.exp(e.deltaY * 0.0015)); }, { passive: false });

    const panel = new Panel(host);
    panel.select('Quantity', [{ value: 'size', label: 'Sizes & distances' }, { value: 'mass', label: 'Masses' }, { value: 'time', label: 'Times' }], mode, (v) => { mode = v; [lo, hi] = full(); hover = -1; loop.invalidate(); });
    panel.button('Show all', () => { [lo, hi] = full(); loop.invalidate(); });
    const r = panel.readout('Range');
    const upd = () => { const [a, b] = full(); r.set(`${(b - a - 4).toFixed(0)} orders of magnitude`); };
    upd();
    panel.el.addEventListener('change', upd);

    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
