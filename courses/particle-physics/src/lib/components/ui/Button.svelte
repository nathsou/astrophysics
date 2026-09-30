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
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.1rem;
    border-radius: 7px;
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    font-size: 0.86rem;
    font-weight: 500;
    padding: 0.3rem 0.9rem;
    cursor: pointer;
    box-shadow: var(--shadow);
    transition: background-color 120ms, color 120ms, border-color 120ms, transform 60ms;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--track);
    color: var(--track-ink);
  }
  .btn:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: none;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }
  .primary:hover:not(:disabled) {
    background: var(--accent-ink);
    border-color: var(--accent-ink);
    color: var(--on-accent);
  }
  .ghost {
    border-color: transparent;
    background: transparent;
    color: var(--ink-2);
    box-shadow: none;
  }
  .ghost:hover:not(:disabled) {
    background: var(--pn);
    border-color: transparent;
    color: var(--fg);
  }
  .sm {
    min-height: 1.75rem;
    font-size: 0.78rem;
    padding: 0.15rem 0.6rem;
    border-radius: 6px;
  }
</style>
