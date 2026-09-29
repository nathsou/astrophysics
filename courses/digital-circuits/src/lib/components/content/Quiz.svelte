<script lang="ts">
  import type { QuizData } from '$lib/content/types';
  import Icon from '../ui/Icon.svelte';

  let { data }: { data: QuizData } = $props();
  let chosen = $state<number | null>(null);
  const name = $props.id();
  const correct = $derived(chosen !== null && data.options[chosen]?.correct === true);
</script>

<fieldset class="quiz ui">
  <legend><Icon name="question" size={15} /> Check your understanding</legend>
  <div class="q">{@html data.question}</div>
  <div class="opts">
    {#each data.options as o, i (i)}
      <label class="opt" class:chosen={chosen === i} class:right={chosen !== null && o.correct} class:wrong={chosen === i && !o.correct}>
        <input type="radio" {name} value={i} bind:group={chosen} />
        <span class="text">{@html o.text}</span>
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
