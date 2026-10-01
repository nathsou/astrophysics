<!--
  Weight diagrams of SU(3) representations, generated from the highest weight (hep/su3, Gelfand–Tsetlin patterns). Choose (p, q); the dots
  are the states at (I₃, Y), the number in a dot its multiplicity, and the diagonals are lines of constant charge Q = I₃ + Y/2.
  Quarks (3), antiquarks (3̄), the octet (8), the decuplet (10) and the 27 are the presets.

    ::weight-diagram{n="12.3" caption="…" p=1 q=1}
-->
<script lang="ts">
  import './part3.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { irrep, decomposeProduct, formatDecomposition, chargeOf } from '$lib/hep/su3';

  let { n, caption, p: p0 = 1, q: q0 = 1 }: { n?: string | number; caption?: string; p?: number; q?: number } = $props();
  let p = $state(p0);
  let q = $state(q0);
  let withSelf = $state(false);
  const r = $derived(irrep(p, q));
  const PRESETS: [string, number, number][] = [['1', 0, 0], ['3', 1, 0], ['3̄', 0, 1], ['6', 2, 0], ['8', 1, 1], ['10', 3, 0], ['27', 2, 2]];
  const W = 420, H = 330;
  const X = (i3x2: number) => W / 2 + (i3x2 / 2) * 52;
  const Y = (y3: number) => H / 2 - (y3 / 3) * 52 * 0.866;
  const prod = $derived(formatDecomposition(decomposeProduct([[p, q], [1, 0]])));
  const qs = $derived([...new Set(r.weights.map((w) => Math.round(6 * chargeOf(w))))].sort((a, b) => b - a));
  const charge = (w: { i3x2: number; y3: number }) => chargeOf(w);
  const fq = (c: number) => (Math.abs(c - Math.round(c)) < 1e-9 ? String(Math.round(c)) : Math.abs(c * 3 - Math.round(c * 3)) < 1e-9 ? (Math.round(c * 3) > 0 ? '+' : '−') + Math.abs(Math.round(c * 3)) + '/3' : c.toFixed(2));
</script>

<Widget title="Weight diagrams of SU(3)" {n} {caption} kind="Explore" live={false}>
  {#snippet controls()}
    <div class="p3-chips ui" role="group" aria-label="Representations">
      {#each PRESETS as [name, pp, qq]}<button type="button" class:on={p === pp && q === qq} onclick={() => { p = pp; q = qq; }}>{name}</button>{/each}
    </div>
    <Slider bind:value={p} min={0} max={5} step={1} label="p (Dynkin label)" format={(v) => String(v)} />
    <Slider bind:value={q} min={0} max={5} step={1} label="q (Dynkin label)" format={(v) => String(v)} />
  {/snippet}
  <div class="p3-two">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Weight diagram of the representation ({p},{q}) of dimension {r.dim}: {r.weights.length} distinct weights plotted by isospin component and hypercharge.">
      <rect width={W} height={H} fill="var(--panel)" />
      <line x1="10" x2={W - 10} y1={Y(0)} y2={Y(0)} stroke="var(--grid)" />
      <line x1={X(0)} x2={X(0)} y1="10" y2={H - 10} stroke="var(--grid)" />
      <text x={W - 12} y={Y(0) - 6} text-anchor="end" class="p3-tag">I₃</text>
      <text x={X(0) + 6} y="18" class="p3-tag">Y</text>
      {#each r.weights as w}
        {@const c = charge(w)}
        <circle cx={X(w.i3x2)} cy={Y(w.y3)} r={10 + 2 * (w.mult - 1)} fill={c > 0.01 ? 'var(--series-7)' : c < -0.01 ? 'var(--series-1)' : 'var(--series-8)'} opacity="0.85" />
        <text x={X(w.i3x2)} y={Y(w.y3) + 4} text-anchor="middle" style="fill:#fff;font-size:11px;font-weight:700">{w.mult > 1 ? w.mult : ''}</text>
        <text x={X(w.i3x2)} y={Y(w.y3) - 14 - 2 * (w.mult - 1)} text-anchor="middle" class="p3-tag">{fq(c)}</text>
      {/each}
    </svg>
    <div>
      <dl class="p3-out ui" style="grid-template-columns:1fr" aria-live="polite">
        <div><dt>representation (p, q) = ({p}, {q})</dt><dd>{r.name}: {r.dim} states</dd></div>
        <div><dt>highest weight</dt><dd>I₃ = {r.highest.i3x2 / 2}, Y = {(r.highest.y3 / 3).toFixed(2)}</dd></div>
        <div><dt>isospin multiplets</dt><dd>{r.multiplets.map((m) => `Y = ${fq(m.y3 / 3)}, I = ${m.i2 % 2 ? m.i2 + '/2' : m.i2 / 2}`).join(' · ')}</dd></div>
        <div><dt>{r.name} ⊗ 3 =</dt><dd>{prod}</dd></div>
      </dl>
      <p class="p3-note ui">Red dots carry positive charge, blue negative, grey none; the small label is the charge in units of e. Triality (p − q) mod 3 = {(((p - q) % 3) + 3) % 3}: only triality 0 representations, such as 1, 8, 10 and 27, contain integer charges, which is all that hadrons have.</p>
    </div>
  </div>
  <span class="p3-sr">{qs.length}</span>
</Widget>

<style>
  svg { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 6px; }
</style>
