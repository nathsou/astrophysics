<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tryPageDocs } from './context';
  import Floating from '../ui/Floating.svelte';

  let { id, children }: { id: string; children?: Snippet } = $props();
  const docs = tryPageDocs();
  const entry = $derived(docs.glossary[id]);
  let anchor = $state<HTMLElement | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hide = () => (timer = setTimeout(() => (anchor = null), 150));
</script>

<button
  type="button"
  class="gloss"
  onpointerenter={(e) => {
    clearTimeout(timer);
    anchor = e.currentTarget;
  }}
  onpointerleave={hide}
  onfocus={(e) => (anchor = e.currentTarget)}
  onblur={() => (anchor = null)}>{@render children?.()}</button
>{#if anchor && entry}<Floating {anchor} width="20rem" onenter={() => clearTimeout(timer)} onleave={hide}
    ><span class="term">{entry.term}</span><span class="def">{@html entry.definition}</span></Floating
  >{/if}

<style>
  .gloss {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    text-decoration: underline dotted var(--ink-3);
    text-underline-offset: 0.2em;
    cursor: help;
  }
  .term {
    display: block;
    font-weight: 650;
    margin-bottom: 0.2rem;
  }
  .def {
    display: block;
  }
</style>
