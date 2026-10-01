<!-- The histograms of a run: the main observable with its fit, pseudo-data and truth overlay, then the other observables. They fill as events stream in. -->
<script lang="ts">
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Histogram from './Histogram.svelte';
  import { OBSERVABLES } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { plusMinus, sig, int } from './fmt.ts';
  import './control.css';

  let { session, secondary = true, mainHeight = 340 }: { session: ControlSession; secondary?: boolean; mainHeight?: number } = $props();
  const s = $derived(session.summary);
  const real = $derived(session.realHistogram);
  let logY = $state(false);
  let showTruth = $state(false);
  let showFit = $state(true);
  const main = $derived(s?.observables[0]);
  const others = $derived(s?.observables.slice(1) ?? []);
  const fit = $derived(s?.fit);
</script>

{#if s && main}
  <div class="cr-row ctl ui">
    <Toggle label="Log y" checked={logY} onchange={(c) => (logY = c)} />
    {#if OBSERVABLES[main.name]?.truth}<Toggle label="Truth level" checked={showTruth} onchange={(c) => (showTruth = c)} />{/if}
    {#if fit}<Toggle label="Fit" checked={showFit} onchange={(c) => (showFit = c)} />{/if}
    <span class="src cr-badge" title={session.view?.source === 'precomputed' ? 'Computed offline by scripts/data/samples.ts with the same code and seeds' : 'Computed in this browser'}>
      {session.view?.source === 'precomputed' ? `precomputed sample, ${int(session.view.events)} events` : `live, ${int(s.n)} events`}
    </span>
  </div>
  <Histogram obs={main} summary={s} main log={logY} {showTruth} {showFit} real={real ? { edges: real.edges, counts: real.counts, manifest: real.manifest } : null} height={mainHeight} />
  <p class="cr-note ui">
    {#if s.lumiFb !== null}
      Expected events at {sig(s.lumiFb)} fb⁻¹, from leading-order cross-sections{s.isLO ? ' (K = 1)' : ` times K = ${s.kFactor.toFixed(1)}`}. {s.isLO ? 'The normalisation is leading order: higher orders would raise it.' : ''}
    {:else}
      Simulated events, not scaled to a luminosity.
    {/if}
    {main.smoothed ? 'The background is a smooth fit to the simulated background samples, as an analysis would use an analytic shape.' : ''}
  </p>
  {#if secondary && others.length}
    <div class="others">
      {#each others as o (o.name)}
        <div>
          <h4 class="ui">{o.label}{o.unit ? ` [${o.unit}]` : ''}</h4>
          <Histogram obs={o} summary={s} height={230} />
        </div>
      {/each}
    </div>
  {/if}
{:else}
  <p class="cr-note ui">No histogram yet. Press Start: the events stream through the six stages and the histograms fill as they arrive.</p>
{/if}

<style>
  .ctl {
    margin-bottom: 0.4rem;
  }
  .src {
    margin-left: auto;
  }
  .others {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    margin-top: 0.8rem;
  }
  h4 {
    font-size: 0.82rem;
    font-weight: 600;
    margin: 0 0 0.2rem;
    color: var(--ink-2);
    border: 0;
    padding: 0;
  }
</style>
