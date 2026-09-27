<!--
  Train the neural bigram model live: logits = W[x], p = softmax(logits), minimise cross-entropy by
  SGD. Watch softmax(W) converge to the table of counts from Chapter 2 — and regularisation play the
  role of smoothing.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { mulberry32 } from '@lm/core';
  import { impl } from '$lib/exercise/impl.svelte';
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { chars, referenceStep, type Chars } from '../shared';

  let data: Chars | null = $state(null);
  let V = $state(65);
  let W = new Float32Array(0);
  let running = $state(false);
  let steps = $state(0);
  let batch = $state(256);
  let logScale = $state(true);
  let curve: { step: number; train: number; val: number }[] = $state([]);
  let probs = $state(new Float32Array(0));
  let countProbs = $state(new Float32Array(0));
  let countLoss = $state(NaN);
  let trainEma = NaN;
  let rng = mulberry32(1);
  let fraction: 'all' | 'tiny' = $state('all');
  const trainIds = $derived(data ? (fraction === 'all' ? data.train : data.train.subarray(0, 10_000)) : new Int32Array(0));

  const lr = $derived(params.get('sgd.lr', 20));
  const lambda = $derived(params.get('sgd.lambda', 0));
  const step = $derived(impl.get('bigram.step', referenceStep));
  const mine = $derived(impl.isMine('bigram.step'));

  onMount(async () => {
    data = await chars();
    V = data.vocab.vocabSize;
    recount();
    reset();
  });

  /** Reference: the counted bigram table from Chapter 2, on the same training data (add-0.01 so no zeros). */
  function recount() {
    const counts = new Float64Array(V * V);
    const tr = trainIds;
    for (let t = 0; t + 1 < tr.length; t++) counts[tr[t]! * V + tr[t + 1]!]!++;
    const cp = new Float32Array(V * V);
    for (let r = 0; r < V; r++) {
      let s = 0;
      for (let c = 0; c < V; c++) s += counts[r * V + c]! + 0.01;
      for (let c = 0; c < V; c++) cp[r * V + c] = (counts[r * V + c]! + 0.01) / s;
    }
    countProbs = cp;
    countLoss = evalLoss(cp);
  }

  function reset() {
    running = false;
    W = new Float32Array(V * V); // all zeros: every prediction starts uniform
    steps = 0;
    curve = [];
    trainEma = NaN;
    rng = mulberry32(1);
    refresh();
  }

  function softmaxRows(w: Float32Array): Float32Array {
    const out = new Float32Array(w.length);
    for (let r = 0; r < V; r++) {
      let m = -Infinity;
      for (let c = 0; c < V; c++) m = Math.max(m, w[r * V + c]!);
      let s = 0;
      for (let c = 0; c < V; c++) s += out[r * V + c] = Math.exp(w[r * V + c]! - m);
      for (let c = 0; c < V; c++) out[r * V + c]! /= s;
    }
    return out;
  }

  /** Mean validation cross-entropy (nats) of a probability table over the first 50k bigrams. */
  function evalLoss(p: Float32Array): number {
    if (!data) return NaN;
    const n = Math.min(50_000, data.val.length - 1);
    let s = 0;
    for (let t = 0; t < n; t++) s -= Math.log(Math.max(p[data.val[t]! * V + data.val[t + 1]!]!, 1e-12));
    return s / n;
  }

  function refresh() {
    probs = softmaxRows(W);
    const val = evalLoss(probs);
    curve = [...curve, { step: steps, train: Number.isFinite(trainEma) ? trainEma : Math.log(V), val }];
  }

  function train(n: number) {
    if (!data) return;
    const xs = new Int32Array(batch), ys = new Int32Array(batch);
    for (let k = 0; k < n; k++) {
      for (let b = 0; b < batch; b++) {
        const t = Math.floor(rng() * (trainIds.length - 1));
        xs[b] = trainIds[t]!;
        ys[b] = trainIds[t + 1]!;
      }
      const loss = step(W, V, xs, ys, lr, lambda);
      trainEma = Number.isFinite(trainEma) ? 0.95 * trainEma + 0.05 * loss : loss;
      steps++;
      if (!Number.isFinite(loss)) {
        running = false;
        break;
      }
    }
    refresh();
  }

  function loop() {
    if (!running) return;
    train(batch >= 2048 ? 5 : 25);
    if (steps >= 20000) running = false;
    requestAnimationFrame(loop);
  }

  const labels = $derived(data ? Array.from({ length: V }, (_, i) => data!.vocab.show(i)) : []);
  const last = $derived(curve.at(-1));
  const toBits = (n: number) => n / Math.LN2;
</script>

<Widget
  title="Training a neural bigram model"
  subtitle="One weight matrix W: row x holds the logits for the character after x. Start from W = 0 (uniform predictions) and minimise cross-entropy by stochastic gradient descent."
  onreset={reset}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => ((running = !running), running && loop())} disabled={!data}>{running ? 'Pause' : steps ? 'Resume' : 'Train'}</Button>
    <Button onclick={() => train(1)} disabled={!data || running}>One step</Button>
    <div class="ctl"><Slider label="learning rate η" min={0.1} max={200} step={0.1} log value={lr} oninput={(v) => params.set('sgd.lr', v)} format={(v) => v.toFixed(1)} /></div>
    <div class="ctl"><Slider label="L2 strength λ" min={0} max={0.5} step={0.005} value={lambda} oninput={(v) => params.set('sgd.lambda', v)} format={(v) => v.toFixed(3)} /></div>
    <Segmented
      label="Training data"
      size="sm"
      options={[
        { value: 'all', label: 'All 1M chars' },
        { value: 'tiny', label: 'First 10k chars' },
      ]}
      bind:value={fraction}
      onchange={() => (recount(), reset())}
    />
    <Segmented label="Batch size" size="sm" options={[16, 256, 2048].map((v) => ({ value: v, label: `B = ${v}` }))} bind:value={batch} />
    <Toggle bind:checked={logScale} label="Log colours" />
  {/snippet}

  {#if !data}
    <p class="muted">Loading TinyShakespeare…</p>
  {:else}
    <div class="stats">
      <span>step <strong class="num">{steps.toLocaleString('en-GB')}</strong></span>
      <span>validation loss <strong class="num">{last ? `${last.val.toFixed(3)} nats = ${toBits(last.val).toFixed(3)} bits` : '—'}</strong></span>
      <span>counted bigram, same data <strong class="num">{toBits(countLoss).toFixed(3)} bits</strong></span>
      {#if mine}<span class="mine">stepping with your bigramStep</span>{/if}
    </div>
    <div class="maps">
      <div>
        <div class="ttl">Learned: softmax(W), row = current character</div>
        <Heatmap values={probs} rows={V} cols={V} log={logScale} range={logScale ? [1e-4, 1] : [0, 1]} rowLabels={labels} colLabels={labels} maxCell={7} label="Learned bigram probabilities" format={(v) => `${(v * 100).toFixed(2)}%`} />
      </div>
      <div>
        <div class="ttl">Counted: P(next | current), as in Chapter 2</div>
        <Heatmap values={countProbs} rows={V} cols={V} log={logScale} range={logScale ? [1e-4, 1] : [0, 1]} rowLabels={labels} colLabels={labels} maxCell={7} label="Counted bigram probabilities" format={(v) => `${(v * 100).toFixed(2)}%`} />
      </div>
    </div>
    <Legend items={[{ label: 'Training loss (moving average)', color: 'var(--series-1)' }, { label: 'Validation loss', color: 'var(--series-2)' }, { label: 'Counted bigram, validation', color: 'var(--ink-3)', dashed: true }]} />
    <Plot
      label="Loss against training steps"
      height={220}
      x={{ domain: [0, Math.max(100, steps)], label: 'SGD steps', nice: true, ticks: 5 }}
      y={{ domain: [2.3, 4.6], label: 'cross-entropy (nats)', ticks: 4 }}
    >
      {#snippet marks({ sx, sy })}
        <line x1={sx(0)} x2={sx(Math.max(100, steps))} y1={sy(countLoss)} y2={sy(countLoss)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {#if curve.length > 1}
          <path class="line" stroke="var(--series-1)" d={'M' + curve.map((c) => `${sx(c.step)},${sy(Math.min(4.6, c.train))}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + curve.map((c) => `${sx(c.step)},${sy(Math.min(4.6, c.val))}`).join('L')} />
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const c = curve.length ? curve.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a)) : null}
        {#if c}<div class="num">step {c.step}: train {c.train.toFixed(3)} · val {c.val.toFixed(3)} nats</div>{/if}
      {/snippet}
    </Plot>
  {/if}
</Widget>

<style>
  .ctl {
    flex: 0 1 10rem;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.6rem;
  }
  .stats strong {
    color: var(--ink);
  }
  .mine {
    background: color-mix(in srgb, var(--good) 14%, transparent);
    padding: 0 0.5rem;
    border-radius: 99px;
    color: var(--ink);
  }
  .maps {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem;
    margin-bottom: 0.6rem;
  }
  @media (max-width: 760px) {
    .maps {
      grid-template-columns: 1fr;
    }
  }
  .ttl {
    font-size: 0.78rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
