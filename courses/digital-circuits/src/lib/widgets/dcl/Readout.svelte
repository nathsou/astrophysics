<!--
  What the source became: totals, gates per kind of construct, and every construct with its cost. Hovering a
  row (or focusing it) probes it: the host lights its gates and its source.
-->
<script lang="ts">
  import type { Analysis, ConstructInfo } from '$lib/hdl/editor/analysis';
  import { formatCounts } from '$lib/hdl/lower/cost';

  let { analysis, source, onprobe, onreveal }: {
    analysis: Analysis;
    source: string;
    /** The construct under the pointer, or null. */
    onprobe?: (c: ConstructInfo | null) => void;
    onreveal?: (offset: number) => void;
  } = $props();

  const KIND: Record<string, string> = {
    add: 'adders', sub: 'subtractors', neg: 'negations', mul: 'multipliers', and: 'AND', or: 'OR', xor: 'XOR', not: 'NOT',
    shl: 'left shifters', shr: 'right shifters', eq: 'equality tests', ne: 'inequality tests', lt: 'comparators', le: 'comparators',
    gt: 'comparators', ge: 'comparators', mux: 'if / else', pmux: 'match', reduce_and: 'all-ones', reduce_or: 'any-one',
    reduce_xor: 'parity', popcount: 'ones counters', reg: 'registers', mem: 'memories',
  };

  const rows = $derived(analysis.constructs.filter((c) => c.module === analysis.top && c.kind !== 'const' && (c.total > 0 || c.reused > 0)));
  const kinds = $derived.by(() => {
    const m = new Map<string, { name: string; n: number; total: number }>();
    for (const c of rows) {
      if (c.total === 0) continue;
      const name = KIND[c.kind] ?? c.kind;
      const e = m.get(name) ?? { name, n: 0, total: 0 };
      e.n++;
      e.total += c.total;
      m.set(name, e);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  });
  const biggest = $derived(Math.max(1, ...kinds.map((k) => k.total)));
  const stats = $derived(analysis.stats);
  const snippet = (c: ConstructInfo) => source.slice(c.from, c.to).replace(/\s+/g, ' ').slice(0, 44);
</script>

<div class="readout ui">
  {#if stats}
    <p class="totals">
      <span><b>{stats.gates}</b> gates</span>
      <span><b>{stats.flipFlops}</b> flip-flops</span>
      {#if stats.memories}<span><b>{stats.memories}</b> RAM</span>{/if}
      <span><b>{stats.depth}</b> gate delays deep</span>
    </p>
  {/if}
  {#if kinds.length}
    <ul class="kinds" aria-label="Elements by construct">
      {#each kinds as k (k.name)}
        <li>
          <span class="kname">{k.name}{#if k.n > 1}<small> × {k.n}</small>{/if}</span>
          <span class="bar" style:--w="{(100 * k.total) / biggest}%"></span>
          <span class="knum">{k.total}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if rows.length}
    <table>
      <thead><tr><th>Line</th><th>Source</th><th>Becomes</th></tr></thead>
      <tbody>
        {#each rows as c, i (i)}
          <tr
            tabindex="0"
            onpointerenter={() => onprobe?.(c)}
            onpointerleave={() => onprobe?.(null)}
            onfocus={() => onprobe?.(c)}
            onblur={() => onprobe?.(null)}
            onclick={() => onreveal?.(c.from)}
            onkeydown={(ev) => ev.key === 'Enter' && onreveal?.(c.from)}
          >
            <td class="ln">{c.line}</td>
            <td class="src"><code>{snippet(c)}</code></td>
            <td class="cost"><span class="title">{c.title}</span><span class="counts">{c.total ? formatCounts(c.counts) : `reuses ${c.reused} shared`}</span></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="empty">Nothing to show yet: the source has no hardware.</p>
  {/if}
</div>

<style>
  .readout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.8rem;
    font-size: 0.82rem;
    min-width: 0;
  }
  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.1rem;
    margin: 0;
    color: var(--ink-2);
  }
  .totals b {
    font-family: var(--font-mono);
    color: var(--fg);
    font-size: 0.95rem;
  }
  .kinds {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }
  .kinds li {
    display: grid;
    grid-template-columns: minmax(6rem, 9rem) 1fr 2.4rem;
    align-items: center;
    gap: 0.6rem;
  }
  .kname {
    color: var(--ink-2);
  }
  .kname small {
    color: var(--mute);
  }
  .bar {
    height: 0.6rem;
    border-radius: 3px;
    background: linear-gradient(90deg, var(--copper) var(--w), transparent var(--w));
    border: 1px solid var(--line);
  }
  .knum {
    text-align: right;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.78rem;
  }
  th {
    text-align: left;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
    padding: 0 0.5rem 0.3rem 0;
    border-bottom: 1px solid var(--line);
  }
  td {
    padding: 0.3rem 0.5rem 0.3rem 0;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  tr {
    cursor: pointer;
  }
  tbody tr:hover,
  tbody tr:focus-visible {
    background: var(--copper-soft);
    outline: none;
  }
  .ln {
    font-family: var(--font-mono);
    color: var(--mute);
    width: 2rem;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    overflow-wrap: anywhere;
  }
  .cost {
    display: grid;
    gap: 0.1rem;
  }
  .title {
    color: var(--fg);
  }
  .counts {
    color: var(--copper-ink);
  }
  .empty {
    color: var(--mute);
    margin: 0;
  }
</style>
