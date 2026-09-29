<!--
  The laws of Boolean algebra as a reference table, every equation checked by the page against its own truth
  table when it loads, plus a checker for your own claims: type two expressions and see whether they are equal,
  and if not, a row where they differ.

    ::laws-table{}
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { ParseError, equivalent, evaluate, parse, truthTable, type Equivalence } from './boolexpr';
  import { LAW_GROUPS, equations, holds } from './laws';

  let { n }: { n?: string | number } = $props();

  const all = equations();
  const verified = all.filter(holds).length;

  let left = $state('¬(A · B)');
  let right = $state('¬A · ¬B');
  const result = $derived.by((): { ok: true; eq: Equivalence; table: ReturnType<typeof truthTable>; l: ReturnType<typeof parse>; r: ReturnType<typeof parse> } | { ok: false; message: string } => {
    try {
      const l = parse(left);
      const r = parse(right);
      const eq = equivalent(l, r);
      return { ok: true, eq, table: truthTable(`(${left}) ⊕ (${right})`), l, r };
    } catch (e) {
      if (e instanceof ParseError) return { ok: false, message: e.message };
      throw e;
    }
  });
  const bit = (b: boolean) => (b ? '1' : '0');
</script>

<Widget title="Laws of Boolean algebra" {n} kind="Reference" live={false} caption="Every law is written as an equation and its dual (swap · and +, and 0 and 1). The page checks each one against a truth table when it loads. Try your own below: is ¬(A · B) equal to ¬A · ¬B?">
  <div class="lt">
    <p class="ap-note ok" role="status">{verified} of {all.length} equations checked on every row of their truth tables: all hold.</p>
    {#each LAW_GROUPS as g (g.title)}
      <section>
        <h5>{g.title}</h5>
        <table>
          <thead><tr><th>Law</th><th>Equation</th><th>Dual</th></tr></thead>
          <tbody>
            {#each g.laws as l (l.name + l.lhs)}
              <tr>
                <th scope="row">{l.name}{#if l.note}<span class="note">{l.note}</span>{/if}</th>
                <td><code>{l.lhs} = {l.rhs}</code></td>
                <td>{#if l.dual}<code>{l.dual.lhs} = {l.dual.rhs}</code>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/each}

    <section class="own">
      <h5>Check your own</h5>
      <p class="ap-note">Capital letters are variables, 0 and 1 are constants. Write NOT as ¬ or ', AND as · or by writing terms side by side, OR as +, XOR as ⊕ (or ^). Binding, tightest first: NOT, AND, XOR, OR.</p>
      <div class="pair">
        <label class="ap-label"><span>Left side</span><input class="ap-input" bind:value={left} spellcheck="false" autocomplete="off" aria-invalid={!result.ok} /></label>
        <span class="eq" aria-hidden="true">=?</span>
        <label class="ap-label"><span>Right side</span><input class="ap-input" bind:value={right} spellcheck="false" autocomplete="off" aria-invalid={!result.ok} /></label>
      </div>
      <div aria-live="polite">
        {#if !result.ok}
          <p class="ap-bad">{result.message}</p>
        {:else if result.eq.equal}
          <p class="ap-ok verdict">Equal on all {result.eq.rows} rows of the truth table over {result.eq.vars.join(', ') || 'no variables'}.</p>
        {:else}
          {@const c = result.eq.counterexample!}
          <p class="ap-bad verdict">
            Not equal. For {result.eq.vars.map((v) => `${v} = ${bit(c.env[v]!)}`).join(', ')} the left side is {bit(c.left)} and the right side is {bit(c.right)}.
          </p>
        {/if}
        {#if result.ok && result.eq.vars.length > 0}
          <div class="tt">
            <table>
              <thead><tr>{#each result.eq.vars as v (v)}<th>{v}</th>{/each}<th class="sepc">left</th><th>right</th><th>equal?</th></tr></thead>
              <tbody>
                {#each result.table.rows as row (JSON.stringify(row.env))}
                  {@const a = evaluate(result.l, row.env)}
                  {@const b = evaluate(result.r, row.env)}
                  <tr class:diff={a !== b}>
                    {#each result.eq.vars as v (v)}<td>{bit(row.env[v] ?? false)}</td>{/each}
                    <td class="sepc">{bit(a)}</td><td>{bit(b)}</td><td>{a === b ? '✓' : '✗'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>
  </div>
</Widget>

<style>
  .lt {
    display: grid;
    gap: 1rem;
    padding: 0.9rem 1.1rem 1.2rem;
  }
  .ok {
    color: var(--ok);
  }
  h5 {
    margin: 0.4rem 0 0.4rem !important;
    padding: 0 !important;
    border: 0 !important;
    font-family: var(--font-display) !important;
    font-size: 0.95rem !important;
    color: var(--fg);
  }
  h5::before,
  h5::after {
    display: none !important;
  }
  section > table,
  .tt {
    overflow-x: auto;
  }
  section {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-family: var(--font-ui);
    font-size: 0.86rem;
  }
  th,
  td {
    text-align: left;
    vertical-align: top;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--line);
  }
  thead th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
  }
  table {
    table-layout: fixed;
    min-width: 44rem;
  }
  th:first-child {
    width: 27%;
  }
  tbody th {
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: 0.86rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--fg);
  }
  .note {
    display: block;
    font-weight: 400;
    font-size: 0.76rem;
    color: var(--mute);
    margin-top: 0.15rem;
    line-height: 1.4;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.84rem;
    overflow-wrap: anywhere;
    background: none !important;
    border: 0 !important;
    padding: 0 !important;
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
    align-items: end;
    margin: 0.5rem 0;
  }
  .pair .ap-label {
    flex: 1 1 12rem;
  }
  .eq {
    font-family: var(--font-mono);
    font-size: 1rem;
    color: var(--mute);
    padding-bottom: 0.4rem;
  }
  .verdict {
    font-family: var(--font-ui);
    font-weight: 600;
    margin: 0.4rem 0 !important;
  }
  .tt table {
    table-layout: auto;
    min-width: 0;
    width: auto;
    font-family: var(--font-mono);
  }
  .tt td,
  .tt th {
    text-align: center;
    padding: 0.2rem 0.7rem;
  }
  .sepc {
    border-left: 2px solid var(--line-strong);
  }
  tr.diff td {
    background: var(--bad-soft);
  }
</style>
