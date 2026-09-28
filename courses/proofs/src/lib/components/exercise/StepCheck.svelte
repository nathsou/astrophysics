<!--
  A chain of claims, each checked by the CAS:
      S(n+1) = S(n) + (n+1)        # definition of S
             = n(n+1)/2 + (n+1)    # induction hypothesis
             = (n+1)(n+2)/2
  Optional requirements: the chain must start at `start`, end at `target`, and prove `relation`.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Checker, chainRelation, parseChain, toTex, REL_TEX, type Expr, type Rel, type Verdict as V } from '$lib/cas';
  import { progress } from '$lib/state/progress.svelte';
  import ExerciseFrame from './ExerciseFrame.svelte';
  import Tex from './Tex.svelte';
  import VerdictBadge from './Verdict.svelte';
  import { casOptions, type CasSpec, type ExerciseBase } from './types';

  interface Spec extends ExerciseBase, CasSpec {
    start?: string;
    target?: string;
    relation?: Rel;
    placeholder?: string;
    /** Pre-filled first line. */
    initial?: string;
    rows?: number;
  }

  let { spec }: { spec: Spec } = $props();

  const checker = new Checker(casOptions(spec));
  let text = $state(spec.initial ?? '');
  let result = $state<{ steps: { from: Expr; rel: Rel; to: Expr; verdict: V; note?: string; first: boolean }[]; error?: string; messages: { ok: boolean; text: string }[] } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    text = progress.draft(spec.id, text);
    if (text.trim()) run();
  });

  /**
   * Split the text into chains. A line that starts with a relation continues the current chain;
   * any other line starts a new one. Text after # is a justification for the line's last relation.
   */
  function prepare(src: string): { chain: string; notes: (string | undefined)[] }[] {
    const chains: { parts: string[]; notes: (string | undefined)[] }[] = [];
    for (const raw of src.split('\n')) {
      const [body, ...comment] = raw.split('#');
      const b = body!.trim();
      if (!b) continue;
      const continues = /^(<=|>=|!=|==|[=<>≤≥≠])/.test(b);
      if (!continues || chains.length === 0) chains.push({ parts: [], notes: [] });
      const cur = chains.at(-1)!;
      cur.parts.push(b);
      const rels = b.match(/<=|>=|!=|==|[=<>≤≥≠]/g)?.length ?? 0;
      for (let i = 0; i < rels; i++) cur.notes.push(i === rels - 1 && comment.length ? comment.join('#').trim() : undefined);
    }
    return chains.map((c) => ({ chain: c.parts.join(' '), notes: c.notes }));
  }

  function sameExpr(a: Expr, src: string): boolean {
    try {
      const v = checker.relation(a, '=', checker.parse(src));
      return v.ok;
    } catch {
      return false;
    }
  }

  function run() {
    progress.saveDraft(spec.id, text);
    if (!text.trim()) {
      result = null;
      return;
    }
    const chains = prepare(text);
    const parsedChains: { exprs: Expr[]; rels: Rel[]; notes: (string | undefined)[] }[] = [];
    for (const c of chains) {
      try {
        parsedChains.push({ ...parseChain(c.chain, checker.parseOpts), notes: c.notes });
      } catch (e) {
        result = { steps: [], error: e instanceof Error ? e.message : String(e), messages: [] };
        return;
      }
    }
    if (parsedChains.every((c) => c.rels.length === 0)) {
      result = { steps: [], error: 'Write at least one step: expression = expression (or <, ≤, …).', messages: [] };
      return;
    }
    const steps = parsedChains.flatMap((c) =>
      c.rels.map((rel, i) => {
        const from = c.exprs[i]!;
        const to = c.exprs[i + 1]!;
        return { from, rel, to, verdict: checker.relation(from, rel, to), note: c.notes[i], first: i === 0 };
      }),
    );
    const messages: { ok: boolean; text: string }[] = [];
    const allOk = steps.every((s) => s.verdict.ok);
    const hasGoal = !!(spec.start || spec.target || spec.relation);
    if (hasGoal && parsedChains.length > 1) {
      messages.push({ ok: false, text: 'Write the argument as one chain: start each new line with a relation such as =, < or ≤.' });
    } else if (hasGoal) {
      const parsed = parsedChains[0]!;
      if (spec.start && !sameExpr(parsed.exprs[0]!, spec.start)) messages.push({ ok: false, text: `Start from ${spec.start}.` });
      if (spec.target && !sameExpr(parsed.exprs.at(-1)!, spec.target)) messages.push({ ok: false, text: `The chain should end at ${spec.target}.` });
      const overall = chainRelation(parsed.rels);
      // A stronger relation proves a weaker one: < gives ≤, = gives ≤ and ≥.
      const implies = (have: Rel | null, want: Rel) =>
        have === want || (want === '<=' && (have === '<' || have === '=')) || (want === '>=' && (have === '>' || have === '='));
      if (spec.relation && !implies(overall, spec.relation)) {
        messages.push({ ok: false, text: overall ? `This chain proves “${overall}”, but the goal needs “${spec.relation}”.` : 'The chain mixes ≤ and ≥, so it does not prove anything.' });
      }
    }
    if (allOk && messages.length === 0) {
      messages.push({ ok: true, text: hasGoal ? 'Every step checks and the chain reaches the goal.' : 'Every step checks.' });
      if (hasGoal) progress.markSolved(spec.id);
    }
    result = { steps, messages };
  }

  function oninput() {
    clearTimeout(timer);
    timer = setTimeout(run, 350);
  }

  const rows = $derived(Math.max(spec.rows ?? 3, text.split('\n').length + 1));
</script>

<ExerciseFrame id={spec.id} kind="Step check" title={spec.title} prompt={spec.prompt} hints={spec.hints ?? (spec.hint ? [spec.hint] : [])} solution={spec.solution}>
  <textarea
    class="input"
    bind:value={text}
    {oninput}
    {rows}
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    placeholder={spec.placeholder ?? (spec.start ? `${spec.start} = …` : 'a = b = c   # one step per line, comments after #')}
    aria-label="Your chain of steps"
  ></textarea>
  <p class="help ui">One relation per line is easiest (start the next line with <code>=</code>, <code>&lt;</code>, <code>&lt;=</code>…). Add a justification after <code>#</code>.</p>
  {#if result}
    {#if result.error}
      <p class="error ui">⚠ {result.error}</p>
    {:else}
      <div class="steps" class:pending={result.steps.some((s) => !s.verdict.ok)} aria-live="polite">
        {#each result.steps as s, i (i)}
          <div class="lhs" class:newchain={s.first && i > 0}>{#if s.first}<Tex tex={toTex(s.from)} />{/if}</div>
          <div class="rel"><Tex tex={REL_TEX[s.rel]} /></div>
          <div class="rhs"><Tex tex={toTex(s.to)} />{#if s.note}<span class="note">{s.note}</span>{/if}</div>
          <div class="verdict"><VerdictBadge v={s.verdict} /></div>
        {/each}
      </div>
      {#each result.messages as m, i (i)}
        <p class="msg ui" class:ok={m.ok}>{m.ok ? '✓' : '→'} {m.text}</p>
      {/each}
    {/if}
  {/if}
</ExerciseFrame>

<style>
  .input {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.6;
    padding: 0.6rem 0.75rem;
    border: 2px solid var(--fg);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--ink);
    resize: vertical;
  }
  .input:focus {
    outline: 3px solid var(--focus);
    outline-offset: 0;
  }
  .help {
    margin: 0.3rem 0 0.6rem !important;
    font-size: 0.75rem;
    color: var(--ink-3);
  }
  .help code {
    font-size: 0.72rem;
  }
  .steps {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 0.35rem 0.5rem;
    padding: 0.7rem 0.85rem;
    background: var(--pn);
    border-left: 6px solid var(--fx-blue);
    border-radius: 0;
    overflow-x: auto;
  }
  .steps.pending {
    border-left-color: var(--fx-red);
  }
  .lhs {
    text-align: right;
  }
  .lhs.newchain {
    padding-top: 0.4rem;
  }
  .rhs {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2rem 0.75rem;
  }
  .note {
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--ink-3);
    font-style: italic;
  }
  .verdict {
    justify-self: end;
  }
  .error {
    color: var(--maybe);
    font-size: 0.85rem;
  }
  .msg {
    margin: 0.5rem 0 0 !important;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .msg {
    font-weight: 500;
  }
  .msg:not(.ok) {
    color: var(--bad);
  }
  .msg.ok {
    color: var(--ok);
    font-weight: 700;
  }
  @media (max-width: 560px) {
    .steps {
      grid-template-columns: auto auto 1fr;
    }
    .verdict {
      grid-column: 1 / -1;
      justify-self: start;
    }
  }
</style>
