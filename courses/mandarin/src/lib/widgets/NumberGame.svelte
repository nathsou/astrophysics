<script lang="ts">
  import { onDestroy } from 'svelte';
  /**
   * Endless number practice: hear (or read) a number, price, time, date or phone number in
   * Chinese and type it in digits; or see the digits and say it aloud, then compare.
   */
  import { makeQuestion, isRight, type NumberKind, type NumberQ } from '$lib/zh/numbergen';
  import { rng } from '$lib/exercises/shuffle';
  import { speech } from '$lib/audio/speech.svelte';
  import { sfx } from '$lib/audio/sfx';
  import { settings } from '$lib/state/settings.svelte';
  import { progress } from '$lib/state/progress.svelte';
  import Zh from '$lib/components/zh/Zh.svelte';
  import PlayButton from '$lib/components/zh/PlayButton.svelte';
  import ClockFace from '$lib/components/ui/ClockFace.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let cancelReplay = () => {};
  onDestroy(() => cancelReplay());

  let { kinds = 'number', max = 99, count = 8, mode = 'listen' }: { kinds?: string; max?: number; count?: number; mode?: 'listen' | 'read' | 'say' } = $props();
  const kindList = $derived(kinds.split(',') as NumberKind[]);
  let how = $state<'listen' | 'read' | 'say'>('listen');
  $effect.pre(() => {
    how = mode;
  });

  const LABEL: Record<NumberKind, string> = { number: 'numbers', price: 'prices', time: 'times', date: 'dates', phone: 'phone numbers', age: 'ages' };
  const FORMAT: Record<NumberKind, string> = { number: 'e.g. 42', price: 'e.g. 12.5', time: 'e.g. 8:30', date: 'month/day, e.g. 3/12', phone: 'all the digits', age: 'e.g. 35' };

  let qs = $state<NumberQ[]>([]);
  let i = $state(0);
  let typed = $state('');
  let result = $state<boolean | null>(null);
  let score = $state(0);
  let started = $state(false);
  let done = $state(false);
  let revealed = $state(false);
  const q = $derived(qs[i]);

  function start() {
    const r = rng(Date.now() % 1e6);
    qs = Array.from({ length: count }, (_, k) => makeQuestion(kindList[k % kindList.length]!, r, max));
    i = 0;
    score = 0;
    started = true;
    done = false;
    ask();
  }
  function ask() {
    typed = '';
    result = null;
    revealed = false;
    cancelReplay();
    if (how === 'listen' && qs[i]) cancelReplay = speech.schedule(qs[i]!.zh);
  }
  function check(e: Event) {
    e.preventDefault();
    if (!q || result !== null || !typed.trim()) return;
    result = isRight(q, typed);
    if (result) score++;
    sfx(result ? 'right' : 'wrong', settings.data.sounds);
    if (how === 'read') void speech.say(q.zh);
  }
  function selfGrade(ok: boolean) {
    result = ok;
    if (ok) score++;
  }
  function next() {
    if (i + 1 >= qs.length) {
      done = true;
      progress.setBest(`numbers-${kinds}-${how}`, score);
      sfx('done', settings.data.sounds);
      return;
    }
    i++;
    ask();
  }
</script>

<div class="game card">
  {#if !started || done}
    <div class="intro">
      <p class="title"><Icon name="sparkle" size={18} /> {done ? `${score} / ${qs.length}` : `Number drill: ${kindList.map((k) => LABEL[k]).join(', ')}`}</p>
      <div class="modes ui" role="radiogroup" aria-label="Mode">
        {#each [['listen', 'Hear it, type it'], ['read', 'Read it, type it'], ['say', 'See it, say it']] as [m, label] (m)}
          <button role="radio" aria-checked={how === m} class:on={how === m} onclick={() => (how = m as typeof how)}>{label}</button>
        {/each}
      </div>
      <button class="btn primary" onclick={start}>{done ? 'Again' : 'Start'}</button>
    </div>
  {:else if q}
    <div class="head ui"><span>{i + 1} / {qs.length}</span><span>Score {score}</span></div>
    <div class="stage">
      {#if how === 'listen'}
        <PlayButton text={q.zh} />
        <PlayButton text={q.zh} slow />
        {#if result !== null}<Zh text={q.zh} size="md" play={false} />{/if}
      {:else if how === 'read'}
        <Zh text={q.zh} size="lg" play={false} />
      {:else}
        {#if q.kind === 'time' && q.h !== undefined}<ClockFace h={q.h} m={q.m ?? 0} size={120} />{:else}<span class="digits">{q.shown}</span>{/if}
        {#if revealed}<Zh text={q.zh} size="md" play={false} /><PlayButton text={q.zh} />{/if}
      {/if}
    </div>
    {#if how === 'say'}
      <div class="row ui">
        {#if !revealed}
          <span class="hint">Say it out loud, then check.</span>
          <button class="btn" onclick={() => ((revealed = true), speech.say(q.zh))}>Check</button>
        {:else if result === null}
          <span class="hint">Did you say it right?</span>
          <button class="btn" onclick={() => selfGrade(false)}>Not quite</button>
          <button class="btn primary" onclick={() => selfGrade(true)}>Yes</button>
        {:else}
          <span></span><button class="btn primary" onclick={next}>Next <Icon name="arrow" size={14} /></button>
        {/if}
      </div>
    {:else}
      <form class="row ui" onsubmit={check}>
        {#if q.kind === 'time' && how === 'listen' && result !== null && q.h !== undefined}<ClockFace h={q.h} m={q.m ?? 0} size={64} />{/if}
        <input bind:value={typed} inputmode={q.kind === 'phone' || q.kind === 'number' || q.kind === 'age' ? 'numeric' : 'text'} placeholder={FORMAT[q.kind]} aria-label="Your answer" disabled={result !== null} class:ok={result === true} class:bad={result === false} />
        {#if result === null}<button class="btn" disabled={!typed.trim()}>Check</button>{:else}<button type="button" class="btn primary" onclick={next}>Next <Icon name="arrow" size={14} /></button>{/if}
      </form>
      {#if result === false}<p class="fb ui">It was <strong>{q.shown}</strong>.</p>{/if}
    {/if}
  {/if}
</div>

<style>
  .game {
    margin: 1.8rem 0;
    padding: 1rem 1.2rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    font-size: 1.05rem;
    margin: 0 0 0.6rem;
  }
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.8rem;
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
    font-size: 0.8rem;
    color: var(--mute);
  }
  .stage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    min-height: 5rem;
    margin: 0.4rem 0 0.6rem;
  }
  .digits {
    font-family: var(--font-ui);
    font-size: 2.2rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .hint {
    flex: 1;
    color: var(--mute);
    font-size: 0.88rem;
  }
  input {
    flex: 1;
    min-width: 0;
    font-size: 1.2rem;
    padding: 0.5rem 0.8rem;
    border-radius: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  input.ok {
    border-color: var(--jade);
    background: var(--jade-soft);
  }
  input.bad {
    border-color: var(--accent);
  }
  .fb {
    margin: 0.4rem 0 0;
    font-size: 0.9rem;
    color: var(--accent-ink);
  }
</style>
