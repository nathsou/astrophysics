<!--
  Build a formula with a restricted set of connectives that is equivalent to a target, e.g.
  "express p ∨ q using only NAND". Checked by truth table.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Tex from '$lib/components/exercise/Tex.svelte';
  import { parseFormula, formulaTex, equivalent, size, type Formula, type BinOp } from '$lib/logic/prop';
  import { progress } from '$lib/state/progress.svelte';

  interface Task {
    target: string;
    allowed: string[];
    hint?: string;
  }
  let { tasks, id, title = 'Build it from parts', subtitle }: { tasks: Task[]; id: string; title?: string; subtitle?: string } = $props();

  const SYM: Record<string, string> = { not: '¬', and: '∧', or: '∨', imp: '→', iff: '↔', xor: '⊕', nand: '↑', nor: '↓' };
  let answers = $state<string[]>([]);
  onMount(() => (answers = progress.draft(id, tasks.map(() => ''))));

  function used(f: Formula, out = new Set<string>()): Set<string> {
    if (f.k === 'not') {
      out.add('not');
      used(f.a, out);
    } else if (f.k !== 'var' && f.k !== 'const') {
      out.add(f.k);
      used(f.a, out);
      used(f.b, out);
    } else if (f.k === 'const') out.add('const');
    return out;
  }

  function verdict(i: number): { ok: boolean; msg: string } | null {
    const src = answers[i]?.trim();
    if (!src) return null;
    let f: Formula;
    try {
      f = parseFormula(src);
    } catch (e) {
      return { ok: false, msg: e instanceof Error ? e.message : String(e) };
    }
    const task = tasks[i]!;
    const bad = [...used(f)].filter((op) => !task.allowed.includes(op));
    if (bad.length) return { ok: false, msg: `Only ${task.allowed.map((a) => SYM[a] ?? a).join(' ')} allowed; you used ${bad.map((b) => SYM[b] ?? 'constants').join(' ')}.` };
    const eq = equivalent(f, parseFormula(task.target));
    if (!eq.ok) {
      const row = Object.entries(eq.counter)
        .map(([k, v]) => `${k} = ${v ? 'T' : 'F'}`)
        .join(', ');
      return { ok: false, msg: `Not equivalent: they differ when ${row}.` };
    }
    return { ok: true, msg: `✓ Equivalent (${size(f)} symbols).` };
  }

  const verdicts = $derived(answers.map((_, i) => verdict(i)));
  $effect(() => {
    if (answers.length) progress.saveDraft(id, answers);
    if (verdicts.length && verdicts.every((v) => v?.ok)) progress.markSolved(id);
  });
  const nandKey = (k: BinOp | 'not') => SYM[k];
</script>

<Widget {title} {subtitle} kind="Exercise">
  <ol class="tasks">
    {#each tasks as t, i (i)}
      <li>
        <div class="goal">
          Express <Tex tex={formulaTex(parseFormula(t.target))} /> using only
          <strong>{t.allowed.map((a) => nandKey(a as BinOp)).join(' ')}</strong>
          {#if t.allowed.includes('nand')}<span class="small">(type <code>nand</code> or ↑)</span>{/if}
        </div>
        <input bind:value={answers[i]} spellcheck="false" placeholder="e.g. (p nand q) nand …" aria-label="Formula for task {i + 1}" />
        {#if verdicts[i]}<p class="v" class:ok={verdicts[i]!.ok}>{verdicts[i]!.msg}</p>{:else if t.hint}<p class="v hint">Hint: {t.hint}</p>{/if}
      </li>
    {/each}
  </ol>
</Widget>

<style>
  .tasks {
    margin: 0;
    padding-left: 1.3rem;
    display: grid;
    gap: 0.9rem;
  }
  .goal {
    margin-bottom: 0.3rem;
  }
  .small {
    color: var(--ink-3);
    font-size: 0.78rem;
  }
  input {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    padding: 0.35rem 0.55rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--page);
    color: var(--ink);
  }
  .v {
    margin: 0.3rem 0 0;
    font-size: 0.82rem;
    color: var(--bad);
  }
  .v.ok {
    color: var(--ok);
    font-weight: 600;
  }
  .v.hint {
    color: var(--ink-3);
  }
</style>
