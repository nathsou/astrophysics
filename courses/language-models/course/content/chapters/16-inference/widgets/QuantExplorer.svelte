<!--
  Quantising real CourseGPT weights: each weight against its rounded value (a staircase, one step size
  per group), the error for each bit width and group size, and CourseGPT's measured validation loss with
  its weights rounded the same way. Uses the learner's quantise() once their exercise passes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { DATA } from '../data';

  type Quantise = (w: Float32Array, bits: number, group: number) => { dequantised: Float32Array };
  function reference(w: Float32Array, bits: number, group: number) {
    const qmax = 2 ** (bits - 1) - 1;
    const dequantised = new Float32Array(w.length);
    for (let s = 0; s < w.length; s += group) {
      let max = 0;
      for (let i = s; i < Math.min(w.length, s + group); i++) max = Math.max(max, Math.abs(w[i]!));
      const scale = max / qmax || 1;
      for (let i = s; i < Math.min(w.length, s + group); i++) dequantised[i] = Math.max(-qmax, Math.min(qmax, Math.round(w[i]! / scale))) * scale;
    }
    return { dequantised };
  }

  const W = DATA.weights ?? {};
  const names = Object.keys(W);
  let name = $state(names[0] ?? '');
  let bits = $state(4);
  let group = $state(512);
  const quantise = $derived(impl.get<Quantise>('quant.quantise', reference));
  const mine = $derived(impl.isMine('quant.quantise'));

  const w = $derived(W[name] ? Float32Array.from(W[name]!.values) : new Float32Array());
  const rows = $derived(W[name]?.rows ?? 512);
  // Values are stored column by column, so a group of ≤ `rows` consecutive values lies within one column.
  const dq = $derived.by(() => {
    try {
      return quantise(w, bits, Math.min(group, rows)).dequantised;
    } catch {
      return w;
    }
  });
  const err = $derived.by(() => {
    let se = 0, ss = 0;
    for (let i = 0; i < w.length; i++) (se += (dq[i]! - w[i]!) ** 2), (ss += w[i]! ** 2);
    return { rel: Math.sqrt(se / ss), snr: 10 * Math.log10(ss / se) };
  });
  const lim = $derived(w.length ? Math.max(...Array.from(w, Math.abs)) * 1.05 : 1);
  const Q = DATA.quant;
  const fp32 = Q?.results[0]?.val_bits ?? NaN;
</script>

<Widget
  title="Rounding CourseGPT’s weights"
  subtitle="Real weights from the middle block (8 output columns × 512 inputs). Each point is one weight: its original value across, its rounded value up. Every group shares one scale, so each gets its own staircase."
  onreset={() => {
    bits = 4;
    group = 512;
  }}
>
  {#snippet controls()}
    <Segmented label="Matrix" size="sm" options={names.map((n) => ({ value: n, label: n.includes('mlp') ? 'MLP (fc)' : 'attention (q)' }))} bind:value={name} />
    <Segmented label="Bits" size="sm" options={[8, 4, 3, 2].map((b) => ({ value: b, label: `int${b}` }))} bind:value={bits} />
    <Segmented label="Group" size="sm" options={[{ value: 512, label: 'per column' }, { value: 128, label: 'groups of 128' }, { value: 32, label: 'groups of 32' }]} bind:value={group} />
  {/snippet}

  {#if !names.length}
    <p class="muted">Run <code>uv run lmc ch16 weights</code> and <code>uv run lmc ch16 summary</code>.</p>
  {:else}
    {#if mine}<p class="mine ui">Using your quantise().</p>{/if}
    <div class="two">
      <Plot label="Original against quantised weights" height={260} x={{ domain: [-lim, lim], label: 'original weight', ticks: 5 }} y={{ domain: [-lim, lim], label: 'after quantisation', ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          <line x1={sx(-lim)} y1={sy(-lim)} x2={sx(lim)} y2={sy(lim)} stroke="var(--ink-3)" stroke-dasharray="3 3" />
          {#each Array.from({ length: Math.min(w.length, 4096) }, (_, i) => i) as i (i)}
            <circle cx={sx(w[i]!)} cy={sy(dq[i]!)} r="1.4" fill="var(--series-{Math.floor(i / rows) % 8 + 1})" opacity="0.7" />
          {/each}
        {/snippet}
      </Plot>
      <div>
        <div class="stats ui">
          <div><span>levels per group</span><strong class="num">{2 ** bits - 1}</strong></div>
          <div><span>relative error (RMS)</span><strong class="num">{(err.rel * 100).toFixed(err.rel < 0.01 ? 2 : 1)}%</strong></div>
          <div><span>signal-to-noise</span><strong class="num">{err.snr.toFixed(1)} dB</strong></div>
        </div>
        {#if Q}
          <table class="res num ui">
            <thead><tr><th>whole model (measured)</th><th>size</th><th>val. bits / token</th></tr></thead>
            <tbody>
              {#each Q.results as r (r.label)}
                <tr class:cur={r.bits === bits && (r.group ?? 512) === group}><td>{r.label}</td><td>{r.megabytes.toFixed(0)} MB</td><td>{r.val_bits.toFixed(3)}{#if r.bits < 32}<span class="d"> ({r.val_bits - fp32 >= 0 ? '+' : ''}{(r.val_bits - fp32).toFixed(3)})</span>{/if}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
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
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .stats > div {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .stats strong {
    color: var(--ink);
  }
  .res {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 0.8rem;
  }
  .res th {
    text-align: left;
    font-size: 0.7rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  .res td {
    border-top: 1px solid var(--rule);
    padding: 0.2rem 0.3rem;
  }
  .res tr.cur td {
    background: var(--surface-2);
    font-weight: 600;
  }
  .d {
    color: var(--ink-3);
  }
</style>
