<!--
  The "Run the original" drop zone of a history card.

    :::history{year=1800 title="Volta’s pile" run="Run the original"} … :::
    ::::run-original{title="Volta’s pile"}
    ::circuit{src="…"}
    ::::

  The history card's button dispatches a bubbling `run-original` event carrying the card's title. This
  wrapper listens for its own card's title, opens what it holds (a live circuit) and scrolls to it. Until
  then it shows a quiet placeholder with its own button, so the figure is reachable without the card too.
  The content is only mounted when opened, so an unopened figure costs nothing.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { prefersReducedMotion } from '$lib/theme/signals';

  let { title, label = 'Run the original', children }: { title: string; label?: string; children?: Snippet } = $props();

  let open = $state(false);
  let el: HTMLDivElement | undefined = $state();

  function show() {
    open = true;
    requestAnimationFrame(() => el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }));
  }

  onMount(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ title?: string }>).detail;
      if (d?.title === title) show();
    };
    window.addEventListener('run-original', on);
    return () => window.removeEventListener('run-original', on);
  });
</script>

<div class="ro" bind:this={el}>
  {#if open}
    {@render children?.()}
  {:else}
    <div class="ph ui">
      <p>“{title}” as a live circuit.</p>
      <button type="button" onclick={show}><Icon name="play" size={13} /> {label}</button>
    </div>
  {/if}
</div>

<style>
  .ro {
    margin: 1.5rem 0;
    scroll-margin: 5rem;
  }
  .ph {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.7rem 1rem;
    border: 1px dashed color-mix(in srgb, var(--c-history) 45%, var(--line));
    border-radius: var(--radius);
    color: var(--ink-2);
    font-size: 0.9rem;
  }
  .ph p {
    margin: 0;
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.32rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--c-history) 55%, var(--line));
    border-radius: 99px;
    background: transparent;
    color: var(--c-history);
    font-weight: 500;
    font-size: 0.84rem;
    cursor: pointer;
  }
  button:hover {
    background: color-mix(in srgb, var(--c-history) 10%, transparent);
  }
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
