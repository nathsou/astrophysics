<!--
  Attention as a soft dictionary lookup. Drag the query: each key scores q·k, softmax turns the
  scores into weights, and the output is the weighted average of the values.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { params } from '$lib/state/params.svelte';

  const ITEMS = [
    { name: 'the', key: [1.6, 0.3], value: [0.4, 1.5] },
    { name: 'king', key: [0.2, 1.7], value: [1.6, 0.9] },
    { name: 'said', key: [-1.5, 0.8], value: [-1.2, 1.4] },
    { name: 'to', key: [-1.2, -1.3], value: [-1.5, -0.8] },
    { name: 'her', key: [0.9, -1.5], value: [0.9, -1.4] },
  ];
  let q = $state([0.9, 1.1]);
  const beta = $derived(params.get('attn.beta', 1));

  const scores = $derived(ITEMS.map((it) => beta * (q[0]! * it.key[0]! + q[1]! * it.key[1]!)));
  const weights = $derived.by(() => {
    const m = Math.max(...scores);
    const e = scores.map((s) => Math.exp(s - m));
    const z = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / z);
  });
  const out = $derived([0, 1].map((d) => ITEMS.reduce((a, it, i) => a + weights[i]! * it.value[d]!, 0)));

  const S = 240, R = 2.4;
  const px = (x: number) => S / 2 + (x / R) * (S / 2);
  const py = (y: number) => S / 2 - (y / R) * (S / 2);
  let dragging = false;
  function move(e: PointerEvent) {
    if (!dragging) return;
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * S, y = ((e.clientY - r.top) / r.height) * S;
    q = [Math.max(-R, Math.min(R, ((x - S / 2) / (S / 2)) * R)), Math.max(-R, Math.min(R, (-(y - S / 2) / (S / 2)) * R))];
  }
  const color = (i: number) => `var(--series-${i + 1})`;
</script>

<Widget
  title="Attention is a soft dictionary lookup"
  subtitle="Drag the query q (left). Each item’s key is scored by the dot product q · k; softmax turns the scores into weights; the output (right, ◆) is the weighted average of the items’ values."
  onreset={() => {
    q = [0.9, 1.1];
    params.set('attn.beta', 1);
  }}
>
  {#snippet controls()}
    <div class="ctl"><Slider label="sharpness β (scales every score)" min={0.1} max={8} step={0.05} log value={beta} oninput={(v) => params.set('attn.beta', v)} format={(v) => v.toFixed(2)} /></div>
  {/snippet}

  <div class="layout">
    <figure>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <svg viewBox="0 0 {S} {S}" onpointermove={move} onpointerup={() => (dragging = false)} onpointerleave={() => (dragging = false)} aria-label="Key space with a draggable query">
        <line class="axis" x1="0" x2={S} y1={py(0)} y2={py(0)} />
        <line class="axis" y1="0" y2={S} x1={px(0)} x2={px(0)} />
        {#each ITEMS as it, i (it.name)}
          <line class="ray" x1={px(0)} y1={py(0)} x2={px(it.key[0]!)} y2={py(it.key[1]!)} style:stroke={color(i)} />
          <circle cx={px(it.key[0]!)} cy={py(it.key[1]!)} r={4 + 10 * weights[i]!} fill={color(i)} opacity="0.85" />
          <text x={px(it.key[0]!) + 8} y={py(it.key[1]!) - 8} class="lab">{it.name}</text>
        {/each}
        <line class="qray" x1={px(0)} y1={py(0)} x2={px(q[0]!)} y2={py(q[1]!)} />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <circle class="q" cx={px(q[0]!)} cy={py(q[1]!)} r="9" onpointerdown={(e) => ((dragging = true), (e.currentTarget as Element).setPointerCapture?.(e.pointerId))} />
        <text x={px(q[0]!)} y={py(q[1]!) + 4} class="qlab" text-anchor="middle">q</text>
      </svg>
      <figcaption>keys (circle size = attention weight)</figcaption>
    </figure>

    <div class="mid ui">
      <table class="num">
        <thead><tr><th></th><th>score q·k</th><th>weight</th></tr></thead>
        <tbody>
          {#each ITEMS as it, i (it.name)}
            <tr>
              <td><span class="sw" style:background={color(i)}></span>{it.name}</td>
              <td>{scores[i]!.toFixed(2)}</td>
              <td><span class="bar" style:width="{weights[i]! * 100}%" style:background={color(i)}></span>{weights[i]!.toFixed(2)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <figure>
      <svg viewBox="0 0 {S} {S}" aria-label="Value space with the output as a weighted average">
        <line class="axis" x1="0" x2={S} y1={py(0)} y2={py(0)} />
        <line class="axis" y1="0" y2={S} x1={px(0)} x2={px(0)} />
        {#each ITEMS as it, i (it.name)}
          <line class="pull" x1={px(out[0]!)} y1={py(out[1]!)} x2={px(it.value[0]!)} y2={py(it.value[1]!)} style:stroke={color(i)} style:opacity={0.15 + 0.85 * weights[i]!} style:stroke-width={1 + 4 * weights[i]!} />
          <rect x={px(it.value[0]!) - 5} y={py(it.value[1]!) - 5} width="10" height="10" rx="2" fill={color(i)} />
          <text x={px(it.value[0]!) + 8} y={py(it.value[1]!) + 4} class="lab">{it.name}</text>
        {/each}
        <path class="out" d="M{px(out[0]!)},{py(out[1]!) - 9} L{px(out[0]!) + 9},{py(out[1]!)} L{px(out[0]!)},{py(out[1]!) + 9} L{px(out[0]!) - 9},{py(out[1]!)} Z" />
      </svg>
      <figcaption>values, and the output ◆ = Σ weight × value</figcaption>
    </figure>
  </div>
  <p class="note ui">
    A hard dictionary returns the value of the one key that matches exactly. Attention returns a <em>blend</em>, weighted by how well each key matches. Because the blend is a smooth function of the query and keys, gradient descent can learn what to look for. Raise β and the blend approaches a hard lookup of the best match; lower it and the output drifts towards the plain average.
  </p>
</Widget>

<style>
  .ctl {
    flex: 0 1 16rem;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
  figure {
    margin: 0;
  }
  svg {
    width: 100%;
    background: var(--surface-2);
    border-radius: 8px;
    touch-action: none;
  }
  figcaption {
    font-size: 0.72rem;
    color: var(--ink-3);
    text-align: center;
    margin-top: 0.3rem;
  }
  .axis {
    stroke: var(--ink-3);
    stroke-width: 0.6;
  }
  .ray {
    stroke-width: 1;
    opacity: 0.35;
  }
  .qray {
    stroke: var(--ink);
    stroke-width: 2;
  }
  .q {
    fill: var(--surface);
    stroke: var(--ink);
    stroke-width: 2;
    cursor: grab;
  }
  .qlab {
    font: italic 700 11px var(--font-ui);
    fill: var(--ink);
    pointer-events: none;
  }
  .lab {
    font: 600 11px var(--font-mono);
    fill: var(--ink);
  }
  .out {
    fill: var(--ink);
    stroke: var(--surface);
    stroke-width: 1.5;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
  th {
    text-align: left;
    color: var(--ink-2);
    font-weight: 600;
    font-size: 0.7rem;
  }
  td {
    padding: 0.15rem 0.2rem;
    border-top: 1px solid var(--rule);
  }
  .sw {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    margin-right: 0.3rem;
  }
  .bar {
    display: inline-block;
    height: 9px;
    max-width: 55%;
    border-radius: 0 3px 3px 0;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
  .note {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
