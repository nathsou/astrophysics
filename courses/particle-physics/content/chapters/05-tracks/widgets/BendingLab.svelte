<!--
  A charged particle in a uniform magnetic field: radius, sagitta and direction of the bend, from p = 0.3 B R z.
  Seen from the side the field points towards you (out of the page) or away from you (into the page).
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const K = 0.299792458; // GeV/c per tesla metre
  let logP = $state(Math.log10(1));
  let B = $state(1);
  let q = $state(-1);
  let out = $state<'out' | 'in'>('out');

  const p = $derived(10 ** logP);
  const R = $derived(p / (K * Math.abs(q) * B)); // m
  const L = 1; // m: the chord whose sagitta is shown
  // Positive charge and B out of the page (+z): F = q v × B with v = +x gives −y: clockwise.
  const clockwise = $derived(Math.sign(q) * (out === 'out' ? 1 : -1) > 0);
  const W = 420, H = 300, S = 120; // px per metre
  const ox = 30, oy = H / 2;
  // centre of the circle
  const cyM = $derived(clockwise ? -R : R);
  const pathD = $derived.by(() => {
    const pts: string[] = [];
    const steps = 200;
    const total = R > 4 ? 3.2 / R : 2 * Math.PI;
    for (let i = 0; i <= steps; i++) {
      const a = (total * i) / steps;
      const x = R * Math.sin(a);
      const y = clockwise ? -R * (1 - Math.cos(a)) : R * (1 - Math.cos(a));
      const px = ox + x * S, py = oy - y * S;
      if (px > W + 20 || py < -20 || py > H + 20) {
        if (i > 0) break;
      }
      pts.push(`${pts.length ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return pts.join('');
  });
  const curls = $derived(2 * R < 1.2);
  // the chord from the origin to the point of the track at x = L (if it gets that far)
  const reaches = $derived(R >= L / 2);
  const sagExact = $derived(reaches ? R - Math.sqrt(R * R - (L / 2) ** 2) : NaN); // m
  const sagApprox = $derived((K * Math.abs(q) * B * L * L) / (8 * p)); // m
  const chordEnd = $derived.by(() => {
    if (!reaches) return null;
    // the track point whose distance from the origin is L
    const a = 2 * Math.asin(L / (2 * R));
    const x = R * Math.sin(a);
    const y = clockwise ? -R * (1 - Math.cos(a)) : R * (1 - Math.cos(a));
    return { x, y };
  });
  const fmt = (v: number, unit: string) => {
    const a = Math.abs(v);
    if (a >= 100) return `${v.toFixed(0)} ${unit}`;
    if (a >= 10) return `${v.toFixed(1)} ${unit}`;
    return `${v.toFixed(2)} ${unit}`;
  };
</script>

<Widget title="Bending a track" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={logP} min={-2} max={2} step={0.02} label="Momentum p [GeV/c]" format={(v) => (10 ** v).toPrecision(2)} />
    <Slider bind:value={B} min={0.1} max={4} step={0.1} label="Field B [T]" />
    <Segmented label="Charge" options={[{ value: -1, label: 'charge −1' }, { value: 1, label: 'charge +1' }, { value: 2, label: 'charge +2' }]} bind:value={q} />
    <Segmented label="Field direction" options={[{ value: 'out', label: 'out of the page (⊙)' }, { value: 'in', label: 'into the page (⊗)' }]} bind:value={out} />
  {/snippet}
  <div class="grid">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="A charged particle entering from the left and bending in a magnetic field; the radius and sagitta are marked" class="view">
      <defs><clipPath id="clip-bl"><rect x="0" y="0" width={W} height={H} /></clipPath></defs>
      {#each Array.from({ length: 6 }, (_, i) => i) as i}
        {#each Array.from({ length: 4 }, (_, j) => j) as j}
          <text x={20 + i * 76} y={24 + j * 88} class="bmark" text-anchor="middle">{out === 'out' ? '⊙' : '⊗'}</text>
        {/each}
      {/each}
      <line x1={ox} x2={ox + L * S} y1={oy} y2={oy} stroke="var(--mute)" stroke-dasharray="4 3" />
      <g clip-path="url(#clip-bl)">
        <path d={pathD} fill="none" stroke="var(--p-muon)" stroke-width="3" stroke-linecap="round" />
        {#if chordEnd}
          <line x1={ox} y1={oy} x2={ox + chordEnd.x * S} y2={oy - chordEnd.y * S} stroke="var(--ink-2)" stroke-width="1.2" />
        {/if}
        {#if R < 6}
          <circle cx={ox} cy={oy - cyM * S} r="3" fill="var(--mute)" />
          <line x1={ox} y1={oy - cyM * S} x2={ox} y2={oy} stroke="var(--mute)" stroke-dasharray="2 3" />
          <text x={ox + 6} y={oy - cyM * S / 2} class="lbl">R</text>
        {/if}
      </g>
      <circle cx={ox} cy={oy} r="4" fill="var(--fg)" />
      <text x={ox + 8} y={oy - 8} class="lbl">source</text>
      <text x={ox + L * S - 4} y={oy + 14} class="lbl" text-anchor="end">1 m</text>
    </svg>
    <div class="nums ui">
      <table>
        <tbody>
          <tr><th>radius R = p / (0.3 |q| B)</th><td>{fmt(R, 'm')}</td></tr>
          <tr><th>sense of the bend</th><td>{clockwise ? 'clockwise' : 'anticlockwise'}</td></tr>
          <tr><th>sagitta over 1 m, exact</th><td>{reaches ? fmt(sagExact * 1000, 'mm') : 'curls up before 1 m'}</td></tr>
          <tr><th>sagitta ≈ 0.3 |q| B L² / 8p</th><td>{fmt(sagApprox * 1000, 'mm')}</td></tr>
        </tbody>
      </table>
      <p class="note">
        {#if curls}This particle's circle is smaller than the picture: it <strong>curls up</strong>, as a slow electron does in a laboratory magnet.
        {:else if R > 50}The track is nearly straight: a bend of {fmt(sagApprox * 1000, 'mm')} in a metre is what the detector must measure.
        {:else}Try reversing the charge, then the field: the bend reverses each time, and two reversals restore it.{/if}
      </p>
    </div>
  </div>
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1.1rem;
    align-items: center;
  }
  @media (max-width: 720px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .view {
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .bmark {
    fill: var(--mute);
    opacity: 0.45;
    font-size: 13px;
  }
  .lbl {
    font-size: 11px;
    fill: var(--ink-2);
  }
  table {
    border-collapse: collapse;
    font-size: 0.84rem;
    width: 100%;
  }
  th,
  td {
    text-transform: none;
    letter-spacing: 0;
    text-align: left;
    padding: 0.2rem 0.4rem;
    border-bottom: 1px solid var(--line);
    font-weight: 400;
  }
  td {
    font-family: var(--font-mono);
    text-align: right;
    white-space: nowrap;
  }
  .note {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.6rem 0 0;
  }
</style>
