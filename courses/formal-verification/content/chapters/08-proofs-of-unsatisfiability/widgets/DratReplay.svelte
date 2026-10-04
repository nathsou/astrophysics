<!--
  DRAT replay. The course's real CDCL solver solves an unsatisfiable formula and writes a DRAT proof: every clause it
  learns ("a") and every clause it deletes ("d"). The trusted checker replays the proof. Click any added line to see
  its RUP check: assume the clause false, unit-propagate over everything added and not yet deleted, reach a conflict.
-->
<script lang="ts">
  import { Solver, type ProofLine } from '$lib/fv/sat/solver';
  import { checkDrat, type DratResult } from '$lib/fv/sat/check/drat';
  import { explainRup, type RupExplanation } from '$lib/fv/sat/resolution';
  import { pigeonhole, randomKSat } from '$lib/fv/sat/encode';
  import { rng } from '$lib/fv/util/random';
  import type { Cnf } from '$lib/fv/sat/cnf';

  let { caption }: { caption?: string } = $props();

  const presets: { name: string; make: () => Cnf }[] = [
    { name: 'Pigeonhole, 5 pigeons in 4 holes', make: () => pigeonhole(5, 4) },
    { name: 'Pigeonhole, 7 pigeons in 6 holes', make: () => pigeonhole(7, 6) },
    { name: 'Random 3-SAT, 100 variables, 460 clauses', make: () => randomKSat(rng(1), 100, 460, 3) },
  ];
  let which = $state(0);
  let cnf = $state.raw<Cnf | undefined>();
  let proof = $state.raw<ProofLine[]>([]);
  let result = $state('');
  let solveMs = $state(0);
  let drat = $state<DratResult | undefined>();
  let checkMs = $state(0);
  let open = $state<{ i: number; e: RupExplanation } | undefined>();
  const SHOW = 400;

  function solve() {
    const f = presets[which]!.make();
    const s = new Solver({ proof: true });
    s.ensureVars(f.nvars);
    for (const c of f.clauses) s.addClause(c);
    const t0 = performance.now();
    result = s.solve({});
    solveMs = performance.now() - t0;
    cnf = f;
    proof = s.proof;
    drat = undefined;
    open = undefined;
  }
  function check() {
    if (!cnf) return;
    const t0 = performance.now();
    drat = checkDrat(cnf.clauses, proof);
    checkMs = performance.now() - t0;
  }
  function explain(i: number) {
    if (!cnf) return;
    // The clause database just before line i: the input, plus additions, minus deletions.
    const db: number[][] = cnf.clauses.map((c) => [...c]);
    const key = (c: readonly number[]) => [...c].sort((a, b) => a - b).join(' ');
    for (let k = 0; k < i; k++) {
      const line = proof[k]!;
      if (line.kind === 'd') {
        const j = db.findIndex((c) => key(c) === key(line.lits));
        if (j >= 0) db.splice(j, 1);
      } else db.push([...line.lits]);
    }
    open = { i, e: explainRup(db, proof[i]!.lits) };
  }
  const adds = $derived(proof.filter((p) => p.kind === 'a').length);
  const dels = $derived(proof.filter((p) => p.kind === 'd').length);
  const lits = $derived(proof.reduce((n, p) => n + p.lits.length, 0));
  const fmt = (ms: number) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`);
  const litText = (l: number) => `${l < 0 ? '¬' : ''}x${Math.abs(l)}`;
</script>

<figure class="drat">
  <div class="bar ui">
    <select bind:value={which} aria-label="Formula">{#each presets as p, i (i)}<option value={i}>{p.name}</option>{/each}</select>
    <button type="button" class="go" onclick={solve}>Solve with proof</button>
    {#if proof.length}<button type="button" class="go" onclick={check}>Check the proof</button>{/if}
  </div>
  {#if cnf}
    <p class="ui stats">
      {cnf.nvars} variables, {cnf.clauses.length} clauses. The solver answers <b>{result.toUpperCase()}</b> in {fmt(solveMs)}.
      {#if result === 'unsat'}Its proof has {adds.toLocaleString('en-GB')} added and {dels.toLocaleString('en-GB')} deleted clauses ({lits.toLocaleString('en-GB')} literals).{/if}
    </p>
    {#if drat}
      <p class="ui verdict" class:bad={!drat.ok}>{drat.ok ? `Proof accepted: ${drat.checked.toLocaleString('en-GB')} clauses checked by unit propagation in ${fmt(checkMs)}, ending in the empty clause.` : `Proof rejected: ${drat.message}`}</p>
    {/if}
    <div class="cols">
      <ol class="lines">
        {#each proof.slice(0, SHOW) as line, i (i)}
          <li class:del={line.kind === 'd'} class:sel={open?.i === i}>
            {#if line.kind === 'a'}<button type="button" onclick={() => explain(i)}><span class="k">a</span> <code>{line.lits.length ? line.lits.map(litText).join(' ') : '∅'}</code></button>
            {:else}<span class="k">d</span> <code>{line.lits.map(litText).join(' ')}</code>{/if}
          </li>
        {/each}
        {#if proof.length > SHOW}<li class="more ui">… {(proof.length - SHOW).toLocaleString('en-GB')} more lines</li>{/if}
      </ol>
      <div class="explain ui">
        {#if open}
          {@const e = open.e}
          <p><b>Line {open.i + 1}.</b> Assume every literal false: {e.assumed.map(litText).join(', ') || '(the empty clause assumes nothing)'}.</p>
          <p>{e.forced.length ? `Unit propagation forces ${e.forced.length} literal${e.forced.length === 1 ? '' : 's'}: ${e.forced.slice(0, 24).map((f) => litText(f.lit)).join(', ')}${e.forced.length > 24 ? ', …' : ''}.` : 'Propagation forces nothing new.'}</p>
          <p class:good={e.ok} class:bad={!e.ok}>{e.ok ? 'A clause becomes false: the line follows (RUP).' : 'No conflict: this line is not RUP.'}</p>
        {:else}
          <p>Click an added line (a) to see why it follows. Deleted lines (d) need no check. The proof argues that if the input were satisfiable, every later set of clauses would be too, and removing a clause from a satisfiable set leaves it satisfiable.</p>
        {/if}
      </div>
    </div>
  {/if}
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .drat {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .bar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }
  select {
    font: inherit;
    font-size: 0.85rem;
    padding: 0.25rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
    max-width: 100%;
  }
  .go {
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.28rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  .stats,
  .verdict {
    font-size: 0.85rem;
    margin: 0.6rem 0 0;
    color: var(--ink-2);
  }
  .verdict {
    color: var(--seal);
    font-weight: 600;
  }
  .verdict.bad {
    color: var(--pencil);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.8rem;
    margin-top: 0.6rem;
  }
  @media (max-width: 640px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  .lines {
    list-style: none;
    margin: 0;
    padding: 0.4rem;
    max-height: 18rem;
    overflow: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
  }
  .lines li {
    padding: 0.05rem 0.2rem;
    white-space: nowrap;
  }
  .lines li.sel {
    background: color-mix(in srgb, var(--gold) 20%, transparent);
  }
  .lines li.del {
    color: var(--mute);
  }
  .lines button {
    font: inherit;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--fg);
    text-align: left;
  }
  .k {
    display: inline-block;
    width: 1em;
    font-family: var(--font-ui);
    font-weight: 700;
    color: var(--ink-blue);
  }
  .del .k {
    color: var(--mute);
  }
  code {
    font-family: var(--font-mono);
  }
  .explain {
    font-size: 0.84rem;
    color: var(--ink-2);
  }
  .explain p {
    margin: 0 0 0.4rem;
  }
  .good {
    color: var(--seal);
    font-weight: 600;
  }
  .bad {
    color: var(--pencil);
    font-weight: 600;
  }
  .more {
    color: var(--mute);
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
