<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    year,
    title,
    people,
    children,
  }: { year?: number | string; title?: string; people?: string; children?: Snippet } = $props();
</script>

<section class="history" aria-label={title ? `History: ${title}` : 'History'}>
  <div class="rail ui">
    <span class="tag"><Icon name="history" size={14} /> History</span>
    {#if year}<span class="year">{year}</span>{/if}
  </div>
  <div class="content">
    {#if title}<h4 class="ui">{title}</h4>{/if}
    {#if people}<p class="people ui">{people}</p>{/if}
    {@render children?.()}
  </div>
</section>

<style>
  .history {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 1.25rem;
    margin: 2.25rem 0;
    padding: 1.2rem 1.3rem 0.5rem;
    background: var(--history-soft);
    border-top: 2px solid var(--fg);
    border-bottom: 2px solid var(--fg);
    position: relative;
  }
  .rail {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border-right: 2px solid var(--fg);
    padding-right: 1rem;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--history);
  }
  .year {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--ink);
  }
  h4 {
    margin: 0 0 0.2rem !important;
    font-size: 1.1rem !important;
  }
  .people {
    margin: 0 0 0.7rem !important;
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .content {
    font-size: 1.02rem;
    min-width: 0;
  }
  .content :global(p) {
    margin-bottom: 0.8rem;
  }
  @media (max-width: 640px) {
    .history {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    .rail {
      flex-direction: row;
      align-items: baseline;
      justify-content: space-between;
      border-right: 0;
      padding: 0;
    }
    .year {
      font-size: 1.4rem;
    }
  }
</style>
