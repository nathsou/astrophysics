<!-- How a BPE token was built: a binary tree of merges down to raw bytes. -->
<script lang="ts">
  import type { BpeTokeniser } from '@lm/core/tokenise';
  import MergeTree from './MergeTree.svelte';

  let { tok, id, depth = 0 }: { tok: BpeTokeniser; id: number; depth?: number } = $props();
  const parts = $derived(depth < 12 ? tok.parts(id) : undefined);
</script>

<div class="node" class:leaf={!parts}>
  <span class="tok" title="token {id}{parts ? ` = ${parts[0]} + ${parts[1]}` : ' (byte)'}">{tok.show(id)}</span>
  {#if parts}
    <div class="kids">
      <MergeTree {tok} id={parts[0]} depth={depth + 1} />
      <MergeTree {tok} id={parts[1]} depth={depth + 1} />
    </div>
  {/if}
</div>

<style>
  .node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    position: relative;
  }
  .tok {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    white-space: pre;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: var(--accent-soft);
    color: var(--accent-ink);
    border: 1px solid color-mix(in srgb, var(--accent-2) 30%, transparent);
  }
  .leaf > .tok {
    background: var(--surface-2);
    color: var(--ink-2);
    border-color: var(--border);
  }
  .kids {
    display: flex;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid var(--rule-strong);
  }
</style>
