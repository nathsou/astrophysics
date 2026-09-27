<!--
  Derivatives as local approximations: a function, its Taylor polynomial of order 1–3 around a
  point, and — in a second chart — how the error of finite-difference derivatives depends on the
  step size h, in float64 and float32.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import Legend from '$lib/charts/Legend.svelte';

  type Fn = { label: string; f: (x: number) => number; d: (x: number) => number; d2: (x: number) => number; d3: (x: number) => number; domain: [number, number]; y: [number, number] };
  const sig = (x: number) => 1 / (1 + Math.exp(-x));
  const FNS: Record<string, Fn> = {
    tanh: {
      label: 'tanh x',
      f: Math.tanh,
      d: (x) => 1 - Math.tanh(x) ** 2,
      d2: (x) => -2 * Math.tanh(x) * (1 - Math.tanh(x) ** 2),
      d3: (x) => {
        const t = Math.tanh(x);
        return -2 * (1 - t * t) * (1 - 3 * t * t);
      },
      domain: [-4, 4],
      y: [-1.6, 1.6],
    },
    sigmoid: {
      label: 'σ(x)',
      f: sig,
      d: (x) => sig(x) * (1 - sig(x)),
      d2: (x) => sig(x) * (1 - sig(x)) * (1 - 2 * sig(x)),
      d3: (x) => {
        const s = sig(x);
        return s * (1 - s) * (1 - 6 * s + 6 * s * s);
      },
      domain: [-6, 6],
      y: [-0.4, 1.4],
    },
    exp: { label: 'eˣ', f: Math.exp, d: Math.exp, d2: Math.exp, d3: Math.exp, domain: [-3, 2.5], y: [-1, 8] },
    log: { label: 'ln x', f: Math.log, d: (x) => 1 / x, d2: (x) => -1 / x ** 2, d3: (x) => 2 / x ** 3, domain: [0.05, 5], y: [-3, 2] },
    sin: { label: 'sin x', f: Math.sin, d: Math.cos, d2: (x) => -Math.sin(x), d3: (x) => -Math.cos(x), domain: [-6, 6], y: [-1.8, 1.8] },
  };

  let name = $state<keyof typeof FNS>('tanh');
  let x0 = $state(0.8);
  let order = $state(1);
  const fn = $derived(FNS[name]!);
  const xc = $derived(Math.min(fn.domain[1], Math.max(fn.domain[0], x0)));

  const taylor = (x: number) => {
    const h = x - xc;
    let v = fn.f(xc) + fn.d(xc) * h;
    if (order >= 2) v += (fn.d2(xc) * h * h) / 2;
    if (order >= 3) v += (fn.d3(xc) * h ** 3) / 6;
    return v;
  };
  const xs = $derived(Array.from({ length: 241 }, (_, i) => fn.domain[0] + ((fn.domain[1] - fn.domain[0]) * i) / 240));
  const clampY = (y: number) => Math.max(fn.y[0] - 10, Math.min(fn.y[1] + 10, y));

  // Finite-difference error as a function of h, in float64 and float32 arithmetic.
  const hs = Array.from({ length: 61 }, (_, i) => 10 ** (-15 + (i * 15) / 60));
  const f32 = (x: number) => Math.fround(fn.f(Math.fround(x)));
  const err = $derived.by(() => {
    const exact = fn.d(xc);
    const rel = (v: number) => Math.max(1e-17, Math.abs(v - exact) / Math.max(1e-12, Math.abs(exact)));
    return hs.map((h) => {
      const h32 = Math.fround(h);
      return {
        h,
        fwd64: rel((fn.f(xc + h) - fn.f(xc)) / h),
        ctr64: rel((fn.f(xc + h) - fn.f(xc - h)) / (2 * h)),
        ctr32: h32 > 0 && Math.fround(xc + h32) !== Math.fround(xc - h32) ? rel(Math.fround(Math.fround(f32(xc + h32) - f32(xc - h32)) / Math.fround(Math.fround(xc + h32) - Math.fround(xc - h32)))) : 1,
      };
    });
  });
  const line = (sx: (v: number) => number, sy: (v: number) => number, key: 'fwd64' | 'ctr64' | 'ctr32') =>
    'M' + err.map((e) => `${sx(e.h)},${sy(Math.min(10, Math.max(1e-16, e[key])))}`).join('L');
  const orders = ['tangent line (order 1)', 'order 2', 'order 3'];
</script>

<Widget
  title="A derivative is the best local linear approximation"
  subtitle="Move the point. The tangent line matches the function’s value and slope there; higher-order Taylor polynomials match curvature too. Below: estimating the slope numerically, and why the step size h can be too small."
  onreset={() => {
    name = 'tanh';
    x0 = 0.8;
    order = 1;
  }}
>
  {#snippet controls()}
    <Segmented label="Function" size="sm" options={Object.entries(FNS).map(([k, v]) => ({ value: k, label: v.label }))} bind:value={name} />
    <div class="ctl"><Slider label="point x₀" min={fn.domain[0]} max={fn.domain[1]} step={0.01} value={xc} oninput={(v) => (x0 = v)} format={(v) => v.toFixed(2)} /></div>
    <Segmented label="Taylor order" size="sm" options={[1, 2, 3].map((v) => ({ value: v, label: String(v) }))} bind:value={order} />
  {/snippet}

  <div class="two">
    <div>
      <Legend items={[{ label: fn.label, color: 'var(--series-1)' }, { label: `Taylor, ${orders[order - 1]}`, color: 'var(--series-2)' }]} />
      <Plot label="Function and its Taylor approximation" height={240} x={{ domain: fn.domain, ticks: 5 }} y={{ domain: fn.y, ticks: 5 }}>
        {#snippet marks({ sx, sy })}
          <path class="line" stroke="var(--series-1)" d={'M' + xs.map((x) => `${sx(x)},${sy(clampY(fn.f(x)))}`).join('L')} />
          <path class="line" stroke="var(--series-2)" d={'M' + xs.map((x) => `${sx(x)},${sy(clampY(taylor(x)))}`).join('L')} />
          <circle cx={sx(xc)} cy={sy(fn.f(xc))} r="5" fill="var(--series-2)" stroke="var(--chart-surface)" stroke-width="2" />
        {/snippet}
      </Plot>
      <p class="readout num ui">f({xc.toFixed(2)}) = {fn.f(xc).toFixed(4)} · f′ = {fn.d(xc).toFixed(4)} · f″ = {fn.d2(xc).toFixed(4)}</p>
    </div>
    <div>
      <Legend
        items={[
          { label: 'forward (f(x+h) − f(x)) / h, float64', color: 'var(--series-3)' },
          { label: 'central, float64', color: 'var(--series-4)' },
          { label: 'central, float32', color: 'var(--series-5)' },
        ]}
      />
      <Plot
        label="Relative error of finite-difference derivatives against step size"
        height={240}
        x={{ type: 'log', domain: [1e-15, 1], label: 'step h (log)', tickValues: [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1], format: (v) => `1e${Math.round(Math.log10(v))}` }}
        y={{ type: 'log', domain: [1e-16, 10], label: 'relative error (log)', tickValues: [1e-15, 1e-10, 1e-5, 1], format: (v) => `1e${Math.round(Math.log10(v))}` }}
      >
        {#snippet marks({ sx, sy })}
          <path class="line" stroke="var(--series-3)" d={line(sx, sy, 'fwd64')} />
          <path class="line" stroke="var(--series-4)" d={line(sx, sy, 'ctr64')} />
          <path class="line" stroke="var(--series-5)" d={line(sx, sy, 'ctr32')} />
        {/snippet}
        {#snippet tooltip({ x })}
          {@const e = err.reduce((a, b) => (Math.abs(Math.log(b.h / x)) < Math.abs(Math.log(a.h / x)) ? b : a))}
          <div class="num">h = {e.h.toExponential(0)}: forward {e.fwd64.toExponential(1)} · central {e.ctr64.toExponential(1)} · float32 {e.ctr32.toExponential(1)}</div>
        {/snippet}
      </Plot>
      <p class="readout ui">Large h: the approximation is poor (truncation error, falling as h for forward and h² for central differences). Tiny h: f(x+h) and f(x) agree in almost every digit, and their difference is mostly rounding error.</p>
    </div>
  </div>
</Widget>

<style>
  .ctl {
    flex: 0 1 12rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
  }
  @media (max-width: 760px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  .readout {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.4rem 0 0;
  }
</style>
