<!--
  A fitted scaling law L(N, D) = E + A/N^α + B/D^β at work: for a compute budget C = 6ND, the loss
  along the IsoFLOP curve at C/10, C and 10C, and how the optimal model size and data grow with C.
  Uses the learner's allocate() once their exercise passes.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';
  import { impl } from '$lib/exercise/impl.svelte';
  import { DATA, PUBLISHED, lawLoss, pow10, si, type Law } from '../data';

  function reference(C: number, l: Law) {
    const G = ((l.alpha * l.A) / (l.beta * l.B)) ** (1 / (l.alpha + l.beta));
    const N = G * (C / 6) ** (l.beta / (l.alpha + l.beta));
    const D = C / (6 * N);
    return { N, D, loss: lawLoss(l, N, D) };
  }
  const laws = $derived({
    ...PUBLISHED,
    ...(DATA.fit ? { ours: { label: 'Ours: TinyStories sweep', law: DATA.fit.law, unit: 'bits / token' } } : {}),
  } as Record<string, { label: string; law: Law; unit: string }>);
  let which = $state('chinchilla');
  let logC = $state(23);
  const allocate = $derived(impl.get('scaling.allocate', reference));
  const mine = $derived(impl.isMine('scaling.allocate'));
  const L = $derived(laws[which]!.law);
  const C = $derived(10 ** logC);
  const opt = $derived.by(() => {
    try {
      return allocate(C, L);
    } catch {
      return reference(C, L);
    }
  });
  const budgets = $derived([C / 10, C, C * 10]);
  const nRange = $derived([opt.N / 300, opt.N * 300] as [number, number]);
  const curves = $derived(
    budgets.map((c) => Array.from({ length: 80 }, (_, i) => nRange[0] * (nRange[1] / nRange[0]) ** (i / 79)).map((n) => [n, lawLoss(L, n, c / (6 * n))] as const)),
  );
  const yLo = $derived(L.E * 0.98);
  const yHi = $derived(Math.min(L.E * 3, Math.max(...curves[0]!.map((p) => p[1])) * 1.02));
  const cs = Array.from({ length: 61 }, (_, i) => 10 ** (13 + i * 0.2));
  const frontier = $derived(cs.map((c) => ({ c, ...reference(c, L) })));
</script>

<Widget
  title="Spending a compute budget"
  subtitle="A fitted law L(N, D) = E + A/N^α + B/D^β. Left: the loss of every way to split a budget C = 6ND between parameters N and tokens D, for three budgets. Right: the best split as the budget grows."
  onreset={() => {
    which = 'chinchilla';
    logC = 23;
  }}
>
  {#snippet controls()}
    <Segmented label="Law" size="sm" options={Object.entries(laws).map(([value, x]) => ({ value, label: x.label }))} bind:value={which} />
    <div class="sl"><Slider label="Compute C (FLOPs)" min={13} max={25} step={0.1} value={logC} oninput={(v) => (logC = v)} format={(v) => `10^${v.toFixed(1)}`} /></div>
  {/snippet}

  {#if mine}<p class="mine ui">Using your allocate().</p>{/if}
  <div class="two">
    <div>
      <Legend items={[{ label: 'C / 10', color: 'var(--series-3)' }, { label: 'C', color: 'var(--series-1)' }, { label: '10 C', color: 'var(--series-2)' }]} />
      <Plot label="Loss along IsoFLOP curves" height={240} x={{ type: 'log', domain: nRange, label: 'parameters N' }} y={{ domain: [yLo, yHi], label: `loss (${laws[which]!.unit})`, ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          {#each curves as curve, i (i)}
            {@const o = reference(budgets[i]!, L)}
            <path class="line" stroke="var(--series-{[3, 1, 2][i]})" d={'M' + curve.map(([n, l]) => `${sx(n)},${sy(Math.min(yHi, l))}`).join('L')} />
            {#if o.N > nRange[0] && o.N < nRange[1]}<circle cx={sx(o.N)} cy={sy(o.loss)} r="4" fill="var(--series-{[3, 1, 2][i]})" />{/if}
          {/each}
          <line x1={0} x2={sx(nRange[1])} y1={sy(L.E)} y2={sy(L.E)} stroke="var(--ink-3)" stroke-dasharray="4 4" />
        {/snippet}
      </Plot>
    </div>
    <div>
      <Legend items={[{ label: 'optimal N', color: 'var(--series-1)' }, { label: 'optimal D (tokens)', color: 'var(--series-2)' }]} />
      <Plot label="Optimal parameters and tokens against compute" height={240} x={{ type: 'log', domain: [1e13, 1e25], label: 'compute (FLOPs)', tickValues: [1e13, 1e16, 1e19, 1e22, 1e25], format: pow10 }} y={{ type: 'log', domain: [1e4, 1e14], label: 'count', tickValues: [1e4, 1e6, 1e8, 1e10, 1e12, 1e14], format: pow10 }}>
        {#snippet marks({ sx, sy })}
          <path class="line" stroke="var(--series-1)" d={'M' + frontier.map((f) => `${sx(f.c)},${sy(f.N)}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + frontier.map((f) => `${sx(f.c)},${sy(f.D)}`).join('L')} />
          <line x1={sx(C)} x2={sx(C)} y1={0} y2={sy(1e4)} stroke="var(--ink-3)" stroke-dasharray="3 3" />
        {/snippet}
      </Plot>
    </div>
  </div>
  <div class="stats ui">
    <span>optimal N <strong class="num">{si(opt.N)}</strong></span>
    <span>optimal D <strong class="num">{si(opt.D)}</strong> tokens</span>
    <span><strong class="num">{(opt.D / opt.N).toFixed(0)}</strong> tokens per parameter</span>
    <span>predicted loss <strong class="num">{opt.loss.toFixed(3)}</strong> {laws[which]!.unit}</span>
    <span>N ∝ C^<strong class="num">{(L.beta / (L.alpha + L.beta)).toFixed(2)}</strong>, D ∝ C^<strong class="num">{(L.alpha / (L.alpha + L.beta)).toFixed(2)}</strong></span>
  </div>
</Widget>

<style>
  .sl {
    flex: 1 1 14rem;
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
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.3rem;
    font-size: 0.8rem;
    color: var(--ink-2);
    margin-top: 0.6rem;
  }
  .stats strong {
    color: var(--ink);
  }
</style>
