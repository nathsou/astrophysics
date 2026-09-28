<!--
  Compute-optimal is not cost-optimal once a model is used: every generated token costs 2N FLOPs. For a
  target loss, each model size N needs D(N) training tokens (from the law); the lifetime cost is
  6·N·D(N) + 2·N·(tokens served). The best N shrinks as usage grows. Uses the learner's
  tokensForLoss() once their exercise passes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { PUBLISHED, pow10, si, type Law } from '../data';

  const law = PUBLISHED.chinchilla!.law;
  function reference(N: number, target: number, l: Law): number {
    const room = target - l.E - l.A / N ** l.alpha;
    return room > 0 ? (l.B / room) ** (1 / l.beta) : Infinity;
  }
  const tokensForLoss = $derived(impl.get('scaling.tokensForLoss', reference));
  const mine = $derived(impl.isMine('scaling.tokensForLoss'));
  let target = $state(2.1);
  let logServe = $state(12);
  const serve = $derived(10 ** logServe);
  const Ns = Array.from({ length: 120 }, (_, i) => 10 ** (8 + (i / 119) * 4));
  const rows = $derived(
    Ns.map((N) => {
      let D: number;
      try {
        D = tokensForLoss(N, target, law);
      } catch {
        D = reference(N, target, law);
      }
      return { N, D, train: 6 * N * D, total: 6 * N * D + 2 * N * serve };
    }).filter((r) => Number.isFinite(r.D)),
  );
  const bestTrain = $derived(rows.reduce((a, b) => (b.train < a.train ? b : a), rows[0]!));
  const bestTotal = $derived(rows.reduce((a, b) => (b.total < a.total ? b : a), rows[0]!));
  const yMin = $derived(Math.min(...rows.map((r) => r.train)) / 3);
  const yMax = $derived(Math.max(bestTotal.total, bestTrain.total) * 30);
</script>

<Widget
  title="Paying for training and for use"
  subtitle="With Chinchilla’s law (nats per token): pick a target loss and how many tokens the model will generate in its lifetime. For each model size, the law says how many training tokens reach the target; the cheapest model overall is smaller, and trained for longer, than the compute-optimal one."
  onreset={() => {
    target = 2.1;
    logServe = 12;
  }}
>
  {#snippet controls()}
    <div class="sl"><Slider label="Target loss (nats / token)" min={1.95} max={2.6} step={0.01} value={target} oninput={(v) => (target = v)} /></div>
    <div class="sl"><Slider label="Tokens generated in use" min={9} max={15} step={0.1} value={logServe} oninput={(v) => (logServe = v)} format={(v) => `10^${v.toFixed(1)}`} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your tokensForLoss().</p>{/if}
  <Legend items={[{ label: 'training FLOPs', color: 'var(--series-2)' }, { label: 'training + use', color: 'var(--series-1)' }]} />
  <Plot label="Cost against model size for a target loss" height={250} x={{ type: 'log', domain: [1e8, 1e12], label: 'parameters N', tickValues: [1e8, 1e9, 1e10, 1e11, 1e12], format: pow10 }} y={{ type: 'log', domain: [yMin, yMax], label: 'FLOPs', format: pow10 }}>
    {#snippet marks({ sx, sy })}
      <path class="line" stroke="var(--series-2)" d={'M' + rows.map((r) => `${sx(r.N)},${sy(Math.min(yMax, r.train))}`).join('L')} />
      <path class="line" stroke="var(--series-1)" d={'M' + rows.map((r) => `${sx(r.N)},${sy(Math.min(yMax, r.total))}`).join('L')} />
      <circle cx={sx(bestTrain.N)} cy={sy(bestTrain.train)} r="5" fill="var(--series-2)" />
      <circle cx={sx(bestTotal.N)} cy={sy(bestTotal.total)} r="5" fill="var(--series-1)" />
    {/snippet}
  </Plot>
  <table class="res num ui">
    <thead><tr><th></th><th>parameters</th><th>training tokens</th><th>tokens / parameter</th><th>total FLOPs</th></tr></thead>
    <tbody>
      <tr><td><span class="sw" style:background="var(--series-2)"></span>cheapest to train</td><td>{si(bestTrain.N)}</td><td>{si(bestTrain.D)}</td><td>{(bestTrain.D / bestTrain.N).toFixed(0)}</td><td>{bestTrain.total.toExponential(2)}</td></tr>
      <tr><td><span class="sw" style:background="var(--series-1)"></span>cheapest overall</td><td>{si(bestTotal.N)}</td><td>{si(bestTotal.D)}</td><td>{(bestTotal.D / bestTotal.N).toFixed(0)}</td><td>{bestTotal.total.toExponential(2)}</td></tr>
    </tbody>
  </table>
</Widget>

<style>
  .sl {
    flex: 1 1 13rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--accent-ink);
    margin: 0 0 0.4rem;
  }
  .res {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
    margin-top: 0.6rem;
  }
  .res th {
    text-align: left;
    font-size: 0.72rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  .res td {
    border-top: 1px solid var(--rule);
    padding: 0.2rem 0.3rem;
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
</style>
