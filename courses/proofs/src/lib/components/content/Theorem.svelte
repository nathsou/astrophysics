<!--
  A theorem-like statement: Theorem 4.1 (Euclid, c. 300 BC). Body in italic, the classical style.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    kind = 'theorem',
    n,
    name,
    who,
    year,
    title,
    children,
  }: { kind?: string; n?: string; name?: string; who?: string; year?: string | number; title?: string; children?: Snippet } = $props();

  const label = $derived(kind.charAt(0).toUpperCase() + kind.slice(1));
  const attribution = $derived([name ?? title, who, year].filter(Boolean).join(', '));
</script>

<div class="thm" data-kind={kind} role="group" aria-label="{label} {n ?? ''}">
  <p class="head">
    <span class="label ui">{label}{#if n}&nbsp;{n}{/if}</span>
    {#if attribution}<span class="attr">({attribution})</span>{/if}
  </p>
  <div class="body">{@render children?.()}</div>
</div>

<style>
  .thm {
    margin: 1.75rem 0;
    padding: 0.85rem 1.2rem 0.2rem;
    border-left: 3px solid var(--accent);
    background: color-mix(in srgb, var(--accent) 4%, var(--surface));
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  }
  .thm[data-kind='lemma'],
  .thm[data-kind='claim'] {
    border-left-color: color-mix(in srgb, var(--accent) 55%, var(--rule-strong));
    background: var(--surface);
  }
  .thm[data-kind='corollary'] {
    border-left-style: double;
    border-left-width: 4px;
  }
  .thm[data-kind='conjecture'] {
    border-left: 3px dashed var(--history);
    background: var(--history-soft);
  }
  .head {
    margin: 0 0 0.35rem !important;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.5rem;
    align-items: baseline;
  }
  .label {
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .thm[data-kind='conjecture'] .label {
    color: var(--history);
  }
  .attr {
    font-size: 0.95rem;
    color: var(--ink-2);
  }
  .body {
    font-style: italic;
  }
  .body :global(p) {
    margin: 0 0 0.75rem;
  }
  .body :global(.katex) {
    font-style: normal;
  }
</style>
