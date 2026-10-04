<!--
  `verify`, `invariant` and `model` exercises: the reader edits Vouch until the engines agree.

    verify / invariant   the code must verify (or meet `expect`), locked lines unchanged, no `assume`.
    model                the reader's text replaces `@model` in each case of a bank; each case must hold or fail
                         as stated (a property must fail on Hyman's algorithm and hold on Peterson's).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { verifyText } from '$lib/components/verify/lsp';
  import { forbidden, judge, lockedIntact, type Expectation } from './check';
  import { progress } from '$lib/state/progress.svelte';
  import type { Verdict } from '$lib/fv/engines';

  interface Case {
    name: string;
    code: string;
    expect: 'holds' | 'fails';
    why?: string;
  }
  interface Spec {
    id: string;
    kind: string;
    title?: string;
    prompt?: string;
    starter?: string;
    code?: string;
    solution?: string;
    locked?: [number, number][];
    expect?: Expectation[];
    forbid?: string[];
    hints?: string[];
    success?: string;
    cases?: Case[];
    exhibit?: string;
    lines?: number;
  }
  let { spec }: { spec: Spec } = $props();

  const starter = (spec.starter ?? spec.code ?? '').replace(/\n$/, '');
  let editor: VouchEditor | undefined = $state();
  let code = $state(starter);
  let running = $state(false);
  let problems = $state<{ message: string; line?: number }[]>([]);
  let results = $state<{ label: string; ok: boolean; detail?: string; verdict?: Verdict }[]>([]);
  let solvedNow = $state(false);
  let showSolution = $state(false);

  onMount(() => {
    const d = progress.draft<string | undefined>(spec.id, undefined);
    if (d && d !== starter) {
      code = d;
      editor?.setValue(d);
    }
  });

  function changed(c: string) {
    code = c;
    progress.saveDraft(spec.id, c);
  }

  async function check() {
    running = true;
    problems = [];
    results = [];
    solvedNow = false;
    try {
      const text = editor?.getValue() ?? code;
      problems = [...lockedIntact(starter, text, spec.locked ?? []), ...forbidden(text, spec.forbid ?? (spec.kind === 'model' ? [] : ['assume']))];
      if (problems.length) return;
      if (spec.kind === 'model' && spec.cases?.length) {
        for (const c of spec.cases) {
          const r = await verifyText(c.code.replace('@model', text));
          if (r.errors.length) {
            results = [...results, { label: c.name, ok: false, detail: r.errors.map((e) => `line ${e.line}: ${e.message}`).join('\n') }];
            continue;
          }
          const all = r.verdicts.flatMap((d) => d.verdicts);
          const holds = all.length > 0 && all.every((v) => v.status === 'verified' || v.badge.kind === 'exhaustive');
          const fails = all.some((v) => v.status === 'violated');
          const ok = c.expect === 'holds' ? holds : fails;
          const shown = all.find((v) => (c.expect === 'holds' ? v.status !== 'verified' : v.status === 'violated')) ?? all[0];
          results = [...results, { label: `${c.name}: should ${c.expect === 'holds' ? 'hold' : 'fail'}`, ok, detail: ok ? c.why : undefined, verdict: shown }];
        }
      } else {
        const r = await verifyText(text);
        if (r.errors.length) {
          problems = r.errors;
          return;
        }
        const j = judge(r.verdicts, spec.expect);
        results = r.verdicts.flatMap((d) => d.verdicts.map((v) => ({ label: d.decl, ok: !j.unmet.some((u) => u.verdict === v), verdict: v })));
        for (const u of j.unmet) if (!u.verdict) results = [...results, { label: 'missing', ok: false, detail: u.reason }];
      }
      if (results.length && results.every((x) => x.ok)) {
        solvedNow = true;
        progress.markSolved(spec.id);
        if (spec.exhibit) progress.markCaught(spec.exhibit);
      }
    } finally {
      running = false;
    }
  }
</script>

<ExerciseFrame id={spec.id} kind={spec.kind === 'invariant' ? 'find the invariant' : spec.kind === 'model' ? 'model it' : 'make it verify'} title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <VouchEditor bind:this={editor} value={code} name={spec.id} locked={spec.locked ?? []} minLines={spec.lines ?? 8} maxHeight="30rem" lsp={!(spec.kind === 'model' && spec.cases?.length)} onchange={changed} />
  <div class="bar ui">
    <button type="button" class="go" onclick={check} disabled={running}>{running ? 'Checking…' : spec.kind === 'model' ? 'Run the bank' : 'Check'}</button>
    <button type="button" class="reset" onclick={() => { editor?.setValue(starter); changed(starter); results = []; problems = []; }}>Reset</button>
    {#if spec.solution}<button type="button" class="reset" onclick={() => (showSolution = !showSolution)}>{showSolution ? 'Hide the solution' : 'Show a solution'}</button>{/if}
  </div>
  {#if problems.length}
    <ul class="problems ui" role="alert">
      {#each problems as p, i (i)}<li>{#if p.line}<b>line {p.line}</b> {/if}{p.message}</li>{/each}
    </ul>
  {/if}
  {#if results.length}
    <div class="results" aria-live="polite">
      {#each results as r, i (i)}
        <div class="row" class:ok={r.ok}>
          <span class="mark ui" aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
          <div class="what">
            {#if spec.kind === 'model'}<p class="label ui">{r.label}</p>{/if}
            {#if r.verdict}<Badge verdict={r.verdict} compact />{/if}
            {#if r.detail}<p class="detail">{r.detail}</p>{/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {#if solvedNow}
    <div class="success" role="status">
      <strong class="ui">Verified.</strong>
      {#if spec.success}{@html spec.success}{/if}
    </div>
  {/if}
  {#if showSolution && spec.solution}
    <VouchEditor value={spec.solution.replace(/\n$/, '')} name={`${spec.id}-solution`} readonly lsp={false} minLines={4} label="A solution" />
  {/if}
</ExerciseFrame>

<style>
  .bar {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    flex-wrap: wrap;
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
  .go:disabled {
    opacity: 0.6;
  }
  .problems {
    margin: 0.6rem 0 0;
    padding: 0.5rem 0.8rem 0.5rem 1.6rem;
    border-left: 3px solid var(--pencil);
    color: var(--pencil);
    font-size: 0.85rem;
    white-space: pre-wrap;
  }
  .results {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 0.7rem;
  }
  .row {
    display: grid;
    grid-template-columns: 1.4rem minmax(0, 1fr);
    gap: 0.4rem;
    align-items: start;
  }
  .mark {
    color: var(--pencil);
    font-weight: 800;
    padding-top: 0.55rem;
  }
  .row.ok .mark {
    color: var(--seal);
  }
  .label {
    margin: 0 0 0.2rem;
    font-size: 0.82rem;
    font-weight: 600;
  }
  .detail {
    margin: 0.25rem 0 0;
    font-size: 0.92rem;
    color: var(--ink-2);
    white-space: pre-wrap;
  }
  .success {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--seal) 45%, var(--line));
    background: var(--seal-soft);
    border-radius: var(--radius-sm);
  }
  .success :global(p) {
    margin: 0.3rem 0 0;
  }
</style>
