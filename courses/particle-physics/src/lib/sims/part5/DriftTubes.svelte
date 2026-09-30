<!--
  A Widerøe drift-tube linac: alternating tubes are connected to an RF source, and a particle is pushed at every gap. The tube after gap n must be
  βₙλ/2 long so that the particle crosses it in half an RF period and meets the next gap with the field reversed. Shorter tubes at low speed, longer
  ones as the particle speeds up; once β ≈ 1 every tube is λ/2 long.

    ::drift-tubes{n="19.2" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { linacLadder, linacToEnergy, betaFromT, C } from './physics';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let fMHz = $state(200);
  let gainKeV = $state(250);
  let t0MeV = $state(0.75);
  let shown = $state(12);

  const ladder = $derived(linacLadder(t0MeV * 1e-3, gainKeV * 1e-6, fMHz * 1e6, shown));
  const lambda = $derived(C / (fMHz * 1e6));
  const to50 = $derived(linacToEnergy(t0MeV * 1e-3, 0.05, gainKeV * 1e-6, fMHz * 1e6));
  const to160 = $derived(linacToEnergy(t0MeV * 1e-3, 0.16, gainKeV * 1e-6, fMHz * 1e6));

  const W = 560, H = 190, PL = 10, PR = 10;
  const gapW = 9;
  const totalW = $derived(ladder.reduce((s, d) => s + d.tubeLength, 0));
  const scale = $derived((W - PL - PR - gapW * (shown + 1)) / Math.max(totalW, 1e-9));
  const rects = $derived.by(() => {
    let x = PL + gapW;
    return ladder.map((d) => {
      const w = Math.max(2, d.tubeLength * scale);
      const r = { x, w, d };
      x += w + gapW;
      return r;
    });
  });
  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const v0 = $derived(betaFromT(t0MeV * 1e-3));
</script>

<Widget title="Drift tubes, step by step" subtitle="The tube after each gap is one half of an RF period long" {n} {caption} kind="Explore" onreset={() => { fMHz = 200; gainKeV = 250; t0MeV = 0.75; shown = 12; }}>
  {#snippet controls()}
    <Slider bind:value={fMHz} min={50} max={800} step={5} label="RF frequency [MHz]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={gainKeV} min={50} max={1000} step={10} label="Energy gained per gap [keV]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={t0MeV} min={0.05} max={5} step={0.05} label="Energy entering the linac [MeV]" format={(v) => v.toFixed(2)} />
    <Slider bind:value={shown} min={4} max={30} step={1} label="Tubes drawn" format={(v) => v.toFixed(0)} />
  {/snippet}

  <svg viewBox="0 0 {W} {H}" class="lin" role="img" aria-label="A row of {shown} drift tubes of increasing length along a beam line. Tube lengths grow from {f(ladder[0]?.tubeLength ?? 0, 3)} metres to {f(ladder[shown - 1]?.tubeLength ?? 0, 3)} metres.">
    <line x1={PL} x2={W - PR} y1="92" y2="92" class="axis" />
    {#each rects as r, i}
      <rect x={r.x} y="72" width={r.w} height="40" class="tube" class:odd={i % 2 === 0} rx="2" />
      {#if i % 2 === 0 || shown <= 14}<text x={r.x + r.w / 2} y="64" text-anchor="middle" class="en">{r.d.T * 1e3 < 10 ? f(r.d.T * 1e3, 1) : f(r.d.T * 1e3, 0)}</text>{/if}
      {#if shown <= 18}<text x={r.x + r.w / 2} y="130" text-anchor="middle" class="ln">{f(r.d.tubeLength * 100, r.d.tubeLength < 0.1 ? 1 : 0)}</text>{/if}
    {/each}
    <text x={PL} y="18" class="cap">kinetic energy after each gap [MeV]</text>
    <text x={PL} y="152" class="cap">tube length [cm]; alternate tubes carry opposite RF polarity (shaded and open)</text>
    <text x={PL} y="176" class="cap">the gaps are drawn far wider than they are</text>
  </svg>

  <dl class="readout ui" role="status" aria-live="polite">
    <div><dt>Wavelength of the RF, λ = c/f</dt><dd>{f(lambda, 2)} m</dd></div>
    <div><dt>Speed entering (β)</dt><dd>{f(v0, 4)}</dd></div>
    <div><dt>Speed after {shown} gaps</dt><dd>{f(ladder[shown - 1]?.beta ?? 0, 4)}</dd></div>
    <div><dt>First tube / last tube drawn</dt><dd>{f((ladder[0]?.tubeLength ?? 0) * 100, 1)} cm / {f((ladder[shown - 1]?.tubeLength ?? 0) * 100, 1)} cm</dd></div>
    <div><dt>To reach 50 MeV</dt><dd>{to50.gaps} gaps, {f(to50.length, 1)} m</dd></div>
    <div><dt>To reach 160 MeV</dt><dd>{to160.gaps} gaps, {f(to160.length, 1)} m</dd></div>
  </dl>
  <p class="note ui">Toy model: every gap adds the same energy, the synchronous phase is taken as fixed, and focusing is ignored. Real linacs change the structure as β grows (Linac4 uses several).</p>
</Widget>

<style>
  .lin { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .axis { stroke: var(--line-strong); stroke-dasharray: 4 4; }
  .tube { fill: var(--surface-2, var(--panel)); stroke: var(--ink-2); stroke-width: 1.2; }
  .tube.odd { fill: var(--accent-soft); }
  .en { font-size: 10px; fill: var(--ink); font-variant-numeric: tabular-nums; }
  .ln { font-size: 10px; fill: var(--ink-2); font-variant-numeric: tabular-nums; }
  .cap { font-size: 11px; fill: var(--mute); }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.4rem 0.9rem; margin: 0.6rem 0 0; }
  .readout div { border-left: 2px solid var(--line-strong); padding-left: 0.5rem; }
  dt { font-size: 0.74rem; color: var(--mute); text-transform: none; letter-spacing: 0; }
  dd { margin: 0; font-family: var(--font-mono); font-size: 0.92rem; font-variant-numeric: tabular-nums; }
  .note { font-size: 0.78rem; color: var(--mute); margin: 0.5rem 0 0; }
</style>
