<!--
  Measured: every attention head of CourseGPT scored as a previous-token head and as an induction head (on random
  tokens repeated twice), the attention pattern of the strongest of each on a repeated sentence, and the loss on
  the repeated random sequence. Recomputes the induction score of the shown pattern with the learner's
  inductionScore().
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { DATA, show } from '../data';

  function reference(attn: number[][], L: number): number {
    let t = 0;
    for (let i = L + 1; i <= 2 * L; i++) t += attn[i]![i - L + 1]!;
    return t / L;
  }
  const score = $derived(impl.get('interp.induction', reference));
  const mine = $derived(impl.isMine('interp.induction'));

  const H = DATA.heads;
  let kind = $state<'induction' | 'previous'>('induction');
  let view = $state<'scores' | 'loss'>('scores');
  const grid = $derived(H ? H[kind] : []);
  const ex = $derived(H?.example[kind]);
  const L = $derived(H ? (H.example.tokens.length - 1) / 2 : 0);
  const exScore = $derived.by(() => {
    if (!ex) return 0;
    try {
      return score(ex.attn, L);
    } catch {
      return reference(ex.attn, L);
    }
  });
</script>

<Widget
  title="Previous-token and induction heads"
  subtitle="Each of CourseGPT’s 64 heads (8 layers × 8), scored on 32 passages of 128 tokens of validation text, each repeated twice. A previous-token head attends to the position just before; an induction head attends to the token that followed the current token’s earlier occurrence."
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="Score" size="sm" options={[{ value: 'induction', label: 'Induction' }, { value: 'previous', label: 'Previous token' }]} bind:value={kind} />
    <Segmented label="Show" size="sm" options={[{ value: 'scores', label: 'Heads' }, { value: 'loss', label: 'Loss on a repeat' }]} bind:value={view} />
  {/snippet}

  {#if mine}<p class="mine ui">Using your inductionScore().</p>{/if}
  {#if !H}
    <p class="muted">Run <code>uv run lmc ch26 heads</code> and <code>uv run lmc ch26 summary</code>.</p>
  {:else if view === 'scores'}
    <div class="two">
      <table class="grid ui" aria-label="Scores per head">
        <thead><tr><th></th>{#each grid[0] ?? [] as _, h (h)}<th>h{h}</th>{/each}</tr></thead>
        <tbody>
          {#each grid as row, l (l)}
            <tr><th>layer {l}</th>{#each row as v, h (h)}<td class:best={ex && ex.layer === l && ex.head === h} style:background="color-mix(in srgb, var(--series-{kind === 'induction' ? 2 : 4}) {Math.round(v * 100)}%, var(--surface))">{v.toFixed(2)}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
      {#if ex}
        <div class="pattern">
          <p class="cap ui">Layer {ex.layer}, head {ex.head} on a sentence said twice (rows attend to columns){kind === 'induction' ? ` — induction score ${exScore.toFixed(2)}` : ''}:</p>
          <svg viewBox="0 0 {ex.attn.length} {ex.attn.length}" class="attn" preserveAspectRatio="none" aria-hidden="true">
            {#each ex.attn as row, i (i)}
              {#each row as v, j (j)}{#if v > 0.02}<rect x={j} y={i} width="1" height="1" fill="var(--series-{kind === 'induction' ? 2 : 4})" opacity={Math.min(1, v * 1.3)} />{/if}{/each}
            {/each}
          </svg>
          <p class="toks ui">{H.example.tokens.map(show).join(' ')}</p>
        </div>
      {/if}
    </div>
  {:else}
    <Plot label="Loss per position on a repeated random sequence" height={220} x={{ domain: [1, H.loss.length], label: 'position', ticks: 6 }} y={{ domain: [0, Math.max(...H.loss) * 1.05], label: 'bits', ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        <line x1={sx(H.T + 0.5)} x2={sx(H.T + 0.5)} y1={sy(0)} y2={sy(Math.max(...H.loss))} stroke="var(--ink-3)" stroke-dasharray="3 3" />
        <path class="line" stroke="var(--series-1)" stroke-width="1.5" d={'M' + H.loss.map((v, i) => `${sx(i + 1)},${sy(v)}`).join('L')} />
      {/snippet}
    </Plot>
    {@const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length}
    <p class="note ui">
      128 tokens of a story, then the same 128 again (after the dashed line). A model that copied would predict the second copy almost perfectly; CourseGPT’s loss falls only from {mean(H.loss.slice(0, H.T)).toFixed(2)} to {mean(H.loss.slice(H.T)).toFixed(2)} bits per token.
      {#if H.random}On random tokens repeated twice: {mean(H.random.loss.slice(0, H.T)).toFixed(1)} → {mean(H.random.loss.slice(H.T)).toFixed(1)} bits.{/if}
    </p>
  {/if}
</Widget>

<style>
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .two {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: flex-start;
  }
  .grid {
    border-collapse: separate;
    border-spacing: 2px;
    font-size: 0.66rem;
  }
  .grid th {
    font-weight: 500;
    color: var(--ink-3);
    padding: 0 0.3rem;
    white-space: nowrap;
  }
  .grid td {
    width: 2.3rem;
    height: 1.4rem;
    text-align: center;
    border-radius: 3px;
    color: var(--ink);
  }
  .grid td.best {
    outline: 1.5px solid var(--ink);
  }
  .pattern {
    flex: 1 1 14rem;
    min-width: 12rem;
  }
  .cap {
    font-size: 0.75rem;
    color: var(--ink-2);
    margin: 0 0 0.3rem;
  }
  .attn {
    width: 100%;
    max-width: 260px;
    aspect-ratio: 1;
    border: 1px solid var(--rule);
    background: var(--surface);
  }
  .toks {
    font-size: 0.68rem;
    color: var(--ink-3);
    margin: 0.3rem 0 0;
    font-family: var(--font-mono);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
