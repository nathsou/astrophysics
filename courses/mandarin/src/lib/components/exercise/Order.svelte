<script lang="ts">
  import { untrack } from 'svelte';
  /** Build the Chinese sentence from tiles. Word order is where Chinese grammar lives. */
  import type { Order } from '$lib/exercises/types';
  import { Sequence } from '$lib/exercises/sequence.svelte';
  import { scramble } from '$lib/exercises/shuffle';
  import { settings } from '$lib/state/settings.svelte';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Steps from './Steps.svelte';
  import Feedback from './Feedback.svelte';
  import Zh from '../zh/Zh.svelte';

  let { data, id, report }: { data: Order; id: string; report: (ok: boolean) => void } = $props();
  const seq = new Sequence(untrack(() => data.items.length));
  const item = $derived(data.items[seq.index]!);
  const answer = $derived(item.zh.split(/\s+/));
  const accepted = $derived([item.zh, ...(item.also ?? [])].map((s) => s.split(/\s+/).join('|')));
  type Tile = { k: number; t: string };
  const tiles = $derived<Tile[]>(scramble([...answer, ...(item.extra ?? [])], `${id}:${seq.index}:${seq.round}`).map((t, k) => ({ k, t })));
  let placed = $state<Tile[]>([]);
  let last = $state<boolean | null>(null);
  const bank = $derived(tiles.filter((t) => !placed.some((p) => p.k === t.k)));
  const sentence = $derived(placed.map((p) => p.t).join(''));

  $effect(() => {
    void seq.index;
    void seq.round;
    placed = [];
    last = null;
  });

  function add(t: Tile) {
    if (seq.settled) return;
    placed = [...placed, t];
    last = null;
  }
  function remove(t: Tile) {
    if (seq.settled) return;
    placed = placed.filter((p) => p.k !== t.k);
    last = null;
  }
  function check() {
    const ok = accepted.includes(placed.map((p) => p.t).join('|'));
    seq.attempt(ok);
    last = ok;
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
    if (ok) void speech.say(sentence);
  }
  function reveal() {
    const used = new Set<number>();
    placed = answer.map((t) => {
      const tile = tiles.find((x) => x.t === t && !used.has(x.k))!;
      used.add(tile.k);
      return tile;
    });
    last = null;
  }
</script>

<Steps {seq} {report} canReveal={last === false} onreveal={reveal}>
  <p class="en">“{item.en}”</p>
  <div class="answer" class:ok={seq.settled} aria-label="Your sentence">
    {#each placed as t (t.k)}
      <button class="tile placed" onclick={() => remove(t)} disabled={seq.settled}><Zh text={t.t} size="md" plain play={false} /></button>
    {:else}
      <span class="placeholder ui">Tap the tiles in order</span>
    {/each}
  </div>
  <div class="bank" aria-label="Tiles">
    {#each bank as t (t.k)}
      <button class="tile" onclick={() => add(t)} disabled={seq.settled}><Zh text={t.t} size="md" plain play={false} /></button>
    {/each}
  </div>
  {#snippet feedback()}
    {#if seq.settled}
      <Feedback ok={last ?? false} explain={item.explain} />
    {:else if last === false}
      <Feedback ok={false} text="Not that order. Tap a tile to take it back." />
    {:else}
      <button class="btn" disabled={placed.length < answer.length} onclick={check}>Check</button>
    {/if}
  {/snippet}
</Steps>

<style>
  .en {
    margin: 0 0 0.7rem;
    font-size: 1.05rem;
    font-style: italic;
  }
  .answer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-height: 3.6rem;
    padding: 0.45rem;
    border-bottom: 2px solid var(--line-strong);
    margin-bottom: 0.9rem;
    align-items: center;
  }
  .answer.ok {
    border-color: var(--jade);
  }
  .placeholder {
    color: var(--mute);
    font-size: 0.85rem;
    padding-left: 0.3rem;
  }
  .bank {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-height: 3rem;
  }
  .tile {
    padding: 0.2rem 0.65rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    border-bottom-width: 3px;
    background: var(--panel);
    cursor: pointer;
    transition: transform 80ms, border-color 100ms;
  }
  .tile:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .tile:active:not(:disabled) {
    transform: translateY(2px);
  }
  .tile.placed {
    background: var(--pn);
  }
  .tile:disabled {
    cursor: default;
  }
</style>
