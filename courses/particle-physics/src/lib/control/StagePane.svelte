<!--
  The frame of one stage of the pipeline: its name, whether it runs the reference code or the reader's ("reference" or "mine", from the hooks installed in the
  workers), its counters and speed, any errors its code raised, and the stage's controls (the children).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { STAGE_NAMES, STAGE_TITLES, type StageName } from '$lib/hep/pipeline/index.ts';
  import type { ControlSession } from './session.svelte.ts';
  import { int, sig } from './fmt.ts';
  import './control.css';

  let { stage, session, children, controls = true }: { stage: StageName; session: ControlSession; children?: Snippet; controls?: boolean } = $props();

  const summary = $derived(session.summary);
  const info = $derived(summary?.stages.find((s) => s.stage === stage));
  const mine = $derived(session.minePerStage[stage]);
  const errors = $derived((summary?.errors ?? []).filter((e) => e.stage === stage));
  const mineErrors = $derived(session.snap?.mine?.errors ?? {});
  const myProblems = $derived(Object.entries(mineErrors).filter(([h]) => session.mine.find((m) => m.hook === h)?.stage === stage));
  const num = $derived(STAGE_NAMES.indexOf(stage) + 1);
  const id = $props.id();
</script>

<section class="pane" class:mine={mine.length > 0} aria-labelledby="{id}-h">
  <header>
    <span class="num ui" aria-hidden="true">{num}</span>
    <h3 id="{id}-h" class="ui">{STAGE_TITLES[stage]}</h3>
    {#if mine.length}
      <span class="cr-badge mine" title="The reader's code runs here: {mine.join(', ')}">mine · {mine.join(', ')}</span>
    {:else}
      <span class="cr-badge" title="The library's reference implementation runs here">reference</span>
    {/if}
  </header>
  <div class="counters ui" aria-live="polite" aria-atomic="true">
    {#if info}
      <span class="speed" title="Events per second this stage manages on its own, on one core"><b>{info.eventsPerSecond >= 10 ? int(info.eventsPerSecond) : sig(info.eventsPerSecond, 2)}</b> events/s</span>
      {#each info.counters as c}<span>{c.label} <b>{int(c.value)}</b></span>{/each}
      {#each info.perEvent.slice(0, 3) as c}<span>{c.label} <b>{sig(c.value, 3)}</b></span>{/each}
    {:else}
      <span class="idle">No events yet. Press Start.</span>
    {/if}
  </div>
  {#each errors as e}
    <p class="cr-warn ui" role="alert">{e.count} event{e.count === 1 ? '' : 's'} lost in this stage: {e.message}</p>
  {/each}
  {#each myProblems as [h, msg]}
    <p class="cr-warn ui" role="alert">Your code for {h} could not be installed: {msg}</p>
  {/each}
  {#if controls && children}<div class="body ui">{@render children()}</div>{/if}
</section>

<style>
  .pane {
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--panel);
    padding: 0.7rem 0.85rem 0.85rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .pane.mine {
    border-color: var(--sig-high);
    box-shadow: 0 0 0 1px var(--sig-high-glow);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .num {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    background: var(--track-soft);
    color: var(--track-ink);
    flex: none;
  }
  h3 {
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    flex: 1;
    min-width: 6rem;
  }
  h3::before,
  h3::after {
    display: none !important;
  }
  .counters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.9rem;
    font-size: 0.76rem;
    color: var(--mute);
    font-family: var(--font-mono);
    background: var(--pn);
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
  }
  .counters b {
    color: var(--fg);
    font-weight: 600;
  }
  .speed b {
    color: var(--phosphor-ink);
  }
  .idle {
    font-family: var(--font-ui);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
</style>
