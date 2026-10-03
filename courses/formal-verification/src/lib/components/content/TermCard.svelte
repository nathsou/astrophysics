<script lang="ts">
  import type { TermDef } from '$lib/content/types';
  import { params } from '$lib/state/params.svelte';
  import Slider from '../ui/Slider.svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    def,
    anchor,
    pinned,
    onclose,
    onenter,
    onleave,
  }: {
    def: TermDef;
    anchor: HTMLElement;
    pinned: boolean;
    onclose: () => void;
    onenter: () => void;
    onleave: () => void;
  } = $props();

  let card = $state<HTMLDivElement | undefined>();
  let pos = $state({ top: 0, left: 0, above: false });

  function place() {
    if (!card || !anchor.isConnected) return;
    const a = anchor.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const margin = 10;
    const above = a.bottom + c.height + margin > innerHeight && a.top - c.height - margin > 0;
    const top = above ? a.top - c.height - margin : a.bottom + margin;
    const left = Math.min(Math.max(8, a.left + a.width / 2 - c.width / 2), innerWidth - c.width - 8);
    pos = { top, left, above };
  }

  $effect(() => {
    void anchor;
    void def;
    place();
    const onMove = () => (pinned ? place() : onclose());
    addEventListener('scroll', onMove, { passive: true, capture: true });
    addEventListener('resize', place);
    return () => {
      removeEventListener('scroll', onMove, { capture: true });
      removeEventListener('resize', place);
    };
  });

  const p = $derived(def.param);
  $effect(() => {
    if (p) params.init(p.key, p.value);
  });
</script>

<div
  bind:this={card}
  class="term-card ui"
  class:pinned
  class:above={pos.above}
  style:top="{pos.top}px"
  style:left="{pos.left}px"
  role="dialog"
  aria-label="Term explanation"
  tabindex="-1"
  onpointerenter={onenter}
  onpointerleave={onleave}
>
  <header>
    <div class="label">{@html def.label}</div>
    {#if pinned}
      <button class="close" onclick={onclose} aria-label="Close"><Icon name="close" size={15} /></button>
    {:else}
      <span class="hint">click to pin</span>
    {/if}
  </header>
  <dl>
    <dt>What</dt>
    <dd>{@html def.what}</dd>
    {#if def.why}
      <dt>Why it’s here</dt>
      <dd>{@html def.why}</dd>
    {/if}
    {#if def.effect}
      <dt>If you change it</dt>
      <dd>{@html def.effect}</dd>
    {/if}
  </dl>
  {#if p}
    <div class="param">
      <Slider
        min={p.min}
        max={p.max}
        step={p.step}
        log={p.log}
        value={params.get(p.key, p.value)}
        oninput={(v) => params.set(p.key, v)}
        label="Try it — linked to the figures on this page"
      />
    </div>
  {/if}
</div>

<style>
  .term-card {
    position: fixed;
    z-index: 50;
    width: min(24rem, calc(100vw - 16px));
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    padding: 0.8rem 1rem 0.6rem;
    font-size: 0.86rem;
    line-height: 1.5;
    animation: pop 120ms ease-out;
  }
  .pinned {
    box-shadow: inset 0 3px 0 var(--sig-high), var(--shadow-lg);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .label {
    font-weight: 700;
    font-size: 0.98rem;
  }
  .hint {
    font-size: 0.7rem;
    color: var(--ink-3);
    white-space: nowrap;
  }
  .close {
    border: 0;
    background: none;
    padding: 2px;
    cursor: pointer;
    color: var(--ink-3);
    border-radius: var(--radius-sm);
  }
  .close:hover {
    color: var(--ink);
    background: var(--surface-2);
  }
  dl {
    margin: 0;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 500;
    color: var(--ink-3);
    margin-top: 0.5rem;
  }
  dd {
    margin: 0.1rem 0 0;
    color: var(--ink);
  }
  .param {
    margin-top: 0.75rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--rule);
  }
</style>
