<script lang="ts">
  /** Deal cards one at a time; drop each into the right bucket. */
  import type { Sort } from '$lib/exercises/types';
  import { shuffle } from '$lib/exercises/shuffle';
  import { settings } from '$lib/state/settings.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { speech } from '$lib/audio/speech.svelte';
  import Rich from './Rich.svelte';
  import Icon from '../ui/Icon.svelte';

  let { data, id, report }: { data: Sort; id: string; report: (ok: boolean) => void } = $props();
  let round = $state(0);
  const deckOrder = $derived(shuffle(data.items.map((_, i) => i), `${id}:${round}`));
  let pos = $state(0);
  let mistakes = $state(0);
  let wrongBucket = $state<number | null>(null);
  let filed = $state<number[][]>([]);
  $effect(() => {
    void round;
    filed = data.buckets.map(() => []);
  });
  const current = $derived(pos < deckOrder.length ? data.items[deckOrder[pos]!]! : null);

  function drop(b: number) {
    if (!current) return;
    if (current[1] === b) {
      filed[b] = [...filed[b]!, deckOrder[pos]!];
      sfx('right', settings.data.sounds);
      if (/\p{Script=Han}/u.test(current[0])) void speech.say(current[0]);
      pos++;
      if (pos === deckOrder.length) {
        report(mistakes <= Math.floor(data.items.length / 4));
        sfx('done', settings.data.sounds);
      }
    } else {
      mistakes++;
      wrongBucket = b;
      sfx('wrong', settings.data.sounds);
      setTimeout(() => (wrongBucket = null), 400);
    }
  }
</script>

{#if data.prompt}<p class="prompt"><Rich text={data.prompt} /></p>{/if}
<div class="dealt">
  {#if current}
    {#key pos}<div class="cardlet"><Rich text={current[0]} size="md" /></div>{/key}
    <span class="left ui">{deckOrder.length - pos} left</span>
  {:else}
    <p class="ui done"><strong>{mistakes === 0 ? '完美！ All sorted, no slips.' : `All sorted, with ${mistakes} slip${mistakes > 1 ? 's' : ''}.`}</strong>
      <button class="btn small" onclick={() => ((round += 1), (pos = 0), (mistakes = 0))}><Icon name="refresh" size={14} />Again</button></p>
    {#if data.explain}<p class="explain"><Rich text={data.explain} /></p>{/if}
  {/if}
</div>
<div class="buckets" style="--n: {data.buckets.length}">
  {#each data.buckets as b, i (i)}
    <button class="bucket" class:wrong={wrongBucket === i} onclick={() => drop(i)} disabled={!current}>
      <span class="name"><Rich text={b} size="md" plain /></span>
      <span class="filed">
        {#each filed[i] ?? [] as k (k)}<span class="chip"><Rich text={data.items[k]![0]} pinyin="hide" plain /></span>{/each}
      </span>
    </button>
  {/each}
</div>

<style>
  .prompt {
    margin: 0 0 0.6rem;
  }
  .dealt {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 5.5rem;
    flex-wrap: wrap;
  }
  .cardlet {
    padding: 0.6rem 1.2rem;
    border-radius: 14px;
    background: var(--panel);
    border: 1.5px solid var(--line-strong);
    box-shadow: var(--shadow);
    animation: deal 220ms ease-out;
  }
  @keyframes deal {
    from {
      transform: translateY(-12px) rotate(-3deg);
      opacity: 0;
    }
  }
  .left {
    color: var(--mute);
    font-size: 0.8rem;
  }
  .done {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    margin: 0;
  }
  .explain {
    width: 100%;
    margin: 0.4rem 0 0;
    color: var(--ink-2);
    font-size: 0.95rem;
  }
  .buckets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr));
    gap: 0.5rem;
    margin-top: 0.8rem;
  }
  .bucket {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    min-height: 5.5rem;
    padding: 0.5rem;
    border: 2px dashed var(--line-strong);
    border-radius: 14px;
    background: var(--pn);
    cursor: pointer;
    color: var(--fg);
    font-family: var(--font-body);
  }
  .bucket:hover:not(:disabled) {
    border-color: var(--accent);
    border-style: solid;
  }
  .bucket.wrong {
    border-color: var(--accent);
    animation: shake 300ms;
  }
  .bucket:disabled {
    cursor: default;
  }
  .filed {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    justify-content: center;
  }
  .chip {
    font-size: 0.8rem;
    background: var(--panel);
    border-radius: 6px;
    padding: 0 0.3rem;
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
