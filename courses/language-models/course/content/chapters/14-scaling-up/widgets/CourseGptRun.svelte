<!--
  CourseGPT's training run on the RTX 4060 Ti: training and validation loss against tokens seen, with
  the n-gram baselines for scale, and the story the model wrote (same seed) at each evaluation.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { DATA } from '../data';

  const R = DATA.coursegpt;
  const B = DATA.baselines;
  const bpt = DATA.tokeniser.meta.val.bytes_per_token;
  let unit = $state<'token' | 'byte'>('token');
  let at = $state(R ? R.samples.length - 1 : 0);
  const cfg = R?.config ?? {};
  const tokensPerStep = Number(cfg.batch ?? 0) * Number(cfg.accum ?? 1) * Number(cfg.context ?? 0);
  const tok = (step: number) => (step * tokensPerStep) / 1e6; // millions of tokens
  const u = $derived((bits: number) => (unit === 'token' ? bits : bits / bpt));
  const yMax = $derived(unit === 'token' ? 6 : 1.5);
  const yMin = $derived(unit === 'token' ? 1 : 0.25);
  const sample = $derived(R?.samples[at]);
  const valAt = $derived(sample ? R!.val.find((v) => v[0] === sample[0]) : undefined);
  const final = R?.val.at(-1);
  const hours = final ? final[2] / 3600 : 0;
  // Medians over the run after compilation (the first records include it).
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const medianMfu = R ? median(R.train.slice(2).map((r) => r[3])) : 0;
  const medianTps = R ? median(R.train.slice(2).map((r) => r[2])) : 0;
</script>

<Widget
  title="Training CourseGPT"
  subtitle={R ? `${(R.params / 1e6).toFixed(1)} M parameters, ${(tok(Number(cfg.steps)) / 1000).toFixed(2)} billion tokens, ${hours.toFixed(1)} hours on an RTX 4060 Ti. Drag the slider to read what the model wrote at each checkpoint (same random seed each time).` : 'CourseGPT’s training run.'}
  kind="Measured"
>
  {#snippet controls()}
    <Segmented label="Unit" size="sm" options={[{ value: 'token', label: 'bits / token' }, { value: 'byte', label: 'bits / byte' }]} bind:value={unit} />
  {/snippet}
  {#if !R}
    <p class="muted">Train with <code>uv run lmc train --preset coursegpt</code>, then run <code>uv run lmc ch14 summary</code>.</p>
  {:else}
    <Legend items={[{ label: 'training', color: 'var(--series-1)' }, { label: 'validation', color: 'var(--series-2)', dot: true }, ...(B ? [{ label: 'bigram baseline', color: 'var(--ink-3)', dashed: true }] : [])]} />
    <Plot label="CourseGPT loss against tokens seen" height={250} x={{ domain: [0, tok(Number(cfg.steps))], label: 'tokens seen (millions)', ticks: 6 }} y={{ domain: [yMin, yMax], label: `bits / ${unit}`, ticks: 5 }}>
      {#snippet marks({ sx, sy })}
        {#if B}<line x1={0} x2={sx(tok(Number(cfg.steps)))} y1={sy(u(B.bigram))} y2={sy(u(B.bigram))} stroke="var(--ink-3)" stroke-dasharray="4 4" />{/if}
        <path class="line" stroke="var(--series-1)" d={'M' + R.train.map((r) => `${sx(tok(r[0]))},${sy(Math.min(yMax, u(r[1])))}`).join('L')} />
        {#each R.val as v (v[0])}<circle cx={sx(tok(v[0]))} cy={sy(Math.min(yMax, u(v[1])))} r={sample && v[0] === sample[0] ? 5 : 3} fill="var(--series-2)" />{/each}
        {#if sample}<line x1={sx(tok(sample[0]))} x2={sx(tok(sample[0]))} y1={0} y2={sy(yMin)} stroke="var(--ink-2)" stroke-dasharray="2 3" />{/if}
      {/snippet}
    </Plot>
    <div class="sl"><Slider label="Checkpoint" min={0} max={R.samples.length - 1} step={1} value={at} oninput={(v) => (at = Math.round(v))} format={(v) => `step ${R.samples[Math.round(v)]?.[0].toLocaleString('en-GB')}`} /></div>
    {#if sample}
      <div class="story">
        <div class="meta ui">Step {sample[0].toLocaleString('en-GB')} · {tok(sample[0]).toFixed(0)} M tokens{#if valAt} · validation {u(valAt[1]).toFixed(3)} bits / {unit}{/if}</div>
        <p>{sample[1].replaceAll('<|endoftext|>', ' ⟨end of story⟩ ')}</p>
      </div>
    {/if}
    <p class="note ui">Median throughput: {Math.round(medianTps).toLocaleString('en-GB')} tokens per second, {(medianMfu * 100).toFixed(0)}% MFU. {#if B}For comparison, the bigram model of Chapter 2 scores {u(B.bigram).toFixed(2)} bits / {unit} on the same tokens, and a uniform guess over 8,192 tokens {u(B.uniform).toFixed(1)}.{/if}</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.85rem;
  }
  .sl {
    margin: 0.6rem 0 0.4rem;
  }
  .story {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    padding: 0.5rem 0.8rem;
  }
  .story .meta {
    font-size: 0.72rem;
    color: var(--ink-3);
  }
  .story p {
    margin: 0.3rem 0 0;
    font-size: 0.88rem;
    white-space: pre-wrap;
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
