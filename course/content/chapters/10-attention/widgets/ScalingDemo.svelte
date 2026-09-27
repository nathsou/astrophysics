<!--
  Why divide by √d: dot products of random d-dimensional vectors have standard deviation √d, so
  without scaling the softmax saturates as d grows — one weight near 1, gradients near 0.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { params } from '$lib/state/params.svelte';

  const N = 12;
  const d = $derived(Math.round(params.get('attn.dim', 64)));
  const gauss = (rng: () => number) => {
    const u = Math.max(rng(), 1e-12), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const scores = $derived.by(() => {
    const rng = mulberry32(7);
    const q = Array.from({ length: d }, () => gauss(rng));
    return Array.from({ length: N }, () => {
      let s = 0;
      for (let i = 0; i < d; i++) s += q[i]! * gauss(rng);
      return s;
    });
  });
  const soft = (xs: number[]) => {
    const m = Math.max(...xs);
    const e = xs.map((x) => Math.exp(x - m));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / z);
  };
  const raw = $derived(soft(scores));
  const scaled = $derived(soft(scores.map((s) => s / Math.sqrt(d))));
  const stats = (p: number[]) => ({
    max: Math.max(...p),
    entropy: -p.reduce((a, x) => a + (x > 0 ? x * Math.log2(x) : 0), 0),
    // Largest diagonal entry of the softmax Jacobian, y(1 − y): how much any score can still move its weight.
    grad: Math.max(...p.map((x) => x * (1 - x))),
  });
  const rs = $derived(stats(raw)), ss = $derived(stats(scaled));
  const std = $derived(Math.sqrt(scores.reduce((a, s) => a + s * s, 0) / N));
</script>

<Widget
  title="Why the scores are divided by √d"
  subtitle="Twelve random keys and a random query with independent N(0, 1) entries in d dimensions. Their dot products spread out like √d. Compare the softmax weights with and without scaling."
  onreset={() => params.set('attn.dim', 64)}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="dimension d" min={1} max={1024} step={1} log value={d} oninput={(v) => params.set('attn.dim', Math.round(v))} format={(v) => String(Math.round(v))} /></div>
  {/snippet}

  <p class="std ui num">Spread of the scores q · k: standard deviation ≈ <strong>{std.toFixed(1)}</strong> (theory: √{d} = {Math.sqrt(d).toFixed(1)})</p>
  <div class="two ui">
    {#each [{ title: 'softmax(q · k)', p: raw, s: rs }, { title: 'softmax(q · k / √d)', p: scaled, s: ss }] as panel (panel.title)}
      <div class="panel">
        <h5><code>{panel.title}</code></h5>
        <div class="bars" role="img" aria-label="Attention weights for {panel.title}">
          {#each panel.p as w, i (i)}
            <div class="col"><div class="bar" style:height="{Math.max(1, w * 100)}%" class:top={w === panel.s.max}></div></div>
          {/each}
        </div>
        <dl class="num">
          <dt>largest weight</dt><dd>{panel.s.max.toFixed(3)}</dd>
          <dt>entropy</dt><dd>{panel.s.entropy.toFixed(2)} bits (max {Math.log2(N).toFixed(2)})</dd>
          <dt>largest y(1 − y)</dt><dd>{panel.s.grad < 1e-4 ? panel.s.grad.toExponential(1) : panel.s.grad.toFixed(4)}</dd>
        </dl>
      </div>
    {/each}
  </div>
  <p class="note ui">
    Without scaling, a large d makes one score dwarf the others, and softmax puts almost all its weight there. The slope y(1 − y) of each weight with respect to its score then collapses towards zero: the attention pattern is frozen before training has taught it anything. Dividing by √d keeps the scores’ spread near 1 whatever the dimension.
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 16rem;
  }
  .std {
    font-size: 0.82rem;
    color: var(--ink-2);
    margin: 0 0 0.6rem;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
  @media (max-width: 600px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  h5 {
    margin: 0 0 0.4rem;
    font-size: 0.8rem;
  }
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 110px;
    border-bottom: 1px solid var(--axis);
  }
  .col {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
  }
  .bar {
    width: 100%;
    background: var(--series-1);
    border-radius: 3px 3px 0 0;
  }
  .bar.top {
    background: var(--series-2);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.15rem 0.8rem;
    font-size: 0.78rem;
    margin: 0.5rem 0 0;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.8rem 0 0;
  }
</style>
