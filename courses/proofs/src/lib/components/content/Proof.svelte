<!-- A proof, ending with the tombstone ∎ (Halmos's symbol). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title = 'Proof', children }: { title?: string; children?: Snippet } = $props();
</script>

<div class="proof" role="group" aria-label={title}>
  <p class="head"><em>{title}.</em></p>
  <div class="body">{@render children?.()}</div>
  <p class="qed" aria-label="End of proof">∎</p>
</div>

<style>
  .proof {
    margin: 1.25rem 0 1.75rem;
    padding: 0 0 0 1.2rem;
    border-left: 1px solid var(--rule-strong);
  }
  .head {
    margin: 0 0 0.4rem !important;
    font-weight: 600;
  }
  .body :global(p) {
    margin: 0 0 0.8rem;
  }
  .qed {
    margin: -0.6rem 0 0 !important;
    text-align: right;
    color: var(--ink-2);
    line-height: 1;
  }
</style>
