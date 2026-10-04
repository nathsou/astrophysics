<!--
  Naive CNF against Tseitin's encoding, for (x1 ∧ y1) ∨ (x2 ∧ y2) ∨ … ∨ (xn ∧ yn). Distributing "or" over "and"
  gives 2^n clauses; Tseitin's transformation gives about 3n. Both counts are computed, not quoted.
-->
<script lang="ts">
  import { fand, forr, fv, naiveCnf, tseitin, type Formula } from '$lib/fv/sat/encode';

  let { caption }: { caption?: string } = $props();
  let n = $state(4);

  const formula = (k: number): Formula => forr(...Array.from({ length: k }, (_, i) => fand(fv(2 * i + 1), fv(2 * i + 2))));
  const rows = $derived(
    Array.from({ length: 16 }, (_, i) => {
      const k = i + 1;
      const f = formula(k);
      const naive = k <= 14 ? naiveCnf(f).length : 2 ** k;
      const t = tseitin(f);
      return { k, naive, tseitin: t.clauses.length, vars: t.nvars };
    }),
  );
  const cur = $derived(rows[n - 1]!);
  const max = Math.log2(2 ** 16);
  const bar = (x: number) => `${(Math.log2(Math.max(1, x)) / max) * 100}%`;
</script>

<figure class="blow">
  <p class="f"><code>{Array.from({ length: Math.min(n, 4) }, (_, i) => `(x${i + 1} ∧ y${i + 1})`).join(' ∨ ')}{n > 4 ? ` ∨ … ∨ (x${n} ∧ y${n})` : ''}</code></p>
  <label class="ui">n = <b>{n}</b> <input type="range" min="1" max="16" bind:value={n} /></label>
  <div class="bars ui">
    <div class="row"><span class="lbl">Distributing (naive CNF)</span><span class="track"><span class="fill naive" style:width={bar(cur.naive)}></span></span><b>{cur.naive.toLocaleString('en-GB')} clauses</b></div>
    <div class="row"><span class="lbl">Tseitin</span><span class="track"><span class="fill ts" style:width={bar(cur.tseitin)}></span></span><b>{cur.tseitin.toLocaleString('en-GB')} clauses, {cur.vars} variables</b></div>
  </div>
  <p class="note ui">Bars on a logarithmic scale. Each extra pair doubles the naive encoding and adds three or four clauses to Tseitin's.</p>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
</figure>

<style>
  .blow {
    margin: 1.8rem 0;
    padding: 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--pn);
  }
  .f {
    margin: 0 0 0.5rem;
    overflow-x: auto;
  }
  label {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    font-size: 0.9rem;
  }
  input {
    flex: 1;
    accent-color: var(--ink-blue);
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.6rem;
    font-size: 0.82rem;
  }
  .row {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr) 14rem;
    gap: 0.6rem;
    align-items: center;
  }
  @media (max-width: 640px) {
    .row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .track {
    height: 0.9rem;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 3px;
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
  }
  .naive {
    background: var(--pencil);
  }
  .ts {
    background: var(--seal);
  }
  .note {
    font-size: 0.75rem;
    color: var(--mute);
    margin: 0.5rem 0 0;
  }
  figcaption {
    margin-top: 0.6rem;
    font-family: var(--font-ui);
    font-size: 0.86rem;
    color: var(--ink-2);
  }
</style>
