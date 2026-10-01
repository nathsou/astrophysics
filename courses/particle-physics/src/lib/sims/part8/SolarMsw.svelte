<!--
  Solar electron neutrinos: the probability of arriving as an electron neutrino against energy, for the adiabatic two-flavour MSW effect at the
  Sun's centre. A toy: one production density (150 g/cm³, electron fraction 0.67), no spread of the production region, θ₁₃ neglected.

    ::solar-msw{n="31.4" caption="…"}    Props: `n`, `caption`, `title`.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import LinePlot from './LinePlot.svelte';
  import { solarSurvival, GLOBAL_FIT_APPROX, thetaFromSin2 } from '$lib/hep/oscillations';
  import { logspace, sig, sci } from './format';

  let { n, caption, title = 'Solar neutrinos: the survival probability against energy' }: { n?: string | number; caption?: string; title?: string } = $props();

  let s12 = $state<number>(GLOBAL_FIT_APPROX.sin2theta12);
  let dm21 = $state<number>(GLOBAL_FIT_APPROX.dm21);
  let rho = $state(150);
  const Es = logspace(0.1e-3, 20e-3, 160); // GeV: 0.1 MeV … 20 MeV... (20e-3 GeV = 20 MeV)
  const theta = $derived(thetaFromSin2(s12));
  const matter = $derived(Es.map((E) => solarSurvival(theta, dm21, E, rho)));
  const vacuum = $derived(Es.map(() => 1 - 0.5 * Math.sin(2 * theta) ** 2));
  const EsMeV = Es.map((E) => E * 1000);
  const low = $derived(solarSurvival(theta, dm21, 1e-6, rho));
  const high = $derived(solarSurvival(theta, dm21, 0.05, rho));
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <Slider bind:value={s12} min={0.2} max={0.45} step={0.001} label="sin²θ₁₂" format={(v) => v.toFixed(3)} />
    <Slider bind:value={dm21} min={2e-5} max={2e-4} step={1e-6} label="Δm²₂₁ [eV²]" format={(v) => sci(v, 2)} />
    <Slider bind:value={rho} min={0} max={300} step={5} label="Density where the neutrino is made [g/cm³]" format={(v) => v.toFixed(0)} />
  {/snippet}
  <LinePlot
    lines={[
      { x: EsMeV, y: matter, label: 'with matter at the solar centre', color: 'var(--series-1)' },
      { x: EsMeV, y: vacuum, label: 'vacuum average 1 − ½ sin²2θ₁₂', color: 'var(--series-8)' },
    ]}
    x={{ type: 'log', domain: [0.1, 20], label: 'neutrino energy [MeV]', tickValues: [0.1, 0.3, 1, 3, 10] }}
    y={{ domain: [0, 1], label: 'probability of arriving as ν_e' }}
    vmarks={[
      { value: 0.42, label: 'pp: below 0.42', color: 'var(--mute)' },
      { value: 0.862, label: '⁷Be 0.86', color: 'var(--mute)' },
      { value: 15, label: '⁸B: up to ≈ 15', color: 'var(--mute)' },
    ]}
    height={280}
    label="Electron-neutrino survival probability from the Sun against neutrino energy, with and without the matter effect"
    format={(v) => sig(v, 3)}
  />
  <p class="ui out" aria-live="polite">
    Low energies: {low.toFixed(2)} (the vacuum average). High energies: {high.toFixed(2)} (close to sin²θ₁₂ = {s12.toFixed(2)}): the neutrino leaves the Sun as ν₂, which is ν_e only {(s12 * 100).toFixed(0)} % of the time.
  </p>
</Widget>

<style>
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
