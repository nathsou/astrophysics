<script lang="ts">
  /**
   * The daily review. Cards come from FSRS: due cards first, then today's new ones. Recall first,
   * then reveal and grade yourself honestly; the scheduler does the rest.
   */
  import { base } from '$app/paths';
  import { untrack, onDestroy } from 'svelte';
  import { deck } from '$lib/srs/deck.svelte';
  import { preview, Rating, type DeckCard } from '$lib/srs/deck';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import { lessonBySlug } from '$content/outline';
  import { lookup } from '$lib/zh/lexicon';
  import { annotate } from '$lib/zh/annotate';
  import { comparePinyin } from '$lib/zh/pinyin';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { Grade } from 'ts-fsrs';

  let queue = $state<DeckCard[]>([]);
  let started = $state(false);
  let revealed = $state(false);
  let reviewed = $state(0);
  let typed = $state('');
  let typedResult = $state<boolean | null>(null);
  let cancelReplay = () => {};
  onDestroy(() => cancelReplay());
  const card = $derived(queue[0]);
  const entry = $derived(card ? lookup(card.word) : undefined);
  const py = $derived(card ? annotate(card.word).flatMap((t) => t.s ?? []).map((s) => s.py).join(' ') : '');
  const counts = $derived(deck.counts());
  const intervals = $derived(card && revealed ? preview(card, new Date()) : null);

  function begin() {
    queue = deck.queue();
    started = true;
    reviewed = 0;
    show();
  }
  function show() {
    cancelReplay();
    revealed = false;
    typed = '';
    typedResult = null;
    const c = untrack(() => queue[0]);
    if (c?.kind === 'hear') cancelReplay = speech.schedule(c.word);
  }
  function reveal() {
    if (!card || revealed) return;
    if (card.kind === 'read' && settings.data.typeAnswers && typed.trim()) {
      typedResult = comparePinyin(typed, py).correct;
      sfx(typedResult ? 'right' : 'wrong', settings.data.sounds);
    }
    revealed = true;
    if (card.kind !== 'hear') void speech.say(card.word);
  }
  function grade(r: Grade) {
    if (!card || !revealed) return;
    deck.grade(card, r);
    reviewed++;
    progress.touch();
    const rest = queue.slice(1);
    // Cards graded Again come back later in the same session.
    if (r === Rating.Again) rest.push(deck.data.cards[`${card.kind}:${card.word}`]!);
    queue = rest;
    if (!queue.length) sfx('done', settings.data.sounds);
    show();
  }
  function onKey(e: KeyboardEvent) {
    if (!started || !card) return;
    if (e.target instanceof HTMLInputElement && e.key !== 'Enter') return;
    if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      reveal();
    } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) as Grade);
    else if (e.key === 'r') void speech.say(card.word);
  }
  const KIND_LABEL = { read: 'Read it', hear: 'Hear it', say: 'Say it' } as const;
  const KIND_HINT = {
    read: 'What does it mean, and how do you say it?',
    hear: 'What did you hear? What does it mean?',
    say: 'How do you say this in Chinese? Say it out loud.',
  } as const;
  const GRADES: { r: Grade; label: string; cls: string }[] = [
    { r: Rating.Again as Grade, label: 'Again', cls: 'again' },
    { r: Rating.Hard as Grade, label: 'Hard', cls: 'hard' },
    { r: Rating.Good as Grade, label: 'Good', cls: 'good' },
    { r: Rating.Easy as Grade, label: 'Easy', cls: 'easy' },
  ];
</script>

<svelte:head><title>Review · Mandarin, Out Loud</title></svelte:head>
<svelte:window onkeydown={onKey} />

<div class="page">
  <header>
    <h1>Review</h1>
    <p class="ui stats">
      <span><strong>{counts.due}</strong> due</span>
      <span><strong>{counts.fresh}</strong> new today</span>
      <span><strong>{counts.words}</strong> words in your deck</span>
      {#if started}<span><strong>{reviewed}</strong> reviewed this session</span>{/if}
    </p>
  </header>

  {#if !started}
    <div class="intro card">
      {#if counts.due + counts.fresh > 0}
        <p>You have <strong>{counts.due + counts.fresh}</strong> card{counts.due + counts.fresh === 1 ? '' : 's'} for today. Each word gets three kinds of card over time: <em>read it</em>, <em>hear it</em> and <em>say it</em>. Recall the answer before revealing it, then grade yourself honestly; the scheduler brings each word back just before you would forget it.</p>
        <button class="btn primary" onclick={begin}><Icon name="cards" size={16} /> Start reviewing</button>
        <p class="ui keys">Keys: <span class="kbd">Space</span> reveal · <span class="kbd">1</span>–<span class="kbd">4</span> grade · <span class="kbd">R</span> replay</p>
      {:else if counts.total === 0}
        <p>Your deck is empty. Words join it when you finish a lesson (the button at the end of each one), or you can add a whole HSK level from the <a href="{base}/words/">word list</a>.</p>
        <a class="btn primary" href="{base}/">Go to the lessons</a>
      {:else}
        <p>Nothing due right now. 很好！ Come back later, or learn something new.</p>
        <p class="ui">{counts.waiting} new card{counts.waiting === 1 ? '' : 's'} waiting; you can raise the daily limit (now {settings.data.newPerDay}) in <a href="{base}/settings/">Settings</a>.</p>
      {/if}
    </div>
  {:else if card}
    <div class="review card">
      <div class="top ui">
        <span class="kind {card.kind}">{KIND_LABEL[card.kind]}</span>
        <span class="left">{queue.length} left</span>
      </div>
      <div class="front">
        {#if card.kind === 'read'}
          <span class="word zh-font" lang="zh-CN">{card.word}</span>
        {:else if card.kind === 'hear'}
          <div class="audio"><PlayButton text={card.word} /><PlayButton text={card.word} slow /></div>
        {:else}
          <span class="gloss-big">{entry?.g}</span>
        {/if}
        <p class="ui hint">{KIND_HINT[card.kind]}</p>
        {#if card.kind === 'read' && settings.data.typeAnswers && !revealed}
          <input class="ui type" bind:value={typed} placeholder="Type the pinyin (e.g. ni3 hao3)" aria-label="Pinyin" autocomplete="off" autocapitalize="off" />
        {/if}
      </div>
      {#if revealed}
        <div class="back">
          <div class="ans">
            <Zh text={card.word} size="xl" pinyin="show" play={false} />
            <PlayButton text={card.word} />
          </div>
          {#if typedResult !== null}<p class="ui typed" class:ok={typedResult}>{typedResult ? '对！ Your pinyin was right.' : `You typed “${typed}”.`}</p>{/if}
          <p class="gloss">{entry?.g}</p>
          {#if entry?.c?.length}<p class="ui mw">Measure word: <span class="zh-font">{entry.c.join('、')}</span></p>{/if}
          {#if card.source && lessonBySlug(card.source)}<p class="ui src">From lesson {lessonBySlug(card.source)?.number}: <a href="{base}/learn/{card.source}/">{lessonBySlug(card.source)?.title}</a></p>{/if}
        </div>
        <div class="grades ui" role="group" aria-label="How well did you remember?">
          {#each GRADES as g, i (g.r)}
            <button class="grade {g.cls}" onclick={() => grade(g.r)}>
              <span class="gl">{g.label}</span>
              <span class="iv">{intervals?.[g.r]}</span>
              <span class="k">{i + 1}</span>
            </button>
          {/each}
        </div>
      {:else}
        <button class="btn primary showbtn" onclick={reveal}>Show answer</button>
      {/if}
    </div>
  {:else}
    <div class="intro card">
      <p class="done">完成了！ All done for now: {reviewed} card{reviewed === 1 ? '' : 's'} reviewed.</p>
      <p class="ui">Come back tomorrow; the cards you found hard will be there sooner.</p>
      <a class="btn" href="{base}/">Back to the course</a>
    </div>
  {/if}
</div>

<style>
  .page {
    padding: 2.2rem clamp(1rem, 4vw, 3.5rem) 4rem;
    max-width: 44rem;
  }
  h1 {
    margin: 0 0 0.3rem;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    margin: 0 0 1.2rem;
    font-size: 0.88rem;
    color: var(--ink-2);
  }
  .intro {
    padding: 1.2rem 1.4rem;
  }
  .intro p:first-child {
    margin-top: 0;
  }
  .keys {
    font-size: 0.8rem;
    color: var(--mute);
  }
  .done {
    font-size: 1.15rem;
    font-weight: 650;
  }
  .review {
    padding: 1rem 1.3rem 1.3rem;
  }
  .top {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
  }
  .kind {
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-ink);
  }
  .kind.hear {
    color: var(--t3);
  }
  .kind.say {
    color: var(--jade);
  }
  .left {
    color: var(--mute);
  }
  .front {
    display: grid;
    justify-items: center;
    gap: 0.4rem;
    padding: 1.6rem 0 1rem;
    min-height: 10rem;
    align-content: center;
  }
  .word {
    font-size: clamp(3rem, 12vw, 4.5rem);
    line-height: 1.2;
  }
  .gloss-big {
    font-size: 1.6rem;
    text-align: center;
    font-style: italic;
  }
  .audio {
    display: flex;
    gap: 0.5rem;
    transform: scale(1.4);
    margin: 1rem 0;
  }
  .hint {
    color: var(--mute);
    font-size: 0.85rem;
    margin: 0.3rem 0 0;
  }
  .type {
    width: min(100%, 18rem);
    font-size: 1.1rem;
    padding: 0.5rem 0.8rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    text-align: center;
  }
  .showbtn {
    width: 100%;
    padding: 0.8rem;
    font-size: 1rem;
  }
  .back {
    border-top: 1px dashed var(--line-strong);
    padding: 1rem 0 0.4rem;
    display: grid;
    justify-items: center;
    text-align: center;
  }
  .ans {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .gloss {
    margin: 0.2rem 0;
    font-size: 1.15rem;
  }
  .typed {
    margin: 0;
    color: var(--accent-ink);
    font-size: 0.88rem;
  }
  .typed.ok {
    color: var(--jade);
  }
  .mw,
  .src {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    color: var(--mute);
  }
  .grades {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.45rem;
    margin-top: 1rem;
  }
  .grade {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.05rem;
    padding: 0.55rem 0.3rem;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    cursor: pointer;
    color: var(--fg);
  }
  .gl {
    font-weight: 700;
    font-size: 0.92rem;
  }
  .iv {
    font-size: 0.75rem;
    color: var(--mute);
  }
  .k {
    position: absolute;
    top: 0.2rem;
    right: 0.4rem;
    font-size: 0.62rem;
    color: var(--mute);
  }
  .again:hover {
    border-color: var(--bad);
    background: var(--bad-soft);
  }
  .hard:hover {
    border-color: var(--gold);
    background: var(--gold-soft);
  }
  .good:hover {
    border-color: var(--jade);
    background: var(--jade-soft);
  }
  .easy:hover {
    border-color: var(--t3);
    background: color-mix(in srgb, var(--t3) 12%, var(--panel));
  }
</style>
