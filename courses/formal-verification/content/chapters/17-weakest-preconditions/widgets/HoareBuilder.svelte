<!--
  The Hoare rule builder: a proof of {requires} body {ensures}, built by applying rules to goals. The sequence rule
  splits off the first statement and needs a midpoint (the weakest precondition of the rest, or one you type); the
  if rule splits into two branches; the while rule needs an invariant. Each rule's side conditions, implications
  between formulas, go to the solver; a goal is proved when its side conditions are valid and its subgoals proved.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { applicableRules, formulaFromText, fromVouch, HoareProof, showFormula, WpError, type Goal, type RuleName, type WStmt } from '$lib/fv/wp/wp';

  let { code, title, caption }: { code: string; title?: string; caption?: string } = $props();

  let proof = $state.raw<HoareProof | undefined>();
  let tick = $state(0);
  let error = $state('');
  let selected = $state(0);
  let midText = $state('');
  let midError = $state('');

  function load() {
    error = '';
    try {
      proof = new HoareProof(fromVouch(code));
      selected = 0;
      tick++;
    } catch (e) {
      if (!(e instanceof WpError)) throw e;
      error = e.message;
    }
  }
  untrack(load);

  const goals = $derived.by(() => {
    void tick;
    return proof ? [...proof.goals] : [];
  });
  const sel = $derived(goals[selected]);
  const rules = $derived(sel && !sel.rule ? applicableRules(sel) : []);

  const RULE_TEXT: Record<RuleName, string> = {
    sequence: 'Sequence: split off the first statement',
    assignment: 'Assignment (with consequence)',
    if: 'If: one goal per branch',
    assert: 'Assert',
    assume: 'Assume',
    return: 'Return',
    while: 'While: use the invariant',
    empty: 'Empty program (consequence)',
  };

  function apply(rule: RuleName, custom: boolean) {
    if (!proof || !sel) return;
    midError = '';
    let mid;
    if (custom) {
      try {
        mid = formulaFromText(proof.prog, midText);
      } catch (e) {
        midError = e instanceof WpError ? e.message : String(e);
        return;
      }
    }
    proof.apply(sel.id, rule, mid);
    tick++;
    const next = proof.goals.find((g) => !g.rule);
    if (next) selected = next.id;
  }
  function auto() {
    proof?.auto();
    tick++;
  }

  const stmtsText = (ss: WStmt[]) => (ss.length ? ss.map((s) => s.text.replace(/\{\s*$/, '{…}')).join('; ') : 'skip');
  const short = (t: string) => (t.length > 70 ? t.slice(0, 67) + '…' : t);
  function depthOf(g: Goal): number {
    let d = 0;
    let cur = g;
    for (;;) {
      const parent = goals.find((x) => x.children.includes(cur.id));
      if (!parent) return d;
      d++;
      cur = parent;
    }
  }
  const order = $derived.by(() => {
    const out: Goal[] = [];
    const visit = (g: Goal) => {
      out.push(g);
      g.children.forEach((c) => visit(goals[c]!));
    };
    if (goals[0]) visit(goals[0]);
    return out;
  });
</script>

<figure class="hb">
  {#if title}<h4 class="ui ttl">{title}</h4>{/if}
  {#if error}<p class="err ui">{error}</p>{/if}
  {#if proof}
    <div class="cols">
      <ol class="goals">
        {#each order as g (g.id)}
          <li class:sel={selected === g.id} class:closed={g.closed} class:open={!g.rule} style="margin-left: {depthOf(g) * 1.1}rem">
            <button type="button" onclick={() => (selected = g.id)}>
              <span class="st ui">{g.closed ? '✓' : g.rule ? (g.side.some((s) => !s.result.valid) ? '✗' : '…') : '○'}</span>
              <code>{'{'}{short(showFormula(g.pre))}{'}'} {short(stmtsText(g.stmts))} {'{'}{short(showFormula(g.post))}{'}'}</code>
              {#if g.rule}<span class="rule ui">{g.rule}</span>{/if}
            </button>
          </li>
        {/each}
      </ol>
      <div class="panel">
        {#if sel}
          <p class="ui lab">Goal</p>
          <div class="triple"><code>{'{'} {showFormula(sel.pre)} {'}'}</code><code class="prog">{sel.stmts.map((s) => s.text.replace(/\{\s*$/, '{…}')).join('\n') || 'skip'}</code><code>{'{'} {showFormula(sel.post)} {'}'}</code></div>
          {#if !sel.rule}
            <p class="ui lab">Apply a rule</p>
            {#each rules as r (r)}
              <button type="button" class="go ui" onclick={() => apply(r, false)}>{RULE_TEXT[r]}{r === 'sequence' ? ', midpoint = wp of the rest' : r === 'while' ? ' written in the code' : ''}</button>
              {#if r === 'sequence' || r === 'while'}
                <div class="custom ui">
                  <input bind:value={midText} placeholder={r === 'sequence' ? 'or type a midpoint, e.g. a == x + y' : 'or type an invariant'} spellcheck="false" />
                  <button type="button" onclick={() => apply(r, true)} disabled={!midText.trim()}>Use it</button>
                </div>
                {#if midError}<p class="err ui">{midError}</p>{/if}
              {/if}
            {/each}
          {:else}
            <p class="ui">Rule applied: <b>{sel.rule}</b>.{#if sel.children.length} {sel.children.length} subgoal{sel.children.length === 1 ? '' : 's'}.{/if}</p>
          {/if}
          {#each sel.side as s, i (i)}
            <p class="side ui" class:ok={s.result.valid} class:bad={!s.result.valid}>
              <span class="mark">{s.result.valid ? '✓' : '✗'}</span>
              <span>Side condition, {s.text}: <code>{showFormula(s.formula)}</code>{s.result.valid ? ' is valid.' : s.result.counterexample ? ` fails for ${s.result.counterexample.map(([k, v]) => `${k} = ${v}`).join(', ')}.` : ` could not be decided.`}</span>
            </p>
          {/each}
        {/if}
        <div class="bar ui">
          <button type="button" onclick={auto} disabled={proof.goals.every((g) => g.rule)}>Apply the obvious rules everywhere</button>
          <button type="button" onclick={load}>Start again</button>
        </div>
        <p class="ui status" class:done={proof.done}>{proof.done ? 'Proved: every goal is closed and every side condition is valid.' : 'Not proved yet.'}</p>
      </div>
    </div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .hb {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .ttl {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem;
  }
  @media (max-width: 820px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .goals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    max-height: 30rem;
    overflow: auto;
  }
  .goals button {
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
    width: 100%;
    text-align: left;
    padding: 0.25rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  .goals li.sel button {
    border-color: var(--ink-blue);
    box-shadow: 0 0 0 1px var(--ink-blue);
  }
  .goals li.closed button {
    border-color: color-mix(in srgb, var(--seal) 50%, var(--line));
  }
  .st {
    flex: none;
    width: 1rem;
    font-weight: 700;
  }
  .closed .st {
    color: var(--seal);
  }
  .rule {
    margin-left: auto;
    flex: none;
    font-size: 0.7rem;
    color: var(--mute);
  }
  .hb code {
    all: unset;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .lab {
    margin: 0.4rem 0 0.2rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .triple {
    display: grid;
    gap: 0.2rem;
    padding: 0.4rem;
    border-radius: var(--radius-sm);
    background: var(--panel);
    border: 1px solid var(--line);
  }
  .triple .prog {
    padding-left: 0.8rem;
    color: var(--ink-2);
  }
  button {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    padding: 0.22rem 0.65rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .go {
    display: block;
    margin: 0.25rem 0;
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .custom {
    display: flex;
    gap: 0.3rem;
    margin: 0.2rem 0 0.4rem;
  }
  .custom input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    padding: 0.2rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .side {
    display: flex;
    gap: 0.35rem;
    font-size: 0.82rem;
    margin: 0.35rem 0;
  }
  .side.ok .mark {
    color: var(--seal);
  }
  .side.bad {
    color: var(--pencil);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.6rem;
  }
  .status {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .status.done {
    color: var(--seal);
  }
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
