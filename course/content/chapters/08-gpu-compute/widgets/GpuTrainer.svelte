<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { gpuMlp, PRESETS, STEPS, type Preset } from '../gpuTrainer.svelte';

  const BASELINES = { bigram: 3.57, kneserNey: 2.22 };
  onMount(() => {
    void gpuMlp.load();
    return () => gpuMlp.pause();
  });

  const bits = (nats: number) => nats / Math.LN2;
  const last = $derived(gpuMlp.history.at(-1));
  const speedup = $derived(gpuMlp.cpuMsPerStep / gpuMlp.gpuMsPerStep);
  const cpuEta = $derived((gpuMlp.cpuMsPerStep * STEPS) / 1000);
  let sample = $state('');
  let sampling = $state(false);

  function duration(s: number): string {
    if (!Number.isFinite(s)) return '…';
    if (s < 90) return `${s.toFixed(0)} s`;
    if (s < 5400) return `${(s / 60).toFixed(0)} min`;
    return `${(s / 3600).toFixed(1)} h`;
  }
</script>

<Widget
  title="The same MLP, trained on your GPU"
  subtitle="Chapter 7’s model and data with this chapter’s GPU backend: every forward, backward and update step runs as WGSL kernels. 20,000 steps of SGD with momentum and a cosine learning-rate schedule."
  onreset={() => gpuMlp.setPreset(gpuMlp.preset)}
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (gpuMlp.running ? gpuMlp.pause() : gpuMlp.start())} disabled={gpuMlp.status !== 'ready' || gpuMlp.step >= STEPS}>
      {gpuMlp.running ? 'Pause' : gpuMlp.step ? (gpuMlp.step >= STEPS ? 'Done' : 'Resume') : 'Train'}
    </Button>
    <Segmented
      label="Model size"
      size="sm"
      options={(Object.keys(PRESETS) as Preset[]).map((k) => ({ value: k, label: PRESETS[k].label }))}
      value={gpuMlp.preset}
      onchange={(v) => gpuMlp.setPreset(v)}
    />
  {/snippet}

  {#if gpuMlp.status === 'unsupported'}
    <p class="muted">This browser does not expose WebGPU. Chrome and Edge (113+) and Safari (26+) do; so does Firefox 141+ on Windows.</p>
  {:else if gpuMlp.status !== 'ready'}
    <p class="muted">Loading TinyShakespeare and compiling kernels…</p>
  {:else}
    <div class="stats">
      <span>h = <strong class="num">{gpuMlp.cfg.h}</strong>, batch <strong class="num">{gpuMlp.cfg.batch}</strong>, d = <strong class="num">{gpuMlp.cfg.d}</strong></span>
      <span>parameters <strong class="num">{gpuMlp.numParameters.toLocaleString('en-GB')}</strong></span>
      <span>step <strong class="num">{gpuMlp.step.toLocaleString('en-GB')}</strong> / {STEPS.toLocaleString('en-GB')}</span>
      <span>validation <strong class="num">{last ? `${bits(last.val).toFixed(3)} bits/char` : '—'}</strong></span>
    </div>
    <div class="speed">
      <div><span class="k">GPU</span><strong class="num">{Number.isFinite(gpuMlp.gpuMsPerStep) ? gpuMlp.gpuMsPerStep.toFixed(2) : '…'}</strong> ms/step</div>
      <div><span class="k">CPU library</span><strong class="num">{Number.isFinite(gpuMlp.cpuMsPerStep) ? gpuMlp.cpuMsPerStep.toFixed(1) : 'timing…'}</strong> ms/step</div>
      <div><span class="k">speed-up</span><strong class="num">{Number.isFinite(speedup) ? `${speedup.toFixed(0)}×` : '…'}</strong></div>
      <div><span class="k">20k steps on the CPU</span><strong class="num">{duration(cpuEta)}</strong></div>
    </div>
    <Legend
      items={[
        { label: 'Training (moving average)', color: 'var(--series-1)' },
        { label: 'Validation', color: 'var(--series-2)' },
        { label: 'Chapter 2: bigram / Kneser–Ney 6-gram', color: 'var(--ink-3)', dashed: true },
      ]}
    />
    <Plot
      label="GPU-trained MLP loss in bits per character"
      height={240}
      x={{ domain: [0, STEPS], label: 'SGD steps', ticks: 5 }}
      y={{ domain: [1.5, 6.2], label: 'bits / char', ticks: 5 }}
    >
      {#snippet marks({ sx, sy })}
        {#each [BASELINES.bigram, BASELINES.kneserNey] as b (b)}
          <line x1="0" x2={sx(STEPS)} y1={sy(b)} y2={sy(b)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {/each}
        {#if gpuMlp.history.length > 1}
          <path class="line" stroke="var(--series-1)" d={'M' + gpuMlp.history.map((h) => `${sx(h.step)},${sy(Math.min(6.2, bits(h.train)))}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + gpuMlp.history.map((h) => `${sx(h.step)},${sy(Math.min(6.2, bits(h.val)))}`).join('L')} />
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const h = gpuMlp.history.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a))}
        <div class="num">step {h.step}: train {bits(h.train).toFixed(3)} · val {bits(h.val).toFixed(3)} bits/char</div>
      {/snippet}
    </Plot>
    <div class="sample">
      <Button
        size="sm"
        disabled={sampling}
        onclick={async () => {
          sampling = true;
          sample = await gpuMlp.sample('ROMEO:\n', 240);
          sampling = false;
        }}>Sample 240 characters</Button
      >
      {#if sample}<pre class="out">ROMEO:<br />{sample}</pre>{/if}
    </div>
  {/if}
</Widget>

<style>
  .stats,
  .speed {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.3rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.5rem;
  }
  .stats strong,
  .speed strong {
    color: var(--ink);
  }
  .speed {
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    gap: 0.4rem 1.8rem;
  }
  .speed .k {
    display: block;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
  }
  .speed strong {
    font-size: 1.05rem;
  }
  .muted {
    color: var(--ink-3);
  }
  .sample {
    margin-top: 0.8rem;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    white-space: pre-wrap;
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
  }
</style>
