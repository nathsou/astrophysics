<!--
  Vanishing and exploding gradients: how strongly the state k steps back influences the state now,
  ‖∂h_T/∂h_{T−k}‖, for a linear RNN, a tanh RNN and an LSTM's cell path.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { params } from '$lib/state/params.svelte';

  const H = 64, T = 60;
  const rho = $derived(params.get('rnn.rho', 0.9));
  const drive = $derived(params.get('rnn.drive', 1));
  const forget = $derived(params.get('rnn.forget', 0.97));

  // Fixed random recurrent weights U, inputs and output direction v.
  const base = (() => {
    const rng = mulberry32(4);
    const g = () => {
      const u = Math.max(rng(), 1e-12), v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    // A random orthogonal matrix (Gram–Schmidt on Gaussian rows): all its singular values are 1, so
    // ρ·U stretches every vector by exactly ρ and the linear network's gradient is exactly ρᵏ.
    const U = new Float64Array(H * H);
    for (let i = 0; i < H; i++) {
      const r = Float64Array.from({ length: H }, g);
      for (let p = 0; p < i; p++) {
        let d = 0;
        for (let j = 0; j < H; j++) d += r[j]! * U[p * H + j]!;
        for (let j = 0; j < H; j++) r[j]! -= d * U[p * H + j]!;
      }
      const n = Math.hypot(...r);
      for (let j = 0; j < H; j++) U[i * H + j] = r[j]! / n;
    }
    const X = Float64Array.from({ length: T * H }, () => g());
    const v0 = Float64Array.from({ length: H }, () => g());
    return { U, X, v0 };
  })();

  /** ‖∂(v·h_T)/∂h_{T−k}‖ for k = 0…T, by back-propagating v through the unrolled network. */
  function norms(tanh: boolean): number[] {
    const { U, X, v0 } = base;
    const hs: Float64Array[] = [];
    let h = new Float64Array(H);
    for (let t = 0; t < T; t++) {
      const z = new Float64Array(H);
      for (let j = 0; j < H; j++) {
        let s = drive * X[t * H + j]!;
        for (let i = 0; i < H; i++) s += h[i]! * rho * U[i * H + j]!;
        z[j] = s;
      }
      h = tanh ? z.map(Math.tanh) : z;
      hs.push(h);
    }
    let g = Float64Array.from(v0);
    const out = [Math.hypot(...g)];
    for (let t = T - 1; t > 0; t--) {
      // Through the non-linearity, then back through U: g ← (g ⊙ tanh′) Uᵀ.
      const d = tanh ? g.map((x, j) => x * (1 - hs[t]![j]! ** 2)) : g;
      const n = new Float64Array(H);
      for (let i = 0; i < H; i++) {
        let s = 0;
        for (let j = 0; j < H; j++) s += rho * U[i * H + j]! * d[j]!;
        n[i] = s;
      }
      g = n;
      out.push(Math.hypot(...g));
    }
    return out.map((x) => x / out[0]!);
  }

  const linear = $derived(norms(false));
  const tanhN = $derived(norms(true));
  const lstm = $derived(Array.from({ length: T }, (_, k) => forget ** k));
  const clamp = (v: number) => Math.min(1e6, Math.max(1e-12, v || 1e-12));
  const line = (vals: number[], sx: (v: number) => number, sy: (v: number) => number) => 'M' + vals.map((v, k) => `${sx(k)},${sy(clamp(v))}`).join('L');
</script>

<Widget
  title="How far back can a gradient reach?"
  subtitle="Back-propagating from step T, the gradient is multiplied by the recurrent Jacobian once per step. Its size k steps back decides whether the network can learn that anything so far back mattered."
  onreset={() => {
    params.set('rnn.rho', 0.9);
    params.set('rnn.drive', 1);
    params.set('rnn.forget', 0.97);
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="recurrent scale ρ (U = ρ × orthogonal)" min={0.5} max={1.5} step={0.01} value={rho} oninput={(v) => params.set('rnn.rho', v)} format={(v) => v.toFixed(2)} /></div>
    <div class="ctl"><Slider label="input strength (tanh saturation)" min={0} max={3} step={0.05} value={drive} oninput={(v) => params.set('rnn.drive', v)} format={(v) => v.toFixed(2)} /></div>
    <div class="ctl"><Slider label="LSTM forget gate f" min={0.5} max={1} step={0.005} value={forget} oninput={(v) => params.set('rnn.forget', v)} format={(v) => v.toFixed(3)} /></div>
  {/snippet}

  <Legend
    items={[
      { label: 'Linear RNN: ρᵏ', color: 'var(--series-1)' },
      { label: 'tanh RNN', color: 'var(--series-2)' },
      { label: 'LSTM cell path: fᵏ', color: 'var(--series-3)' },
    ]}
  />
  <Plot
    label="Relative gradient norm against steps back"
    height={260}
    x={{ domain: [0, T - 1], label: 'steps back, k', ticks: 6 }}
    y={{ type: 'log', domain: [1e-12, 1e6], label: '‖∂h_T / ∂h_(T−k)‖ (relative, log)', tickValues: [1e-12, 1e-8, 1e-4, 1, 1e4], format: (v) => (v === 1 ? '1' : `1e${Math.round(Math.log10(v))}`) }}
  >
    {#snippet marks({ sx, sy })}
      <line x1={sx(0)} x2={sx(T - 1)} y1={sy(1)} y2={sy(1)} stroke="var(--ink-3)" stroke-dasharray="3 3" />
      <path class="line" stroke="var(--series-1)" d={line(linear, sx, sy)} />
      <path class="line" stroke="var(--series-2)" d={line(tanhN, sx, sy)} />
      <path class="line" stroke="var(--series-3)" d={line(lstm, sx, sy)} />
    {/snippet}
    {#snippet tooltip({ x })}
      {@const k = Math.max(0, Math.min(T - 1, Math.round(x)))}
      <div class="num">k = {k}: linear {linear[k]!.toExponential(1)} · tanh {tanhN[k]!.toExponential(1)} · LSTM {lstm[k]!.toExponential(1)}</div>
    {/snippet}
  </Plot>
  <p class="note ui num">
    After 50 steps: linear {linear[50]!.toExponential(1)}, tanh {tanhN[50]!.toExponential(1)}, LSTM cell {lstm[50]!.toExponential(1)}.
    {rho > 1.05 && drive < 0.3 ? 'With ρ > 1 and weak inputs the gradient explodes — clipping (below) keeps training stable.' : drive > 1.5 ? 'Strong inputs saturate tanh (slope near 0), which vanishes the gradient even when ρ > 1.' : ''}
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 15rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
