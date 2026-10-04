<!--
  `bug` exercises: spot the faulty line in a proof, a specification or a model. Click a line; the answer key
  says whether it is the culprit, and why.
-->
<script lang="ts">
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import { progress } from '$lib/state/progress.svelte';

  interface Spec {
    id: string;
    title?: string;
    prompt?: string;
    code: string;
    /** 1-based line(s) of the bug. */
    bug: number | number[];
    explain?: string;
    hints?: string[];
    /** Optional per-line feedback for wrong picks. */
    lines?: Record<string, string>;
  }
  let { spec }: { spec: Spec } = $props();
  const lines = spec.code.replace(/\n$/, '').split('\n');
  const bugs = Array.isArray(spec.bug) ? spec.bug : [spec.bug];
  let picked = $state<number | undefined>();
  const right = $derived(picked !== undefined && bugs.includes(picked));
  function pick(n: number) {
    picked = n;
    if (bugs.includes(n)) progress.markSolved(spec.id);
  }
</script>

<ExerciseFrame id={spec.id} kind="find the bug" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <ol class="code" aria-label="Click the faulty line">
    {#each lines as l, i (i)}
      <li>
        <button type="button" class:picked={picked === i + 1} class:right={picked === i + 1 && right} class:wrong={picked === i + 1 && !right} onclick={() => pick(i + 1)}>
          <span class="n">{i + 1}</span><code>{l || ' '}</code>
        </button>
      </li>
    {/each}
  </ol>
  {#if picked !== undefined}
    <div class="verdict" class:right role="status">
      {#if right}
        <strong class="ui">Yes: line {picked}.</strong> {#if spec.explain}{@html spec.explain}{/if}
      {:else}
        <strong class="ui">Not line {picked}.</strong> {spec.lines?.[String(picked)] ?? 'That line is fine. Look again.'}
      {/if}
    </div>
  {/if}
</ExerciseFrame>

<style>
  .code {
    list-style: none;
    margin: 0;
    padding: 0.4rem 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--code-bg);
    overflow-x: auto;
  }
  button {
    display: flex;
    gap: 0.8rem;
    width: 100%;
    padding: 0.05rem 0.6rem;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--fg);
    font: inherit;
  }
  button:hover {
    background: var(--gold-soft);
  }
  .n {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--mute);
    width: 1.6rem;
    text-align: right;
    flex: none;
    padding-top: 0.15rem;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.86rem;
    white-space: pre;
    background: none;
  }
  .picked.right {
    background: var(--seal-soft);
  }
  .picked.wrong {
    background: color-mix(in srgb, var(--pencil) 12%, transparent);
  }
  .verdict {
    margin-top: 0.6rem;
    color: var(--pencil);
  }
  .verdict.right {
    color: var(--fg);
  }
  .verdict :global(p) {
    display: inline;
  }
</style>
