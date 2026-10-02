<script lang="ts">
  import type { QuizData } from '$lib/content/types';
  import Icon from '../ui/Icon.svelte';

  let { data }: { data: QuizData } = $props();
  let chosen = $state<number | null>(null);
  let submitted = $state<number | null>(null);
  let revealed = $state(false);
  const name = $props.id();
  const correct = $derived(submitted !== null && data.options[submitted]?.correct === true);
</script>

<fieldset class="quiz ui">
  <legend><Icon name="question" size={15} /> Check your understanding</legend>
  <div class="q">{@html data.question}</div>
  <div class="opts">
    {#each data.options as o, i (i)}
      <label class="opt" class:chosen={chosen === i} class:right={(revealed || submitted === i) && o.correct} class:wrong={submitted === i && !o.correct}>
        <input type="radio" {name} value={i} bind:group={chosen} onchange={() => { submitted = null; }} />
        <span class="text">{@html o.text}</span>
      </label>
    {/each}
  </div>
  <div class="quiz-actions">
    <button type="button" disabled={chosen === null} onclick={() => (submitted = chosen)}>Check answer</button>
    <button type="button" onclick={() => (revealed = !revealed)}>{revealed ? 'Hide explanation' : 'Show explanation'}</button>
    <button type="button" onclick={() => { chosen = null; submitted = null; revealed = false; }}>Try again</button>
  </div>
  {#if revealed}
    <div class="feedback" aria-live="polite">
      {#each data.options.filter(o => o.correct) as answer}<p>{@html answer.text} {#if answer.why}{@html answer.why}{/if}</p>{/each}
    </div>
  {/if}
  {#if submitted !== null}
    <div class="feedback" class:ok={correct} aria-live="polite">
      <strong>{correct ? 'Correct.' : 'Not quite.'}</strong>
      {#if data.options[submitted]?.why}{@html data.options[submitted]!.why}{/if}
    </div>
  {/if}
</fieldset>

<style>
  .quiz-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
  .quiz-actions button { font: inherit; padding: 0.35rem 0.6rem; cursor: pointer; }
  .quiz {
    margin: 2.25rem 0;
    padding: 1rem 1.2rem 1.15rem;
    border: 2px solid var(--fg);
    border-left: 8px solid var(--fx-blue);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.94rem;
  }
  legend {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0.4rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--ink);
  }
  .q {
    font-family: var(--font-body);
    font-size: 1.1rem;
    margin-bottom: 0.8rem;
  }
  .opts {
    display: grid;
    gap: 0.45rem;
  }
  .opt {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 120ms, background-color 120ms;
  }
  .opt:hover {
    border-color: var(--fg);
  }
  .opt input {
    margin-top: 0.3rem;
    accent-color: var(--fx-blue);
  }
  .opt.right {
    border-color: var(--good);
    background: color-mix(in srgb, var(--good) 12%, var(--surface));
  }
  .opt.wrong {
    border-color: var(--critical);
    background: color-mix(in srgb, var(--critical) 10%, var(--surface));
  }
  .feedback {
    margin-top: 0.8rem;
    padding: 0.6rem 0.8rem;
    border-radius: var(--radius-sm);
    background: var(--pn);
    line-height: 1.5;
  }
</style>
