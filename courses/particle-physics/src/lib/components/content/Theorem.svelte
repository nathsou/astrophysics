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
    margin: 1.9rem 0;
    padding: 0.95rem 1.3rem 0.25rem;
    border-left: 3px solid var(--track);
    background: var(--pn);
    border-radius: 0;
  }
  .thm[data-kind='lemma'],
  .thm[data-kind='claim'] {
    border-left-color: var(--c-programmer);
  }
  .thm[data-kind='corollary'] {
    border-left-color: var(--sig-high);
  }
  .thm[data-kind='conjecture'] {
    border: 1px dashed var(--line-strong);
    background: transparent;
  }
  .head {
    margin: 0 0 0.4rem !important;
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.6rem;
    align-items: baseline;
  }
  .label {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.74rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .thm[data-kind='lemma'] .label,
  .thm[data-kind='claim'] .label {
    color: var(--ok);
  }
  .thm[data-kind='corollary'] .label,
  .thm[data-kind='conjecture'] .label {
    color: var(--history);
  }
  .attr {
    font-family: var(--font-ui);
    font-size: 0.9rem;
    font-weight: 500;
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
