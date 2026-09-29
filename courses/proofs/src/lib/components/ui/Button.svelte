<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    variant = 'secondary',
    size = 'md',
    children,
    ...rest
  }: { variant?: 'primary' | 'secondary' | 'ghost'; size?: 'sm' | 'md'; children?: Snippet } & HTMLButtonAttributes = $props();
</script>

<button class="btn ui {variant} {size}" {...rest}>{@render children?.()}</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border-radius: var(--radius-sm);
    border: 2px solid var(--fg);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.84rem;
    font-weight: 700;
    padding: 0.32rem 0.8rem;
    cursor: pointer;
    transition: background-color 120ms, color 120ms, transform 60ms;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    background: var(--pn);
  }
  .btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
  }
  .ghost {
    border-color: transparent;
    background: transparent;
    color: var(--ink-2);
  }
  .ghost:hover:not(:disabled) {
    border-color: var(--fg);
  }
  .sm {
    font-size: 0.78rem;
    padding: 0.2rem 0.55rem;
  }
</style>
