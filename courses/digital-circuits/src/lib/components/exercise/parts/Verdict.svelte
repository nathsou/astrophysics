<!-- The verdict line of a checked exercise: a mark, a sentence and a background, never colour alone. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { ok, children }: { ok: boolean; children: Snippet } = $props();
</script>

<div class="verdict ui" class:ok class:bad={!ok} role="status" aria-live="polite">
  <strong>{ok ? '✓' : '✗'} {@render children()}</strong>
</div>

<style>
  .verdict {
    margin-top: 0.4rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--line-strong);
  }
  .verdict.ok {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  .verdict.bad {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
</style>
