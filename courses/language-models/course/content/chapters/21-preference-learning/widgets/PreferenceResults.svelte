<!--
  Measured: preference learning on the instruction-tuned CourseGPT of Chapter 20. The reward model's accuracy
  on held-out pairs; best-of-n picking with the reward model against the true score; and DPO at two values of
  β, against the SFT model it started from, with sample stories.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  let { view: initial = 'reward' }: { view?: 'reward' | 'bestofn' | 'dpo' } = $props();
  // svelte-ignore state_referenced_locally
  let view = $state(initial);
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const dpoKeys = Object.keys(DATA.dpo ?? {});
  const label = (k: string) => (k === 'sft' ? 'SFT (Chapter 20)' : `DPO, β = ${k.replace('dpo-', '')}`);
  let sampleModel = $state(dpoKeys.at(-1) ?? 'sft');
  let hover = $state<string | null>(null);

  function pickReward(pt: { x: number; y: number } | null) {
    if (!pt || !DATA.reward) return (hover = null);
    const c = DATA.reward.curve;
    const row = c.reduce((b, r) => (Math.abs(r[0] - pt.x) < Math.abs(b[0] - pt.x) ? r : b), c[0]!);
    hover = `step ${row[0]}: ${pct(row[1])} of held-out pairs ranked correctly`;
  }
  function pickBon(pt: { x: number; y: number } | null) {
    if (!pt || !DATA.bestofn) return (hover = null);
    const b = DATA.bestofn;
    const i = b.oracle.reduce((bi, r, j) => (Math.abs(Math.log(r[0]) - Math.log(Math.max(1, pt.x))) < Math.abs(Math.log(b.oracle[bi]![0]) - Math.log(Math.max(1, pt.x))) ? j : bi), 0);
    hover = `best of ${b.oracle[i]![0]}: reward model ${pct(b.reward_model[i]![1])}, true score ${pct(b.oracle[i]![1])}`;
  }
  const rewardSteps = DATA.reward?.curve.at(-1)?.[0] ?? 1;
  const bonMax = DATA.bestofn?.oracle.at(-1)?.[0] ?? 16;
</script>

<Widget
  title="Learning from preferences"
  subtitle="Two stories per instruction from the Chapter 20 model; the one using more of the required name and words is ‘chosen’. Evaluated on 200 held-out instructions."
  kind="Measured"
>
  {#snippet controls()}
    <Segmented
      label="View"
      size="sm"
      options={[{ value: 'reward', label: 'Reward model' }, { value: 'bestofn', label: 'Best-of-n' }, { value: 'dpo', label: 'DPO' }]}
      bind:value={view}
    />
  {/snippet}

  {#if view === 'reward'}
    {#if DATA.reward}
      <Plot label="Reward model accuracy" height={230} x={{ domain: [0, rewardSteps], label: 'training step (16 pairs each)', ticks: 6 }} y={{ domain: [0.4, 1], label: 'held-out accuracy', ticks: 4 }} onpointer={pickReward}>
        {#snippet marks({ sx, sy })}
          <line x1={sx(0)} x2={sx(rewardSteps)} y1={sy(0.5)} y2={sy(0.5)} stroke="var(--ink-3)" stroke-dasharray="3 3" />
          <path class="line" stroke="var(--series-1)" stroke-width="2" d={'M' + DATA.reward!.curve.map(([s, a]) => `${sx(s)},${sy(a)}`).join('L')} />
        {/snippet}
      </Plot>
    {:else}
      <p class="muted">Run <code>uv run lmc ch21 reward</code> and <code>uv run lmc ch21 summary</code>.</p>
    {/if}
  {:else if view === 'bestofn'}
    {#if DATA.bestofn}
      <Legend items={[{ label: 'picked by the reward model', color: 'var(--series-1)' }, { label: 'picked by the true score', color: 'var(--series-3)', dashed: true }]} />
      <Plot label="Best-of-n" height={230} x={{ domain: [1, bonMax], type: 'log', label: 'stories sampled per instruction (n)', ticks: 5 }} y={{ domain: [0, 1], label: 'instructions fully satisfied', ticks: 5 }} onpointer={pickBon}>
        {#snippet marks({ sx, sy })}
          <path class="line" stroke="var(--series-3)" stroke-width="2" stroke-dasharray="4 3" d={'M' + DATA.bestofn!.oracle.map(([k, v]) => `${sx(k)},${sy(v)}`).join('L')} />
          <path class="line" stroke="var(--series-1)" stroke-width="2" d={'M' + DATA.bestofn!.reward_model.map(([k, v]) => `${sx(k)},${sy(v)}`).join('L')} />
          {#each DATA.bestofn!.reward_model as [k, v] (k)}<circle cx={sx(k)} cy={sy(v)} r="2.5" fill="var(--series-1)" />{/each}
        {/snippet}
      </Plot>
    {:else}
      <p class="muted">Run <code>uv run lmc ch21 bestofn</code> and <code>uv run lmc ch21 summary</code>.</p>
    {/if}
  {:else if DATA.dpo}
    <table class="ui">
      <thead><tr><th></th><th>all four constraints</th><th>constraints met (of 4)</th><th>fluency (bits / token, lower is better)</th></tr></thead>
      <tbody>
        {#each dpoKeys as k (k)}
          {@const e = DATA.dpo[k]!}
          <tr><td>{label(k)}</td><td class="num">{pct(e.all)}</td><td class="num">{e.mean_score.toFixed(2)}</td><td class="num">{e.fluency_bits.toFixed(2)}</td></tr>
        {/each}
      </tbody>
    </table>
    <div class="samples">
      <Segmented label="Samples from" size="sm" options={dpoKeys.map((k) => ({ value: k, label: label(k) }))} bind:value={sampleModel} />
      {#each DATA.dpo[sampleModel]?.samples ?? [] as s, i (i)}
        <div class="sample">
          <p class="instr ui">{s.instruction}</p>
          <p class="story">{s.story}</p>
        </div>
      {/each}
    </div>
  {:else}
    <p class="muted">Run <code>uv run lmc ch21 dpo</code> and <code>uv run lmc ch21 summary</code>.</p>
  {/if}
  {#if view !== 'dpo'}<p class="hover ui">{hover ?? ' '}</p>{/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .hover {
    font-size: 0.78rem;
    color: var(--ink-2);
    min-height: 1.2em;
    margin: 0.3rem 0 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  th {
    font-weight: 500;
    font-size: 0.72rem;
    color: var(--ink-3);
    text-align: right;
    padding: 0.2rem 0.4rem;
  }
  td {
    padding: 0.3rem 0.4rem;
    border-top: 1px solid var(--rule);
    text-align: right;
  }
  td:first-child,
  th:first-child {
    text-align: left;
    color: var(--ink-2);
  }
  .samples {
    margin-top: 0.9rem;
  }
  .sample {
    margin-top: 0.6rem;
    padding: 0.5rem 0.7rem;
    background: var(--surface-2);
    border-radius: 6px;
  }
  .instr {
    font-size: 0.75rem;
    color: var(--ink-2);
    margin: 0 0 0.3rem;
  }
  .story {
    font-size: 0.85rem;
    margin: 0;
    max-height: 9rem;
    overflow-y: auto;
  }
</style>
