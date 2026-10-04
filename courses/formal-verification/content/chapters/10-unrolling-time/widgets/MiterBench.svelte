<!--
  The miter bench: is a carry-lookahead adder equal to a ripple-carry adder? Random testing tries a million input
  pairs; the miter (both circuits on the same inputs, their outputs XORed, the XORs ORed) goes to the SAT solver,
  which either finds inputs where they differ or proves, with a checked proof, that none exist. A planted bug in
  the lookahead logic shows the difference between "a million tests passed" and "for all inputs".
-->
<script lang="ts">
  import { lookaheadAdder, rippleAdder, miter, lookaheadNumeric, bugProbability } from './adders';
  import { tseitin, type Formula } from '$lib/fv/sat/encode';
  import { Solver } from '$lib/fv/sat/solver';
  import { checkDrat } from '$lib/fv/sat/check/drat';
  import { rng } from '$lib/fv/util/random';
  import { progress } from '$lib/state/progress.svelte';

  let { id, caption }: { id?: string; caption?: string } = $props();

  let width = $state(32);
  let bug = $state(true);
  let testing = $state(false);
  let tested = $state(0);
  let mismatches = $state(0);
  let testMs = $state(0);
  let solving = $state(false);
  let result = $state<
    | { kind: 'unsat'; vars: number; clauses: number; ms: number; proof: boolean; proofMs: number }
    | { kind: 'sat'; vars: number; clauses: number; ms: number; a: bigint; b: bigint; good: bigint; bad: bigint }
    | undefined
  >();
  const N = 1_000_000;

  function reset() {
    tested = 0;
    mismatches = 0;
    result = undefined;
  }

  function test() {
    if (testing) return;
    testing = true;
    tested = 0;
    mismatches = 0;
    const r = rng(1994 + width);
    const w = width;
    const t0 = performance.now();
    const chunk = () => {
      const end = Math.min(N, tested + 25_000);
      let m = mismatches;
      for (let t = tested; t < end; t++) {
        const a: boolean[] = new Array(w);
        const b: boolean[] = new Array(w);
        for (let i = 0; i < w; i++) {
          a[i] = r.next() < 0.5;
          b[i] = r.next() < 0.5;
        }
        // Reference: ripple-carry addition on booleans.
        let c = false;
        const ref: boolean[] = [];
        for (let i = 0; i < w; i++) {
          ref.push(a[i] !== b[i] !== c);
          c = (a[i]! && b[i]!) || (a[i]! && c) || (b[i]! && c);
        }
        ref.push(c);
        const got = lookaheadNumeric(w, a, b, bug);
        if (got.some((x, i) => x !== ref[i])) m++;
      }
      tested = end;
      mismatches = m;
      testMs = performance.now() - t0;
      if (tested < N) setTimeout(chunk, 0);
      else testing = false;
    };
    setTimeout(chunk, 10);
  }

  function solve() {
    if (solving) return;
    solving = true;
    result = undefined;
    setTimeout(() => {
      const w = width;
      const vars = (from: number): Formula[] => Array.from({ length: w }, (_, i) => ({ k: 'var', v: from + i }));
      const inp = { a: vars(1), b: vars(w + 1) };
      const t0 = performance.now();
      const cnf = tseitin(miter(rippleAdder(inp), lookaheadAdder(inp, bug)), 2 * w + 1);
      const s = new Solver({ proof: true });
      s.ensureVars(cnf.nvars);
      for (const c of cnf.clauses) s.addClause(c);
      const r = s.solve();
      const ms = performance.now() - t0;
      if (r === 'sat') {
        const val = (from: number) => Array.from({ length: w }, (_, i) => (s.model[from + i] ? 1n << BigInt(i) : 0n)).reduce((x, y) => x + y, 0n);
        const a = val(1);
        const b = val(w + 1);
        const bits = (n: bigint) => Array.from({ length: w }, (_, i) => ((n >> BigInt(i)) & 1n) === 1n);
        const out = lookaheadNumeric(w, bits(a), bits(b), bug).reduce((n, x, i) => (x ? n | (1n << BigInt(i)) : n), 0n);
        result = { kind: 'sat', vars: cnf.nvars, clauses: cnf.clauses.length, ms, a, b, good: a + b, bad: out };
        if (id && bug && w >= 32) progress.markSolved(id);
      } else {
        const p0 = performance.now();
        const ok = checkDrat(cnf.clauses, s.proof).ok;
        result = { kind: 'unsat', vars: cnf.nvars, clauses: cnf.clauses.length, ms, proof: ok, proofMs: performance.now() - p0 };
      }
      solving = false;
    }, 20);
  }

  const hex = (n: bigint, w: number) => `0x${n.toString(16).padStart(Math.ceil(w / 4), '0')}`;
  const bin = (n: bigint, w: number) => n.toString(2).padStart(w, '0').replace(/(.{4})(?=.)/g, '$1 ');
  const p = $derived(bugProbability(width));
  const fmtP = (x: number) => (x >= 0.01 ? `${(x * 100).toFixed(1)} %` : `1 in ${Math.round(1 / x).toLocaleString('en-GB')}`);
</script>

<figure class="miter">
  <div class="bar ui">
    <label>Width <select bind:value={width} onchange={reset}>{#each [8, 16, 32, 64] as w (w)}<option value={w}>{w} bits</option>{/each}</select></label>
    <label class="chk"><input type="checkbox" bind:checked={bug} onchange={reset} /> plant the bug in the lookahead adder</label>
  </div>
  <div class="cols">
    <section>
      <h4 class="ui">Random testing</h4>
      <p class="ui small">Add {N.toLocaleString('en-GB')} random pairs with both adders and compare.</p>
      <button type="button" class="go ui" onclick={test} disabled={testing}>{testing ? `Testing… ${Math.round((tested / N) * 100)} %` : 'Run a million tests'}</button>
      {#if tested}
        <p class="ui out" class:bad={mismatches > 0}>{tested.toLocaleString('en-GB')} pairs, {mismatches.toLocaleString('en-GB')} mismatch{mismatches === 1 ? '' : 'es'}, {(testMs / 1000).toFixed(1)} s.</p>
      {/if}
      {#if bug}<p class="ui small">The bug shows only when block 0 makes a carry and every block above it passes the carry on: about {fmtP(p)} of random pairs at {width} bits.</p>{/if}
    </section>
    <section>
      <h4 class="ui">The miter</h4>
      <p class="ui small">Both circuits on the same {2 * width} input bits; the outputs XORed and ORed: satisfiable exactly when they differ.</p>
      <button type="button" class="go ui" onclick={solve} disabled={solving}>{solving ? 'Solving…' : 'Solve the miter'}</button>
      {#if result?.kind === 'unsat'}
        <p class="ui out good">UNSAT: the adders agree on all 2<sup>{2 * width}</sup> input pairs. {result.vars.toLocaleString('en-GB')} variables, {result.clauses.toLocaleString('en-GB')} clauses, {Math.round(result.ms)} ms; DRAT proof {result.proof ? 'checked' : 'rejected'} in {Math.round(result.proofMs)} ms.</p>
      {:else if result?.kind === 'sat'}
        <p class="ui out bad">SAT in {Math.round(result.ms)} ms ({result.vars.toLocaleString('en-GB')} variables, {result.clauses.toLocaleString('en-GB')} clauses). The adders differ on:</p>
        <table class="cex">
          <tbody>
            <tr><th class="ui">a</th><td>{bin(result.a, width)}</td><td>{hex(result.a, width)}</td></tr>
            <tr><th class="ui">b</th><td>{bin(result.b, width)}</td><td>{hex(result.b, width)}</td></tr>
            <tr><th class="ui">ripple</th><td>{bin(result.good, width + 1)}</td><td>{hex(result.good, width + 1)}</td></tr>
            <tr class="wrong"><th class="ui">lookahead</th><td>{bin(result.bad, width + 1)}</td><td>{hex(result.bad, width + 1)}</td></tr>
          </tbody>
        </table>
      {/if}
    </section>
  </div>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .miter {
    margin: 2rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    font-size: 0.85rem;
    margin-bottom: 0.6rem;
  }
  select {
    font: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--panel);
    color: var(--fg);
  }
  .chk input {
    accent-color: var(--pencil);
  }
  .cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    gap: 0.8rem;
  }
  @media (max-width: 640px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
  section {
    padding: 0.6rem 0.8rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    min-width: 0;
  }
  h4 {
    margin: 0 0 0.3rem;
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.2rem 0 0.5rem;
  }
  .go {
    font: inherit;
    font-family: var(--font-ui);
    font-size: 0.84rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0.28rem 0.8rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--ink-blue);
    background: var(--ink-blue);
    color: var(--on-accent);
  }
  .go:disabled {
    opacity: 0.6;
  }
  .out {
    font-size: 0.84rem;
    margin: 0.5rem 0 0.3rem;
  }
  .out.good {
    color: var(--seal);
  }
  .out.bad {
    color: var(--pencil);
  }
  .cex {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    border-collapse: collapse;
    display: block;
    overflow-x: auto;
  }
  .cex th {
    text-align: right;
    padding-right: 0.5rem;
    font-weight: 600;
    color: var(--ink-2);
  }
  .cex td {
    padding: 0.1rem 0.5rem;
    white-space: nowrap;
  }
  .cex .wrong td {
    color: var(--pencil);
    font-weight: 700;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
