<!-- Common frame for exercises: label, title, solved badge, prompt, body, hints and solution. -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { progress } from '$lib/state/progress.svelte';
  import Icon from '../ui/Icon.svelte';

  let {
    id,
    kind,
    title,
    prompt,
    hints = [],
    solution,
    solutionLabel = 'Show a solution',
    completionLabel = 'Answer checked',
    children,
    footer,
  }: {
    id: string;
    kind: string;
    title?: string;
    prompt?: string;
    hints?: string[];
    solution?: string;
    solutionLabel?: string;
    completionLabel?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  let shownHints = $state(0);
  let showSolution = $state(false);
  let mounted = $state(false);
  onMount(() => {
    progress.load();
    mounted = true;
  });
  const solved = $derived(mounted && progress.isSolved(id));
</script>

<section class="exercise" class:solved aria-label="{kind}{title ? `: ${title}` : ''}">
  <header class="ui">
    <span class="kind"><Icon name="exercises" size={14} /> {kind}</span>
    {#if title}<span class="title">{title}</span>{/if}
    <span class="spacer"></span>
    {#if solved}<span class="badge"><Icon name="check" size={13} /> {completionLabel}</span>{/if}
  </header>
  {#if prompt}<div class="prompt">{@html prompt}</div>{/if}
  <div class="body">{@render children()}</div>
  {#if footer}{@render footer()}{/if}
  {#if hints.length || solution}
    <div class="help ui">
      {#if shownHints > 0}
        <ol class="hint-list">
          {#each hints.slice(0, shownHints) as h, i (i)}<li>{@html h}</li>{/each}
        </ol>
      {/if}
      <div class="help-buttons">
        {#if shownHints < hints.length}
          <button onclick={() => shownHints++}><Icon name="tip" size={14} /> {shownHints === 0 ? 'Hint' : 'Another hint'} <span class="n">{shownHints}/{hints.length}</span></button>
        {/if}
        {#if solution}
          <button onclick={() => (showSolution = !showSolution)}><Icon name="eye" size={14} /> {showSolution ? 'Hide the solution' : solutionLabel}</button>
        {/if}
      </div>
      {#if showSolution && solution}
        <div class="solution">{@html solution}</div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .exercise {
    margin: 2.25rem 0;
    border: 2px solid var(--fg);
    border-left: 8px solid var(--fx-red);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 0.85rem 1.15rem 1rem;
  }
  /* Pending work is red; once accepted it turns blue. */
  .exercise.solved {
    border-left-color: var(--fx-blue);
  }
  header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    margin-bottom: 0.4rem;
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.13em;
    font-weight: 700;
    font-size: 0.68rem;
    color: var(--accent);
  }
  .exercise.solved .kind {
    color: var(--ok);
  }
  .title {
    font-weight: 700;
    font-size: 0.95rem;
  }
  .spacer {
    flex: 1;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--ok);
    background: var(--ok-soft);
    border: 2px solid var(--ok);
    border-radius: var(--radius-sm);
    padding: 0.05rem 0.5rem;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.72rem;
  }
  .prompt :global(p) {
    margin: 0 0 0.75rem;
  }
  .help {
    margin-top: 0.75rem;
    font-size: 0.85rem;
  }
  .help-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .help button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 2px solid var(--fg);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 0.2rem 0.7rem;
    cursor: pointer;
    color: var(--ink);
    font-weight: 700;
  }
  .help button:hover {
    background: var(--fx-yellow);
    color: var(--fx-ink);
  }
  .n {
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }
  .hint-list {
    margin: 0 0 0.6rem;
    padding-left: 1.3rem;
    font-family: var(--font-body);
    font-size: 0.98rem;
  }
  .hint-list :global(p) {
    margin: 0 0 0.4rem;
  }
  .solution {
    margin-top: 0.75rem;
    padding: 0.7rem 0.9rem 0.1rem;
    border-radius: var(--radius-sm);
    border-left: 4px solid var(--fx-blue);
    background: var(--surface-2);
    font-family: var(--font-body);
    font-size: 1rem;
  }
  .solution :global(p) {
    margin: 0 0 0.7rem;
  }
</style>
