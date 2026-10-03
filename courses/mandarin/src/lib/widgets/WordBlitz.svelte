<script lang="ts">
  /**
   * Sixty seconds, as many words as you can: see or hear a word, pick its meaning. Words come
   * from your review deck (or HSK 1 if your deck is small), so the game reinforces what you study.
   */
  import { deck } from '$lib/srs/deck.svelte';
  import { hskWords, lookup, type Word } from '$lib/zh/lexicon';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { rng, shuffle } from '$lib/exercises/shuffle';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Zh from '$lib/components/zh/Zh.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { seconds = 60 }: { seconds?: number } = $props();
  let mode = $state<'see' | 'hear'>('see');
  let pool: Word[] = [];
  let q = $state<{ w: Word; options: string[]; answer: number } | null>(null);
  let score = $state(0);
  let misses = $state<Word[]>([]);
  let left = $state(0);
  let running = $state(false);
  let finished = $state(false);
  let flash = $state<'ok' | 'bad' | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;
  let r = rng(1);
  let best = $state(false);

  function buildPool() {
    const mine = [...new Set(Object.values(deck.data.cards).map((c) => c.word))].map((w) => lookup(w)).filter((w): w is Word => !!w?.g);
    pool = mine.length >= 20 ? mine : [...mine, ...hskWords(settings.data.list, 1)].filter((w, i, a) => a.findIndex((x) => x.w === w.w) === i);
  }
  function nextQ() {
    const w = pool[Math.floor(r() * pool.length)]!;
    const others = shuffle(
      pool.filter((x) => x.g !== w.g),
      Math.floor(r() * 1e6),
    ).slice(0, 3);
    const opts = shuffle([w, ...others], Math.floor(r() * 1e6));
    q = { w, options: opts.map((o) => o.g), answer: opts.indexOf(w) };
    if (mode === 'hear') void speech.say(w.w);
  }
  function start() {
    buildPool();
    r = rng(Date.now() % 1e6);
    score = 0;
    misses = [];
    left = seconds;
    running = true;
    finished = false;
    nextQ();
    clearInterval(timer);
    timer = setInterval(() => {
      left--;
      if (left <= 0) stop();
    }, 1000);
  }
  function stop() {
    clearInterval(timer);
    running = false;
    finished = true;
    best = progress.setBest(`blitz-${mode}`, score);
    sfx('done', settings.data.sounds);
  }
  function pick(i: number) {
    if (!q || !running) return;
    const ok = i === q.answer;
    flash = ok ? 'ok' : 'bad';
    setTimeout(() => (flash = null), 250);
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
    if (ok) score++;
    else misses = [...misses, q.w];
    nextQ();
  }
  function onKey(e: KeyboardEvent) {
    if (!running) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) pick(n - 1);
  }
  $effect(() => () => clearInterval(timer));
</script>

<svelte:window onkeydown={onKey} />

<div class="blitz card" class:ok={flash === 'ok'} class:bad={flash === 'bad'}>
  {#if !running}
    <p class="title"><Icon name="flame" size={18} /> Word blitz{finished ? `: ${score}${best ? ' · new best!' : ''}` : ''}</p>
    {#if finished && misses.length}
      <p class="ui">Missed: {#each [...new Map(misses.map((m) => [m.w, m])).values()] as m (m.w)}<span class="miss"><Zh text={m.w} play={false} /> {m.g}</span>{/each}</p>
    {:else}
      <p class="ui">{seconds} seconds. Pick the meaning of each word as fast as you can. Words come from your review deck.</p>
    {/if}
    <div class="modes ui" role="radiogroup" aria-label="Mode">
      <button role="radio" aria-checked={mode === 'see'} class:on={mode === 'see'} onclick={() => (mode = 'see')}>See the word</button>
      <button role="radio" aria-checked={mode === 'hear'} class:on={mode === 'hear'} onclick={() => (mode = 'hear')}>Hear the word</button>
    </div>
    <button class="btn primary" onclick={start}>{finished ? 'Again' : 'Go!'}</button>
  {:else if q}
    <div class="head ui"><span class="time" class:low={left <= 10}>{left}s</span><span>Score {score}</span></div>
    <div class="word">
      {#if mode === 'see'}<Zh text={q.w.w} size="xl" plain play={false} />{:else}<button class="btn" onclick={() => q && speech.say(q.w.w)}><Icon name="speaker" size={22} /> Replay</button>{/if}
    </div>
    <div class="opts">
      {#each q.options as o, i (i)}
        <button class="opt" onclick={() => pick(i)}><span class="n ui">{i + 1}</span>{o}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .blitz {
    padding: 1rem 1.2rem;
    margin: 1rem 0;
    transition: box-shadow 150ms;
  }
  .blitz.ok {
    box-shadow: 0 0 0 3px var(--jade);
  }
  .blitz.bad {
    box-shadow: 0 0 0 3px var(--accent);
  }
  .title {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-weight: 700;
    font-size: 1.1rem;
    margin: 0 0 0.5rem;
  }
  .miss {
    display: inline-flex;
    gap: 0.3rem;
    margin: 0 0.6rem 0.2rem 0;
    font-size: 0.85rem;
  }
  .modes {
    display: flex;
    gap: 0.3rem;
    margin: 0.4rem 0 0.8rem;
  }
  .modes button {
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    border-radius: 999px;
    padding: 0.3rem 0.8rem;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    color: var(--ink-2);
  }
  .modes button.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .head {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
  }
  .time.low {
    color: var(--accent);
  }
  .word {
    display: grid;
    place-items: center;
    min-height: 7rem;
  }
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
  }
  .opt {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    text-align: left;
    padding: 0.55rem 0.7rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    font-family: var(--font-body);
    color: var(--fg);
    font-size: 0.92rem;
  }
  .opt:hover {
    border-color: var(--accent);
  }
  .n {
    font-size: 0.7rem;
    color: var(--mute);
    font-weight: 700;
  }
  @media (max-width: 480px) {
    .opts {
      grid-template-columns: 1fr;
    }
  }
</style>
