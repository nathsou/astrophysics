<script lang="ts">
  let { items }: { items: { label: string; color: string; dashed?: boolean; dot?: boolean }[] } = $props();
</script>

<ul class="legend ui">
  {#each items as it (it.label)}
    <li>
      <svg width="18" height="10" aria-hidden="true">
        {#if it.dot}
          <circle cx="9" cy="5" r="4" fill={it.color} />
        {:else}
          <line x1="1" x2="17" y1="5" y2="5" stroke={it.color} stroke-width="2.5" stroke-linecap="round" stroke-dasharray={it.dashed ? '3 3' : undefined} />
        {/if}
      </svg>
      {it.label}
    </li>
  {/each}
</ul>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    list-style: none;
    margin: 0 0 0.4rem;
    padding: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0 !important;
  }
</style>
