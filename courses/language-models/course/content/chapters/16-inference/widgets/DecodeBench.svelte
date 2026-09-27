<!--
  Generation speed on this machine: CourseGPT decoding greedily without a cache (recomputing the whole
  context for every token), with the KV cache, and with the KV cache and int8 weights.
-->
<script lang="ts">
  import { argmax } from '@lm/core/sample';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { gpuDescription } from '$lib/gpu/device';
  import { loadCourseGpt, nextLogits, runnerFor, type CourseGpt } from '$lib/models/coursegpt';

  type Mode = 'none' | 'cache' | 'int8';
  const MODES: { key: Mode; label: string; color: string }[] = [
    { key: 'none', label: 'no cache', color: 'var(--series-2)' },
    { key: 'cache', label: 'KV cache', color: 'var(--series-1)' },
    { key: 'int8', label: 'KV cache + int8', color: 'var(--series-3)' },
  ];
  const N = 400; // with the prompt, most of the 512-token context: long enough for the uncached cost to grow
  const PROMPT = 'Once upon a time, there was a little dog named Max. Max loved to run in the park with his friend, a small cat named Kitty. One day,';

  let m = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'running' | 'done' | 'error'>('idle');
  let error = $state('');
  let progress = $state(0);
  let current = $state<Mode | null>(null);
  let results = $state<Partial<Record<Mode, { ms: number[]; prefill: number; text: string }>>>({});

  async function run() {
    status = m ? 'running' : 'loading';
    try {
      m ??= await loadCourseGpt((f) => (progress = f));
      status = 'running';
      results = {};
      for (const mode of MODES.map((x) => x.key)) {
        current = mode;
        results[mode] = await bench(mode);
      }
      status = 'done';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'error';
    }
    current = null;
  }

  async function bench(mode: Mode): Promise<{ ms: number[]; prefill: number; text: string }> {
    const model = m!;
    const ids = [model.eot, ...model.tok.encode(PROMPT)];
    const start = ids.length;
    const ms: number[] = [];
    let prefill = NaN;
    if (mode === 'none') {
      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        const z = await nextLogits(model, ids);
        ids.push(argmax(z));
        ms.push(performance.now() - t0);
      }
    } else {
      const runner = await runnerFor(model, { int8: mode === 'int8' });
      const cache = runner.cache();
      let t0 = performance.now();
      let logits = runner.forward(cache, ids);
      let z = await logits.read();
      logits.dispose();
      prefill = performance.now() - t0;
      for (let i = 0; i < N; i++) {
        t0 = performance.now();
        ids.push(argmax(z));
        logits = runner.forward(cache, [ids.at(-1)!]);
        z = await logits.read();
        logits.dispose();
        ms.push(performance.now() - t0);
      }
      cache.dispose();
    }
    return { ms, prefill, text: model.tok.decode(ids.slice(start)) };
  }

  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const yMax = $derived(Math.max(1, ...Object.values(results).flatMap((r) => r.ms.slice(2))) * 1.1);
  const same = $derived(results.none && results.cache ? results.none.text === results.cache.text : null);
  const promptTokens = $derived(m ? m.tok.encode(PROMPT).length + 1 : 0);
</script>

<Widget
  title="How fast does CourseGPT generate?"
  subtitle="Measured in your browser: {N} tokens of greedy decoding after a {promptTokens || '≈ 35'}-token prompt, three ways. Each point is one token, including the copy of its logits back to the CPU."
  kind="Benchmark"
>
  {#snippet controls()}
    <Button variant="primary" onclick={run} disabled={status === 'loading' || status === 'running'}>
      {status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : status === 'running' ? `Running: ${MODES.find((x) => x.key === current)?.label}…` : 'Run the benchmark'}
    </Button>
  {/snippet}

  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  <Legend items={MODES.map((x) => ({ label: x.label, color: x.color }))} />
  <Plot label="Milliseconds per token against position" height={230} x={{ domain: [0, N], label: 'token generated', ticks: 6 }} y={{ domain: [0, yMax], label: 'ms per token', ticks: 5 }}>
    {#snippet marks({ sx, sy })}
      {#each MODES as mode (mode.key)}
        {@const r = results[mode.key]}
        {#if r}
          {#each r.ms as v, i (i)}<circle cx={sx(i)} cy={sy(Math.min(v, yMax))} r="2" fill={mode.color} />{/each}
        {/if}
      {/each}
    {/snippet}
  </Plot>
  {#if Object.keys(results).length}
    <table class="res num ui">
      <thead><tr><th></th><th>median ms / token</th><th>tokens / s</th><th>prompt (prefill)</th></tr></thead>
      <tbody>
        {#each MODES as mode (mode.key)}
          {@const r = results[mode.key]}
          {#if r}
            <tr><td><span class="sw" style:background={mode.color}></span>{mode.label}</td><td>{median(r.ms).toFixed(1)}</td><td>{(1000 / median(r.ms)).toFixed(0)}</td><td>{Number.isFinite(r.prefill) ? `${r.prefill.toFixed(0)} ms for ${promptTokens} tokens` : '—'}</td></tr>
          {/if}
        {/each}
      </tbody>
    </table>
    <p class="muted ui">{gpuDescription()}{same !== null ? ` · cached and uncached decoding produced ${same ? 'the same' : 'different'} text` : ''}{results.int8 && results.cache ? ` · int8 ${results.int8.text === results.cache.text ? 'produced the same text too' : 'diverged from float32 after a while, as tiny rounding differences change a greedy choice'}` : ''}.</p>
  {/if}
</Widget>

<style>
  .muted {
    color: var(--ink-3);
    font-size: 0.78rem;
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
