<script lang="ts">
  import { onDestroy } from 'svelte';
  /**
   * Ear training: hear a syllable (or a two-syllable word), name its tones. Missed items come
   * back later in the round, and tones you confuse are drawn more often next time.
   */
  import { TONE_ITEMS } from '$content/data/syllables';
  import { hskWords } from '$lib/zh/lexicon';
  import { annotate } from '$lib/zh/annotate';
  import { mark } from '$lib/zh/pinyin';
  import { rng } from '$lib/exercises/shuffle';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import ToneGlyph from '$lib/components/ui/ToneGlyph.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import Zh from '$lib/components/zh/Zh.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let cancelReplay = () => {};
  onDestroy(() => cancelReplay());

  let { mode = 'single', count = 10, only = '' }: { mode?: 'single' | 'pairs'; count?: number; only?: string } = $props();

  interface Q {
    text: string;
    tones: number[];
    py: string[];
    gloss: string;
  }

  const STATS = 'mandarin:tone-stats';
  function loadStats(): number[] {
    try {
      const s = JSON.parse(localStorage.getItem(STATS) ?? 'null');
      return Array.isArray(s) && s.length === 6 ? s : [0, 1, 1, 1, 1, 1];
    } catch {
      return [0, 1, 1, 1, 1, 1];
    }
  }
  function saveMiss(tone: number) {
    try {
      const s = loadStats();
      s[tone] = Math.min(6, s[tone]! + 1);
      localStorage.setItem(STATS, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }

  function pool(): Q[] {
    if (mode === 'pairs') {
      return [...hskWords('n', 1), ...hskWords('n', 2)]
        .filter((w) => [...w.w].length === 2)
        .map((w) => {
          const s = annotate(w.w).flatMap((t) => t.s ?? []);
          return { text: w.w, tones: s.map((x) => x.tone), py: s.map((x) => x.py), gloss: w.g };
        })
        .filter((q) => q.tones.length === 2 && q.tones[0] !== 5);
    }
    const items = only ? TONE_ITEMS.filter((t) => only.split(',').includes(t.base)) : TONE_ITEMS;
    return items.map((t) => ({ text: t.ch, tones: [t.tone], py: [mark(t.base, t.tone)], gloss: t.meaning }));
  }

  let queue = $state<Q[]>([]);
  let pos = $state(0);
  let picked = $state<number[]>([]);
  let result = $state<boolean | null>(null);
  let score = $state(0);
  let streak = $state(0);
  let best = $state(0);
  let finished = $state(false);
  let started = $state(false);
  let newBest = $state(false);
  const q = $derived(queue[pos]);
  const choices = $derived(mode === 'pairs' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]);

  function deal() {
    const all = pool();
    const stats = loadStats();
    const r = rng(Date.now() % 100000);
    // Weight items by how often their tones have been missed.
    const weighted = all.map((x) => ({ x, w: r() * (1 + x.tones.reduce((a, t) => a + (stats[t] ?? 1), 0) / 3) }));
    weighted.sort((a, b) => b.w - a.w);
    queue = weighted.slice(0, count).map((w) => w.x);
    pos = 0;
    score = 0;
    streak = 0;
    best = 0;
    finished = false;
    started = true;
    newBest = false;
    ask();
  }

  function ask() {
    picked = [];
    result = null;
    cancelReplay();
    if (queue[pos]) cancelReplay = speech.schedule(queue[pos]!.text, 200);
  }

  function choose(t: number) {
    if (!q || result !== null) return;
    picked = [...picked, t];
    if (picked.length < q.tones.length) return;
    const ok = picked.every((p, i) => p === q.tones[i]);
    result = ok;
    sfx(ok ? 'right' : 'wrong', settings.data.sounds);
    if (ok) {
      score++;
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 0;
      q.tones.forEach((t, i) => picked[i] !== t && saveMiss(t));
      if (queue.length < count + 5) queue = [...queue, q];
    }
  }

  function next() {
    if (pos + 1 >= queue.length) {
      finished = true;
      newBest = progress.setBest(`tones-${mode}`, score);
      sfx('done', settings.data.sounds);
      return;
    }
    pos++;
    ask();
  }

  function onKey(e: KeyboardEvent) {
    if (e.defaultPrevented || e.isComposing || (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"], #teacher-chat, .wordcard'))) return;
    if (!started || finished) return;
    if (e.target instanceof HTMLInputElement) return;
    const n = Number(e.key);
    if (choices.includes(n)) choose(n);
    else if ((e.key === 'Enter' || e.key === ' ') && result !== null) {
      e.preventDefault();
      next();
    } else if (e.key === 'r' && q) void speech.say(q.text);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="trainer card">
  {#if !started}
    <div class="intro">
      <p class="title"><Icon name="speaker" size={18} /> Tone detective{mode === 'pairs' ? ': two-syllable words' : ''}</p>
      <p>You will hear {count} {mode === 'pairs' ? 'words' : 'syllables'}. Name the tone{mode === 'pairs' ? 's' : ''} of each. Keys <span class="kbd">1</span>–<span class="kbd">{choices.length === 5 ? 5 : 4}</span> work too; <span class="kbd">R</span> replays.</p>
      <button class="btn primary" onclick={deal}>Start</button>
    </div>
  {:else if finished}
    <div class="intro">
      <p class="title">{score} / {queue.length}{newBest ? ' · new best!' : ''}</p>
      <p>Best streak this round: {best}. {score === queue.length ? '耳朵很好！ Great ears.' : 'Missed tones come up more often next time.'}</p>
      <button class="btn primary" onclick={deal}><Icon name="refresh" size={15} />Another round</button>
    </div>
  {:else if q}
    <div class="head ui">
      <span>{pos + 1} / {queue.length}</span>
      <span class="streak" class:hot={streak >= 3}><Icon name="flame" size={14} /> {streak}</span>
    </div>
    <div class="stage">
      <PlayButton text={q.text} />
      <PlayButton text={q.text} slow />
      {#if result !== null}
        <span class="reveal"><Zh text={q.text} size="lg" pinyin="show" play={false} /> <span class="gl">{q.gloss}</span></span>
      {:else}
        <span class="slots">{#each q.tones as _, i (i)}<span class="slot" class:filled={picked[i] !== undefined}>{picked[i] ? (picked[i] === 5 ? '·' : picked[i]) : '?'}</span>{/each}</span>
      {/if}
    </div>
    <div class="choices">
      {#each choices as t (t)}
        <button class="tone t{t}" onclick={() => choose(t)} disabled={result !== null} aria-label={t === 5 ? 'Neutral tone' : `Tone ${t}`}>
          <ToneGlyph tone={t} size={26} /><span class="ui">{t === 5 ? 'neutral' : t}</span>
        </button>
      {/each}
    </div>
    <div class="foot ui" aria-live="polite">
      {#if result === true}<span class="ok">对！ {q.py.join(' ')}</span>{:else if result === false}<span class="bad">It was {q.py.join(' ')} ({q.tones.map((t) => (t === 5 ? 'neutral' : t)).join('-')}). It will come back.</span>{/if}
      {#if result !== null}<button class="btn primary small" onclick={next}>Next <Icon name="arrow" size={14} /></button>{/if}
    </div>
  {/if}
</div>

<style>
  .trainer {
    margin: 1.8rem 0;
    padding: 1rem 1.2rem;
  }
  .intro p {
    margin: 0 0 0.7rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .head {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  .streak.hot {
    color: var(--accent);
    font-weight: 700;
  }
  .stage {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 5rem;
    flex-wrap: wrap;
  }
  .slots {
    display: inline-flex;
    gap: 0.3rem;
    margin-left: 0.5rem;
  }
  .slot {
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border: 2px dashed var(--line-strong);
    border-radius: 10px;
    font-family: var(--font-ui);
    font-weight: 700;
    color: var(--mute);
  }
  .slot.filled {
    border-style: solid;
    color: var(--fg);
  }
  .reveal {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-left: 0.3rem;
  }
  .gl {
    color: var(--ink-2);
    font-style: italic;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(4.2rem, 1fr));
    gap: 0.45rem;
  }
  .tone {
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    padding: 0.55rem 0.3rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--tone);
    cursor: pointer;
    font-weight: 700;
    font-size: 0.8rem;
  }
  .tone:hover:not(:disabled) {
    border-color: var(--tone);
    background: color-mix(in srgb, var(--tone) 8%, var(--panel));
  }
  .tone:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.6rem;
    min-height: 2.6rem;
    margin-top: 0.6rem;
    font-size: 0.9rem;
  }
  .ok {
    color: var(--jade);
    font-weight: 650;
  }
  .bad {
    color: var(--accent-ink);
  }
</style>
