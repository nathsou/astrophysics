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
    margin: 1.9rem 0;
    padding: 0.8rem 1.1rem 0.9rem;
    border: 2px dashed var(--fg);
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 0.92rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--ink);
  }
  .kind {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 700;
  }
  .title {
    color: var(--ink);
    font-weight: 700;
  }
  ol {
    margin: 0.5rem 0 0.5rem;
    padding-left: 1.4rem;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 2px solid var(--fg);
    background: var(--surface);
    color: var(--ink);
    font-weight: 700;
    border-radius: var(--radius-sm);
    padding: 0.28rem 0.75rem;
    cursor: pointer;
    font-size: 0.84rem;
  }
  button:hover {
    background: var(--fx-yellow);
    color: var(--fx-ink);
  }
  .count {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.75rem;
    opacity: 0.75;
    font-variant-numeric: tabular-nums;
  }
  .hide {
    color: var(--ink-2);
  }
</style>
