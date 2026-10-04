<!--
  The lying solver. A CDCL solver with one bug in conflict analysis (it drops a literal from some learned clauses)
  reports UNSAT on a satisfiable formula and hands over its proof. The reader checks the proof line by line: each
  line must follow from the input and the lines before it by unit propagation (RUP). The bad line is caught, and the
  trusted DRAT checker agrees. Then an honest solver finds a model, which is checked clause by clause.
-->
<script lang="ts">
  import { LyingStepper, explainRup, runWithProof, type RupExplanation } from '$lib/fv/sat/resolution';
  import { checkDrat, type DratResult } from '$lib/fv/sat/check/drat';
  import { solveCnf, type ProofLine } from '$lib/fv/sat/solver';
  import { progress } from '$lib/state/progress.svelte';

  let { clauses, nvars, id, caption }: { clauses: number[][]; nvars: number; id?: string; caption?: string } = $props();

  const litText = (l: number) => `${l < 0 ? '¬' : ''}x${Math.abs(l)}`;
  const clauseText = (c: readonly number[]) => (c.length ? c.map(litText).join(' ∨ ') : '∅ (the empty clause)');

  let proof = $state<ProofLine[] | undefined>();
  let checks = $state<RupExplanation[]>([]);
  let drat = $state<DratResult | undefined>();
  let model = $state<boolean[] | undefined>();
  let open = $state<number | undefined>();

  function ask() {
    proof = runWithProof(new LyingStepper(clauses, nvars)).proof;
    checks = [];
    drat = undefined;
    model = undefined;
  }
  function check() {
    if (!proof) return;
    const db = clauses.map((c) => [...c]);
    const out: RupExplanation[] = [];
    for (const line of proof) {
      const e = explainRup(db, line.lits);
      out.push(e);
      if (!e.ok) break;
      db.push(line.lits);
    }
    checks = out;
    open = out.length - 1;
    drat = checkDrat(clauses, proof);
  }
  function honest() {
    const r = solveCnf({ nvars, clauses });
    model = r.result === 'sat' ? r.model : undefined;
    if (model && id) progress.markSolved(id);
  }
  const satisfied = $derived(model ? clauses.filter((c) => c.some((l) => model![Math.abs(l)] === l > 0)).length : 0);
</script>

<figure class="liar">
  <p class="ui info">A formula with {nvars} variables and {clauses.length} clauses.</p>
  <details class="ui formula"><summary>Show the clauses</summary><ol>{#each clauses as c, i (i)}<li><code>{clauseText(c)}</code></li>{/each}</ol></details>

  <div class="steps ui">
    <section>
      <h4>1. Ask the solver</h4>
      <button type="button" class="go" onclick={ask}>Solve</button>
      {#if proof}
        <p class="claim">The solver answers <b>UNSAT</b> and hands over a proof of {proof.length} lines:</p>
        <ol class="proof">
          {#each proof as line, i (i)}
            {@const c = checks[i]}
            <li class:ok={c?.ok} class:bad={c && !c.ok}>
              <button type="button" class="line" onclick={() => (open = i)} disabled={!c}><code>{clauseText(line.lits)}</code>{#if c}<span class="mark">{c.ok ? '✓ follows' : '✗ does not follow'}</span>{/if}</button>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    {#if proof}
      <section>
        <h4>2. Check the proof</h4>
        <button type="button" class="go" onclick={check}>Check every line</button>
        {#if open !== undefined && checks[open] && proof[open]}
          {@const e = checks[open]!}
          <div class="why" class:bad={!e.ok}>
            <p>Line {open + 1}, <code>{clauseText(proof[open]!.lits)}</code>. Assume it false: {e.assumed.length ? e.assumed.map(litText).join(', ') : 'nothing to assume'}.</p>
            {#if e.forced.length}<p>Unit propagation forces {e.forced.map((f) => `${litText(f.lit)} (clause ${f.clause + 1})`).join(', ')}.</p>{:else}<p>No clause is unit: propagation forces nothing.</p>{/if}
            {#if e.ok}
              <p>{e.conflict !== undefined ? `Clause ${e.conflict + 1} is now false: assuming the line false contradicts what came before, so the line follows.` : 'The line is a tautology.'}</p>
            {:else}
              <p><b>No clause becomes false.</b> The line does not follow from the input and the lines before it by unit propagation. The checker rejects the proof here, and with it the answer UNSAT.</p>
            {/if}
          </div>
        {/if}
        {#if drat}<p class="drat" class:bad={!drat.ok}>The course's trusted DRAT checker: {drat.ok ? 'proof accepted.' : `proof rejected at line ${(drat.failedAt ?? 0) + 1}. ${drat.message}`}</p>{/if}
      </section>
    {/if}

    {#if drat && !drat.ok}
      <section>
        <h4>3. Ask an honest solver</h4>
        <button type="button" class="go" onclick={honest}>Solve honestly</button>
        {#if model}
          <p class="claim">The honest solver answers <b>SAT</b> with {Array.from({ length: nvars }, (_, i) => litText(model![i + 1] ? i + 1 : -(i + 1))).join(', ')}. Checked: it satisfies {satisfied} of the {clauses.length} clauses. The liar was wrong.</p>
        {/if}
      </section>
    {/if}
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .liar {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .info {
    margin: 0 0 0.3rem;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
  .formula {
    font-size: 0.82rem;
    margin-bottom: 0.6rem;
  }
  .formula ol {
    columns: 3 12rem;
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }
  .steps {
    display: grid;
    gap: 0.8rem;
    font-size: 0.86rem;
  }
  section {
    padding: 0.6rem 0.8rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .liar h4 {
    margin: 0 0 0.4rem;
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-2);
  }
  .go {
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0.28rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  .claim {
    margin: 0.5rem 0 0.3rem;
  }
  .proof {
    margin: 0.2rem 0 0;
    padding-left: 1.6rem;
  }
  .line {
    font: inherit;
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
    background: none;
    border: none;
    padding: 0.1rem 0;
    color: var(--fg);
    cursor: pointer;
    text-align: left;
  }
  .line:disabled {
    cursor: default;
  }
  .mark {
    font-size: 0.78rem;
  }
  li.ok .mark {
    color: var(--seal);
  }
  li.bad .mark,
  li.bad code {
    color: var(--pencil);
    font-weight: 700;
  }
  .why {
    margin-top: 0.5rem;
    padding: 0.4rem 0.7rem;
    border-left: 3px solid var(--seal);
    background: var(--pn);
  }
  .why.bad {
    border-left-color: var(--pencil);
  }
  .why p {
    margin: 0.2rem 0;
  }
  .drat {
    margin: 0.5rem 0 0;
    color: var(--seal);
  }
  .drat.bad {
    color: var(--pencil);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
