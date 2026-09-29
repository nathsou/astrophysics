<script lang="ts">
  import * as T from '@lm/core/text';
  import { impl } from '$lib/exercise/impl.svelte';
  import { params, focus } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { shakespeare, ALPHABET27 } from '../corpus-stats';

  type Dist = { labels: string[]; p: number[] };
  const norm = (xs: number[]) => {
    const s = xs.reduce((a, b) => a + b, 0);
    return xs.map((x) => x / s);
  };
  const PRESETS: Record<string, () => Promise<Dist> | Dist> = {
    'Fair coin': () => ({ labels: ['H', 'T'], p: [0.5, 0.5] }),
    'Biased coin': () => ({ labels: ['H', 'T'], p: [0.9, 0.1] }),
    'Fair die': () => ({ labels: ['1', '2', '3', '4', '5', '6'], p: Array(6).fill(1 / 6) }),
    'Loaded die': () => ({ labels: ['1', '2', '3', '4', '5', '6'], p: norm([1, 1, 1, 1, 1, 5]) }),
    'English letters': async () => {
      const s = await shakespeare();
      return { labels: [...ALPHABET27].map((c) => (c === ' ' ? '␣' : c)), p: norm([...s.counts27]) };
    },
    'Certain': () => ({ labels: ['a', 'b', 'c', 'd'], p: [1, 0, 0, 0] }),
  };

  let preset = $state('Loaded die');
  let dist = $state<Dist>({ labels: ['1', '2', '3', '4', '5', '6'], p: norm([1, 1, 1, 1, 1, 5]) });
  let dragging = $state<number | null>(null);
  let hover = $state<number | null>(null);
  let chart = $state<SVGSVGElement | undefined>();

  async function choose(name: string) {
    preset = name;
    dist = await PRESETS[name]!();
  }

  const b = $derived(params.get('entropy.b', 2));
  const unitName = $derived(Math.abs(b - 2) < 0.02 ? 'bits' : Math.abs(b - Math.E) < 0.02 ? 'nats' : Math.abs(b - 10) < 0.02 ? 'hartleys' : `base-${b.toFixed(2)} units`);
  const entropyFn = $derived(impl.get('text.entropy', T.entropy));
  const H = $derived.by(() => {
    try {
      return entropyFn(dist.p, b);
    } catch {
      return NaN;
    }
  });
  const Hmax = $derived(Math.log(dist.p.length) / Math.log(b));
  const surprisal = (p: number) => (p > 0 ? -Math.log(p) / Math.log(b) : Infinity);

  // Chart geometry.
  let W = $state(640);
  const Hh = 190, pad = 28;
  const k = $derived(dist.p.length);
  const colW = $derived((W - pad) / k);
  const barW = $derived(Math.min(24, colW * 0.7));
  const maxP = $derived(Math.max(0.25, ...dist.p) * 1.05);
  const y = (p: number) => Hh - (p / maxP) * (Hh - 12);

  function setFromPointer(e: PointerEvent, i: number) {
    if (!chart) return;
    const r = chart.getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * (Hh + 70);
    const v = Math.min(0.999, Math.max(0.001, ((Hh - py) / (Hh - 12)) * maxP));
    const others = dist.p.reduce((a, x, j) => (j === i ? a : a + x), 0);
    dist.p = dist.p.map((x, j) => (j === i ? v : others > 0 ? (x / others) * (1 - v) : (1 - v) / (k - 1)));
    preset = 'Custom';
  }
</script>

<svelte:window onpointerup={() => (dragging = null)} />

<Widget
  title="Entropy: how surprised should you expect to be?"
  subtitle="Drag the bars to reshape the distribution. Each outcome’s surprisal is −log p; entropy is the probability-weighted average surprisal."
  onreset={() => choose('Loaded die')}
>
  {#snippet controls()}
    <div class="presets" role="group" aria-label="Distributions">
      {#each Object.keys(PRESETS) as name (name)}<button class="chip" class:on={preset === name} onclick={() => choose(name)}>{name}</button>{/each}
    </div>
    <div class="seg" role="radiogroup" aria-label="Logarithm base">
      {#each [{ v: 2, l: 'bits (b = 2)' }, { v: Math.E, l: 'nats (b = e)' }, { v: 10, l: 'hartleys (b = 10)' }] as o (o.l)}
        <button role="radio" aria-checked={Math.abs(b - o.v) < 0.02} class:on={Math.abs(b - o.v) < 0.02} onclick={() => params.set('entropy.b', o.v)}>{o.l}</button>
      {/each}
    </div>
  {/snippet}

  <div class="readout">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="big" onpointerenter={() => focus.set('H', 'entropy')} onpointerleave={() => focus.set(null)}>
      <span class="k">Entropy H</span>
      <span class="v num">{Number.isFinite(H) ? H.toFixed(3) : '—'}</span>
      <span class="u">{unitName}</span>
    </div>
    <div class="small">
      <div><span class="k">Maximum (uniform over {k})</span> <span class="num">{Hmax.toFixed(3)}</span></div>
      <div><span class="k">Effective number of outcomes b<sup>H</sup></span> <span class="num">{(b ** H).toFixed(2)}</span></div>
      {#if impl.isMine('text.entropy')}<div class="mine">computed by your entropy()</div>{/if}
    </div>
  </div>

  <div bind:clientWidth={W}>
  <svg bind:this={chart} width={W} height={Hh + 70} viewBox="0 0 {W} {Hh + 70}" class="chart" role="img" aria-label="Probability distribution; drag bars to edit">
    <line x1={pad} x2={W} y1={Hh} y2={Hh} class="base" />
    {#each [0.25, 0.5, 0.75, 1].filter((t) => t <= maxP) as t (t)}
      <line x1={pad} x2={W} y1={y(t)} y2={y(t)} class="grid" />
      <text x={pad - 6} y={y(t)} dy="0.32em" text-anchor="end" class="tick">{t}</text>
    {/each}
    {#each dist.p as p, i (i)}
      {@const cx = pad + colW * (i + 0.5)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="col"
        class:hl={hover === i}
        onpointerdown={(e) => {
          dragging = i;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          setFromPointer(e, i);
        }}
        onpointermove={(e) => dragging === i && setFromPointer(e, i)}
        onpointerenter={() => ((hover = i), focus.set('p', 'entropy'))}
        onpointerleave={() => ((hover = null), focus.set(null))}
      >
        <rect x={cx - colW / 2} y="0" width={colW} height={Hh + 70} class="hit" />
        <path class="bar" d="M{cx - barW / 2},{Hh} V{Math.min(Hh, y(p) + 4)} q0,-4 4,-4 h{barW - 8} q4,0 4,4 V{Hh} Z" />
        <text x={cx} y={Hh + 16} text-anchor="middle" class="lab">{dist.labels[i]}</text>
        {#if k <= 12 || hover === i}
          <text x={cx} y={Math.min(y(p) - 6, Hh - 6)} text-anchor="middle" class="val">{(p * 100).toFixed(p < 0.1 ? 1 : 0)}%</text>
        {/if}
        <text x={cx} y={Hh + 34} text-anchor="middle" class="sur">{k <= 12 || hover === i ? (Number.isFinite(surprisal(p)) ? surprisal(p).toFixed(2) : '∞') : ''}</text>
        <rect x={cx - barW / 2} y={Hh + 44} width={barW} height={Math.max(0.5, (p > 0 ? p * surprisal(p) : 0) / Math.max(Hmax, 0.001) * 22)} rx="2" class="contrib" />
      </g>
    {/each}
    <text x="2" y={Hh + 34} class="rowlab">−log p</text>
    <text x="2" y={Hh + 58} class="rowlab">p·(−log p)</text>
  </svg>
  </div>
</Widget>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border-control);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent-2);
    color: var(--accent-ink);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border-control);
    border-radius: 7px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: var(--surface);
    padding: 0.3rem 0.65rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--ink-2);
  }
  .seg button + button {
    border-left: 1px solid var(--border);
  }
  .seg button.on {
    background: var(--accent-soft);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem 2.5rem;
    margin-bottom: 0.5rem;
  }
  .big {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    cursor: help;
  }
  .big .v {
    font-size: 2.4rem;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  .k {
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .u {
    color: var(--ink-2);
  }
  .small {
    font-size: 0.82rem;
    display: grid;
    gap: 0.15rem;
  }
  .mine {
    font-size: 0.75rem;
    color: var(--ink);
    background: color-mix(in srgb, var(--good) 14%, transparent);
    padding: 0 0.5rem;
    border-radius: 99px;
    justify-self: start;
  }
  .chart {
    display: block;
    touch-action: none;
    user-select: none;
  }
  .base {
    stroke: var(--axis);
  }
  .grid {
    stroke: var(--grid);
  }
  .tick,
  .rowlab {
    font-size: 10px;
    fill: var(--ink-3);
  }
  .hit {
    fill: transparent;
    cursor: ns-resize;
  }
  .bar {
    fill: var(--series-1);
    pointer-events: none;
  }
  .col.hl .hit {
    fill: var(--surface-2);
  }
  .lab {
    font-size: 12px;
    fill: var(--ink);
    font-family: var(--font-mono);
  }
  .val {
    font-size: 10px;
    fill: var(--ink-2);
  }
  .sur {
    font-size: 10px;
    fill: var(--ink-2);
    font-family: var(--font-mono);
  }
  .contrib {
    fill: var(--series-2);
  }
</style>
