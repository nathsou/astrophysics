<script lang="ts">
  /** Progress dots, the Next button, and the end-of-exercise summary. */
  import type { Snippet } from 'svelte';
  import { settings } from '$lib/state/settings.svelte';
  import { sfx } from '$lib/audio/sfx';
  import type { Sequence } from '$lib/exercises/sequence.svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    seq,
    report,
    children,
    feedback,
    canReveal = false,
    onreveal,
  }: {
    seq: Sequence;
    report: (ok: boolean) => void;
    children: Snippet;
    feedback?: Snippet;
    canReveal?: boolean;
    onreveal?: () => void;
  } = $props();

  let nextBtn: HTMLButtonElement | undefined = $state();
  $effect(() => {
    if (seq.settled && nextBtn) nextBtn.focus({ preventScroll: true });
  });

  function next() {
    const last = seq.index + 1 >= seq.length;
    seq.next();
    if (last) {
      report(seq.passed);
      sfx('done', settings.data.sounds);
    }
  }

  const messages = [
    [1, '完美！ Perfect. Every one right first time.'],
    [0.8, '很好！ Very good.'],
    [0.6, '不错！ Not bad at all.'],
    [0, 'Worth another go: the second round is where it sticks.'],
  ] as const;
  const message = $derived(messages.find(([t]) => seq.score / seq.length >= t)![1]);
</script>

{#if !seq.done}
  {#if seq.length > 1}
    <ol class="dots" aria-label="Question {seq.index + 1} of {seq.length}">
      {#each seq.first as r, i (i)}
        <li class:current={i === seq.index} class:right={r === true} class:wrong={r === false}></li>
      {/each}
    </ol>
  {/if}
  {@render children()}
  <div class="actions ui">
    <div class="fb" aria-live="polite">{@render feedback?.()}</div>
    {#if seq.settled}
      <button class="btn primary" bind:this={nextBtn} onclick={next}>
        {seq.index + 1 >= seq.length ? 'Finish' : 'Next'}
        <Icon name="arrow" size={16} />
      </button>
    {:else if canReveal}
      <button class="btn ghost small" onclick={() => (seq.reveal(), onreveal?.())}>Show me</button>
    {/if}
  </div>
{:else}
  <div class="summary ui">
    <p class="score"><strong>{seq.score}</strong> / {seq.length} right first time</p>
    <p class="msg">{message}</p>
    <button class="btn" onclick={() => seq.restart()}><Icon name="refresh" size={16} />Again</button>
  </div>
{/if}

<style>
  .dots {
    display: flex;
    gap: 0.3rem;
    list-style: none;
    padding: 0;
    margin: 0 0 0.9rem;
  }
  .dots li {
    width: 1.4rem;
    height: 0.3rem;
    border-radius: 999px;
    background: var(--line);
  }
  .dots li.current {
    background: var(--mute);
  }
  .dots li.right {
    background: var(--jade);
  }
  .dots li.wrong {
    background: var(--accent);
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    margin-top: 1rem;
    min-height: 2.4rem;
  }
  .fb {
    flex: 1;
    font-size: 0.92rem;
    line-height: 1.45;
  }
  .summary {
    text-align: center;
    padding: 0.6rem 0 0.2rem;
  }
  .score {
    margin: 0;
    font-size: 1.05rem;
  }
  .score strong {
    font-size: 1.6rem;
    color: var(--accent-ink);
  }
  .msg {
    margin: 0.3rem 0 0.9rem;
    color: var(--ink-2);
  }
</style>
