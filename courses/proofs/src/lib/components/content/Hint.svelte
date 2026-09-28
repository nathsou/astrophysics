<script lang="ts">
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import { getHints } from './zoom';

  let { title, children }: { title?: string; children?: Snippet } = $props();
  const hints = getHints();
  const index = hints.claim();
</script>

{#if index < hints.current}
  <li transition:slide={{ duration: 180 }}>
    {#if title}<strong>{title}</strong>{/if}
    <div class="text">{@render children?.()}</div>
  </li>
{/if}

<style>
  li {
    margin: 0.35rem 0;
    font-family: var(--font-body);
    font-size: 1rem;
  }
  strong {
    font-family: var(--font-ui);
    font-size: 0.85rem;
  }
  .text :global(p) {
    margin: 0.1rem 0 0.5rem;
  }
</style>
