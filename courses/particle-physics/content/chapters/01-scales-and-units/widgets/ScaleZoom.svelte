<!--
  Powers of ten: drag a length from a millimetre down to 10⁻¹⁹ m. The widget shows what has that size, the energy a
  probe needs to resolve it (E = hc / L, with hc = 1.24 GeV·fm), and the machine that first reached it.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { formatEnergy, formatLength } from '$lib/hep/units';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  // hc in eV·m: 1.239841984e-6
  const HC_EV_M = 1.239841984e-6;

  interface Thing { size: number; name: string; note: string }
  const THINGS: Thing[] = [
    { size: 1e-3, name: 'a grain of sand', note: 'about a millimetre across' },
    { size: 7e-5, name: 'a human hair', note: 'roughly 70 µm thick' },
    { size: 7e-6, name: 'a red blood cell', note: 'about 7 µm' },
    { size: 1e-7, name: 'a virus', note: 'tens to hundreds of nanometres' },
    { size: 2e-9, name: 'the width of a DNA double helix', note: 'about 2 nm' },
    { size: 1e-10, name: 'an atom', note: 'an atom is about 10⁻¹⁰ m across (a hydrogen atom: 1.06 × 10⁻¹⁰ m, twice the Bohr radius)' },
    { size: 1.4e-14, name: 'a gold nucleus', note: 'about 14 fm across' },
    { size: 1.7e-15, name: 'a proton', note: 'charge radius 0.84 fm, so about 1.7 fm across' },
    { size: 1e-18, name: 'a quark or an electron', note: 'no size has been measured; no structure is seen down to about 10⁻¹⁸ m' },
  ];

  interface Probe { size: number; name: string; detail: string }
  /** Probes, ordered from coarse to fine: the smallest length each can resolve (about its wavelength, λ = hc/E). */
  const PROBES: Probe[] = [
    { size: 5e-7, name: 'Visible light', detail: 'photons of 2–3 eV, in an optical microscope' },
    { size: 4e-12, name: 'An electron microscope', detail: 'electrons of 100 keV, wavelength about 4 pm (far better than the lenses can use)' },
    { size: 1e-10, name: 'X-rays', detail: 'photons of about 12 keV, from a tube or a synchrotron: the spacing of atoms in a crystal' },
    { size: 5e-15, name: 'Rutherford’s alpha particles (1909–11)', detail: 'alphas of about 7.7 MeV: too feeble to get inside a gold nucleus, they reached to about 30 fm of its centre' },
    { size: 2.5e-15, name: 'Hofstadter’s electrons (1950s)', detail: 'electrons of a few hundred MeV at Stanford: the first measurement of the proton’s size' },
    { size: 6e-17, name: 'SLAC (1967–)', detail: 'electrons of up to 20 GeV: quarks inside the proton' },
    { size: 6e-18, name: 'LEP (1989–2000)', detail: 'electrons and positrons colliding at up to 209 GeV in total' },
    { size: 2.5e-19, name: 'The LHC (2010–)', detail: 'quarks and gluons colliding with a few TeV between them' },
  ];

  let logL = $state(-10);
  const L = $derived(10 ** logL);
  const energyEv = $derived(HC_EV_M / L);
  const thing = $derived([...THINGS].sort((a, b) => Math.abs(Math.log10(a.size / L)) - Math.abs(Math.log10(b.size / L)))[0]!);
  const probe = $derived.by(() => {
    // the coarsest probe that resolves L (its size ≤ L), else the finest one
    const ok = PROBES.filter((p) => p.size <= L * 1.5).sort((a, b) => b.size - a.size);
    return ok[0] ?? PROBES[PROBES.length - 1]!;
  });
</script>

<Widget title="How small can you see?" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={logL} min={-19.5} max={-3} step={0.05} label="Length scale, log₁₀(L / m)" format={(v) => `10^${v.toFixed(1)} m`} />
  {/snippet}
  <div class="grid ui">
    <div class="card">
      <div class="k">Length</div>
      <div class="v">{formatLength(L)}</div>
      <div class="s">Nearest familiar size: <strong>{thing.name}</strong>, {thing.note}.</div>
    </div>
    <div class="card">
      <div class="k">Energy needed to resolve it</div>
      <div class="v">{formatEnergy(energyEv / 1e9)}</div>
      <div class="s">E = <i>hc</i> / L: a probe with wavelength λ = L carries this energy (if it is massless or fast).</div>
    </div>
    <div class="card wide">
      <div class="k">First reached by</div>
      <div class="v small">{probe.name}</div>
      <div class="s">{probe.detail}.</div>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.7rem 0.9rem;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .k {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .v {
    font-family: var(--font-display);
    font-size: 1.7rem;
    color: var(--track-ink);
  }
  .v.small {
    font-size: 1.15rem;
  }
  .s {
    font-size: 0.85rem;
    color: var(--ink-2);
    margin-top: 0.15rem;
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
