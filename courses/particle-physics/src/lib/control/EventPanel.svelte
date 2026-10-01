<!-- The event display for events the trigger kept: step through them, overlay truth on reconstruction, select an object to see the truth it came from. -->
<script lang="ts">
  import EventDisplay from '$lib/display/EventDisplay.svelte';
  import { geometryFromDetectorConfig } from '$lib/display/geometry.ts';
  import { ecalOuterRadius, hcalOuterRadius } from '$lib/hep/detector/config.ts';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import type { FullEvent } from '$lib/hep/event/index.ts';
  import type { KeptEvent } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import './control.css';

  let { session }: { session: ControlSession } = $props();
  let filter = $state<'kept' | 'selected'>('kept');
  let index = $state(0);
  let selected = $state<string | null>(null);
  // The list is frozen while a run streams in, so that the event under study does not move; "Refresh" takes the latest.
  let frozen = $state.raw<KeptEvent[]>([]);
  const latest = $derived(session.kept);
  $effect(() => {
    if (frozen.length === 0 && latest.length > 0) frozen = latest;
    if (!session.running && latest.length > 0 && latest !== frozen && frozen.length < latest.length) frozen = latest;
    if (latest.length === 0 && frozen.length > 0 && !session.snap?.events) frozen = [];
  });
  const shown = $derived(frozen.filter((k) => filter === 'kept' || k.selected));
  const events = $derived<FullEvent[]>(shown.map((k) => k.event));
  const det = $derived(session.detector);
  const geometry = $derived(geometryFromDetectorConfig(det, { ecalOuterRadius: ecalOuterRadius(det), hcalOuterRadius: hcalOuterRadius(det) }));
  const current = $derived(shown[Math.min(index, shown.length - 1)]);
  $effect(() => {
    if (index >= shown.length) index = Math.max(0, shown.length - 1);
  });
  const fresh = $derived(Math.max(0, latest.length - frozen.length));
</script>

<div class="head ui">
  <Segmented label="Which events" size="sm" options={[{ value: 'kept', label: 'kept by the trigger' }, { value: 'selected', label: 'selected by the analysis' }]} value={filter} onchange={(v) => (filter = v as 'kept' | 'selected')} />
  <button type="button" class="cr-btn" onclick={() => (frozen = latest)} disabled={latest === frozen}>Refresh list{fresh > 0 ? ` (${fresh} new)` : ''}</button>
  {#if current}
    <span class="meta cr-mono" aria-live="polite">event {current.index} of {current.sample}{current.event.trigger?.length ? `, fired ${current.event.trigger.join(', ')}` : ''}{current.selected ? ', selected' : ''}</span>
  {/if}
</div>
{#if events.length > 0}
  <EventDisplay {events} {geometry} bind:index bind:selected showTruth={false} showReco views="3d,rphi,rz,lego" viewHeight={340} />
{:else}
  <p class="cr-note ui">No events to show yet. Run the pipeline: the first events the trigger keeps appear here (complete with hits, calorimeter cells, reconstructed objects and the truth record).</p>
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
    margin-bottom: 0.6rem;
  }
  .meta {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
</style>
