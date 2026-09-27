<!--
  Constrained maximum likelihood on the probability simplex (Chapter 2's problem, with three symbols):
  the log-likelihood Σ cᵢ log pᵢ over all p with p₁ + p₂ + p₃ = 1. At a chosen point, the gradient splits
  into a part along the constraint surface and a part perpendicular to it; at the optimum only the
  perpendicular part (μ·(1, 1, 1)) is left.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';

  let c = $state([6, 3, 1]);
  let p = $state([0.2, 0.5, 0.3]);
  const W = 320, H = 280, PAD = 24;
  // Barycentric (p₁, p₂, p₃) → screen: corners for symbols a (bottom left), b (bottom right), c (top).
  const A = [PAD, H - PAD], B = [W - PAD, H - PAD], C = [W / 2, PAD + 6];
  const toXY = (q: number[]) => [q[0]! * A[0]! + q[1]! * B[0]! + q[2]! * C[0]!, q[0]! * A[1]! + q[1]! * B[1]! + q[2]! * C[1]!] as const;
  function toP(x: number, y: number): number[] {
    // Solve for barycentric coordinates of (x, y) in triangle ABC.
    const d = (B[1]! - C[1]!) * (A[0]! - C[0]!) + (C[0]! - B[0]!) * (A[1]! - C[1]!);
    const a = ((B[1]! - C[1]!) * (x - C[0]!) + (C[0]! - B[0]!) * (y - C[1]!)) / d;
    const b = ((C[1]! - A[1]!) * (x - C[0]!) + (A[0]! - C[0]!) * (y - C[1]!)) / d;
    const q = [a, b, 1 - a - b].map((v) => Math.max(0.01, v));
    const s = q.reduce((u, v) => u + v, 0);
    return q.map((v) => v / s);
  }
  const N = $derived(c.reduce((a, b) => a + b, 0));
  const mle = $derived(c.map((x) => x / N));
  const ll = (q: number[]) => c.reduce((a, ci, i) => a + ci * Math.log(q[i]!), 0);
  // ∇f = (cᵢ / pᵢ); its component along (1,1,1)/√3 is the part the constraint absorbs.
  const grad = $derived(c.map((ci, i) => ci / p[i]!));
  const mu = $derived(grad.reduce((a, b) => a + b, 0) / 3);
  const inPlane = $derived(grad.map((g) => g - mu));
  const inPlaneNorm = $derived(Math.hypot(...inPlane));
  // Arrow for the in-plane part, drawn in the triangle (scaled for visibility).
  const arrow = $derived.by(() => {
    const scale = 0.25 / Math.max(1, Math.max(...grad.map(Math.abs)));
    const end = p.map((v, i) => v + scale * inPlane[i]!);
    return [toXY(p), toXY(end)] as const;
  });
  // Contours of the log-likelihood, sampled on a grid.
  const cells = $derived.by(() => {
    const out: { x: number; y: number; v: number }[] = [];
    const n = 36;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const q = [i / n, j / n, (n - i - j) / n].map((v) => Math.max(0.005, v));
      const [x, y] = toXY(q);
      out.push({ x, y, v: ll(q) });
    }
    return out;
  });
  const vmax = $derived(ll(mle));
  // Likelihood relative to its maximum, per observation (so the picture does not sharpen as counts grow).
  const shade = (v: number) => Math.exp(((v - vmax) / N) * 4);
  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;
  function move(e: PointerEvent) {
    if (!dragging || !svg) return;
    const r = svg.getBoundingClientRect();
    p = toP(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
  }
  const [mx, my] = $derived(toXY(mle));
  const [px, py] = $derived(toXY(p));
</script>

<Widget
  title="Maximum likelihood under a constraint"
  subtitle="Three symbols seen c₁, c₂, c₃ times. Every point of the triangle is a distribution (p₁, p₂, p₃); darker means a higher log-likelihood Σ cᵢ log pᵢ. Drag the point: the arrow is the part of the gradient that lies along the triangle."
  onreset={() => {
    c = [6, 3, 1];
    p = [0.2, 0.5, 0.3];
  }}
>
  {#snippet controls()}
    {#each ['a', 'b', 'c'] as s, i (s)}
      <div class="sl"><Slider label="count of {s}" min={1} max={20} step={1} value={c[i]!} oninput={(v) => (c[i] = Math.round(v))} format={(v) => String(Math.round(v))} /></div>
    {/each}
  {/snippet}

  <div class="two">
    <svg bind:this={svg} viewBox="0 0 {W} {H}" role="img" aria-label="Probability simplex" onpointerdown={(e) => ((dragging = true), move(e))} onpointermove={move} onpointerup={() => (dragging = false)} onpointerleave={() => (dragging = false)}>
      {#each cells as k, i (i)}<circle cx={k.x} cy={k.y} r="5.5" fill="var(--series-1)" opacity={0.08 + 0.7 * shade(k.v)} />{/each}
      <polygon points="{A.join(',')} {B.join(',')} {C.join(',')}" fill="none" stroke="var(--rule-strong)" />
      <text x={A[0]! - 4} y={A[1]! + 16} class="lbl">a</text><text x={B[0]! - 4} y={B[1]! + 16} class="lbl">b</text><text x={C[0]! - 3} y={C[1]! - 8} class="lbl">c</text>
      <circle cx={mx} cy={my} r="5" fill="none" stroke="var(--ink)" stroke-width="2" />
      <line x1={arrow[0][0]} y1={arrow[0][1]} x2={arrow[1][0]} y2={arrow[1][1]} stroke="var(--series-2)" stroke-width="2.5" marker-end="url(#ah)" />
      <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="var(--series-2)" /></marker></defs>
      <circle cx={px} cy={py} r="6" fill="var(--series-2)" class="handle" />
    </svg>
    <div class="out ui">
      <div><span>point p</span><strong class="num">({p.map((v) => v.toFixed(2)).join(', ')})</strong></div>
      <div><span>gradient ∇f = (cᵢ / pᵢ)</span><strong class="num">({grad.map((v) => v.toFixed(1)).join(', ')})</strong></div>
      <div><span>part along the triangle</span><strong class="num">{inPlaneNorm.toFixed(2)}</strong></div>
      <div><span>part perpendicular: μ·(1, 1, 1), μ =</span><strong class="num">{mu.toFixed(2)}</strong></div>
      <div><span>maximum (ringed): cᵢ / N</span><strong class="num">({mle.map((v) => v.toFixed(2)).join(', ')})</strong></div>
      <p class="note">Drag the point onto the ring. The arrow shrinks to nothing: all that remains of the gradient is perpendicular to the triangle, ∇f = μ ∇(p₁ + p₂ + p₃), which is the Lagrange condition. There, cᵢ / pᵢ = μ for every i, so pᵢ = cᵢ / μ and μ = N.</p>
    </div>
  </div>
</Widget>

<style>
  .sl {
    flex: 1 1 9rem;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.2rem;
    align-items: start;
  }
  @media (max-width: 720px) {
    .two {
      grid-template-columns: 1fr;
    }
  }
  svg {
    width: 100%;
    max-width: 380px;
    touch-action: none;
    cursor: crosshair;
  }
  .lbl {
    font-size: 13px;
    fill: var(--ink-2);
  }
  .handle {
    stroke: var(--surface);
    stroke-width: 2;
  }
  .out > div {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    border-top: 1px solid var(--rule);
    padding: 0.3rem 0;
    font-size: 0.8rem;
    color: var(--ink-2);
  }
  .out strong {
    color: var(--ink);
  }
  .note {
    font-size: 0.78rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
</style>
