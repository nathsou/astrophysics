<script lang="ts">
  import type { Snippet } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    id,
    label,
    icon,
    title = null,
    optional = false,
    body,
  }: { id: string; label: string; icon: string; title?: string | null; optional?: boolean; body: Snippet<[(ok: boolean) => void]> } = $props();

  const result = $derived(progress.data.exercises[id]);
  const report = (ok: boolean) => progress.record(id, ok);
</script>

<section class="exercise card" data-exercise={id} aria-label="{label}{title ? `: ${title}` : ''}">
  <header class="ui">
    <span class="kind"><Icon name={icon} size={15} />{label}</span>
    {#if title}<span class="title">{title}</span>{/if}
    <span class="spacer"></span>
    {#if optional}<span class="opt">Optional</span>{/if}
    {#if result?.ok}
      <span class="status ok" title="You have completed this exercise"><Icon name="check" size={14} />Done</span>
    {:else if result}
      <span class="status tried" title="Attempted; not yet passed">Tried</span>
    {/if}
  </header>
  <div class="content">
    {@render body(report)}
  </div>
</section>

<style>
  .exercise {
    margin: 2rem 0;
    overflow: hidden;
    border-color: var(--line-strong);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.7rem;
    padding: 0.6rem 1rem;
    background: var(--pn);
    border-bottom: 1px solid var(--line);
    font-size: 0.82rem;
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 700;
    color: var(--accent-ink);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-size: 0.72rem;
  }
  .title {
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  .opt {
    font-size: 0.72rem;
    color: var(--mute);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 0 0.5rem;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-weight: 600;
    font-size: 0.76rem;
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
  }
  .ok {
    background: var(--jade-soft);
    color: var(--jade);
  }
  .tried {
    background: var(--gold-soft);
    color: var(--gold);
  }
  .content {
    padding: 1rem 1.1rem 1.1rem;
  }
</style>
