<!--
  The continuous beta spectrum (Chapter 22). The electron's kinetic energy in a three-body decay follows dN/dT ∝ p E (T0 − T)²
  (phase space only: no Coulomb correction, no forbidden-decay shape factor). If the decay had only two bodies, every electron
  would have the same energy. Electrons are drawn by accept–reject from `hep/random`, seeded.

    ::beta-spectrum{n="22.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { acceptReject, rng } from '$lib/hep/random';
  import { particle } from '$lib/hep/particles';
  import { betaMeanEnergy, betaSpectrum, twoBodyElectronEnergy } from './weak';

  let { n, caption, title = 'Why the beta spectrum is continuous' }: { n?: string | number; caption?: string; title?: string } = $props();

  const mn = particle(2112).mass, mp = particle(2212).mass;
  const PRESETS = {
    neutron: { label: 'free neutron', T0: mn - mp - particle(11).mass, note: 'end-point from the mass difference m_n − m_p − m_e (recoil neglected)' },
    bi210: { label: 'end-point 1.16 MeV', T0: 1.16e-3, note: 'about the end-point of radium E (bismuth-210), the source of the early measurements' },
    tritium: { label: 'tritium', T0: 18.6e-6, note: 'end-point 18.6 keV: the decay KATRIN studies to weigh the neutrino' },
  } as const;
  type Key = keyof typeof PRESETS;
  let key = $state<Key>('neutron');
  let count = $state(3000);
  let seed = $state(11);
  let show = $state<'both' | 'curve' | 'two'>('both');

  const T0 = $derived(PRESETS[key].T0);
  const me = particle(11).mass;
  const curve = $derived.by(() => {
    const N = 120;
    const pts = Array.from({ length: N + 1 }, (_, i) => {
      const T = (i / N) * T0;
      return { T, w: betaSpectrum(T, T0) };
    });
    const max = Math.max(...pts.map((p) => p.w));
    return pts.map((p) => ({ T: p.T, w: p.w / max }));
  });
  const mean = $derived(betaMeanEnergy(T0));
  const twoBody = $derived(key === 'neutron' ? twoBodyElectronEnergy(mn, mp) : null);

  const NB = 30;
  const hist = $derived.by(() => {
    const r = rng(seed);
    const max = Math.max(...curve.map((p) => betaSpectrum(p.T, T0))) * 1.001;
    const h = new Array<number>(NB).fill(0);
    for (let i = 0; i < count; i++) {
      const { x } = acceptReject(r, (t) => betaSpectrum(t, T0, me), 0, T0, max);
      h[Math.min(NB - 1, Math.floor((x / T0) * NB))]!++;
    }
    return h;
  });
  const norm = $derived.by(() => {
    // expected counts per bin for the normalised curve: scale so the areas agree
    const area = curve.reduce((s, p) => s + p.w, 0) * (T0 / 120);
    return (count * (T0 / NB)) / area;
  });
  const unitTxt = (T: number) => (T < 1e-4 ? `${(T * 1e6).toPrecision(3)} keV` : `${(T * 1e3).toPrecision(3)} MeV`);
  const scaleX = $derived(T0 < 1e-4 ? 1e6 : 1e3);
  const unit = $derived(T0 < 1e-4 ? 'keV' : 'MeV');
  const top = $derived(Math.max(1.1, ...hist.map((v) => v / norm)) * 1.05);
</script>

<Widget {title} {n} {caption} kind="Explore" onreset={() => { key = 'neutron'; count = 3000; seed = 11; show = 'both'; }}>
  {#snippet controls()}
    <div class="ctl">
      <Segmented label="Decay" size="sm" bind:value={key} options={Object.entries(PRESETS).map(([v, p]) => ({ value: v as Key, label: p.label }))} />
      <Segmented label="Show" size="sm" bind:value={show} options={[{ value: 'both', label: 'Electrons and curve' }, { value: 'curve', label: 'Curve only' }, { value: 'two', label: 'Two-body line' }]} />
      <Slider bind:value={count} min={200} max={30000} step={100} log label="Electrons" format={(v) => Math.round(v).toLocaleString('en-GB')} />
      <Button size="sm" onclick={() => (seed = seed + 1)}>New sample (seed {seed})</Button>
    </div>
  {/snippet}
  <Plot
    x={{ domain: [0, T0 * scaleX], label: `electron kinetic energy T [${unit}]`, format: (v) => Number(v.toPrecision(3)).toString() }}
    y={{ domain: [0, top], label: 'electrons per bin (relative)', format: (v) => v.toFixed(1) }}
    height={300}
    label="The kinetic-energy spectrum of electrons from a beta decay: a smooth hump that vanishes at the end-point, and, for comparison, the single line that a two-body decay would give"
  >
    {#snippet marks({ sx, sy })}
      {#if show !== 'two'}
        {#if show === 'both'}
          {#each hist as v, i}
            {@const x0 = ((i) / NB) * T0 * scaleX}
            {@const x1 = ((i + 1) / NB) * T0 * scaleX}
            <rect x={sx(x0) + 1} y={sy(v / norm)} width={Math.max(1, sx(x1) - sx(x0) - 2)} height={Math.max(0, sy(0) - sy(v / norm))} fill="var(--p-electron)" opacity="0.35" />
            <line x1={(sx(x0) + sx(x1)) / 2} x2={(sx(x0) + sx(x1)) / 2} y1={sy((v + Math.sqrt(v)) / norm)} y2={sy(Math.max(0, v - Math.sqrt(v)) / norm)} stroke="var(--p-electron)" stroke-width="1.2" />
          {/each}
        {/if}
        <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.T * scaleX)},${sy(p.w)}`).join('')} fill="none" stroke="var(--series-1)" stroke-width="2.2" />
        <line x1={sx(mean * scaleX)} x2={sx(mean * scaleX)} y1={sy(0)} y2={sy(top)} stroke="var(--ink-2)" stroke-dasharray="4 3" />
        <text x={sx(mean * scaleX) + 4} y="14" class="lbl">mean {unitTxt(mean)}</text>
      {/if}
      {#if show === 'two' || show === 'both'}
        {@const T2 = twoBody ?? T0 * 0.999}
        <line x1={sx(T2 * scaleX)} x2={sx(T2 * scaleX)} y1={sy(0)} y2={sy(top)} stroke="var(--bad)" stroke-width="2.5" />
        <text x={sx(T2 * scaleX) - 6} y="30" text-anchor="end" class="lbl" fill="var(--bad)">two-body decay: one energy{twoBody === null ? ' (at the end-point)' : ''}</text>
      {/if}
    {/snippet}
  </Plot>
  <p class="ui note" aria-live="polite">
    End-point T₀ = {unitTxt(T0)} ({PRESETS[key].note}). The mean electron energy is {(100 * mean / T0).toFixed(0)} % of T₀: the rest goes to the neutrino.
    Phase space only: the Coulomb attraction of the nucleus, which shifts the real spectra towards low energies, is not included.
  </p>
</Widget>

<style>
  .ctl {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.4rem;
    align-items: end;
  }
  .lbl {
    font-size: 11px;
    font-family: var(--font-ui);
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--chart-surface);
    stroke-width: 3px;
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
</style>
