<!--
  Counterexamples as a table: the inputs that went wrong, what was expected and what the design gave. A cell that
  differs carries a mark as well as a colour. Used by the hdl, fit, decode and route exercises.
-->
<script lang="ts">
  interface Row {
    /** A step, cycle or phase label, when the rows are a sequence. */
    step?: string;
    inputs: Record<string, string>;
    expected: Record<string, string>;
    got: Record<string, string>;
    differ: string[];
  }
  let { rows, caption = 'The first things that went wrong' }: { rows: Row[]; caption?: string } = $props();
  const inputs = $derived(Object.keys(rows[0]?.inputs ?? {}));
  const outputs = $derived(Object.keys(rows[0]?.expected ?? {}));
  const hasStep = $derived(rows.some((r) => r.step));
</script>

<div class="wrap">
  <p class="cap">{caption}</p>
  <table class="mm num" aria-label={caption}>
    <thead>
      <tr>
        {#if hasStep}<th rowspan="2" scope="col">when</th>{/if}
        {#if inputs.length}<th colspan={inputs.length} scope="colgroup" class="grp">inputs</th>{/if}
        <th colspan={outputs.length} scope="colgroup" class="grp">expected</th>
        <th colspan={outputs.length} scope="colgroup" class="grp">got</th>
      </tr>
      <tr>
        {#each inputs as n (n)}<th scope="col">{n}</th>{/each}
        {#each outputs as n (`e${n}`)}<th scope="col">{n}</th>{/each}
        {#each outputs as n (`g${n}`)}<th scope="col">{n}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr>
          {#if hasStep}<th scope="row" class="step">{r.step ?? ''}</th>{/if}
          {#each inputs as n (n)}<td>{r.inputs[n]}</td>{/each}
          {#each outputs as n (`e${n}`)}<td>{r.expected[n]}</td>{/each}
          {#each outputs as n (`g${n}`)}
            <td class:bad={r.differ.includes(n)}>{r.got[n]}{#if r.differ.includes(n)}<span class="mark" aria-label="differs"> ≠</span>{/if}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap {
    overflow-x: auto;
    max-width: 100%;
  }
  .mm {
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    margin: 0.3rem 0;
  }
  .cap {
    margin: 0.3rem 0 0;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--ink-3);
  }
  th,
  td {
    border: 1px solid var(--line);
    padding: 0.12rem 0.5rem;
    text-align: center;
    white-space: nowrap;
  }
  thead th {
    background: var(--surface-2);
    color: var(--ink-2);
    font-weight: 600;
  }
  th.grp {
    color: var(--ink-3);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  th.step {
    text-align: left;
    font-family: var(--font-ui);
    font-weight: 500;
    color: var(--ink-2);
    background: transparent;
  }
  td.bad {
    background: var(--bad-soft);
    color: var(--bad);
    font-weight: 800;
  }
</style>
