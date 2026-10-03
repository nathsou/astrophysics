<script lang="ts">
  /**
   * Build characters from parts. Pick two pieces; if they make a real character you discover it,
   * with the story of how it works. Can you find them all?
   */
  import { PARTS, RECIPES } from '$content/data/characters';
  import { annotate } from '$lib/zh/annotate';
  import { lookup } from '$lib/zh/lexicon';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { settings } from '$lib/state/settings.svelte';

  let { kind = 'all' }: { kind?: 'all' | 'meaning' | 'sound' } = $props();
  const recipes = $derived(kind === 'all' ? RECIPES : RECIPES.filter((r) => r.kind === kind));
  const parts = $derived(PARTS.filter((p) => recipes.some((r) => r.parts.includes(p))));
  let picked = $state<string[]>([]);
  let found = $state<Set<string>>(new Set());
  let last = $state<(typeof RECIPES)[number] | null>(null);
  let miss = $state(false);

  function pick(p: string) {
    miss = false;
    picked = [...picked, p].slice(-2);
    if (picked.length < 2) return;
    const [a, b] = picked;
    const r = recipes.find((x) => (x.parts[0] === a && x.parts[1] === b) || (x.parts[0] === b && x.parts[1] === a));
    if (r) {
      last = r;
      found = new Set([...found, r.result]);
      sfx('right', settings.data.sounds);
      void speech.say(r.result);
    } else {
      miss = true;
      last = null;
    }
    picked = [];
  }
  const py = (ch: string) => annotate(ch)[0]?.s?.[0];
</script>

<figure class="builder card">
  <div class="parts" role="group" aria-label="Parts">
    {#each parts as p (p)}
      <button class="part zh-font" class:on={picked.includes(p)} onclick={() => pick(p)} title={lookup(p)?.g ?? ''}>{p}</button>
    {/each}
  </div>
  <div class="result" aria-live="polite">
    {#if picked.length === 1}
      <p class="ui hint"><span class="zh-font big">{picked[0]}</span> + ?</p>
    {:else if last}
      {@const s = py(last.result)}
      <div class="made">
        <span class="zh-font eq">{last.parts[0]} + {last.parts[1]} =</span>
        <span class="zh-font big res">{last.result}</span>
        <span class="info"><span class="py t{s?.tone ?? 5}">{s?.py}</span> <span class="kind ui {last.kind}">{last.kind === 'sound' ? 'meaning + sound' : 'meaning + meaning'}</span><br />{last.note}</span>
      </div>
    {:else if miss}
      <p class="ui hint">Not a character we know. Try another pair.</p>
    {:else}
      <p class="ui hint">Pick two parts.</p>
    {/if}
  </div>
  <div class="found ui">
    <span>Found {found.size} / {recipes.length}:</span>
    {#each recipes as r (r.result)}
      <span class="slot zh-font" class:got={found.has(r.result)} title={found.has(r.result) ? (lookup(r.result)?.g ?? '') : 'not found yet'}>{found.has(r.result) ? r.result : '·'}</span>
    {/each}
  </div>
</figure>

<style>
  .builder {
    margin: 1.6rem 0;
    padding: 1rem 1.1rem;
  }
  .parts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .part {
    width: 2.8rem;
    height: 2.8rem;
    font-size: 1.6rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    border-bottom-width: 3px;
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .part:hover {
    border-color: var(--accent);
  }
  .part.on {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .result {
    min-height: 5.5rem;
    display: flex;
    align-items: center;
    margin: 0.6rem 0;
  }
  .hint {
    color: var(--mute);
    margin: 0;
  }
  .made {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    flex-wrap: wrap;
    animation: pop 250ms ease-out;
  }
  .eq {
    font-size: 1.5rem;
    color: var(--mute);
  }
  .big {
    font-size: 2rem;
  }
  .res {
    font-size: 3.2rem;
    line-height: 1;
    color: var(--accent);
  }
  .info {
    font-size: 0.92rem;
    max-width: 22rem;
  }
  .py {
    font-family: var(--font-py);
    font-weight: 700;
    color: var(--tone);
  }
  .kind {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.05rem 0.45rem;
    border-radius: 999px;
    background: var(--jade-soft);
    color: var(--jade);
  }
  .kind.sound {
    background: var(--gold-soft);
    color: var(--gold);
  }
  .found {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .slot {
    width: 1.6rem;
    text-align: center;
    font-size: 1.1rem;
    border-radius: 6px;
    background: var(--pn);
  }
  .slot.got {
    background: var(--jade-soft);
    color: var(--fg);
  }
  @keyframes pop {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
  }
</style>
