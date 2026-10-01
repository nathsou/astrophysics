<!--
  The oscillation lab: the flagship figure of Chapter 31. Three-flavour oscillation probabilities from the PMNS matrix (hep/oscillations),
  by exact numerical propagation, in vacuum or through constant-density matter. The horizontal axis is L/E at the chosen energy; the marker shows
  the chosen baseline. Presets set the flavour, energy and baseline of real experiments; the parameters start at rounded global-fit values.

    ::oscillation-lab{n="31.1" caption="…"}    Props: `preset` (initial preset id), `n`, `caption`, `title`.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from './LinePlot.svelte';
  import { GLOBAL_FIT_APPROX, paramsFromSin2, probabilities3, oscillationLength, OSC_PHASE_CONSTANT } from '$lib/hep/oscillations';
  import { logspace, sig, sci } from './format';

  let { preset: preset0 = 'atm', n, caption, title = 'Oscillation lab: three flavours, vacuum and matter' }: { preset?: string; n?: string | number; caption?: string; title?: string } = $props();

  interface Preset {
    id: string;
    label: string;
    flavour: number;
    anti: boolean;
    E: number;
    L: number;
    matter: number;
    note: string;
  }
  const PRESETS: Preset[] = [
    { id: 'atm', label: 'Atmospheric', flavour: 1, anti: false, E: 1, L: 500, matter: 0, note: 'Super-Kamiokande sees muon neutrinos made in the atmosphere, from overhead (15 km) to through the Earth (12,700 km), mostly near 1 GeV. The first dip of ν_μ survival at 1 GeV is near 500 km.' },
    { id: 'kamland', label: 'Reactor, 180 km', flavour: 0, anti: true, E: 0.004, L: 180, matter: 0, note: 'Electron antineutrinos of about 4 MeV from nuclear reactors, seen by KamLAND at a flux-weighted distance of about 180 km: the solar oscillation, at Δm²₂₁.' },
    { id: 'juno', label: 'Reactor, 53 km', flavour: 0, anti: true, E: 0.004, L: 53, matter: 0, note: 'The same antineutrinos at about 53 km, JUNO’s distance: the solar oscillation has a fast ripple on it, from Δm²₃₁ and θ₁₃.' },
    { id: 'short', label: 'Reactor, 1.7 km', flavour: 0, anti: true, E: 0.0035, L: 1.7, matter: 0, note: 'A short-baseline reactor experiment (about 1.7 km): a small, clean dip from θ₁₃ at the atmospheric splitting.' },
    { id: 't2k', label: 'Beam, 295 km', flavour: 1, anti: false, E: 0.6, L: 295, matter: 2.6, note: 'A T2K-like beam: muon neutrinos of 0.6 GeV over 295 km of crust. Watch P(ν_μ → ν_e): a few per cent, and different for antineutrinos.' },
    { id: 'dune', label: 'Beam, 1300 km', flavour: 1, anti: false, E: 2.5, L: 1300, matter: 2.85, note: 'A DUNE-like beam: 1300 km of crust at a few GeV. Matter effects are large here and depend on the mass ordering.' },
    { id: 'opera', label: 'Beam, 730 km', flavour: 1, anti: false, E: 17, L: 730, matter: 2.8, note: 'The CNGS beam from CERN to Gran Sasso, as OPERA saw it: muon neutrinos of about 17 GeV, where only about 1.7 % have turned into ν_τ by the time they arrive.' },
  ];

  const g = GLOBAL_FIT_APPROX;
  let s12 = $state<number>(g.sin2theta12);
  let s23 = $state<number>(g.sin2theta23);
  let s13 = $state<number>(g.sin2theta13);
  let delta = $state<number>(g.deltaCPDeg);
  let dm21 = $state<number>(g.dm21);
  let dm3l = $state<number>(g.dm3l);
  let ordering = $state<'normal' | 'inverted'>('normal');
  let presetId = $state(untrack(() => preset0));
  const first = PRESETS.find((p) => p.id === untrack(() => preset0)) ?? PRESETS[0]!;
  let flavour = $state(first.flavour);
  let anti = $state(first.anti);
  let E = $state(first.E);
  let L = $state(first.L);
  let useMatter = $state(first.matter > 0);
  let density = $state(first.matter > 0 ? first.matter : 2.8);

  const preset = $derived(PRESETS.find((p) => p.id === presetId));
  function choose(id: string) {
    const p = PRESETS.find((q) => q.id === id);
    if (!p) return;
    presetId = id;
    flavour = p.flavour;
    anti = p.anti;
    E = p.E;
    L = p.L;
    useMatter = p.matter > 0;
    if (p.matter > 0) density = p.matter;
  }
  function resetParams() {
    s12 = g.sin2theta12;
    s23 = g.sin2theta23;
    s13 = g.sin2theta13;
    delta = g.deltaCPDeg;
    dm21 = g.dm21;
    dm3l = g.dm3l;
    ordering = 'normal';
  }

  const params = $derived(paramsFromSin2(s12, s13, s23, delta, dm21, dm3l, ordering));
  const opts = $derived({ matter: useMatter ? density : undefined, anti });
  const xs = logspace(0.3, 2e5, 900);
  const curves = $derived.by(() => {
    const out: number[][] = [[], [], []];
    for (const x of xs) {
      const P = probabilities3(params, x * E, E, opts)[flavour]!;
      for (let b = 0; b < 3; b++) out[b]!.push(P[b]!);
    }
    return out;
  });
  const here = $derived(probabilities3(params, L, E, opts)[flavour]!);
  const LoverE = $derived(L / E);
  const FLAV = ['ν_e', 'ν_μ', 'ν_τ'];
  const bar = (i: number) => (anti ? `ν̄_${'eμτ'[i]}` : FLAV[i]!);
  const colours = ['var(--p-electron)', 'var(--p-muon)', 'var(--p-tau)'];
  const dashes = ['', '7 3', '2 3'];
  const lines = $derived(
    [0, 1, 2].map((b) => ({ x: xs, y: curves[b]!, label: `→ ${bar(b)}${b === flavour ? ' (survival)' : ''}`, color: colours[b], dash: dashes[b], width: b === flavour ? 2.4 : 2 })),
  );
  const fmtE = (v: number) => (v < 0.1 ? `${sig(v * 1000, 3)} MeV` : `${sig(v, 3)} GeV`);
  const lOsc = $derived(oscillationLength(dm3l, E));
  const lSol = $derived(oscillationLength(dm21, E));
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <div class="row ui">
      <Segmented
        label="Experiment preset"
        size="sm"
        options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        bind:value={presetId}
        onchange={(v) => choose(v)}
      />
    </div>
    <div class="row ui">
      <Segmented label="Initial flavour" size="sm" options={[{ value: 0, label: 'ν_e' }, { value: 1, label: 'ν_μ' }, { value: 2, label: 'ν_τ' }]} bind:value={flavour} />
      <Toggle bind:checked={anti} label="Antineutrinos" />
      <Toggle bind:checked={useMatter} label="Matter" />
      <Segmented label="Mass ordering" size="sm" options={[{ value: 'normal', label: 'Normal' }, { value: 'inverted', label: 'Inverted' }]} bind:value={ordering} />
    </div>
    <div class="sliders">
      <Slider bind:value={E} min={0.001} max={30} log label="Energy E" format={fmtE} />
      <Slider bind:value={L} min={1} max={13000} log label="Baseline L [km]" format={(v) => sig(v, 3)} />
      {#if useMatter}<Slider bind:value={density} min={0.5} max={13} step={0.1} label="Density [g/cm³]" format={(v) => v.toFixed(1)} />{/if}
      <Slider bind:value={s12} min={0.2} max={0.45} step={0.001} label="sin²θ₁₂" format={(v) => v.toFixed(3)} />
      <Slider bind:value={s23} min={0.3} max={0.7} step={0.005} label="sin²θ₂₃" format={(v) => v.toFixed(3)} />
      <Slider bind:value={s13} min={0} max={0.06} step={0.0005} label="sin²θ₁₃" format={(v) => v.toFixed(4)} />
      <Slider bind:value={delta} min={0} max={360} step={1} label="CP phase δ [°]" format={(v) => v.toFixed(0)} />
      <Slider bind:value={dm21} min={2e-5} max={2e-4} step={1e-6} label="Δm²₂₁ [eV²]" format={(v) => sci(v, 2)} />
      <Slider bind:value={dm3l} min={1e-3} max={5e-3} step={1e-5} label={ordering === 'normal' ? 'Δm²₃₁ [eV²]' : '|Δm²₃₂| [eV²]'} format={(v) => sci(v, 3)} />
    </div>
    <div class="row ui"><Button onclick={resetParams} title="Back to the rounded global-fit values">Reset the mixing parameters</Button></div>
  {/snippet}

  {#if preset}<p class="ui note">{preset.note}</p>{/if}
  <LinePlot
    {lines}
    x={{ type: 'log', domain: [0.3, 2e5], label: `L/E [km/GeV], at E = ${fmtE(E)} (so L = ${sig(0.3 * E, 2)} … ${sig(2e5 * E, 2)} km)`, tickValues: [1, 10, 100, 1000, 1e4, 1e5] }}
    y={{ domain: [0, 1], label: `probability that a ${bar(flavour)} becomes …` }}
    vmarks={[{ value: LoverE, label: `L/E = ${sig(LoverE, 3)}`, color: 'var(--sig-high)', dash: '' }]}
    height={320}
    label="Oscillation probabilities against L over E for the chosen initial flavour, with the chosen baseline marked"
    format={(v) => sig(v, 3)}
  />
  <div class="readout ui" aria-live="polite">
    <table>
      <caption>At L = {sig(L, 3)} km, E = {fmtE(E)}{useMatter ? `, in matter of ${density.toFixed(1)} g/cm³` : ', in vacuum'}</caption>
      <thead><tr><th>{bar(flavour)} becomes</th>{#each [0, 1, 2] as b}<th>{bar(b)}</th>{/each}<th>sum</th></tr></thead>
      <tbody>
        <tr>
          <th>probability</th>
          {#each [0, 1, 2] as b}<td class:surv={b === flavour}>{here[b]!.toFixed(4)}</td>{/each}
          <td>{(here[0]! + here[1]! + here[2]!).toFixed(4)}</td>
        </tr>
      </tbody>
    </table>
    <p class="small">
      Phase constant 1.267 = {sig(OSC_PHASE_CONSTANT, 6)} (derived from ħc). At this energy the atmospheric oscillation repeats every {sig(lOsc, 3)} km, the solar one every {sig(lSol, 3)} km.
    </p>
  </div>
</Widget>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
    width: 100%;
  }
  .sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.4rem 1.2rem;
    width: 100%;
  }
  .note {
    margin: 0 0 0.6rem;
    font-size: 0.85rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .readout {
    margin-top: 0.7rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  caption {
    text-align: left;
    font-size: 0.78rem;
    color: var(--mute);
    padding-bottom: 0.25rem;
  }
  th,
  td {
    padding: 0.2rem 0.8rem 0.2rem 0;
    text-align: left;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
  }
  td {
    font-family: var(--font-mono);
  }
  .surv {
    color: var(--accent-ink, var(--track-ink));
    font-weight: 600;
  }
  .small {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    color: var(--mute);
  }
</style>
