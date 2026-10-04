<!--
  The DPLL(T) conversation: the SAT solver chooses truth values for equality atoms; the theory of equality checks
  each choice with an e-graph and either agrees or returns a conflict, whose negation the SAT solver learns. The
  clauses are editable (one per line, literals separated by |, each `s = t` or `s != t`).
-->
<script lang="ts">
  import { DplltStepper, parseEufClauses, showTerm, EufParseError, type Message } from '$lib/fv/smt/dpllt-stepper';
  import type { Term } from '$lib/fv/logic/term';

  let { clauses: initial, caption }: { clauses: string[]; caption?: string } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(initial.join('\n'));
  let stepper = $state.raw<DplltStepper | undefined>();
  let log = $state.raw<Message[]>([]);
  let tick = $state(0);
  let error = $state('');

  function load() {
    error = '';
    try {
      const { clauses, atoms } = parseEufClauses(text.split('\n').map((l) => l.trim()).filter(Boolean));
      stepper = new DplltStepper(clauses, atoms);
      log = [];
      tick++;
    } catch (e) {
      error = e instanceof EufParseError ? e.message : String(e);
      stepper = undefined;
    }
  }
  load();

  function next() {
    if (!stepper) return;
    stepper.next();
    log = [...stepper.log];
    tick++;
  }
  function all() {
    if (!stepper) return;
    for (let i = 0; i < 200 && !stepper.done; i++) stepper.next();
    log = [...stepper.log];
    tick++;
  }

  const view = $derived.by(() => {
    void tick;
    if (!stepper) return undefined;
    const st = stepper.st;
    const value = (l: number) => st.value(l);
    const clauses = st.clauses.map((c, i) => ({ lits: c, lemma: stepper!.lemmas.has(i), learned: i >= st.inputCount && !stepper!.lemmas.has(i), state: st.clauseState(i).kind }));
    // E-graph: group the terms by class.
    const { euf, conflict } = stepper.egraph();
    const terms = new Set<Term>();
    for (const a of stepper.atoms) {
      const add = (t: Term) => {
        terms.add(t);
        t.args.forEach(add);
      };
      add(a.a);
      add(a.b);
    }
    for (const t of terms) euf.add(t);
    const groups = new Map<Term, Term[]>();
    for (const t of terms) {
      const r = euf.find(t);
      groups.set(r, [...(groups.get(r) ?? []), t]);
    }
    const diseqs = st.trail.filter((t) => t.lit < 0).map((t) => stepper!.atoms[-t.lit - 1]!);
    return { clauses, value, groups: [...groups.values()].sort((a, b) => b.length - a.length), diseqs, conflict, level: st.level };
  });
  const litText = (l: number) => stepper?.litText(l) ?? '';
</script>

<figure class="convo">
  <div class="grid">
    <section class="left">
      <h4 class="ui">Clauses</h4>
      <textarea bind:value={text} rows={Math.max(3, initial.length + 1)} spellcheck="false" aria-label="Clauses, one per line"></textarea>
      <div class="bar ui">
        <button type="button" onclick={load}>Load and reset</button>
      </div>
      {#if error}<p class="err ui">{error}</p>{/if}
      {#if view}
        <ol class="clauses">
          {#each view.clauses as c, i (i)}
            <li class={c.state} class:lemma={c.lemma} class:learned={c.learned}>
              {#each c.lits as l, k (k)}<span class="lit" class:t={view.value(l) === true} class:f={view.value(l) === false}>{litText(l)}</span>{#if k < c.lits.length - 1}<span class="or"> ∨ </span>{/if}{/each}
              {#if c.lemma}<span class="tag ui">theory lemma</span>{:else if c.learned}<span class="tag ui">learned</span>{/if}
            </li>
          {/each}
        </ol>
      {/if}
    </section>
    <section class="mid">
      <h4 class="ui">The conversation</h4>
      <div class="bar ui">
        <button type="button" class="go" onclick={next} disabled={!stepper || stepper.done}>Next turn</button>
        <button type="button" onclick={all} disabled={!stepper || stepper.done}>To the end</button>
      </div>
      <ol class="chat">
        {#each log as m, i (i)}
          <li class="msg {m.who}" class:bad={m.kind === 'conflict' || m.kind === 'unsat'} class:good={m.kind === 'sat'}>
            <span class="who ui">{m.who === 'sat' ? 'SAT solver' : 'Theory of equality'}</span>
            <span class="txt">{m.text}</span>
          </li>
        {:else}
          <li class="hint ui">Press Next turn.</li>
        {/each}
      </ol>
    </section>
    <section class="right">
      <h4 class="ui">The e-graph (current choices)</h4>
      {#if view}
        <div class="classes">
          {#each view.groups as g, i (i)}
            <div class="cls" class:multi={g.length > 1}>{#each g as t (t.id)}<code>{showTerm(t)}</code>{/each}</div>
          {/each}
        </div>
        {#if view.diseqs.length}<p class="ui dq">Must differ: {#each view.diseqs as d, i (i)}<code class:hot={view.conflict && view.conflict.includes(-(stepper!.atoms.indexOf(d) + 1))}>{showTerm(d.a)} ≠ {showTerm(d.b)}</code>{/each}</p>{/if}
        {#if view.conflict}<p class="ui conflict">Conflict: {view.conflict.map(litText).join(', ')}</p>{/if}
      {/if}
    </section>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .convo {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.3fr) minmax(0, 0.9fr);
    gap: 0.8rem;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  section {
    min-width: 0;
  }
  .convo h4 {
    margin: 0 0 0.4rem;
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    resize: vertical;
  }
  .bar {
    display: flex;
    gap: 0.4rem;
    margin: 0.3rem 0 0.5rem;
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
    background: var(--ink-blue);
    border-color: var(--ink-blue);
    color: var(--on-accent);
    font-weight: 600;
  }
  .err {
    color: var(--pencil);
    font-size: 0.82rem;
  }
  .clauses {
    margin: 0;
    padding-left: 1.4rem;
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }
  .clauses li {
    padding: 0.12rem 0;
  }
  .clauses li.false {
    background: color-mix(in srgb, var(--pencil) 12%, transparent);
  }
  .lit.t {
    color: var(--seal);
    font-weight: 700;
  }
  .lit.f {
    color: var(--mute);
    text-decoration: line-through;
  }
  .or {
    color: var(--mute);
    margin: 0 0.3em;
  }
  .tag {
    margin-left: 0.4rem;
    font-size: 0.68rem;
    color: var(--gold);
    font-weight: 700;
  }
  .chat {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
    max-height: 22rem;
    overflow-y: auto;
  }
  .msg {
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--panel);
    font-size: 0.82rem;
  }
  .msg.theory {
    margin-left: 1.2rem;
    border-color: color-mix(in srgb, var(--ink-blue) 40%, var(--line));
  }
  .msg.sat {
    margin-right: 1.2rem;
  }
  .msg.bad {
    border-color: var(--pencil);
  }
  .msg.good {
    border-color: var(--seal);
  }
  .who {
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .txt {
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }
  .hint {
    color: var(--mute);
    font-size: 0.82rem;
  }
  .classes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .cls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    padding: 0.25rem 0.35rem;
    border: 1px dashed var(--line-strong);
    border-radius: 999px;
    background: var(--panel);
  }
  .cls.multi {
    border-style: solid;
    border-color: var(--ink-blue);
    background: color-mix(in srgb, var(--ink-blue) 8%, var(--panel));
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }
  .dq {
    font-size: 0.78rem;
    color: var(--ink-2);
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: baseline;
  }
  .dq code.hot,
  .conflict {
    color: var(--pencil);
    font-weight: 700;
  }
  .conflict {
    font-size: 0.8rem;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
