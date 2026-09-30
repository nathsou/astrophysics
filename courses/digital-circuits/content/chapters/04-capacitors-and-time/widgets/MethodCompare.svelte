<!--
  Two ways to step an RC circuit through time: backward Euler and the trapezoidal rule, with a fixed step of h × τ.
  Make h large (a "stiff" step: the circuit's own time constant is much shorter than the step) and the trapezoidal
  rule rings around the right answer while backward Euler creeps up monotonically. Run by the real analog engine
  in its fixed-step mode; see methods.ts.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { amplification, methodCurves, VS } from './methods';

  let { n }: { n?: string } = $props();

  let h = $state(10);
  const steps = $derived(Math.min(80, Math.max(6, Math.ceil(8 / h))));
  const m = $derived(methodCurves(h, steps));
  const a = $derived(amplification(h));

  const W = 420;
  const H = 230;
  const L = 44;
  const B = 28;
  const T = 12;
  const Rt = 12;
  const YMIN = -0.5;
  const YMAX = 10;
  const tEnd = $derived(m.t[m.t.length - 1]!);
  const x = (t: number) => L + (t / tEnd) * (W - L - Rt);
  const y = (v: number) => H - B - ((Math.max(YMIN, Math.min(YMAX, v)) - YMIN) / (YMAX - YMIN)) * (H - B - T);
  const line = (v: number[]) => v.map((val, i) => `${i ? 'L' : 'M'}${x(m.t[i]!).toFixed(1)} ${y(val).toFixed(1)}`).join(' ');
  const exactPath = $derived(
    Array.from({ length: 121 }, (_, i) => {
      const t = (tEnd * i) / 120;
      return `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(VS * (1 - Math.exp(-t))).toFixed(1)}`;
    }).join(' '),
  );
  const peak = $derived(Math.max(...m.trapezoidal));
  const fmt = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
</script>

<Widget title="Two ways to take a step" {n} kind="Interactive" caption="Both curves are the analog engine, stepping 5 V onto R and C with a fixed step h. Drag h up: backward Euler stays under 5 V; the trapezoidal rule overshoots and rings.">
  <div class="mc ui">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Voltage against time in units of τ: the exact exponential, backward Euler, and the trapezoidal rule with a step of {h.toFixed(1)} τ. The trapezoidal rule peaks at {peak.toFixed(1)} volts.">
      <g class="grid">
        {#each [0, 5, 10] as v (v)}
          <line x1={L} x2={W - Rt} y1={y(v)} y2={y(v)} class:target={v === 5} />
          <text x={L - 6} y={y(v) + 4} text-anchor="end">{v} V</text>
        {/each}
        <line x1={L} x2={L} y1={T} y2={H - B} class="axis" />
        <text x={W - Rt} y={H - 8} text-anchor="end">time (in units of τ = RC), step h = {h < 1 ? h.toFixed(2) : h.toFixed(1)} τ</text>
      </g>
      <path d={exactPath} class="exact" />
      <path d={line(m.euler)} class="euler" />
      <path d={line(m.trapezoidal)} class="trap" />
      {#each m.euler as v, i (i)}<circle cx={x(m.t[i]!)} cy={y(v)} r="3" class="euler dot" />{/each}
      {#each m.trapezoidal as v, i (i)}<circle cx={x(m.t[i]!)} cy={y(v)} r="3" class="trap dot" />{/each}
    </svg>
    <ul class="key">
      <li><i class="k exact"></i>exact, 5 V (1 − e<sup>−t/τ</sup>)</li>
      <li><i class="k euler"></i>backward Euler: error × <b>{fmt(a.euler)}</b> per step</li>
      <li><i class="k trap"></i>trapezoidal: error × <b>{fmt(a.trapezoidal)}</b> per step</li>
    </ul>
    <Slider label="Step h" min={0.1} max={50} log bind:value={h} format={(v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} τ`} />
  </div>
</Widget>

<style>
  .mc {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  svg {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
    display: block;
    font-family: var(--font-mono);
    font-size: 10.5px;
  }
  .grid line {
    stroke: var(--line);
    stroke-width: 1;
  }
  .grid line.target {
    stroke: var(--line-strong);
    stroke-dasharray: 4 4;
  }
  .grid line.axis {
    stroke: var(--line-strong);
  }
  .grid text {
    fill: var(--mute);
  }
  path {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .exact {
    stroke: var(--mute);
    stroke-dasharray: 5 4;
    stroke-width: 1.5;
  }
  .euler {
    stroke: var(--series-2);
    fill: var(--series-2);
  }
  .trap {
    stroke: var(--series-1);
    fill: var(--series-1);
  }
  path.euler,
  path.trap {
    fill: none;
    opacity: 0.55;
  }
  .dot {
    stroke: var(--panel);
    stroke-width: 1;
  }
  .key {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1.4rem;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  .k {
    display: inline-block;
    width: 1.1rem;
    height: 0;
    border-top: 3px solid var(--series-2);
    vertical-align: middle;
    margin-right: 0.4rem;
  }
  .k.trap {
    border-top-color: var(--series-1);
  }
  .k.exact {
    border-top: 2px dashed var(--mute);
  }
  b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
</style>
