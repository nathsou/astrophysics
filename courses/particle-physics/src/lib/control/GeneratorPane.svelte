<!-- Stage 2 controls: the samples (process, share of the events), the K-factor, and which parts of the generator run. -->
<script lang="ts">
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { PROCESS_CHOICES, beamsOf } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { int, xsec } from './fmt.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  const g = $derived(session.config.generator);
  const infos = $derived(session.summary?.samples ?? []);
  const known = (name: string) => PROCESS_CHOICES.some((p) => p.name === name);
  const setProcess = (i: number, name: string) => {
    const s = session.config.generator.samples[i]!;
    s.process = name;
    s.options = undefined;
    s.window = undefined;
    s.label = PROCESS_CHOICES.find((p) => p.name === name)?.label ?? name;
    const beams = beamsOf(name);
    if (i === 0 && session.config.machine.mode !== beams) {
      session.config.machine.mode = beams;
      if (beams === 'ee') { session.config.machine.sqrtS = 91.1876; session.config.machine.lumi = 2e31; session.config.machine.pileupMean = 0; }
      else if (session.config.machine.sqrtS < 1000) { session.config.machine.sqrtS = 13600; session.config.machine.lumi = undefined; }
    }
  };
  const hasEE = $derived(g.samples.some((s) => beamsOf(s.process) === 'ee'));
</script>

<div class="samples">
  {#each g.samples as s, i (s.name + i)}
    <div class="sample">
      <label class="cr-label" for="proc-{i}">{s.role === 'signal' ? 'Signal' : 'Background'} sample {i + 1}</label>
      <select id="proc-{i}" class="cr-select" value={s.process} onchange={(e) => setProcess(i, e.currentTarget.value)}>
        {#if !known(s.process)}<option value={s.process}>{s.process}</option>{/if}
        {#each PROCESS_CHOICES as p}<option value={p.name}>{p.label}</option>{/each}
      </select>
      <div class="meta ui">
        {#if s.options || s.window}
          <span class="cr-badge" title="Generator-level cuts: {JSON.stringify(s.options ?? {})} {s.window ? `window on m(${s.window.pdg}) ${s.window.lo}–${s.window.hi} GeV` : ''}">
            {s.window ? `window ${s.window.lo}–${s.window.hi} GeV` : 'cuts'}
          </span>
        {/if}
        {#if infos[i]}
          <span class="cr-mono">σ {xsec(infos[i]!.sigmaPb)} · {int(infos[i]!.n)} events</span>
        {/if}
      </div>
      {#if g.samples.length > 1}
        <Slider label="Share of events" min={1} max={9} step={1} value={s.share} format={(v) => String(Math.round(v))} oninput={(v) => (session.config.generator.samples[i]!.share = Math.round(v))} />
      {/if}
    </div>
  {/each}
</div>

<Slider label="K-factor on every cross-section" min={1} max={5} step={0.1} value={g.kFactor} format={(v) => v.toFixed(1)} oninput={(v) => (session.config.generator.kFactor = v)} />
<p class="cr-note">
  {#if g.kFactor === 1 && g.samples.every((s) => (s.kFactor ?? 1) === 1)}
    Cross-sections are leading order (K = 1). Higher orders raise them: by roughly 1.2 to 1.3 for W and Z, about 1.9 for tt̄ and about 3 for gg → H.
  {:else}
    Every cross-section is the leading-order value times K = {g.kFactor.toFixed(1)}. K only rescales the histograms; it does not change the events.
  {/if}
</p>
<div class="cr-row">
  <Toggle label="Parton shower" checked={g.shower} onchange={(c) => (session.config.generator.shower = c)} />
  <Toggle label="Hadronisation" checked={g.hadronise} onchange={(c) => (session.config.generator.hadronise = c)} />
  <Toggle label="Decays" checked={g.decay} onchange={(c) => (session.config.generator.decay = c)} />
  {#if hasEE}<Toggle label="Initial-state radiation" checked={g.isr} onchange={(c) => (session.config.generator.isr = c)} />{/if}
</div>

<style>
  .samples {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .sample {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px dashed var(--line);
  }
  .sample:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    align-items: center;
    font-size: 0.74rem;
    color: var(--mute);
  }
</style>
