<!--
  `encode` exercises: encode a puzzle or a constraint problem as a Vouch `problem`. The check is the exact number
  of solutions, counted by the SAT solver with blocking clauses: an encoding that forgets a constraint has too many,
  one that adds a wrong constraint has too few, and only a faithful one has exactly the right number.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { verifyText } from '$lib/components/verify/lsp';
  import { progress } from '$lib/state/progress.svelte';
  import type { Verdict } from '$lib/fv/engines';

  interface Spec {
    id: string;
    title?: string;
    prompt?: string;
    starter: string;
    count: number;
    solution?: string;
    hints?: string[];
    success?: string;
    lines?: number;
    /** Text shown when the count is too high or too low. */
    feedback?: { high?: string; low?: string };
  }
  let { spec }: { spec: Spec } = $props();

  const starter = spec.starter.replace(/\n$/, '');
  let editor: VouchEditor | undefined = $state();
  let running = $state(false);
  let verdict = $state<Verdict | undefined>();
  let errors = $state<string[]>([]);
  let solved = $state(false);
  let showSolution = $state(false);

  onMount(() => {
    const d = progress.draft<string | undefined>(spec.id, undefined);
    if (d && d !== starter) editor?.setValue(d);
  });

  const got = $derived(verdict?.badge.kind === 'counted' ? verdict.badge : undefined);

  async function check() {
    running = true;
    errors = [];
    verdict = undefined;
    solved = false;
    try {
      const text = editor?.getValue() ?? starter;
      progress.saveDraft(spec.id, text);
      if (!/\bcount\b/.test(text)) {
        errors = ['The problem must end with `count`, so that the solver counts every solution.'];
        return;
      }
      const r = await verifyText(text);
      if (r.errors.length) {
        errors = r.errors.map((e) => `line ${e.line}: ${e.message}`);
        return;
      }
      verdict = r.verdicts.find((d) => d.kind === 'problem')?.verdicts[0];
      const b = verdict?.badge;
      if (b?.kind === 'counted' && !b.more && b.count === spec.count && verdict?.certificate.checked) {
        solved = true;
        progress.markSolved(spec.id);
      }
    } finally {
      running = false;
    }
  }
</script>

<ExerciseFrame id={spec.id} kind="encode it" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <VouchEditor bind:this={editor} value={starter} name={spec.id} minLines={spec.lines ?? 10} maxHeight="30rem" />
  <div class="bar ui">
    <button type="button" class="go" onclick={check} disabled={running}>{running ? 'Counting…' : 'Count the solutions'}</button>
    <button type="button" onclick={() => editor?.setValue(starter)}>Reset</button>
    {#if spec.solution}<button type="button" onclick={() => (showSolution = !showSolution)}>{showSolution ? 'Hide the solution' : 'Show a solution'}</button>{/if}
    <span class="target">Target: exactly {spec.count.toLocaleString('en-GB')} solution{spec.count === 1 ? '' : 's'}</span>
  </div>
  {#if errors.length}<ul class="err ui">{#each errors as e, i (i)}<li>{e}</li>{/each}</ul>{/if}
  {#if verdict}
    <Badge {verdict} />
    {#if got && !solved}
      <p class="miss">
        {#if got.more || got.count > spec.count}
          Your encoding has {got.more ? 'more than ' : ''}{got.count.toLocaleString('en-GB')} solutions: too many, so some constraint is missing or too weak. {spec.feedback?.high ?? ''}
        {:else}
          Your encoding has {got.count.toLocaleString('en-GB')} solution{got.count === 1 ? '' : 's'}: too few, so some constraint rules out arrangements that should be allowed. {spec.feedback?.low ?? ''}
        {/if}
      </p>
    {/if}
  {/if}
  {#if solved}<div class="success" role="status"><strong class="ui">Exactly right.</strong> {#if spec.success}{@html spec.success}{/if}</div>{/if}
  {#if showSolution && spec.solution}<VouchEditor value={spec.solution.replace(/\n$/, '')} name={`${spec.id}-solution`} readonly lsp={false} minLines={4} label="A solution" />{/if}
</ExerciseFrame>

<style>
  .bar {
    display: flex;
    gap: 0.5rem;
    margin: 0.5rem 0;
    flex-wrap: wrap;
    align-items: center;
  }
  button {
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.3rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .go {
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .target {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin-left: auto;
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .miss {
    color: var(--pencil);
    margin: 0.5rem 0 0;
  }
  .success {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--seal) 45%, var(--line));
    background: var(--seal-soft);
    border-radius: var(--radius-sm);
  }
</style>
