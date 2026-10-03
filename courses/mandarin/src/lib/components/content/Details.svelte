<script lang="ts">
  import type { Snippet } from 'svelte';
  let { summary, children }: { summary: string; children: Snippet } = $props();
</script>

<details>
  <summary class="ui">{summary}</summary>
  <div class="inner">{@render children()}</div>
</details>

<style>
  details {
    margin: 1.4rem 0;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
  }
  summary {
    cursor: pointer;
    padding: 0.7rem 1rem;
    font-weight: 600;
    font-size: 0.92rem;
  }
  .inner {
    padding: 0 1.1rem 0.6rem;
  }
</style>
