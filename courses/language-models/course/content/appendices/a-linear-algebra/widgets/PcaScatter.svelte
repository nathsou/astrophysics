<!--
  PCA in two dimensions: the principal components are the eigenvectors of the covariance matrix,
  and projecting onto the first keeps as much of the variance as any single direction can.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';

  let angle = $state(30);
  let ratio = $state(0.35);
  let project = $state(false);
  const Npts = 220;

  const base = (() => {
    const rng = mulberry32(11);
    return Array.from({ length: Npts }, () => {
      const u = Math.max(rng(), 1e-12), v = rng();
      const r = Math.sqrt(-2 * Math.log(u));
      return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)] as [number, number];
    });
  })();

  const pts = $derived.by(() => {
    const t = (angle * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    return base.map(([x, y]) => {
      const a = x, b = y * ratio;
      return [c * a - s * b + 0.3, s * a + c * b - 0.2] as [number, number];
    });
  });

  const stats = $derived.by(() => {
    const mx = pts.reduce((a, p) => a + p[0], 0) / Npts, my = pts.reduce((a, p) => a + p[1], 0) / Npts;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of pts) {
      sxx += (x - mx) ** 2 / (Npts - 1);
      syy += (y - my) ** 2 / (Npts - 1);
      sxy += ((x - mx) * (y - my)) / (Npts - 1);
    }
    // Eigen-decomposition of the symmetric 2 × 2 covariance, in closed form.
    const tr = sxx + syy, det = sxx * syy - sxy * sxy;
    const r = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const l1 = tr / 2 + r, l2 = tr / 2 - r;
    let v1: [number, number] = Math.abs(sxy) > 1e-12 ? [sxy, l1 - sxx] : sxx >= syy ? [1, 0] : [0, 1];
    const n = Math.hypot(...v1);
    v1 = [v1[0] / n, v1[1] / n];
    const v2: [number, number] = [-v1[1], v1[0]];
    return { mx, my, sxx, syy, sxy, l1, l2, v1, v2 };
  });

  const R = 3.6, S = 320;
  const px = (x: number) => S / 2 + (x / R) * (S / 2);
  const py = (y: number) => S / 2 - (y / R) * (S / 2);
  const proj = (p: [number, number]): [number, number] => {
    const { mx, my, v1 } = stats;
    const t = (p[0] - mx) * v1[0] + (p[1] - my) * v1[1];
    return [mx + t * v1[0], my + t * v1[1]];
  };
  const found = $derived(((Math.atan2(stats.v1[1], stats.v1[0]) * 180) / Math.PI + 180) % 180);
</script>

<Widget
  title="Principal components are the axes of the data"
  subtitle="Rotate and flatten a cloud of points. PCA finds its axes from the covariance matrix alone; projecting onto the first axis keeps the most variance any single direction can."
  onreset={() => {
    angle = 30;
    ratio = 0.35;
    project = false;
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="rotation" min={0} max={180} step={1} value={angle} oninput={(v) => (angle = v)} format={(v) => `${v.toFixed(0)}°`} /></div>
    <div class="ctl"><Slider label="minor / major spread" min={0.02} max={1} step={0.01} value={ratio} oninput={(v) => (ratio = v)} format={(v) => v.toFixed(2)} /></div>
    <Toggle bind:checked={project} label="Project onto PC1" />
  {/snippet}

  <div class="layout">
    <svg viewBox="0 0 {S} {S}" role="img" aria-label="Scatter plot with its two principal axes; PC1 explains {((stats.l1 / (stats.l1 + stats.l2)) * 100).toFixed(0)}% of the variance">
      <line class="axis" x1="0" x2={S} y1={py(0)} y2={py(0)} />
      <line class="axis" y1="0" y2={S} x1={px(0)} x2={px(0)} />
      {#each pts as p, i (i)}
        {@const q = project ? proj(p) : p}
        {#if project}<line class="drop" x1={px(p[0])} y1={py(p[1])} x2={px(q[0])} y2={py(q[1])} />{/if}
        <circle cx={px(q[0])} cy={py(q[1])} r="2.6" class="pt" />
      {/each}
      {#each [{ v: stats.v1, l: stats.l1, c: 'var(--series-2)', n: 'PC1' }, { v: stats.v2, l: stats.l2, c: 'var(--series-3)', n: 'PC2' }] as a (a.n)}
        {@const len = 2 * Math.sqrt(a.l)}
        <line class="pc" style:stroke={a.c} x1={px(stats.mx - len * a.v[0])} y1={py(stats.my - len * a.v[1])} x2={px(stats.mx + len * a.v[0])} y2={py(stats.my + len * a.v[1])} />
        <text class="pclab" x={px(stats.mx + len * a.v[0]) + 5} y={py(stats.my + len * a.v[1]) - 5}>{a.n}</text>
      {/each}
    </svg>
    <div class="side ui">
      <p class="eq">
        Covariance Σ =
        <span class="mat num">[{stats.sxx.toFixed(2)}, {stats.sxy.toFixed(2)}; {stats.sxy.toFixed(2)}, {stats.syy.toFixed(2)}]</span>
      </p>
      <dl class="facts">
        <dt><span class="sw" style:background="var(--series-2)"></span>λ₁ (variance along PC1)</dt><dd class="num">{stats.l1.toFixed(3)}</dd>
        <dt><span class="sw" style:background="var(--series-3)"></span>λ₂ (variance along PC2)</dt><dd class="num">{stats.l2.toFixed(3)}</dd>
        <dt>PC1 explains</dt><dd class="num">{((stats.l1 / (stats.l1 + stats.l2)) * 100).toFixed(1)}% of the variance</dd>
        <dt>PC1 direction</dt><dd class="num">{found.toFixed(1)}° (you set {angle.toFixed(0)}°)</dd>
      </dl>
      <p class="note">
        The two axes are perpendicular because Σ is symmetric. Each axis extends two standard deviations (2√λ) either side of the mean. With the spreads nearly equal, PC1 is poorly determined: many directions carry almost the same variance.
      </p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    flex: 0 1 12rem;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: center;
  }
  @media (max-width: 700px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    max-width: 22rem;
    justify-self: center;
    background: var(--surface-2);
    border-radius: 8px;
  }
  .axis {
    stroke: var(--ink-3);
    stroke-width: 0.8;
  }
  .pt {
    fill: var(--series-1);
    opacity: 0.75;
  }
  .drop {
    stroke: var(--ink-3);
    stroke-width: 0.5;
  }
  .pc {
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .pclab {
    font: 700 11px var(--font-ui);
    fill: var(--ink);
  }
  .eq {
    font-size: 0.84rem;
    margin: 0 0 0.6rem;
  }
  .mat {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3rem 0.8rem;
    font-size: 0.82rem;
    margin: 0 0 0.6rem;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    margin-right: 0.35rem;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0;
  }
</style>
