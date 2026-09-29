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
    border-radius: 7px;
    border: 1px solid var(--border-control);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.82rem;
    font-weight: 560;
    padding: 0.38rem 0.75rem;
    cursor: pointer;
    transition: background-color 120ms, border-color 120ms, transform 60ms;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--ink-3);
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
  .sm {
    font-size: 0.76rem;
    padding: 0.25rem 0.55rem;
  }
</style>
