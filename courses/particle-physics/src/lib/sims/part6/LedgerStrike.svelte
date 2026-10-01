<!--
  The ledger of conservation laws, updated (Chapters 22 and 24). Rows are laws; columns are the three forces met so far.
  `stage` is 22 (parity and charge conjugation struck through) or 24 (CP as well).

    ::ledger-strike{stage="22" n="22.4" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';

  let { stage = 22, n, caption, title = 'The ledger after the weak force' }: { stage?: number | string; n?: string | number; caption?: string; title?: string } = $props();
  const st = $derived(Number(stage));

  type Cell = 'yes' | 'no' | 'rare';
  interface Row {
    law: string;
    note: string;
    strong: Cell;
    em: Cell;
    weak: Cell;
    /** From which chapter the law is struck through (for the weak column). */
    struck?: number;
    /** The note before the law is struck through. */
    early?: string;
  }
  const ROWS: Row[] = [
    { law: 'Energy and momentum', note: 'never violated', strong: 'yes', em: 'yes', weak: 'yes' },
    { law: 'Electric charge', note: 'never violated', strong: 'yes', em: 'yes', weak: 'yes' },
    { law: 'Colour', note: 'Chapter 18', strong: 'yes', em: 'yes', weak: 'yes' },
    { law: 'Baryon number', note: 'no violation seen; proton-decay limits in Chapter 32', strong: 'yes', em: 'yes', weak: 'yes' },
    { law: 'Lepton numbers L_e, L_μ, L_τ, each separately', note: 'holds so far; Chapter 31 strikes it through', strong: 'yes', em: 'yes', weak: 'yes' },
    { law: 'Strangeness, charm, bottom', note: 'the weak force changes each by one unit', strong: 'yes', em: 'yes', weak: 'no' },
    { law: 'Parity P (mirror reflection)', note: 'Wu and others, 1957', strong: 'yes', em: 'yes', weak: 'no', struck: 22 },
    { law: 'Charge conjugation C (particle ↔ antiparticle)', note: 'Garwin, Lederman and Weinrich, 1957', strong: 'yes', em: 'yes', weak: 'no', struck: 22 },
    { law: 'CP (both together)', note: 'Cronin and Fitch, 1964: violated, but only slightly', early: 'the weak force seems to respect it: Chapter 24 looks again', strong: 'yes', em: 'yes', weak: 'rare', struck: 24 },
    { law: 'CPT (all three, with time reversed)', note: 'holds in every quantum field theory of this kind', strong: 'yes', em: 'yes', weak: 'yes' },
  ];
  const visible = $derived(ROWS.filter((r) => !r.struck || r.struck <= st || r.struck === 24));
  const isStruck = (r: Row) => r.struck !== undefined && r.struck <= st;
  const mark = (c: Cell, struck: boolean) => (c === 'yes' ? '✓' : c === 'rare' ? (struck ? '✗ (slightly)' : '✓ (so far)') : '✗');
</script>

<Widget {title} {n} {caption} kind="Figure" live={false}>
  <table class="ui ledger">
    <thead>
      <tr><th scope="col">Law</th><th scope="col">Strong</th><th scope="col">Electromagnetic</th><th scope="col">Weak</th></tr>
    </thead>
    <tbody>
      {#each visible as r}
        <tr class:struck={isStruck(r)}>
          <th scope="row">
            <span class="law">{r.law}</span>
            <span class="note">{isStruck(r) || !r.early ? r.note : r.early}</span>
            {#if isStruck(r)}<span class="sr">(struck through: the weak force violates this law)</span>{/if}
          </th>
          <td class="c">{mark(r.strong, false)}</td>
          <td class="c">{mark(r.em, false)}</td>
          <td class="c w" class:bad={r.weak === 'no' || (r.weak === 'rare' && isStruck(r))}>{mark(r.weak, isStruck(r))}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</Widget>

<style>
  .ledger {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.86rem;
  }
  th,
  td {
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--line);
    text-transform: none;
    letter-spacing: 0;
    vertical-align: top;
  }
  thead th {
    text-align: center;
    color: var(--ink-2);
    font-weight: 600;
  }
  thead th:first-child {
    text-align: left;
  }
  tbody th {
    text-align: left;
    font-weight: 400;
  }
  .note {
    display: block;
    font-size: 0.75rem;
    color: var(--mute);
  }
  .c {
    text-align: center;
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .struck .law {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
    color: var(--ink-2);
  }
  .bad {
    color: var(--bad);
    font-weight: 600;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
