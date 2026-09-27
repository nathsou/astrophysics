<!--
  The whole training loop, instrumented: loss, learning rate and gradient norm; throughput and
  utilisation; checkpoints you can save, restore and download; and samples at any point.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { GptTrainer } from '$lib/train/gpt.svelte';
  import { run, PRESETS, type Preset } from '../dashboard.svelte';

  let preset = $state<Preset>('quick');
  let subset = $state(0);
  let checkpoints = $state<{ name: string; step: number; savedAt: number; val: number }[]>([]);
  let sample = $state('');
  let busy = $state('');
  let message = $state('');

  const refresh = async () => (checkpoints = await GptTrainer.checkpoints());
  onMount(() => {
    void run.load();
    void refresh();
    return () => run.pause();
  });

  async function choose(p: Preset, chars = subset) {
    preset = p;
    subset = chars;
    await run.configure({ ...PRESETS[p].cfg, trainChars: chars });
  }
  async function save() {
    busy = 'Saving…';
    await run.save(`${PRESETS[preset].label}${subset ? ` (${subset / 1000}k chars)` : ''} @ ${run.step}`);
    await refresh();
    busy = '';
  }
  async function upload(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = 'Loading…';
    try {
      message = await run.importSafetensors(new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    busy = '';
  }
  async function download() {
    busy = 'Exporting…';
    const bytes = await run.exportSafetensors();
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `char-gpt-step${run.step}.safetensors`;
    a.click();
    URL.revokeObjectURL(url);
    busy = '';
  }
  const bits = (n: number) => n / Math.LN2;
  const last = $derived(run.history.at(-1));
  const best = $derived(run.history.length > 1 ? Math.min(...run.history.slice(1).map((h) => h.val)) : NaN);
  const lrMax = $derived(run.cfg.lr);
</script>

<Widget
  title="Training dashboard"
  subtitle="A character-level GPT trained on your GPU, with everything this chapter describes on show. Checkpoints are stored in this browser; the download is a safetensors file that PyTorch can load."
>
  {#snippet controls()}
    <Button variant="primary" onclick={() => (run.running ? run.pause() : run.start())} disabled={run.status !== 'ready' || run.step >= run.cfg.steps}>
      {run.running ? 'Pause' : run.step ? (run.step >= run.cfg.steps ? 'Done' : 'Resume') : 'Train'}
    </Button>
    <Segmented label="Model" size="sm" options={(Object.keys(PRESETS) as Preset[]).map((k) => ({ value: k, label: PRESETS[k].label }))} value={preset} onchange={(v) => choose(v)} />
    <Segmented label="Training data" size="sm" options={[{ value: 0, label: 'All 1M chars' }, { value: 100_000, label: '100k' }, { value: 10_000, label: '10k' }]} value={subset} onchange={(v) => choose(preset, v)} />
  {/snippet}

  {#if run.status === 'unsupported'}
    <p class="muted">This dashboard needs WebGPU. The PyTorch lab below runs the same training loop.</p>
  {:else if run.status !== 'ready'}
    <p class="muted">Loading data, measuring your GPU and compiling kernels…</p>
  {:else}
    <div class="stats">
      <div><span class="k">step</span><strong class="num">{run.step.toLocaleString('en-GB')}</strong> / {run.cfg.steps.toLocaleString('en-GB')}</div>
      <div><span class="k">parameters</span><strong class="num">{run.numParameters.toLocaleString('en-GB')}</strong></div>
      <div><span class="k">speed</span><strong class="num">{Number.isFinite(run.tokensPerSec) ? `${Math.round(run.tokensPerSec / 1000)}k` : '…'}</strong> tokens/s</div>
      <div><span class="k">utilisation</span><strong class="num">{Number.isFinite(run.utilisation) ? `${(run.utilisation * 100).toFixed(0)}%` : '…'}</strong> of best matmul</div>
      <div><span class="k">validation</span><strong class="num">{last ? bits(last.val).toFixed(3) : '—'}</strong> bits/char{Number.isFinite(best) ? ` (best ${bits(best).toFixed(3)})` : ''}</div>
    </div>
    <div class="charts">
      <div class="main">
        <Legend items={[{ label: 'Training (moving average)', color: 'var(--series-1)' }, { label: 'Validation', color: 'var(--series-2)' }, { label: 'Kneser–Ney 2.22', color: 'var(--ink-3)', dashed: true }]} />
        <Plot label="Training and validation loss" height={230} x={{ domain: [0, run.cfg.steps], label: 'step', ticks: 5 }} y={{ domain: [1.2, 4.5], label: 'bits / char', ticks: 5 }}>
          {#snippet marks({ sx, sy })}
            <line x1="0" x2={sx(run.cfg.steps)} y1={sy(2.22)} y2={sy(2.22)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
            {#if run.history.length > 1}
              <path class="line" stroke="var(--series-1)" d={'M' + run.history.slice(1).map((h) => `${sx(h.step)},${sy(Math.min(4.5, bits(h.train)))}`).join('L')} />
              <path class="line" stroke="var(--series-2)" d={'M' + run.history.slice(1).map((h) => `${sx(h.step)},${sy(Math.min(4.5, bits(h.val)))}`).join('L')} />
            {/if}
          {/snippet}
          {#snippet tooltip({ x })}
            {@const h = run.history.reduce((a, b) => (Math.abs(b.step - x) < Math.abs(a.step - x) ? b : a))}
            <div class="num">step {h.step}: train {bits(h.train).toFixed(3)} · val {bits(h.val).toFixed(3)}</div>
          {/snippet}
        </Plot>
      </div>
      <div class="side">
        <h5>Learning rate</h5>
        <Plot label="Learning rate schedule" height={100} margin={{ top: 6, right: 8, bottom: 22, left: 48 }} crosshair={false} x={{ domain: [0, run.cfg.steps], ticks: 3 }} y={{ domain: [0, lrMax * 1.05], ticks: 2, format: (v) => v.toExponential(0) }}>
          {#snippet marks({ sx, sy })}
            <path class="line" stroke="var(--series-3)" d={'M' + Array.from({ length: 101 }, (_, i) => (i * run.cfg.steps) / 100).map((s) => `${sx(s)},${sy(run.lrAt(s))}`).join('L')} />
            <line x1={sx(run.step)} x2={sx(run.step)} y1={sy(0)} y2={sy(lrMax)} stroke="var(--ink-2)" stroke-dasharray="2 2" />
          {/snippet}
        </Plot>
        <h5>Gradient norm (before clipping at {run.cfg.clip})</h5>
        <Plot label="Gradient norm" height={100} margin={{ top: 6, right: 8, bottom: 22, left: 48 }} crosshair={false} x={{ domain: [0, run.cfg.steps], ticks: 3 }} y={{ type: 'log', domain: [0.05, 20], tickValues: [0.1, 1, 10] }}>
          {#snippet marks({ sx, sy })}
            <line x1="0" x2={sx(run.cfg.steps)} y1={sy(run.cfg.clip)} y2={sy(run.cfg.clip)} stroke="var(--ink-3)" stroke-dasharray="3 3" />
            {#if run.gradNorms.length > 1}
              <path class="line thin" stroke="var(--series-4)" d={'M' + run.gradNorms.map((g) => `${sx(g.step)},${sy(Math.min(20, Math.max(0.05, g.norm)))}`).join('L')} />
            {/if}
          {/snippet}
        </Plot>
      </div>
    </div>

    <div class="actions ui">
      <Button size="sm" onclick={save} disabled={!!busy || run.running}>Save checkpoint</Button>
      <Button size="sm" onclick={download} disabled={!!busy || run.running}>Download .safetensors</Button>
      <label class="file">Load .safetensors<input type="file" accept=".safetensors" onchange={upload} disabled={!!busy || run.running} /></label>
      <Button size="sm" onclick={async () => (sample = await run.sample('ROMEO:\n', 300))} disabled={!!busy}>Sample 300 characters</Button>
      {#if busy}<span class="busy">{busy}</span>{:else if message}<span class="busy">{message}</span>{/if}
    </div>
    {#if checkpoints.length}
      <table class="ckpts num ui">
        <thead><tr><th>checkpoint</th><th>saved</th><th>validation</th><th></th></tr></thead>
        <tbody>
          {#each checkpoints as c (c.name)}
            <tr>
              <td>{c.name}</td>
              <td>{new Date(c.savedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>{Number.isFinite(c.val) ? `${bits(c.val).toFixed(3)} bits` : '—'}</td>
              <td class="right">
                <button class="link" onclick={() => run.restore(c.name)}>restore</button>
                <button class="link" onclick={async () => (await GptTrainer.deleteCheckpoint(c.name), refresh())}>delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if sample}<pre class="out">ROMEO:<br />{sample}</pre>{/if}
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.6rem;
    background: var(--surface-2);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-bottom: 0.8rem;
  }
  .stats .k {
    display: block;
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-3);
  }
  .stats strong {
    color: var(--ink);
    font-size: 1rem;
  }
  .charts {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    gap: 1rem;
  }
  @media (max-width: 760px) {
    .charts {
      grid-template-columns: 1fr;
    }
  }
  h5 {
    margin: 0.2rem 0 0.1rem;
    font-size: 0.72rem;
    color: var(--ink-2);
    font-weight: 600;
  }
  :global(.line.thin) {
    stroke-width: 1.2 !important;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.8rem;
  }
  .file {
    font-size: 0.76rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
    background: var(--surface);
    color: var(--ink);
  }
  .file input {
    display: none;
  }
  .busy {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .ckpts {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 0.6rem;
  }
  .ckpts th {
    text-align: left;
    color: var(--ink-2);
    font-weight: 600;
  }
  .ckpts td {
    border-top: 1px solid var(--rule);
    padding: 0.2rem 0.3rem;
  }
  .right {
    text-align: right;
  }
  .link {
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    padding: 0 0.3rem;
  }
  .out {
    margin: 0.6rem 0 0;
    font-size: 0.8rem;
    white-space: pre-wrap;
    background: var(--surface-2);
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
  }
</style>
