<script lang="ts">
  import type { Snippet } from 'svelte';
  let { caption, wide = false, credit, children }: { caption?: string; wide?: boolean; credit?: string; children?: Snippet } = $props();
</script>

<figure class="figure" class:wide>
  {@render children?.()}
  {#if caption || credit}
    <figcaption class="ui">
      {caption ?? ''}
      {#if credit}<span class="credit">{credit}</span>{/if}
    </figcaption>
  {/if}
</figure>

<style>
  .figure {
    margin: 2rem 0;
  }
  .figure :global(img) {
    display: block;
    margin: 0 auto;
    border-radius: var(--radius-sm);
  }
  figcaption {
    margin-top: 0.6rem;
    font-size: 0.84rem;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .credit {
    display: block;
    color: var(--ink-3);
    font-size: 0.76rem;
    margin-top: 0.2rem;
  }
</style>
