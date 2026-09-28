<!-- A small anchored popover card (fixed-position, flips above when there is no room below). -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    anchor,
    children,
    width = '22rem',
    onenter,
    onleave,
  }: { anchor: HTMLElement; children: Snippet; width?: string; onenter?: () => void; onleave?: () => void } = $props();

  let el = $state<HTMLDivElement | undefined>();
  let pos = $state({ top: -9999, left: 0 });

  function place() {
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    const below = a.bottom + 8 + c.height < innerHeight;
    pos = {
      top: below ? a.bottom + 8 : a.top - c.height - 8,
      left: Math.min(Math.max(8, a.left + a.width / 2 - c.width / 2), innerWidth - c.width - 8),
    };
  }

  $effect(() => {
    void anchor;
    place();
    addEventListener('scroll', place, { passive: true, capture: true });
    addEventListener('resize', place);
    return () => {
      removeEventListener('scroll', place, { capture: true });
      removeEventListener('resize', place);
    };
  });
</script>

<div
  bind:this={el}
  class="floating ui"
  style:top="{pos.top}px"
  style:left="{pos.left}px"
  style:width
  role="tooltip"
  onpointerenter={onenter}
  onpointerleave={onleave}
>
  {@render children()}
</div>

<style>
  .floating {
    position: fixed;
    z-index: 60;
    max-width: calc(100vw - 16px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    padding: 0.7rem 0.9rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--ink);
    animation: pop 110ms ease-out;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }
</style>
