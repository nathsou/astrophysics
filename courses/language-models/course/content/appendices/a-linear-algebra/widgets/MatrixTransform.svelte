<!--
  A 2 × 2 matrix as a transformation of the plane: the grid, the unit square (area = |det|), the
  unit circle (→ an ellipse whose axes are the singular values) and, when real, the eigenvectors.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import { params } from '$lib/state/params.svelte';

  const K = ['la.a', 'la.b', 'la.c', 'la.d'] as const;
  const DEFAULT = [1.2, 0.5, 0.3, 0.9];
  const m = $derived(K.map((k, i) => params.get(k, DEFAULT[i]!)) as [number, number, number, number]);
  const set = (vals: number[]) => K.forEach((k, i) => params.set(k, vals[i]!));
  let showEigen = $state(true);
  let showCircle = $state(true);

  const PRESETS: { label: string; v: number[] }[] = [
    { label: 'Identity', v: [1, 0, 0, 1] },
    { label: 'Rotate 30°', v: [Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6), Math.sin(Math.PI / 6), Math.cos(Math.PI / 6)] },
    { label: 'Scale', v: [1.5, 0, 0, 0.5] },
    { label: 'Shear', v: [1, 1, 0, 1] },
    { label: 'Reflect', v: [1, 0, 0, -1] },
    { label: 'Rank 1', v: [1, 0.5, 2, 1] },
    { label: 'Symmetric', v: [1.5, 0.6, 0.6, 0.7] },
  ];

  // Apply the matrix [[a, b], [c, d]] to a column vector (x, y).
  const T = (x: number, y: number): [number, number] => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
  const det = $derived(m[0] * m[3] - m[1] * m[2]);
  const tr = $derived(m[0] + m[3]);
  const disc = $derived(tr * tr - 4 * det);
  const eig = $derived.by(() => {
    if (disc < -1e-9) return null;
    const r = Math.sqrt(Math.max(0, disc));
    return [(tr + r) / 2, (tr - r) / 2].map((l) => {
      // (A − λI)v = 0: take v from whichever row is non-degenerate.
      let v: [number, number] = Math.abs(m[1]) > 1e-9 ? [m[1], l - m[0]] : Math.abs(m[2]) > 1e-9 ? [l - m[3], m[2]] : Math.abs(l - m[0]) < 1e-9 ? [1, 0] : [0, 1];
      const n = Math.hypot(...v) || 1;
      v = [v[0] / n, v[1] / n];
      return { l, v };
    });
  });
  // Singular values of a 2 × 2 matrix in closed form.
  const sv = $derived.by(() => {
    const s = m[0] ** 2 + m[1] ** 2 + m[2] ** 2 + m[3] ** 2;
    const r = Math.sqrt(Math.max(0, s * s - 4 * det * det));
    return [Math.sqrt((s + r) / 2), Math.sqrt(Math.max(0, (s - r) / 2))];
  });
  const rank = $derived(sv[0]! < 1e-9 ? 0 : sv[1]! < 1e-6 ? 1 : 2);

  const R = 3.2; // half-width of the view in plane units
  const S = 300;
  const px = (x: number) => S / 2 + (x / R) * (S / 2);
  const py = (y: number) => S / 2 - (y / R) * (S / 2);
  const P = (p: [number, number]) => `${px(p[0])},${py(p[1])}`;
  const gridLines = $derived.by(() => {
    const out: string[] = [];
    for (let k = -4; k <= 4; k++) {
      out.push(`M${P(T(k, -4))}L${P(T(k, 4))}`);
      out.push(`M${P(T(-4, k))}L${P(T(4, k))}`);
    }
    return out;
  });
  const circle = $derived('M' + Array.from({ length: 73 }, (_, i) => P(T(Math.cos((i / 72) * 2 * Math.PI), Math.sin((i / 72) * 2 * Math.PI)))).join('L'));
  const square = $derived(`M${P(T(0, 0))}L${P(T(1, 0))}L${P(T(1, 1))}L${P(T(0, 1))}Z`);
  const fmt = (v: number) => (Math.abs(v) < 5e-3 ? '0' : v.toFixed(2));
</script>

<Widget
  title="A matrix is a transformation"
  subtitle="Set the entries of A, or pick a preset. The grid shows where A sends every point; the coloured arrows are A’s columns — the images of the two basis vectors."
  onreset={() => set(DEFAULT)}
>
  {#snippet controls()}
    <div class="presets">
      {#each PRESETS as p (p.label)}<button class="chip" onclick={() => set(p.v)}>{p.label}</button>{/each}
    </div>
    <Toggle bind:checked={showCircle} label="Unit circle" />
    <Toggle bind:checked={showEigen} label="Eigenvectors" />
  {/snippet}

  <div class="layout">
    <svg viewBox="0 0 {S} {S}" role="img" aria-label="The plane transformed by A; determinant {det.toFixed(2)}">
      <!-- original axes -->
      <line class="axis" x1="0" x2={S} y1={py(0)} y2={py(0)} />
      <line class="axis" y1="0" y2={S} x1={px(0)} x2={px(0)} />
      {#each gridLines as d, i (i)}<path class="grid" {d} />{/each}
      <path class="square" d={square} />
      {#if showCircle}<path class="circle" d={circle} />{/if}
      {#if showEigen && eig}
        {#each eig as e, i (i)}
          <line class="eig" x1={px(-4 * e.v[0])} y1={py(-4 * e.v[1])} x2={px(4 * e.v[0])} y2={py(4 * e.v[1])} />
          <text class="eiglab" x={px(e.v[0] * (2.2 + i * 0.4)) + 4} y={py(e.v[1] * (2.2 + i * 0.4)) - 4}>λ = {fmt(e.l)}</text>
        {/each}
      {/if}
      <line class="vec" style:stroke="var(--series-1)" x1={px(0)} y1={py(0)} x2={px(m[0])} y2={py(m[2])} />
      <circle cx={px(m[0])} cy={py(m[2])} r="4.5" fill="var(--series-1)" />
      <line class="vec" style:stroke="var(--series-2)" x1={px(0)} y1={py(0)} x2={px(m[1])} y2={py(m[3])} />
      <circle cx={px(m[1])} cy={py(m[3])} r="4.5" fill="var(--series-2)" />
    </svg>

    <div class="side ui">
      <div class="matrix">
        <span class="bracket">A =</span>
        <div class="entries">
          {#each K as k, i (k)}
            <div class="entry" class:c1={i % 2 === 0} class:c2={i % 2 === 1}>
              <Slider label={['a', 'b', 'c', 'd'][i]!} min={-2} max={2} step={0.01} value={m[i]!} oninput={(v) => params.set(k, v)} format={(v) => v.toFixed(2)} />
            </div>
          {/each}
        </div>
      </div>
      <dl class="facts">
        <dt>det A</dt><dd class="num">{fmt(det)} <span class="muted">— the unit square’s area becomes {Math.abs(det).toFixed(2)}{det < -1e-9 ? ', flipped' : ''}</span></dd>
        <dt>rank</dt><dd class="num">{rank} <span class="muted">{rank === 2 ? '— invertible' : rank === 1 ? '— the plane collapses onto a line' : ''}</span></dd>
        <dt>eigenvalues</dt><dd class="num">{eig ? eig.map((e) => fmt(e.l)).join(', ') : 'complex (A rotates every direction)'}</dd>
        <dt>singular values</dt><dd class="num">{sv.map(fmt).join(', ')} <span class="muted">— the ellipse’s semi-axes</span></dd>
      </dl>
    </div>
  </div>
</Widget>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 99px;
    padding: 0.2rem 0.6rem;
    font-size: 0.74rem;
    cursor: pointer;
    color: var(--ink-2);
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
    stroke-width: 1;
  }
  .grid {
    stroke: color-mix(in srgb, var(--series-7) 45%, transparent);
    stroke-width: 0.8;
    fill: none;
  }
  .square {
    fill: color-mix(in srgb, var(--series-4) 30%, transparent);
    stroke: var(--series-4);
    stroke-width: 1.5;
  }
  .circle {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .eig {
    stroke: var(--series-3);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
  }
  .eiglab {
    font: 600 11px var(--font-ui);
    fill: var(--ink);
  }
  .vec {
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .matrix {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .bracket {
    font: 600 1rem var(--font-mono);
  }
  .entries {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3rem 0.8rem;
    border-left: 2px solid var(--ink-2);
    border-right: 2px solid var(--ink-2);
    padding: 0.3rem 0.6rem;
    flex: 1;
  }
  .entry {
    border-bottom: 3px solid transparent;
  }
  .entry.c1 {
    border-bottom-color: var(--series-1);
  }
  .entry.c2 {
    border-bottom-color: var(--series-2);
  }
  .facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3rem 0.8rem;
    font-size: 0.82rem;
    margin: 0;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  .muted {
    color: var(--ink-3);
  }
</style>
