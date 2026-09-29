// Secondary figure: initial mass -> remnant fate, in the style of Heger et al. (2003). A simplified,
// illustrative mapping (real boundaries are uncertain and depend strongly on metallicity, rotation,
// mass loss and binarity), draggable by zero-age main-sequence mass and a metallicity toggle.

import { defineSim, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { palette, onThemeChange } from '../lib/ui/theme';

type Z = 'solar' | 'low';

interface Band { lo: number; hi: number; label: string; color: 'good' | 'accent' | 'accent2' | 'accent3' | 'bad' | 'muted'; desc: string }

function bands(z: Z): Band[] {
  if (z === 'solar') {
    return [
      { lo: 0.08, hi: 8, label: 'White dwarf', color: 'good', desc: 'Core never ignites carbon; sheds envelope as a planetary nebula (Chapter 15), leaves a C/O (or O/Ne/Mg) white dwarf.' },
      { lo: 8, hi: 10, label: 'WD or weak ECSN', color: 'accent2', desc: 'Borderline: an O/Ne/Mg core near M_Ch may undergo electron-capture collapse to a light neutron star.' },
      { lo: 10, hi: 25, label: 'Neutron star', color: 'accent', desc: 'Iron core collapses, bounce + neutrino heating revive the shock (Type II-P/Ib/Ic). Leaves a neutron star (Chapter 18).' },
      { lo: 25, hi: 45, label: 'Black hole (fallback)', color: 'bad', desc: 'Shock is weak or fails; much of the envelope falls back onto the proto-neutron star, pushing it over the maximum neutron-star mass.' },
      { lo: 45, hi: 90, label: 'Black hole (weak/failed SN)', color: 'bad', desc: 'Strong mass loss complicates the picture, but collapse is often direct or nearly so at solar metallicity.' },
      { lo: 90, hi: 140, label: 'Pulsational pair instability', color: 'accent3', desc: 'Pair-production instability triggers violent pulses that eject mass, then the star still collapses to a black hole — narrowing the mass that arrives at core collapse.' },
      { lo: 140, hi: 260, label: 'Pair-instability SN, no remnant', color: 'muted', desc: 'The star is completely unbound by explosive oxygen/silicon burning triggered by e⁺e⁻ pair production softening the pressure. No compact remnant.' },
      { lo: 260, hi: 1000, label: 'Direct collapse to black hole', color: 'bad', desc: 'Photodisintegration of iron-group nuclei removes pressure support faster than any explosion can respond: the whole star collapses.' },
    ];
  }
  return [
    { lo: 0.08, hi: 8, label: 'White dwarf', color: 'good', desc: 'Same low-mass fate; metallicity barely matters below the AGB.' },
    { lo: 8, hi: 20, label: 'Neutron star', color: 'accent', desc: 'Weaker winds at low metallicity mean less mass is lost, but the core-collapse physics is similar.' },
    { lo: 20, hi: 60, label: 'Black hole (direct/fallback)', color: 'bad', desc: 'Low metallicity means weak winds: massive stars keep more of their envelope, favouring larger black holes than at solar metallicity — relevant to the black-hole masses LIGO sees (Chapter 20).' },
    { lo: 60, hi: 140, label: 'Black hole', color: 'bad', desc: 'Little mass loss lets the star arrive at collapse still very massive.' },
    { lo: 140, hi: 260, label: 'Pair-instability SN, no remnant', color: 'muted', desc: 'The pair-instability mass window shifts with metallicity-dependent mass loss and mixing, but a gap in black-hole mass near 50–130 M☉ is expected either way.' },
    { lo: 260, hi: 1000, label: 'Direct collapse to black hole', color: 'bad', desc: 'Same photodisintegration collapse as at solar metallicity.' },
  ];
}

export default defineSim({
  mount({ host }) {
    let pal = palette();
    const stage = createStage(host, { aspect: 21 / 9, maxDpr: 2 });
    const ctx = stage.canvas.getContext('2d')!;
    let mass = 15; // Msun
    let z: Z = 'solar';
    const MMIN = 0.08, MMAX = 300;
    const logMin = Math.log10(MMIN), logMax = Math.log10(MMAX);

    const panel = new Panel(host);
    const roFate = panel.readout('Fate');
    panel.slider('Initial (ZAMS) mass', { min: MMIN, max: MMAX, value: mass, log: true, unit: 'M☉', format: (v) => fmt(v, 3) }, (v) => { mass = v; draw(); });
    panel.select('Metallicity', [{ value: 'solar', label: 'Solar (Z ≈ Z☉)' }, { value: 'low', label: 'Low (Z ≈ 0.1 Z☉)' }], z, (v) => { z = v; draw(); });

    function draw() {
      const bs = bands(z);
      const { width: W, height: H, dpr } = stage;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const m = { l: 16, r: 16, t: 34, b: 64 };
      const barY = m.t, barH = H - m.t - m.b, pw = W - m.l - m.r;
      const xOf = (Mv: number) => m.l + ((Math.log10(Mv) - logMin) / (logMax - logMin)) * pw;

      for (const b of bs) {
        const x0 = xOf(b.lo), x1 = xOf(Math.min(b.hi, MMAX));
        // a tint of the band colour with solid edges; the ink label on top keeps full contrast
        ctx.fillStyle = pal[b.color];
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x0, barY, x1 - x0, barH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pal[b.color];
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 0.75, barY + 0.75, x1 - x0 - 1.5, barH - 1.5);
        // label: horizontal if it fits, otherwise rotated to run up the band
        ctx.save();
        ctx.fillStyle = pal.fg;
        ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const midY = barY + barH / 2, bw = x1 - x0, tw = ctx.measureText(b.label).width;
        if (tw + 8 <= bw) ctx.fillText(b.label, (x0 + x1) / 2, midY);
        else if (bw >= 14 && tw + 8 <= barH) {
          ctx.translate((x0 + x1) / 2, midY);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(b.label, 0, 0);
        }
        ctx.restore();
      }
      // tick marks
      ctx.strokeStyle = pal.axis;
      ctx.fillStyle = pal.muted;
      ctx.font = '11px JetBrains Mono, ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (const t of [0.1, 1, 8, 25, 90, 140, 260]) {
        const x = xOf(t);
        ctx.beginPath(); ctx.moveTo(x, barY); ctx.lineTo(x, barY + barH); ctx.stroke();
        ctx.fillText(`${t}`, x, barY + barH + 14);
      }
      ctx.fillText('zero-age main-sequence mass (M☉)', W / 2, barY + barH + 30);

      // marker for chosen mass
      const xm = xOf(mass);
      ctx.strokeStyle = pal.fg;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(xm, barY - 10); ctx.lineTo(xm, barY + barH + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xm - 6, barY - 10); ctx.lineTo(xm + 6, barY - 10); ctx.lineTo(xm, barY - 2); ctx.closePath();
      ctx.fillStyle = pal.fg; ctx.fill();

      const hit = bs.find((b) => mass >= b.lo && mass < b.hi) ?? bs[bs.length - 1];
      roFate.set(mass < 0.9
        ? 'Not yet! A star this light lives longer than the current age of the Universe. Eventually it will become a white dwarf (helium-rich below about 0.5 M☉).'
        : `${hit.label}: ${hit.desc}`);
    }
    stage.onResize(() => draw());
    onThemeChange(() => { pal = palette(); draw(); });

    return { setVisible() {}, destroy() {} };
  },
});
