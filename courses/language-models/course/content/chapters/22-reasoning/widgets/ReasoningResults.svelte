<!--
  Measured: a 4-layer GPT trained from scratch on 6-digit addition. Training curves for the direct and
  scratchpad formats; accuracy of majority voting and pass@k over sampled answers; and GRPO on an
  under-trained direct model, rewarded only for correct answers.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA, LABELS, type ModelKey } from '../data';

  let { view: initial = 'train' }: { view?: 'train' | 'vote' | 'grpo' } = $props();
  // svelte-ignore state_referenced_locally
  let view = $state(initial);
  const MODELS: ModelKey[] = ['direct', 'scratchpad', 'direct-short'];
  const colour: Record<ModelKey, string> = { direct: 'var(--series-1)', scratchpad: 'var(--series-2)', 'direct-short': 'var(--series-4)' };
  const pct = (v: number) => `${(v * 100).toFixed(v > 0.995 && v < 1 ? 1 : 0)}%`;
  const trainSteps = Math.max(1, ...Object.values(DATA.train ?? {}).map((t) => t.curve.at(-1)?.[0] ?? 0));
  let hover = $state<string | null>(null);

  function pickTrain(pt: { x: number; y: number } | null) {
    if (!pt || !DATA.train) return (hover = null);
    const parts = MODELS.filter((m) => DATA.train![m]).map((m) => {
      const c = DATA.train![m].curve;
      const row = c.reduce((b, r) => (Math.abs(r[0] - pt.x) < Math.abs(b[0] - pt.x) ? r : b), c[0]!);
      return `${LABELS[m]}: ${pct(row[2])} at step ${row[0]}`;
    });
    hover = parts.join(' · ');
  }
  function pickVote(pt: { x: number; y: number } | null) {
    if (!pt || !DATA.vote) return (hover = null);
    const parts = MODELS.filter((m) => DATA.vote![m]).map((m) => {
      const v = DATA.vote![m];
      const i = v.vote.reduce((bi, r, j) => (Math.abs(Math.log(r[0]) - Math.log(Math.max(1, pt.x))) < Math.abs(Math.log(v.vote[bi]![0]) - Math.log(Math.max(1, pt.x))) ? j : bi), 0);
      return `${LABELS[m]}, k = ${v.vote[i]![0]}: vote ${pct(v.vote[i]![1])}, pass ${pct(v.pass[i]![1])}`;
    });
    hover = parts.join(' · ');
  }
  function pickGrpo(pt: { x: number; y: number } | null) {
    if (!pt || !DATA.grpo) return (hover = null);
    const c = DATA.grpo.curve;
    const row = c.reduce((b, r) => (Math.abs(r[0] - pt.x) < Math.abs(b[0] - pt.x) ? r : b), c[0]!);
    hover = `step ${row[0]}: greedy ${pct(row[1])}, one sample at T = 1 ${pct(row[3])}`;
  }
  const grpoMax = DATA.grpo?.curve.at(-1)?.[0] ?? 300;
</script>

<Widget
  title="Adding six-digit numbers"
  subtitle="A 4-layer, width-256 GPT trained from scratch on random sums, with the loss only on what follows “=”. Accuracy is exact-match on held-out problems."
  kind="Measured"
>
  {#snippet controls()}
    <Segmented
      label="View"
      size="sm"
      options={[{ value: 'train', label: 'Training' }, { value: 'vote', label: 'More samples' }, { value: 'grpo', label: 'GRPO' }]}
      bind:value={view}
    />
  {/snippet}

  {#if view === 'train'}
    {#if DATA.train}
      <Legend items={MODELS.filter((m) => DATA.train![m]).map((m) => ({ label: LABELS[m], color: colour[m] }))} />
      <Plot label="Greedy accuracy during training" height={250} x={{ domain: [0, trainSteps], label: 'training step (256 problems each)', ticks: 6 }} y={{ domain: [0, 1], label: 'accuracy', ticks: 5 }} onpointer={pickTrain}>
        {#snippet marks({ sx, sy })}
          {#each MODELS.filter((m) => DATA.train![m]) as m (m)}
            <path class="line" stroke={colour[m]} stroke-width="2" d={'M' + [[0, 0, 0] as [number, number, number], ...DATA.train![m].curve].map(([s, , a]) => `${sx(s)},${sy(a)}`).join('L')} />
          {/each}
        {/snippet}
      </Plot>
    {:else}
      <p class="muted">Run <code>uv run lmc ch22 train</code> and <code>uv run lmc ch22 summary</code>.</p>
    {/if}
  {:else if view === 'vote'}
    {#if DATA.vote}
      <Legend
        items={[
          ...MODELS.filter((m) => DATA.vote![m]).map((m) => ({ label: `${LABELS[m]}: vote`, color: colour[m] })),
          ...MODELS.filter((m) => DATA.vote![m]).map((m) => ({ label: `pass@k`, color: colour[m], dashed: true })).slice(0, 1),
        ]}
      />
      <Plot label="Accuracy of majority voting and pass@k" height={250} x={{ domain: [1, 32], type: 'log', label: 'samples per problem (temperature 1)', ticks: 6 }} y={{ domain: [0, 1], label: 'accuracy', ticks: 5 }} onpointer={pickVote}>
        {#snippet marks({ sx, sy })}
          {#each MODELS.filter((m) => DATA.vote![m]) as m (m)}
            {@const v = DATA.vote![m]}
            <path class="line" stroke={colour[m]} stroke-width="1.5" stroke-dasharray="4 3" d={'M' + v.pass.map(([k, a]) => `${sx(k)},${sy(a)}`).join('L')} />
            <path class="line" stroke={colour[m]} stroke-width="2" d={'M' + v.vote.map(([k, a]) => `${sx(k)},${sy(a)}`).join('L')} />
            <line x1={sx(1)} x2={sx(32)} y1={sy(v.greedy)} y2={sy(v.greedy)} stroke={colour[m]} stroke-width="1" opacity="0.45" />
          {/each}
        {/snippet}
      </Plot>
      <p class="note ui">Solid: majority vote of k samples. Dashed: pass@k, the fraction of problems where at least one sample is right. Faint horizontal lines: greedy decoding.</p>
    {:else}
      <p class="muted">Run <code>uv run lmc ch22 vote</code> and <code>uv run lmc ch22 summary</code>.</p>
    {/if}
  {:else if DATA.grpo}
    <Legend items={[{ label: 'greedy accuracy', color: colour['direct-short'] }, { label: 'one sample at temperature 1', color: 'var(--series-5)', dashed: true }]} />
    <Plot label="GRPO training" height={250} x={{ domain: [0, grpoMax], label: `GRPO step (${DATA.grpo.prompts} problems × ${DATA.grpo.group} samples)`, ticks: 6 }} y={{ domain: [0.3, 1], label: 'accuracy', ticks: 5 }} onpointer={pickGrpo}>
      {#snippet marks({ sx, sy })}
        <path class="line" stroke="var(--series-5)" stroke-width="2" stroke-dasharray="4 3" d={'M' + DATA.grpo!.curve.map(([s, , , r]) => `${sx(s)},${sy(r)}`).join('L')} />
        <path class="line" stroke={colour['direct-short']} stroke-width="2" d={'M' + DATA.grpo!.curve.map(([s, a]) => `${sx(s)},${sy(a)}`).join('L')} />
      {/snippet}
    </Plot>
    <p class="note ui">Before → after: greedy {pct(DATA.grpo.before.greedy)} → {pct(DATA.grpo.after.greedy)}, one sample {pct(DATA.grpo.before.pass1)} → {pct(DATA.grpo.after.pass1)}, any of 8 samples (pass@8) {pct(DATA.grpo.before.pass8)} → {pct(DATA.grpo.after.pass8)}.</p>
  {:else}
    <p class="muted">Run <code>uv run lmc ch22 grpo</code> and <code>uv run lmc ch22 summary</code>.</p>
  {/if}
  <p class="hover ui">{hover ?? ' '}</p>
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .note {
    font-size: 0.76rem;
    color: var(--ink-3);
    margin: 0.3rem 0 0;
  }
  .hover {
    font-size: 0.78rem;
    color: var(--ink-2);
    min-height: 1.2em;
    margin: 0.3rem 0 0;
  }
</style>
