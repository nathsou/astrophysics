<script lang="ts">
  import type { QuizData } from '$lib/content/types';
  import Icon from '../ui/Icon.svelte';

  let { data, kind = 'quiz' }: { data: QuizData; kind?: 'quiz' | 'predict' } = $props();
  let chosen = $state<number | null>(null);
  const name = $props.id();
  const correct = $derived(chosen !== null && data.options[chosen]?.correct === true);
</script>

<fieldset class="quiz ui" class:answered={chosen !== null}>
  <legend><span class="led" class:ok={chosen !== null && correct} class:bad={chosen !== null && !correct} aria-hidden="true"></span> {kind === 'predict' ? 'Predict, then reveal' : 'Check your understanding'}</legend>
  <div class="q">{@html data.question}</div>
  <div class="opts">
    {#each data.options as o, i (i)}
      <label class="opt" class:chosen={chosen === i} class:right={chosen !== null && o.correct} class:wrong={chosen === i && !o.correct}>
        <input type="radio" {name} value={i} bind:group={chosen} />
        <span class="key" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
        <span class="text">{@html o.text}</span>
        {#if chosen !== null && o.correct}<span class="mark ok"><Icon name="check" size={15} label="Correct answer" /></span>{:else if chosen === i}<span class="mark bad"><Icon name="close" size={15} label="Your answer" /></span>{/if}
      </label>
    {/each}
  </div>
  {#if chosen !== null}
    <div class="feedback" class:ok={correct} aria-live="polite">
      <strong>{correct ? 'Correct.' : 'Not quite.'}</strong>
      {#if data.options[chosen]?.why}{@html data.options[chosen]!.why}{/if}
    </div>
  {/if}
</fieldset>

<style>
  .quiz {
    margin: 2.25rem 0;
    padding: 0.9rem 1.2rem 1.15rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow);
    font-size: 0.95rem;
    min-width: 0;
  }
  legend {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.45rem;
    margin-left: -0.45rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
    color: var(--ink-2);
  }
  /* A status LED: dark until answered, then green or red. */
  .led {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--surface-3);
    box-shadow: inset 0 0 0 1px var(--line-strong);
    transition: background-color 200ms, box-shadow 200ms;
  }
  .led.ok {
    background: var(--ok);
    box-shadow: 0 0 8px var(--phosphor-glow);
  }
  .led.bad {
    background: var(--bad);
    box-shadow: 0 0 8px color-mix(in srgb, var(--bad) 45%, transparent);
  }
  .q {
    font-family: var(--font-body);
    font-size: 1.1rem;
    line-height: 1.55;
    margin: 0.2rem 0 0.9rem;
  }
  .opts {
    display: grid;
    gap: 0.45rem;
  }
  .opt {
    position: relative;
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--bg);
    cursor: pointer;
    transition: border-color 120ms, background-color 120ms;
  }
  .opt:hover {
    border-color: var(--line-strong);
    background: var(--pn);
  }
  .opt input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
  }
  .opt:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .key {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    margin-top: 0.02rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .text {
    flex: 1;
    min-width: 0;
    padding-top: 0.1rem;
  }
  .chosen .key {
    background: var(--fg);
    border-color: var(--fg);
    color: var(--bg);
  }
  .opt.right {
    border-color: color-mix(in srgb, var(--ok) 60%, var(--line));
    background: var(--ok-soft);
  }
  .opt.right .key {
    background: var(--ok);
    border-color: var(--ok);
    color: var(--on-accent);
  }
  .opt.wrong {
    border-color: color-mix(in srgb, var(--bad) 60%, var(--line));
    background: var(--bad-soft);
  }
  .opt.wrong .key {
    background: var(--bad);
    border-color: var(--bad);
    color: light-dark(#fff, #1a0606);
  }
  .mark {
    flex: none;
    display: inline-flex;
    padding-top: 0.2rem;
  }
  .mark.ok {
    color: var(--ok);
  }
  .mark.bad {
    color: var(--bad);
  }
  .feedback {
    margin-top: 0.85rem;
    padding: 0.65rem 0.9rem;
    border-radius: var(--radius-sm);
    background: var(--pn);
    border-left: 3px solid var(--bad);
    line-height: 1.5;
  }
  .feedback.ok {
    border-left-color: var(--ok);
  }
</style>
