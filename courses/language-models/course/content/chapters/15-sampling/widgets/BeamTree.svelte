<!--
  Beam search on CourseGPT, drawn as a tree: at each step every beam is extended by its best tokens and
  only the `width` most probable partial sequences survive. Compared with greedy decoding (width 1).
-->
<script lang="ts">
  import { beamSearch, type BeamStep } from '@lm/core/sample';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { loadCourseGpt, nextLogits, type CourseGpt } from '$lib/models/coursegpt';
  import { show } from '../data';

  let m = $state<CourseGpt | null>(null);
  let status = $state<'idle' | 'loading' | 'ready' | 'running' | 'error'>('idle');
  let error = $state('');
  let progress = $state(0);
  let prompt = $state('Once upon a time, there was a');
  let width = $state(3);
  let steps = $state(6);
  let trace = $state<BeamStep[]>([]);
  let result = $state<{ beam: string; beamLogp: number; greedy: string; greedyLogp: number } | null>(null);

  async function logprobs(ids: number[]): Promise<Float64Array> {
    const z = await nextLogits(m!, ids);
    let max = -Infinity;
    for (const v of z) max = Math.max(max, v);
    let s = 0;
    for (const v of z) s += Math.exp(v - max);
    const lse = max + Math.log(s);
    return Float64Array.from(z, (v) => v - lse);
  }

  async function run() {
    if (!m) {
      status = 'loading';
      try {
        m = await loadCourseGpt((f) => (progress = f));
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        status = 'error';
        return;
      }
    }
    status = 'running';
    const start = [m.eot, ...m.tok.encode(prompt)];
    const beam = await beamSearch(logprobs, start, { width, steps, eos: m.eot });
    const greedy = await beamSearch(logprobs, start, { width: 1, steps, eos: m.eot });
    trace = beam.trace;
    const text = (ids: number[]) => m!.tok.decode(ids.slice(start.length).filter((i) => i !== m!.eot));
    result = { beam: text(beam.best.ids), beamLogp: beam.best.logp, greedy: text(greedy.best.ids), greedyLogp: greedy.best.logp };
    status = 'ready';
  }

  const COL = 118, ROW = 34, PAD = 10;
  const tokenOf = (t: number, j: number) => {
    const tok = trace[t]!.tokens[j]!;
    return tok < 0 ? '·' : tok === m?.eot ? '⟨end⟩' : show(m!.tok.decode([tok]));
  };
  const bestRow = $derived.by(() => {
    if (!trace.length) return [] as number[];
    // Follow the best final beam back to the start.
    const last = trace.length - 1;
    const rows: number[] = new Array<number>(trace.length);
    rows[last] = 0;
    for (let t = last; t > 0; t--) rows[t - 1] = trace[t]!.parents[rows[t]!]!;
    return rows;
  });
</script>

<Widget
  title="Beam search, step by step"
  subtitle="Each column is one step. Every surviving beam is extended by its most probable tokens, and only the best `width` partial sequences (by total log-probability) are kept. The highlighted path is the winner."
  onreset={() => {
    width = 3;
    steps = 6;
  }}
>
  {#snippet controls()}
    <Button variant="primary" onclick={run} disabled={status === 'loading' || status === 'running'}>
      {status === 'loading' ? `Loading… ${(progress * 100).toFixed(0)}%` : status === 'running' ? 'Searching…' : m ? 'Search' : 'Load CourseGPT and search'}
    </Button>
    <div class="sl"><Slider label="Beam width" min={1} max={6} step={1} value={width} oninput={(v) => (width = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
    <div class="sl"><Slider label="Steps" min={2} max={10} step={1} value={steps} oninput={(v) => (steps = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <input class="prompt" bind:value={prompt} spellcheck="false" aria-label="Prompt" />
  {#if status === 'error'}<p class="muted">{error}</p>{/if}
  {#if trace.length}
    <div class="scroll">
      <svg width={PAD * 2 + COL * trace.length} height={PAD * 2 + ROW * width} role="img" aria-label="Beam search tree">
        {#each trace as step, t (t)}
          {#each step.beams as b, j (j)}
            {@const x = PAD + t * COL}
            {@const y = PAD + j * ROW}
            {#if t > 0}
              <line x1={x - 16} y1={PAD + step.parents[j]! * ROW + ROW / 2 - 4} x2={x} y2={y + ROW / 2 - 4} class="edge" class:best={bestRow[t] === j && bestRow[t - 1] === step.parents[j]} />
            {/if}
            <g class="node" class:best={bestRow[t] === j}>
              <rect {x} {y} width={COL - 16} height={ROW - 8} rx="4" />
              <text x={x + 6} y={y + 12}>{tokenOf(t, j).slice(0, 12)}</text>
              <text x={x + 6} y={y + 23} class="lp">{b.logp.toFixed(2)}</text>
            </g>
          {/each}
        {/each}
      </svg>
    </div>
  {/if}
  {#if result}
    <div class="res">
      <div><span class="k">beam search (width {width})</span><span class="v">{prompt}<strong>{result.beam}</strong></span><span class="lpv num">log P = {result.beamLogp.toFixed(2)}</span></div>
      <div><span class="k">greedy</span><span class="v">{prompt}<strong>{result.greedy}</strong></span><span class="lpv num">log P = {result.greedyLogp.toFixed(2)}</span></div>
    </div>
  {/if}
</Widget>

<style>
  .sl {
    flex: 0 1 10rem;
  }
  .muted {
    color: var(--ink-3);
    font-size: 0.8rem;
  }
  .prompt {
    width: 100%;
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--rule-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    margin-bottom: 0.6rem;
  }
  .scroll {
    overflow-x: auto;
  }
  svg {
    display: block;
  }
  .edge {
    stroke: var(--rule-strong);
    stroke-width: 1.2;
  }
  .edge.best {
    stroke: var(--series-1);
    stroke-width: 2.5;
  }
  .node rect {
    fill: var(--surface);
    stroke: var(--border);
  }
  .node.best rect {
    fill: var(--accent-soft);
    stroke: var(--series-1);
  }
  .node text {
    font-family: var(--font-mono);
    font-size: 11px;
    fill: var(--ink);
  }
  .node text.lp {
    font-size: 9.5px;
    fill: var(--ink-3);
  }
  .res {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.7rem;
    font-size: 0.85rem;
  }
  .res > div {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr) 7rem;
    gap: 0.6rem;
    align-items: baseline;
  }
  .k {
    font-size: 0.75rem;
    color: var(--ink-2);
  }
  .lpv {
    font-size: 0.75rem;
    color: var(--ink-2);
    text-align: right;
  }
</style>
