<!--
  Gradient descent on two-parameter loss surfaces, drawn with the GPU heatmap. Click to choose the
  starting point; the learning rate is shared with the update equation above.
-->
<script lang="ts">
  import { mulberry32 } from '@lm/core';
  import { params } from '$lib/state/params.svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Heatmap from '$lib/gfx/Heatmap.svelte';

  type Fn = { label: string; f: (x: number, y: number) => number; g: (x: number, y: number) => [number, number]; x: [number, number]; y: [number, number]; start: [number, number]; lr: number; note: string };
  let kappa = $state(10);
  const FNS: Record<string, () => Fn> = {
    bowl: () => ({
      label: 'Ill-conditioned bowl',
      f: (x, y) => 0.5 * (kappa * x * x + y * y),
      g: (x, y) => [kappa * x, y],
      x: [-2, 2],
      y: [-2, 2],
      start: [-1.6, 1.8],
      lr: 0.15,
      note: 'The steepest direction is not towards the minimum. With curvature κ times larger along x than y, any learning rate stable for x (η < 2/κ) crawls along y.',
    }),
    rosenbrock: () => ({
      label: 'Rosenbrock valley',
      f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
      g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
      x: [-2, 2],
      y: [-1, 3],
      start: [-1.5, 2.2],
      lr: 0.001,
      note: 'A curved, narrow valley: finding it is easy, following it to the minimum at (1, 1) is slow. A classic test for optimisers since 1960.',
    }),
    twoMinima: () => ({
      label: 'Two valleys',
      f: (x, y) => -1.5 * Math.exp(-((x - 1) ** 2 + (y - 1) ** 2) / 0.5) - Math.exp(-((x + 1) ** 2 + (y + 0.5) ** 2) / 0.3) + 0.1 * (x * x + y * y),
      g: (x, y) => {
        const a = Math.exp(-((x - 1) ** 2 + (y - 1) ** 2) / 0.5), b = Math.exp(-((x + 1) ** 2 + (y + 0.5) ** 2) / 0.3);
        return [1.5 * a * (2 * (x - 1)) / 0.5 + b * (2 * (x + 1)) / 0.3 + 0.2 * x, 1.5 * a * (2 * (y - 1)) / 0.5 + b * (2 * (y + 0.5)) / 0.3 + 0.2 * y];
      },
      x: [-2.5, 2.5],
      y: [-2.5, 2.5],
      start: [-0.2, -1.8],
      lr: 0.1,
      note: 'Non-convex: where you start decides which minimum you reach. Neural network losses are non-convex, yet in very high dimensions most local minima turn out to be nearly as good as each other.',
    }),
  };

  let which = $state<keyof typeof FNS>('bowl');
  const fn = $derived(FNS[which]!());
  const lr = $derived(params.get('gd.lr', 0.15));
  let noisy = $state(false);
  let start = $state<[number, number]>([-1.6, 1.8]);
  let path = $state<[number, number][]>([]);
  let running = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  const R = 160;
  const grid = $derived.by(() => {
    const vals = new Float32Array(R * R);
    let lo = Infinity;
    for (let r = 0; r < R; r++)
      for (let c = 0; c < R; c++) {
        const x = fn.x[0] + ((c + 0.5) / R) * (fn.x[1] - fn.x[0]);
        const y = fn.y[1] - ((r + 0.5) / R) * (fn.y[1] - fn.y[0]);
        const v = fn.f(x, y);
        vals[r * R + c] = v;
        lo = Math.min(lo, v);
      }
    for (let i = 0; i < vals.length; i++) vals[i] = vals[i]! - lo + 1e-3; // shift positive for a log colour scale
    return vals;
  });

  function choose(k: keyof typeof FNS) {
    which = k;
    const f = FNS[k]!();
    params.set('gd.lr', f.lr);
    start = f.start;
  }

  function run() {
    clearInterval(timer);
    const rng = mulberry32(7);
    let p: [number, number] = [...start];
    path = [p];
    running = true;
    let i = 0;
    timer = setInterval(() => {
      for (let k = 0; k < 3; k++) {
        let [gx, gy] = fn.g(p[0], p[1]);
        if (noisy) {
          // Mimic a minibatch gradient: the true gradient plus zero-mean noise.
          const s = 0.3 * (1 + Math.hypot(gx, gy) * 0.3);
          gx += s * (rng() + rng() - 1) * 1.7;
          gy += s * (rng() + rng() - 1) * 1.7;
        }
        p = [p[0] - lr * gx, p[1] - lr * gy];
        path = [...path, p];
        i++;
        if (!Number.isFinite(p[0]) || Math.abs(p[0]) > 1e6 || i >= 300) {
          clearInterval(timer);
          running = false;
          return;
        }
      }
    }, 30);
  }

  // Restart whenever the surface, learning rate, noise or starting point changes.
  $effect(() => {
    void [fn, lr, noisy, start];
    run();
    return () => clearInterval(timer);
  });

  const last = $derived(path.at(-1) ?? start);
  const diverged = $derived(!Number.isFinite(last[0]) || Math.abs(last[0]) > 1e3 || Math.abs(last[1]) > 1e3);
  const toPx = (p: [number, number], w: number, h: number) => [((p[0] - fn.x[0]) / (fn.x[1] - fn.x[0])) * w, ((fn.y[1] - p[1]) / (fn.y[1] - fn.y[0])) * h] as const;
  const clampPath = (w: number, h: number) =>
    path
      .filter((p) => Number.isFinite(p[0]) && Math.abs(p[0]) < 50 && Math.abs(p[1]) < 50)
      .map((p) => toPx(p, w, h).join(','))
      .join(' ');
</script>

<Widget
  title="Gradient descent on a loss surface"
  subtitle="Colour is the loss (log scale). Click anywhere to start there. Change the learning rate η with the slider under the update equation, or here."
  onreset={() => choose(which)}
>
  {#snippet controls()}
    <Segmented
      label="Surface"
      size="sm"
      options={[
        { value: 'bowl', label: 'Ill-conditioned bowl' },
        { value: 'rosenbrock', label: 'Rosenbrock' },
        { value: 'twoMinima', label: 'Two valleys' },
      ]}
      value={which}
      onchange={(v) => choose(v)}
    />
    <div class="ctl"><Slider label="learning rate η" min={0.0001} max={2} step={0.0001} log value={lr} oninput={(v) => params.set('gd.lr', v)} format={(v) => (v < 0.01 ? v.toExponential(1) : v.toFixed(3))} /></div>
    {#if which === 'bowl'}<div class="ctl"><Slider label="condition number κ" min={1} max={40} step={1} bind:value={kappa} format={(v) => String(v)} /></div>{/if}
    <Toggle bind:checked={noisy} label="Noisy (minibatch) gradients" />
    <Button variant="primary" onclick={run}>Run again</Button>
  {/snippet}

  <div class="layout">
    <div class="map">
      <Heatmap
        values={grid}
        rows={R}
        cols={R}
        log
        maxWidth={380}
        showScale={false}
        label="Loss surface"
        onclick={({ x, y, width, height }) => {
          start = [fn.x[0] + (x / width) * (fn.x[1] - fn.x[0]), fn.y[1] - (y / height) * (fn.y[1] - fn.y[0])];
        }}
      >
        {#snippet tooltip({ row, col })}
          {@const x = fn.x[0] + ((col + 0.5) / R) * (fn.x[1] - fn.x[0])}
          {@const y = fn.y[1] - ((row + 0.5) / R) * (fn.y[1] - fn.y[0])}
          <div class="num">({x.toFixed(2)}, {y.toFixed(2)}) · loss {fn.f(x, y).toFixed(3)}</div>
          <div class="muted">click to start here</div>
        {/snippet}
        {#snippet overlay({ width, height })}
          <polyline points={clampPath(width, height)} class="path" />
          {#if path.length}
            {@const s = toPx(start, width, height)}
            <circle cx={s[0]} cy={s[1]} r="5" class="start" />
            {#if !diverged}
              {@const e = toPx(last, width, height)}
              <circle cx={e[0]} cy={e[1]} r="5" class="end" />
            {/if}
          {/if}
        {/snippet}
      </Heatmap>
    </div>
    <div class="side">
      <div class="k">{fn.label}</div>
      <dl>
        <dt>Steps</dt><dd class="num">{path.length - 1}{running ? ' …' : ''}</dd>
        <dt>Position</dt><dd class="num">{diverged ? '—' : `(${last[0].toFixed(3)}, ${last[1].toFixed(3)})`}</dd>
        <dt>Loss</dt><dd class="num">{diverged ? '∞ — diverged' : fn.f(last[0], last[1]).toFixed(4)}</dd>
      </dl>
      {#if diverged}<p class="warn">The learning rate is too large: each step overshoots further than the last. Lower η.</p>{/if}
      <p class="note">{fn.note}</p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    flex: 0 1 11rem;
  }
  .layout {
    display: grid;
    grid-template-columns: 380px minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  .map {
    min-width: 0;
  }
  .path {
    fill: none;
    stroke: var(--series-2);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .start {
    fill: var(--chart-surface);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .end {
    fill: var(--series-2);
    stroke: var(--chart-surface);
    stroke-width: 2;
  }
  .k {
    font-weight: 650;
    margin-bottom: 0.4rem;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.2rem 0.8rem;
    font-size: 0.82rem;
    margin: 0 0 0.6rem;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  .warn {
    color: var(--critical);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    line-height: 1.5;
  }
  .muted {
    font-size: 0.72rem;
    color: var(--ink-3);
  }
</style>
