<!-- Stage 1 controls: mode, √s, the beam parameters behind the luminosity (hep/machine machineStage), and the pile-up simulated with each hard collision. -->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { beamsOf, machineOf, type PipelineConfig } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { lumi as fmtLumi, sig, hz } from './fmt.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const m = $derived(session.config.machine);
  const stage = $derived(machineOf($state.snapshot(session.config) as PipelineConfig));
  const beamsMismatch = $derived(session.config.generator.samples.some((s) => beamsOf(s.process) !== m.mode));
  const isEE = $derived(m.mode === 'ee');
  const beam = $derived(m.beam ?? {});
  const setBeam = (k: string, v: number) => {
    session.config.machine.beam = { ...(session.config.machine.beam ?? {}), [k]: v };
    session.config.machine.lumi = undefined;
  };
  let useMachineMu = $derived(m.pileupMean === null);
  const energies = [
    { value: 7000, label: '7 TeV' },
    { value: 8000, label: '8' },
    { value: 13000, label: '13' },
    { value: 13600, label: '13.6' },
    { value: 14000, label: '14' },
  ];
</script>

<div class="cr-row">
  <div>
    <span class="cr-label">Mode</span>
    <Segmented
      label="Collision mode"
      size="sm"
      options={[{ value: 'pp', label: 'pp' }, { value: 'ppbar', label: 'pp̄' }, { value: 'ee', label: 'e⁺e⁻' }]}
      value={m.mode}
      onchange={(v) => {
        session.config.machine.mode = v as 'pp' | 'ee' | 'ppbar';
        if (v === 'ee') {
          session.config.machine.sqrtS = 91.1876;
          session.config.machine.lumi = 2e31;
          session.config.machine.pileupMean = 0;
        } else if (session.config.machine.sqrtS < 1000) {
          session.config.machine.sqrtS = 13600;
          session.config.machine.lumi = undefined;
          session.config.machine.pileupMean = 0;
        }
      }}
    />
  </div>
  {#if isEE}
    <div style="flex:1;min-width:11rem">
      <Slider label="√s [GeV]" min={20} max={250} step={0.5} value={m.sqrtS} format={(v) => v.toFixed(1)} oninput={(v) => (session.config.machine.sqrtS = v)} />
    </div>
  {:else}
    <div>
      <span class="cr-label">√s</span>
      <Segmented label="Centre-of-mass energy" size="sm" options={energies} value={m.sqrtS} onchange={(v) => (session.config.machine.sqrtS = v as number)} />
    </div>
  {/if}
</div>
{#if beamsMismatch}
  <p class="cr-warn">The generator's processes need {beamsOf(session.config.generator.samples[0]!.process) === 'ee' ? 'e⁺e⁻' : beamsOf(session.config.generator.samples[0]!.process) === 'ppbar' ? 'pp̄' : 'pp'} beams, but the mode is {m.mode === 'ee' ? 'e⁺e⁻' : m.mode === 'ppbar' ? 'pp̄' : 'pp'}.</p>
{/if}

{#if !isEE}
  <div class="cr-fields">
    <Slider label="Protons per bunch [10¹¹]" min={0.3} max={2.5} step={0.05} value={(beam.bunchIntensity ?? 1.6e11) / 1e11} format={(v) => v.toFixed(2)} oninput={(v) => setBeam('bunchIntensity', v * 1e11)} />
    <Slider label="Bunches" min={100} max={2808} step={4} value={beam.nBunches ?? 2400} format={(v) => String(Math.round(v))} oninput={(v) => setBeam('nBunches', Math.round(v))} />
    <Slider label="β* [m]" min={0.15} max={2} step={0.05} value={beam.betaStar ?? 0.6} format={(v) => v.toFixed(2)} oninput={(v) => setBeam('betaStar', v)} />
    <Slider label="Emittance ε_n [µm]" min={1} max={5} step={0.1} value={(beam.epsN ?? 2.5e-6) * 1e6} format={(v) => v.toFixed(1)} oninput={(v) => setBeam('epsN', v * 1e-6)} />
  </div>
{/if}

<dl class="read ui">
  <div><dt>luminosity</dt><dd>{fmtLumi(stage.lumi)}</dd></div>
  {#if !isEE}<div><dt>collisions per crossing μ</dt><dd>{sig(stage.mu, 3)}</dd></div>{/if}
  <div><dt>crossing rate</dt><dd>{hz(stage.crossingRateHz)}</dd></div>
</dl>

{#if !isEE}
  <Toggle label="Simulate the machine's μ" checked={useMachineMu} onchange={(c) => (session.config.machine.pileupMean = c ? null : 10)} />
  {#if !useMachineMu}
    <Slider label="Simulated pile-up collisions" min={0} max={60} step={1} value={m.pileupMean ?? 0} format={(v) => String(Math.round(v))} oninput={(v) => (session.config.machine.pileupMean = Math.round(v))} />
  {/if}
  <p class="cr-note">Each pile-up collision costs time. The machine at this luminosity makes μ = {sig(stage.mu, 2)}; the default runs fewer so that the figure fills quickly.</p>
{/if}

<style>
  .read {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.3rem 0.8rem;
    margin: 0;
    font-size: 0.8rem;
  }
  dt {
    color: var(--mute);
    font-size: 0.7rem;
    letter-spacing: 0.03em;
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
  }
</style>
