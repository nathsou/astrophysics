<!--
  Inside the trained attention-only model: every head's attention pattern on a passage of
  validation text, as a matrix and as highlighted text, with a summary of what each head does.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';
  import { attnLm, LM } from '../lmTrainer.svelte';

  const T = LM.T, H = LM.heads;
  let layer = $state(0);
  let head = $state(0);
  let query = $state(T - 1);
  const maps = $derived(attnLm.maps);
  const L = $derived(maps?.layers ?? 1);
  const matrix = $derived(maps ? maps.probs[Math.min(layer, L - 1)]!.subarray(head * T * T, (head + 1) * T * T) : null);
  const show = (c: string) => (c === '\n' ? '↵' : c === ' ' ? '·' : c);

  /** For each head: average attention to itself, to the previous token, and mean distance looked back. */
  const summary = $derived.by(() => {
    if (!maps) return [];
    const rows: { layer: number; head: number; self: number; prev: number; dist: number }[] = [];
    for (let l = 0; l < maps.layers; l++) {
      for (let h = 0; h < H; h++) {
        const m = maps.probs[l]!;
        let self = 0, prev = 0, dist = 0;
        for (let i = 1; i < T; i++) {
          const row = (h * T + i) * T;
          self += m[row + i]! / (T - 1);
          prev += m[row + i - 1]! / (T - 1);
          for (let j = 0; j <= i; j++) dist += (m[row + j]! * (i - j)) / (T - 1);
        }
        rows.push({ layer: l, head: h, self, prev, dist });
      }
    }
    return rows;
  });
</script>

<Widget
  title="What the heads look at"
  subtitle="Each head’s attention weights on {T} characters of validation text, from the model above (updated every 500 steps). Row = query position, column = key position; the upper triangle is masked. Click a row to see it as text."
>
  {#snippet controls()}
    {#if L > 1}<Segmented label="Layer" size="sm" options={Array.from({ length: L }, (_, l) => ({ value: l, label: `layer ${l + 1}` }))} bind:value={layer} />{/if}
    <Segmented label="Head" size="sm" options={Array.from({ length: H }, (_, h) => ({ value: h, label: `head ${h + 1}` }))} bind:value={head} />
  {/snippet}

  {#if !maps || !matrix}
    <p class="muted">Train the model above; the maps appear after its first evaluation (step 500).</p>
  {:else}
    <div class="layout">
      <Heatmap
        values={matrix}
        rows={T}
        cols={T}
        range={[0, 1]}
        maxWidth={380}
        showScale={false}
        label="Attention weights of layer {layer + 1}, head {head + 1}"
        highlight={{ row: query, col: query }}
        onclick={(c) => (query = c.row)}
        format={(v) => v.toFixed(3)}
      >
        {#snippet tooltip({ row, col, value })}
          <div class="num">query {row} “{show(maps!.text[row]!)}” → key {col} “{show(maps!.text[col]!)}”: {value.toFixed(3)}</div>
        {/snippet}
      </Heatmap>
      <div class="side ui">
        <p class="qline">Query position {query}: “<strong>{show(maps.text[query]!)}</strong>”, predicting “{show(maps.text[query + 1]!)}”</p>
        <div class="text" aria-label="Attention from the query position, shown on the text">
          {#each Array.from(maps.text.slice(0, T)) as ch, j (j)}{#if j <= query}<span class:q={j === query} style:background="color-mix(in srgb, var(--series-2) {Math.round(Math.min(1, matrix[query * T + j]! * 1.5) * 90)}%, transparent)">{show(ch)}</span>{:else}<span class="future">{show(ch)}</span>{/if}{/each}
        </div>
        <table class="summary num">
          <thead><tr><th>head</th><th>to itself</th><th>to previous</th><th>mean look-back</th></tr></thead>
          <tbody>
            {#each summary as s (s.layer * 10 + s.head)}
              <tr class:cur={s.layer === layer && s.head === head}>
                <td>L{s.layer + 1} H{s.head + 1}</td><td>{(s.self * 100).toFixed(0)}%</td><td>{(s.prev * 100).toFixed(0)}%</td><td>{s.dist.toFixed(1)} chars</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="note">Weights from step {maps.step.toLocaleString('en-GB')}.</p>
      </div>
    </div>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .qline {
    font-size: 0.8rem;
    margin: 0 0 0.4rem;
  }
  .text {
    font: 0.8rem/1.6 var(--font-mono);
    background: var(--surface-2);
    padding: 0.5rem 0.7rem;
    border-radius: 6px;
    word-break: break-all;
  }
  .text .q {
    outline: 2px solid var(--ink);
  }
  .text .future {
    color: var(--ink-3);
    opacity: 0.5;
  }
  .summary {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.76rem;
    margin-top: 0.8rem;
  }
  .summary th {
    text-align: left;
    color: var(--ink-2);
    font-weight: 600;
  }
  .summary td {
    border-top: 1px solid var(--rule);
    padding: 0.1rem 0.3rem;
  }
  .summary tr.cur td {
    background: var(--surface-2);
    font-weight: 700;
  }
  .note {
    font-size: 0.74rem;
    color: var(--ink-3);
  }
</style>
