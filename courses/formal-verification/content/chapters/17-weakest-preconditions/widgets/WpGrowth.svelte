<!--
  Formula growth: n branches in sequence, each updating x differently. The textbook wp copies the postcondition
  into both branches of every if, so its formula doubles with each branch. The course's generator works forwards
  and merges the branches at each join, so its formula grows by a constant per branch. Sizes are distinct
  subformulas, measured on the formulas the two methods actually build.
-->
<script lang="ts">
  import { computeWp, formulaSize, fromVouch } from '$lib/fv/wp/wp';
  import { parse } from '$lib/fv/vouch/syntax/parser';
  import { check } from '$lib/fv/vouch/check/checker';
  import { generate } from '$lib/fv/vouch/vc/gen';
  import { and } from '$lib/fv/logic/term';

  let { max = 12, caption }: { max?: number; caption?: string } = $props();

  const prog = (n: number) => `fn f(x0: int) -> int
  ensures result != 7
{
  var x = x0
${Array.from({ length: n }, () => '  if x > 10 { x = 2 * x } else { x = x + 3 }').join('\n')}
  return x
}`;
  // svelte-ignore state_referenced_locally
  const rows = Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const src = prog(n);
    const wp = formulaSize(computeWp(fromVouch(src)).wp).dag;
    const p = parse(src);
    const c = check(p.program);
    const vcs = generate(c, c.fns.get('f')!);
    const fwd = Math.max(...vcs.obligations.map((o) => formulaSize(and(...o.hyps, o.goal)).dag));
    return { n, wp, fwd };
  });
  const top = Math.max(...rows.map((r) => Math.max(r.wp, r.fwd)));
  const w = (x: number) => `${Math.max(1, (100 * Math.log(x)) / Math.log(top))}%`;
</script>

<figure class="growth">
  <table class="ui">
    <thead><tr><th>branches</th><th>wp, backwards (copies the postcondition)</th><th>forwards, merging at joins</th></tr></thead>
    <tbody>
      {#each rows as r (r.n)}
        <tr>
          <td class="n">{r.n}</td>
          <td><span class="bar wp" style="width: {w(r.wp)}"></span><span class="v">{r.wp.toLocaleString('en-GB')}</span></td>
          <td><span class="bar fw" style="width: {w(r.fwd)}"></span><span class="v">{r.fwd.toLocaleString('en-GB')}</span></td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .growth {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin: 0;
  }
  th {
    text-align: left;
    font-weight: 600;
    color: var(--ink-2);
    padding: 0.2rem 0.4rem;
  }
  td {
    padding: 0.12rem 0.4rem;
    white-space: nowrap;
  }
  td.n {
    text-align: right;
    width: 3rem;
  }
  .bar {
    display: inline-block;
    height: 0.6rem;
    border-radius: 2px;
    vertical-align: middle;
    max-width: 70%;
  }
  .bar.wp {
    background: var(--pencil);
  }
  .bar.fw {
    background: var(--seal);
  }
  .v {
    margin-left: 0.4rem;
    font-variant-numeric: tabular-nums;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
