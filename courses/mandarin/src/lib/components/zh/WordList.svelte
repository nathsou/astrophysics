<script lang="ts">
  /** New words for a lesson section: tap to hear; glosses from the dictionary unless given. */
  import { lookup } from '$lib/zh/lexicon';
  import { speech } from '$lib/audio/speech.svelte';
  import Zh from './Zh.svelte';
  import Icon from '../ui/Icon.svelte';

  let { items }: { items: { w: string; g?: string }[] } = $props();
  const rows = $derived(items.map((it) => ({ ...it, gloss: it.g ?? lookup(it.w.replace(/\[[^\]]*\]/g, ''))?.g ?? '' })));
  let playingAll = $state(false);

  async function playAll() {
    playingAll = true;
    for (const r of rows) {
      if (!playingAll) break;
      await speech.say(r.w);
      await new Promise((res) => setTimeout(res, 350));
    }
    playingAll = false;
  }
</script>

<div class="words card">
  <div class="bar ui">
    <span class="label">New words</span>
    <button class="btn small ghost" onclick={() => (playingAll ? ((playingAll = false), speech.stop()) : playAll())}>
      <Icon name={playingAll ? 'stop' : 'play'} size={14} />
      {playingAll ? 'Stop' : 'Hear them all'}
    </button>
  </div>
  <ul>
    {#each rows as r (r.w)}
      <li>
        <span class="w"><Zh text={r.w} size="md" play={false} /></span>
        <span class="g">{r.gloss}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .words {
    margin: 1.5rem 0;
    padding: 0.4rem 0 0.6rem;
    overflow: hidden;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.2rem 0.6rem 0.2rem 1rem;
  }
  .label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-ink);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.35rem 1rem;
    border-top: 1px solid var(--line);
    min-width: 0;
  }
  .w {
    flex: none;
  }
  .g {
    font-size: 0.92rem;
    color: var(--ink-2);
    line-height: 1.35;
  }
</style>
