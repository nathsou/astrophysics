<!--
  `spec` exercises and the spec adversary (PLAN §3, through-line 3): the reader writes a contract. It must not be
  too strong (the reference implementation verifies against it) and not too weak (every wrong implementation in
  the bank fails against it). Each adversary is a function body that replaces the reference body.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import ExerciseFrame from '../ExerciseFrame.svelte';
  import VouchEditor from '$lib/components/verify/VouchEditor.svelte';
  import Badge from '$lib/components/verify/Badge.svelte';
  import { verifyText } from '$lib/components/verify/lsp';
  import { fnVerified, forbidden, replaceBody } from './check';
  import { progress } from '$lib/state/progress.svelte';
  import type { Verdict } from '$lib/fv/engines';

  interface Adversary {
    name: string;
    body: string;
    why?: string;
  }
  interface Spec {
    id: string;
    title?: string;
    prompt?: string;
    starter: string;
    fn: string;
    adversaries: Adversary[];
    solution?: string;
    hints?: string[];
    success?: string;
    lines?: number;
  }
  let { spec }: { spec: Spec } = $props();

  const starter = spec.starter.replace(/\n$/, '');
  let editor: VouchEditor | undefined = $state();
  let running = $state(false);
  let reference = $state<{ ok: boolean; verdicts: Verdict[]; errors: string[] } | undefined>();
  let caught = $state<{ a: Adversary; caught: boolean; verdict?: Verdict }[]>([]);
  let solvedNow = $state(false);
  let showSolution = $state(false);

  onMount(() => {
    const d = progress.draft<string | undefined>(spec.id, undefined);
    if (d && d !== starter) editor?.setValue(d);
  });

  async function check() {
    running = true;
    reference = undefined;
    caught = [];
    solvedNow = false;
    try {
      const text = editor?.getValue() ?? starter;
      const bad = forbidden(text, ['assume']);
      if (bad.length) {
        reference = { ok: false, verdicts: [], errors: bad.map((b) => b.message) };
        return;
      }
      const r = await verifyText(text);
      if (r.errors.length) {
        reference = { ok: false, verdicts: [], errors: r.errors.map((e) => `line ${e.line}: ${e.message}`) };
        return;
      }
      reference = { ok: fnVerified(r.verdicts, spec.fn), verdicts: r.verdicts.find((d) => d.decl === spec.fn)?.verdicts ?? [], errors: [] };
      for (const a of spec.adversaries) {
        const variant = replaceBody(text, spec.fn, a.body);
        if (!variant) continue;
        const v = await verifyText(variant);
        const fn = v.verdicts.find((d) => d.decl === spec.fn);
        const ok = !!fn && fn.verdicts.length > 0 && fn.verdicts.every((x) => x.status === 'verified');
        caught = [...caught, { a, caught: !ok && !v.errors.length, verdict: fn?.verdicts.find((x) => x.status !== 'verified') ?? fn?.verdicts[0] }];
      }
      if (reference.ok && caught.every((c) => c.caught)) {
        solvedNow = true;
        progress.markSolved(spec.id);
      }
    } finally {
      running = false;
    }
  }
</script>

<ExerciseFrame id={spec.id} kind="write the specification" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? []}>
  <VouchEditor bind:this={editor} value={starter} name={spec.id} minLines={spec.lines ?? 8} maxHeight="30rem" onchange={(c) => progress.saveDraft(spec.id, c)} />
  <div class="bar ui">
    <button type="button" class="go" onclick={check} disabled={running}>{running ? 'Running the adversaries…' : 'Check the specification'}</button>
    <button type="button" onclick={() => editor?.setValue(starter)}>Reset</button>
    {#if spec.solution}<button type="button" onclick={() => (showSolution = !showSolution)}>{showSolution ? 'Hide the solution' : 'Show a solution'}</button>{/if}
  </div>
  {#if reference}
    <div class="panel">
      <p class="h ui">1 · The correct implementation must satisfy your specification</p>
      {#if reference.errors.length}
        <ul class="err ui">{#each reference.errors as e, i (i)}<li>{e}</li>{/each}</ul>
      {:else}
        <p class="line" class:ok={reference.ok}><span class="mark">{reference.ok ? '✓' : '✗'}</span> {reference.ok ? 'It verifies: the specification is not too strong.' : 'It does not verify: the specification asks for something the correct code does not do, or the proof needs more help.'}</p>
        {#if !reference.ok}{#each reference.verdicts.filter((v) => v.status !== 'verified') as v, i (i)}<Badge verdict={v} compact />{/each}{/if}
      {/if}
      {#if caught.length}
        <p class="h ui">2 · Every wrong implementation must fail against it</p>
        <ul class="adv">
          {#each caught as c, i (i)}
            <li class:ok={c.caught}>
              <span class="mark">{c.caught ? '✓' : '✗'}</span>
              <span><b class="ui">{c.a.name}</b> {c.caught ? 'is rejected.' : 'verifies against your specification, so the specification lets it through.'}{#if !c.caught && c.a.why} <span class="why">{c.a.why}</span>{/if}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
  {#if solvedNow}
    <div class="success" role="status"><strong class="ui">Specified.</strong> {#if spec.success}{@html spec.success}{/if}</div>
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
  .panel {
    margin-top: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .h {
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }
  .line,
  .adv li {
    margin: 0;
    color: var(--pencil);
  }
  .line.ok,
  .adv li.ok {
    color: var(--fg);
  }
  .mark {
    font-weight: 800;
    color: var(--pencil);
    margin-right: 0.3rem;
  }
  .ok .mark {
    color: var(--seal);
  }
  .adv {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .why {
    color: var(--ink-2);
  }
  .err {
    color: var(--pencil);
    font-size: 0.85rem;
  }
  .success {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid color-mix(in srgb, var(--seal) 45%, var(--line));
    background: var(--seal-soft);
    border-radius: var(--radius-sm);
  }
</style>
