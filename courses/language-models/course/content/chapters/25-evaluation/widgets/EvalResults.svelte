<!--
  Measured: the "which sentence comes next?" benchmark for the models of the book, with 95% bootstrap intervals;
  CourseGPT's calibration (next-token, and on the benchmark's four choices, via the learner's ece()); and what
  training on the test items does to the score.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { DATA } from '../data';

  function reference(predictions: { confidence: number; correct: boolean }[], B = 10): number {
    const conf = new Array<number>(B).fill(0), right = new Array<number>(B).fill(0);
    for (const p of predictions) {
      const b = Math.min(B - 1, Math.floor(p.confidence * B));
      conf[b]! += p.confidence;
      right[b]! += Number(p.correct);
    }
    let t = 0;
    for (let b = 0; b < B; b++) t += Math.abs(conf[b]! - right[b]!);
    return t / predictions.length;
  }
  const ece = $derived(impl.get('eval.ece', reference));
  const mine = $derived(impl.isMine('eval.ece'));

  let { view: initial = 'benchmark' }: { view?: 'benchmark' | 'calibration' | 'contamination' } = $props();
  // svelte-ignore state_referenced_locally
  let view = $state(initial);
  let mode = $state<'sum' | 'mean'>('sum');
  let example = $state(0);
  const B = DATA.benchmark;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  // Reliability of the four-way choice: bins of the model's probability for the option it picked.
  const choice = $derived.by(() => {
    const preds = (B?.conf ?? []).map(([c, r]) => ({ confidence: c, correct: r === 1 }));
    const bins = Array.from({ length: 10 }, () => ({ c: 0, r: 0, n: 0 }));
    for (const p of preds) {
      const b = bins[Math.min(9, Math.floor(p.confidence * 10))]!;
      b.c += p.confidence;
      b.r += Number(p.correct);
      b.n++;
    }
    let e: number;
    try {
      e = ece(preds);
    } catch {
      e = reference(preds);
    }
    return { bins: bins.filter((b) => b.n >= 5).map((b) => [b.c / b.n, b.r / b.n, b.n] as const), ece: e };
  });
</script>

<Widget
  title="Evaluating the models of the book"
  subtitle="1,000 items built from TinyStories validation stories: a story’s first sentences, and four candidates for the next one — the true sentence and three taken from other stories. A model picks the candidate it finds most likely. Chance is 25%."
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="View" size="sm" options={[{ value: 'benchmark', label: 'Scores' }, { value: 'calibration', label: 'Calibration' }, { value: 'contamination', label: 'Contamination' }]} bind:value={view} />
    {#if view === 'benchmark'}<Segmented label="Score by" size="sm" options={[{ value: 'sum', label: 'total log-prob' }, { value: 'mean', label: 'per token' }]} bind:value={mode} />{/if}
  {/snippet}

  {#if view === 'benchmark'}
    {#if B}
      <div class="bars ui">
        <span class="h"></span><span class="h">accuracy, with 95% interval</span><span class="h">val. bits / token</span>
        {#each B.results as r (r.run)}
          {@const acc = mode === 'sum' ? r.acc_sum : r.acc_mean}
          {@const ci = mode === 'sum' ? r.ci_sum : r.ci_mean}
          <span class="lbl">{r.label}</span>
          <div class="track">
            <div class="bar" style:width="{acc * 100}%"></div>
            <div class="ci" style:left="{ci[0] * 100}%" style:width="{(ci[1] - ci[0]) * 100}%"></div>
            <span class="num v">{pct(acc)}</span>
          </div>
          <span class="num b">{r.val_bits.toFixed(3)}</span>
        {/each}
      </div>
      {#if B.paired}
        <p class="note ui">Paired on the same items, CourseGPT minus the 10 × 640 model: <strong class="num">{(B.paired.diff * 100).toFixed(1)}</strong> points, 95% interval {(B.paired.ci[0] * 100).toFixed(1)} to {(B.paired.ci[1] * 100).toFixed(1)}.</p>
      {/if}
      <details class="ex ui">
        <summary>An item</summary>
        <Segmented label="Item" size="sm" options={B.examples.map((_, i) => ({ value: i, label: `${i + 1}` }))} bind:value={example} />
        <p class="ctx">{B.examples[example]!.context} …</p>
        <ol>
          {#each B.examples[example]!.options as o, i (i)}<li class:ans={i === B.examples[example]!.answer}>{o}</li>{/each}
        </ol>
      </details>
    {:else}
      <p class="muted">Run <code>uv run lmc ch25 benchmark</code> and <code>uv run lmc ch25 summary</code>.</p>
    {/if}
  {:else if view === 'calibration'}
    {#if mine}<p class="mine ui">Using your ece().</p>{/if}
    {#if DATA.calibration}
      <Legend items={[{ label: 'next token (top-1)', color: 'var(--series-1)' }, { label: 'benchmark choice', color: 'var(--series-3)' }, { label: 'perfect calibration', color: 'var(--ink-3)', dashed: true }]} />
      <Plot label="Reliability diagram" height={260} x={{ domain: [0, 1], label: 'confidence', ticks: 5 }} y={{ domain: [0, 1], label: 'fraction correct', ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--ink-3)" stroke-dasharray="4 3" />
          <path class="line" stroke="var(--series-1)" stroke-width="2" d={'M' + DATA.calibration!.bins.map((b) => `${sx(b[2])},${sy(b[3])}`).join('L')} />
          {#each DATA.calibration!.bins as b (b[0])}<circle cx={sx(b[2])} cy={sy(b[3])} r={2 + Math.sqrt(b[4] / DATA.calibration!.tokens) * 8} fill="var(--series-1)" opacity="0.7" />{/each}
          {#if choice.bins.length}
            <path class="line" stroke="var(--series-3)" stroke-width="2" d={'M' + choice.bins.map((b) => `${sx(b[0])},${sy(b[1])}`).join('L')} />
            {#each choice.bins as b (b[0])}<circle cx={sx(b[0])} cy={sy(b[1])} r="3" fill="var(--series-3)" />{/each}
          {/if}
        {/snippet}
      </Plot>
      <p class="note ui">
        Next token: top-1 right <strong class="num">{pct(DATA.calibration.accuracy)}</strong> of the time with mean confidence <strong class="num">{pct(DATA.calibration.confidence)}</strong>; ECE <strong class="num">{DATA.calibration.ece.toFixed(3)}</strong> over {DATA.calibration.tokens.toLocaleString('en-GB')} tokens (dot area: share of tokens).
        {#if choice.bins.length}Benchmark choice: ECE <strong class="num">{choice.ece.toFixed(3)}</strong>.{/if}
      </p>
    {:else}
      <p class="muted">Run <code>uv run lmc ch25 calibration</code> and <code>uv run lmc ch25 summary</code>.</p>
    {/if}
  {:else if DATA.contaminate}
    {@const C = DATA.contaminate}
    <Legend items={[{ label: 'the 1,000 test items (leaked)', color: 'var(--critical)' }, { label: '1,000 fresh items', color: 'var(--series-1)' }]} />
    <Plot label="Accuracy while training on the test stories" height={240} x={{ domain: [0, C.steps], label: 'training steps on the test stories (16 per step)', ticks: 4 }} y={{ domain: [0.4, 1], label: 'accuracy', ticks: 4 }}>
      {#snippet marks({ sx, sy })}
        <path class="line" stroke="var(--critical)" stroke-width="2" d={'M' + [[0, C.before.test], ...C.curve.map((c) => [c[0], c[1]])].map(([s, a]) => `${sx(s!)},${sy(a!)}`).join('L')} />
        <path class="line" stroke="var(--series-1)" stroke-width="2" d={'M' + [[0, C.before.fresh], ...C.curve.map((c) => [c[0], c[2]])].map(([s, a]) => `${sx(s!)},${sy(a!)}`).join('L')} />
      {/snippet}
    </Plot>
    <p class="note ui">Before: {pct(C.before.test)} on the test items, {pct(C.before.fresh)} on fresh ones. After {C.steps} steps: {pct(C.curve.at(-1)![1])} and {pct(C.curve.at(-1)![2])}.</p>
  {:else}
    <p class="muted">Run <code>uv run lmc ch25 contaminate</code> and <code>uv run lmc ch25 summary</code>.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .bars {
    display: grid;
    grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr) 4.5rem;
    gap: 0.3rem 0.7rem;
    align-items: center;
    font-size: 0.8rem;
  }
  .h {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .lbl {
    color: var(--ink-2);
  }
  .track {
    position: relative;
    height: 1.1rem;
    background: var(--surface-2);
    border-radius: 3px;
  }
  .bar {
    height: 100%;
    background: var(--series-1);
    opacity: 0.75;
    border-radius: 3px;
  }
  .ci {
    position: absolute;
    top: 45%;
    height: 10%;
    background: var(--ink);
  }
  .v {
    position: absolute;
    right: 0.3rem;
    top: 0;
    line-height: 1.1rem;
    font-size: 0.72rem;
  }
  .b {
    text-align: right;
    color: var(--ink-3);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
  .ex {
    margin-top: 0.7rem;
    font-size: 0.8rem;
  }
  .ex summary {
    cursor: pointer;
    color: var(--ink-2);
    margin-bottom: 0.4rem;
  }
  .ctx {
    font-family: var(--font-body, serif);
    font-size: 0.85rem;
    margin: 0.5rem 0 0.3rem;
  }
  ol {
    margin: 0;
    padding-left: 1.4rem;
  }
  li.ans {
    color: var(--good);
    font-weight: 600;
  }
</style>
