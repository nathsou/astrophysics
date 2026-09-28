<!--
  A hint ladder: each click reveals one more rung.
    ::::hints
    :::hint[Which technique?] … :::
    ::::
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../ui/Icon.svelte';
  import { setHints } from './zoom';

  let { title, children }: { title?: string; children?: Snippet } = $props();

  let current = $state(0);
  const counter = { n: 0 };
  setHints({
    claim: () => counter.n++,
    get current() {
      return current;
    },
  });
</script>

<section class="hints ui" aria-label={title ?? 'Hints'}>
  <header>
    <Icon name="tip" size={15} />
    <span class="kind">Hints</span>
    {#if title}<span class="title">{title}</span>{/if}
  </header>
  <ol>{@render children?.()}</ol>
  {#if current < counter.n}
    <button onclick={() => current++}>
      {current === 0 ? 'Show the first hint' : current === counter.n - 1 ? 'Show the last hint' : 'Show another hint'}
      <span class="count">{current}/{counter.n}</span>
    </button>
  {:else}
    <button class="hide" onclick={() => (current = 0)}>Hide hints</button>
  {/if}
</section>

<style>
  .hints {
    margin: 1.75rem 0;
    padding: 0.75rem 1rem 0.85rem;
    border: 1px dashed color-mix(in srgb, var(--tip) 50%, var(--border));
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--tip) 4%, var(--surface));
    font-size: 0.9rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--tip);
  }
  .kind {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 650;
  }
  .title {
    color: var(--ink);
    font-weight: 600;
  }
  ol {
    margin: 0.5rem 0 0.4rem;
    padding-left: 1.4rem;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    font-size: 0.82rem;
  }
  button:hover {
    border-color: var(--tip);
  }
  .count {
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .hide {
    color: var(--ink-2);
  }
</style>
