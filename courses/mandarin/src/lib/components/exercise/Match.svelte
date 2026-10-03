<script lang="ts">
  /** Match pairs: tap one on the left, then its partner on the right. */
  import type { Match } from '$lib/exercises/types';
  import { shuffle } from '$lib/exercises/shuffle';
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Rich from './Rich.svelte';
  import Icon from '../ui/Icon.svelte';

  let { data, id, report }: { data: Match; id: string; report: (ok: boolean) => void } = $props();
  let round = $state(0);
  const left = $derived(shuffle(data.pairs.map((_, i) => i), `${id}:l:${round}`));
  const right = $derived(shuffle(data.pairs.map((_, i) => i), `${id}:r:${round}`));
  let sel = $state<number | null>(null);
  let matched = $state<Set<number>>(new Set());
  let flash = $state<number | null>(null);
  let mistakes = $state(0);
  const done = $derived(matched.size === data.pairs.length);
  const isZh = (s: string) => /\p{Script=Han}/u.test(s);

  function pickLeft(i: number) {
    if (matched.has(i)) return;
    sel = i;
    const t = data.pairs[i]![0];
    if (data.listen || isZh(t)) void speech.say(t);
  }
  function pickRight(i: number) {
    if (sel === null || matched.has(i)) return;
    if (i === sel) {
      matched = new Set([...matched, i]);
      sfx('right', settings.data.sounds);
      sel = null;
      if (matched.size === data.pairs.length) {
        report(mistakes <= Math.floor(data.pairs.length / 3));
        sfx('done', settings.data.sounds);
      }
    } else {
      mistakes++;
      flash = i;
      sfx('wrong', settings.data.sounds);
      setTimeout(() => (flash = null), 400);
    }
  }
  function again() {
    round++;
    matched = new Set();
    mistakes = 0;
    sel = null;
  }
</script>

<div class="match">
  <div class="col">
    {#each left as i (i)}
      <button class="cell" class:sel={sel === i} class:done={matched.has(i)} onclick={() => pickLeft(i)} disabled={matched.has(i)}>
        {#if data.listen && !matched.has(i)}<Icon name="speaker" size={20} /><span class="sr-only">Sound {i + 1}</span>{:else}<Rich text={data.pairs[i]![0]} plain />{/if}
      </button>
    {/each}
  </div>
  <div class="col">
    {#each right as i (i)}
      <button class="cell" class:done={matched.has(i)} class:flash={flash === i} onclick={() => pickRight(i)} disabled={matched.has(i) || sel === null}>
        <Rich text={data.pairs[i]![1]} pinyin={data.listen ? 'hide' : 'auto'} plain />
      </button>
    {/each}
  </div>
</div>
<div class="foot ui" aria-live="polite">
  {#if done}
    <span><strong>{mistakes === 0 ? '完美！ No mistakes.' : `Done, with ${mistakes} slip${mistakes > 1 ? 's' : ''}.`}</strong></span>
    <button class="btn small" onclick={again}><Icon name="refresh" size={14} />Again</button>
  {:else}
    <span class="hint">{sel === null ? 'Tap an item on the left…' : '…now its partner on the right.'}</span>
  {/if}
</div>

<style>
  .match {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1.2rem;
  }
  .col {
    display: grid;
    gap: 0.45rem;
    align-content: start;
  }
  .cell {
    min-height: 3rem;
    padding: 0.4rem 0.7rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--fg);
    transition: border-color 100ms, background-color 100ms, opacity 200ms;
  }
  .cell:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .cell.sel {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .cell.done {
    border-color: var(--jade);
    background: var(--jade-soft);
    opacity: 0.65;
  }
  .cell.flash {
    border-color: var(--accent);
    animation: shake 300ms;
  }
  .cell:disabled:not(.done) {
    cursor: default;
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.8rem;
    min-height: 2rem;
    font-size: 0.9rem;
  }
  .hint {
    color: var(--mute);
  }
  @keyframes shake {
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
</style>
