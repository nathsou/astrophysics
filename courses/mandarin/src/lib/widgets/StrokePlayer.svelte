<script lang="ts">
  /** Watch characters being written, stroke by stroke. */
  import type HanziWriterType from 'hanzi-writer';
  import HanziCanvas from '$lib/components/zh/HanziCanvas.svelte';
  import { annotate } from '$lib/zh/annotate';
  import { lookup } from '$lib/zh/lexicon';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { chars = '十口日' }: { chars?: string } = $props();
  const list = $derived([...chars]);
  let writers = $state<(HanziWriterType | undefined)[]>([]);

  async function playAll() {
    for (const w of writers) if (w) await new Promise<void>((r) => w.animateCharacter({ onComplete: () => r() }));
  }
</script>

<figure class="player">
  <div class="row">
    {#each list as ch, i (ch + i)}
      {@const s = annotate(ch)[0]?.s?.[0]}
      <div class="cell">
        <div class="canvas" role="button" tabindex="0" onclick={() => writers[i]?.animateCharacter()} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), writers[i]?.animateCharacter())} aria-label="Animate {ch}">
          <HanziCanvas char={ch} size={130} bind:writer={writers[i]} />
        </div>
        <span class="cap ui"><span class="py t{s?.tone ?? 5}">{s?.py}</span> {lookup(ch)?.g?.split(';')[0] ?? ''}</span>
      </div>
    {/each}
  </div>
  <figcaption class="ui"><button class="btn small" onclick={playAll}><Icon name="play" size={14} />Write them all</button> Tap a character to watch it written.</figcaption>
</figure>

<style>
  .player {
    margin: 1.6rem 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
  }
  .cell {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
  }
  .canvas {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0;
    background: none;
    cursor: pointer;
  }
  .cap {
    font-size: 0.78rem;
    color: var(--ink-2);
    max-width: 130px;
    text-align: center;
  }
  .py {
    color: var(--tone);
    font-weight: 700;
  }
  figcaption {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.6rem;
    font-size: 0.82rem;
    color: var(--mute);
  }
</style>
