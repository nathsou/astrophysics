<!--
  Why a low-rank update is enough: the singular values of the weight change made by full fine-tuning, as
  cumulative energy, with LoRA's ranks marked; and LoRA's parameter count against the full matrix's.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const S = DATA.spectrum;
  const names = Object.keys(S ?? {});
  let rank = $state(8);
  let n = $state(512);
  let m = $state(2048);
  const colour = (i: number) => `var(--series-${i + 1})`;
</script>

<Widget
  title="How low-rank is fine-tuning?"
  subtitle="Left: for four of CourseGPT’s matrices, the share of the full fine-tune’s weight change ΔW (its squared Frobenius norm) captured by its top r singular directions. Right: what a rank-r update costs."
  kind="Measured"
>
  <div class="two">
    <div>
      {#if !S}
        <p class="muted">Run <code>uv run lmc ch20 spectrum</code> and <code>summary</code>.</p>
      {:else}
        <Legend items={names.map((k, i) => ({ label: k, color: colour(i) }))} />
        <Plot label="Cumulative energy of the weight change" height={230} x={{ type: 'log', domain: [1, 64], label: 'rank r', tickValues: [1, 2, 4, 8, 16, 32, 64] }} y={{ domain: [0, 1], label: 'share of ‖ΔW‖² captured', format: (v) => `${(v * 100).toFixed(0)}%`, ticks: 5 }}>
          {#snippet marks({ sx, sy })}
            {#each [1, 4, 16] as r (r)}<line x1={sx(r)} x2={sx(r)} y1={0} y2={sy(0)} stroke="var(--ink-3)" stroke-dasharray="3 3" />{/each}
            {#each names as k, i (k)}
              <path class="line" stroke={colour(i)} d={'M' + S[k]!.energy.map((e, j) => `${sx(j + 1)},${sy(e)}`).join('L')} />
            {/each}
          {/snippet}
        </Plot>
      {/if}
    </div>
    <div class="calc">
      <Slider label="Rows (inputs)" min={64} max={8192} step={64} value={n} oninput={(v) => (n = Math.round(v))} format={(v) => String(Math.round(v))} />
      <Slider label="Columns (outputs)" min={64} max={8192} step={64} value={m} oninput={(v) => (m = Math.round(v))} format={(v) => String(Math.round(v))} />
      <Slider label="Rank r" min={1} max={128} step={1} value={rank} oninput={(v) => (rank = Math.round(v))} format={(v) => String(Math.round(v))} />
      <div class="out ui">
        <div><span>full update</span><strong class="num">{(n * m).toLocaleString('en-GB')}</strong></div>
        <div><span>LoRA: A ({n} × {rank}) + B ({rank} × {m})</span><strong class="num">{(rank * (n + m)).toLocaleString('en-GB')}</strong></div>
        <div><span>fraction</span><strong class="num">{((100 * rank * (n + m)) / (n * m)).toFixed(2)}%</strong></div>
      </div>
    </div>
  </div>
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .calc {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .out > div {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .out strong {
    color: var(--ink);
  }
</style>
