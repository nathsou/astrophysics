<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children?: Snippet } = $props();
</script>

<kbd>{@render children?.()}</kbd>

<style>
  kbd {
    font-family: var(--font-mono);
    font-size: 0.8em;
    padding: 0.1em 0.4em;
    border: 1px solid var(--rule-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--surface);
  }
</style>
