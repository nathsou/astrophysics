<!--
  The central experiment of the chapter: training and validation cross-entropy against n for each
  estimator. Training loss always falls with n; validation loss reveals overfitting and sparsity.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { crossEntropy } from '@lm/core';
  import { impl } from '$lib/exercise/impl.svelte';
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { charData, model, smoothingFrom, MAX_ORDER, SMOOTHING_LABELS, type CharData, type SmoothingKind } from '../shared';

  const EVAL = 8000; // characters evaluated per split (enough for stable estimates, fast in-browser)
  const KINDS: SmoothingKind[] = ['mle', 'addk', 'interp', 'kn'];
  const COLOR: Record<SmoothingKind, string> = { mle: 'var(--series-1)', addk: 'var(--series-2)', interp: 'var(--series-3)', kn: 'var(--series-4)' };

  let data = $state<CharData | null>(null);
  let show = $state<'val' | 'both'>('both');
  let results = $state<Record<SmoothingKind, { train: number; val: number }[]>>({ mle: [], addk: [], interp: [], kn: [] });
  let progress = $state(0);
  let running = $state(false);
  let token = 0;

  onMount(async () => {
    data = await charData();
  });

  const p = $derived({ k: params.get('smooth.k', 0.1), lambda: params.get('smooth.lambda', 0.8), d: params.get('smooth.d', 0.75) });
  const ceImpl = $derived(impl.get('lm.crossEntropyBits', null as null | ((prob: (ctx: number[], next: number) => number, ids: number[], contextLength: number) => number)));

  // Recompute (debounced) when the data, smoothing parameters or learner implementation change.
  $effect(() => {
    if (!data) return;
    void p.k, p.lambda, p.d, ceImpl;
    const my = ++token;
    const t = setTimeout(() => run(my), 250);
    return () => clearTimeout(t);
  });

  async function run(my: number) {
    if (!data) return;
    running = true;
    const out: typeof results = { mle: [], addk: [], interp: [], kn: [] };
    const trainIds = data.train.slice(0, EVAL + MAX_ORDER);
    const valIds = data.val.slice(0, EVAL + MAX_ORDER);
    let done = 0;
    for (const kind of KINDS) {
      for (let n = 1; n <= MAX_ORDER; n++) {
        if (my !== token) return;
        const m = model(data, n, smoothingFrom(kind, p));
        const ce = (ids: number[]) =>
          ceImpl ? ceImpl((c, x) => m.prob(c, x), ids.slice(MAX_ORDER - m.contextLength), m.contextLength) : crossEntropy(m, ids, { start: MAX_ORDER }).crossEntropy;
        out[kind].push({ train: ce(trainIds), val: ce(valIds) });
        progress = ++done / (KINDS.length * MAX_ORDER);
        await new Promise((r) => setTimeout(r, 0));
      }
      results = { ...out };
    }
    running = false;
  }

  const Y_MAX = 5;
  /** Polyline through finite values only; infinite values break the line. */
  function finitePath(vals: number[], sx: (v: number) => number, sy: (v: number) => number): string {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (!Number.isFinite(v)) return void (pen = false);
      d += `${pen ? 'L' : 'M'}${sx(i + 1)},${sy(clip(v))}`;
      pen = true;
    });
    return d;
  }
  const clip = (v: number) => Math.min(v, Y_MAX);
  const best = $derived.by(() => {
    let b = { kind: 'kn' as SmoothingKind, n: 0, v: Infinity };
    for (const k of KINDS) results[k].forEach((r, i) => r.val < b.v && (b = { kind: k, n: i + 1, v: r.val }));
    return b;
  });
</script>

<Widget
  title="Overfitting in one picture"
  subtitle="Cross-entropy (bits per character) against the order n, for each estimator. Solid lines are held-out validation text; dashed lines are text the model was trained on."
>
  {#snippet controls()}
    <Segmented label="Show" size="sm" options={[{ value: 'both', label: 'Train + validation' }, { value: 'val', label: 'Validation only' }]} bind:value={show} />
    {#if running}<span class="prog">computing… {Math.round(progress * 100)}%</span>{/if}
    {#if ceImpl}<span class="mine">using your crossEntropyBits</span>{/if}
  {/snippet}

  <Legend items={KINDS.map((k) => ({ label: SMOOTHING_LABELS[k], color: COLOR[k] }))} />
  {#if data}
    <Plot
      label="Cross-entropy against n-gram order for four smoothing methods"
      height={330}
      x={{ domain: [1, MAX_ORDER], label: 'Order n (context = n − 1 characters)', ticks: 8, format: (v) => String(v) }}
      y={{ domain: [0, Y_MAX], label: 'Cross-entropy (bits / char)', ticks: 5 }}
    >
      {#snippet marks({ sx, sy })}
        {#each KINDS as k (k)}
          {@const r = results[k]}
          {#if r.length}
            {#if show === 'both'}
              <path class="line" stroke={COLOR[k]} stroke-dasharray="5 4" opacity="0.7" d={'M' + r.map((v, i) => `${sx(i + 1)},${sy(clip(v.train))}`).join('L')} />
            {/if}
            <path class="line" stroke={COLOR[k]} d={finitePath(r.map((v) => v.val), sx, sy)} />
            {#each r as v, i (i)}
              {#if Number.isFinite(v.val)}
                <circle class="dot" cx={sx(i + 1)} cy={sy(clip(v.val))} r="4" fill={COLOR[k]} />
              {:else}
                <path d="M{sx(i + 1)},{sy(Y_MAX) + 2} l-5,9 h10 z" fill={COLOR[k]}><title>{SMOOTHING_LABELS[k]}, n = {i + 1}: infinite cross-entropy</title></path>
              {/if}
            {/each}
          {/if}
        {/each}
        {#if best.n}
          <text x={sx(best.n)} y={sy(best.v) + 22} text-anchor="middle" class="best">best {best.v.toFixed(2)}</text>
        {/if}
      {/snippet}
      {#snippet tooltip({ x })}
        {@const n = Math.round(x)}
        <div><strong>n = {n}</strong></div>
        {#each KINDS as k (k)}
          {@const v = results[k][n - 1]}
          {#if v}<div class="tt num"><i style:background={COLOR[k]}></i>{SMOOTHING_LABELS[k]}: val {Number.isFinite(v.val) ? v.val.toFixed(3) : '∞'} · train {v.train.toFixed(3)}</div>{/if}
        {/each}
      {/snippet}
    </Plot>
    <p class="foot">
      Arrows at the top mark infinite cross-entropy: the MLE gave some validation character probability 0. Evaluated on {EVAL.toLocaleString('en-GB')} characters of each split.
    </p>
  {:else}
    <p class="prog">Counting n-grams…</p>
  {/if}
</Widget>

<style>
  .prog,
  .foot {
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  .foot {
    margin: 0.5rem 0 0;
  }
  .mine {
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--good) 14%, transparent);
    padding: 0 0.5rem;
    border-radius: 99px;
  }
  .best {
    font-size: 11px;
    fill: var(--ink-2);
  }
  .tt {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
  }
  .tt i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
</style>
