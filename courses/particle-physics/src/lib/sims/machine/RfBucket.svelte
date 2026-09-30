<!--
  The RF bucket: longitudinal phase space of a proton bunch in a synchrotron (the LHC at its 450 GeV injection, h = 35 640).

  Each dot is a proton: its phase relative to the synchronous particle (horizontal) and its momentum offset δ = Δp/p (vertical).
  Each turn the standard map kicks the energy and advances the phase, so a bunch oscillates about the synchronous point. The amber
  curve is the separatrix, the boundary of stable motion. Protons outside it are lost: they turn red and are drawn as crosses.

    ::rf-bucket{n="19.4" caption="…"}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { rng, normal } from '$lib/hep/random';
  import {
    bucketAreaEVs, bucketGeometry, deltaOf, energyOffsetOf, inBucket, lhcRf, separatrix, stablePhase, stepLongitudinal, synchrotronTune, type LongParticle,
  } from '$lib/hep/machine';
  import { prefersReducedMotion } from './fmt';

  let { n, caption, particles: N = 400 }: { n?: string | number; caption?: string; particles?: number } = $props();

  const E0 = 450; // GeV: LHC injection
  const F_RF = 400.789e6;
  const F_REV = 11245.5;
  const DEG = 180 / Math.PI;

  let voltageMV = $state(8);
  let gainPct = $state(0);
  let sigmaPhiDeg = $state(30);
  let sigmaDelta = $state(3); // in 1e-4
  let playing = $state(true);
  let perFrame = $state(1);
  let seed = $state(1);
  let turns = $state(0);
  let statusText = $state('');

  const params = $derived.by(() => {
    const base = lhcRf(E0, voltageMV * 1e6);
    return { ...base, phiS: stablePhase(base.eta, gainPct / 100) };
  });
  const geom = $derived(bucketGeometry(params));
  const sep = $derived(separatrix(params, 160));
  const Qs = $derived(synchrotronTune(params));
  const areaEVs = $derived(bucketAreaEVs(geom.area, params, F_RF));
  const bunchAreaEVs = $derived(bucketAreaEVs(4 * Math.PI * ((sigmaPhiDeg / DEG) * (sigmaDelta * 1e-4)), params, F_RF));
  const fill = $derived(bunchAreaEVs / areaEVs);

  // ── plot geometry ──
  const W = 560, H = 300, PL = 52, PR = 14, PT = 12, PB = 38;
  const XMIN = -200, XMAX = 200, YMAX = 2.5; // deg, 1e-3
  const xs = (deg: number) => PL + ((deg - XMIN) / (XMAX - XMIN)) * (W - PL - PR);
  const ys = (d1e3: number) => PT + (1 - (d1e3 + YMAX) / (2 * YMAX)) * (H - PT - PB);

  let parts: LongParticle[] = [];
  let inPath = $state('');
  let lostPath = $state('');
  let nLost = $state(0);

  function inject() {
    const r = rng(seed);
    parts = [];
    for (let i = 0; i < N; i++) {
      let a: number, b: number;
      do { a = normal(r); } while (Math.abs(a) > 3.5);
      do { b = normal(r); } while (Math.abs(b) > 3.5);
      parts.push({ dphi: (a * sigmaPhiDeg) / DEG, dE: energyOffsetOf(params, b * sigmaDelta * 1e-4) });
    }
    turns = 0;
    for (const p of parts) if (!inBucket(p, params, geom)) p.lost = true;
    draw();
  }

  function wrap(deg: number): number {
    let y = (deg - XMIN) % 360;
    if (y < 0) y += 360;
    return y + XMIN;
  }

  function draw() {
    let a = '', b = '', lost = 0;
    for (const p of parts) {
      const d = deltaOf(params, p.dE) * 1e3;
      if (Math.abs(d) > YMAX * 1.02) { if (p.lost) lost++; continue; }
      if (p.lost) {
        lost++;
        const x = xs(wrap(p.dphi * DEG)), y = ys(d);
        b += `M${(x - 2.4).toFixed(1)} ${(y - 2.4).toFixed(1)}l4.8 4.8M${(x - 2.4).toFixed(1)} ${(y + 2.4).toFixed(1)}l4.8-4.8`;
      } else {
        a += `M${xs(p.dphi * DEG).toFixed(1)} ${ys(d).toFixed(1)}h0.01`;
      }
    }
    inPath = a;
    lostPath = b;
    nLost = parts.reduce((s, p) => s + (p.lost ? 1 : 0), 0);
  }

  function step(k: number) {
    for (let i = 0; i < k; i++) {
      for (const p of parts) {
        stepLongitudinal(p, params);
        if (!p.lost && !inBucket(p, params, geom)) p.lost = true;
      }
    }
    turns += k;
    draw();
  }

  let raf = 0;
  let visible = true;
  let host = $state<HTMLElement | undefined>();
  function loop() {
    raf = requestAnimationFrame(loop);
    if (playing && visible) step(perFrame);
  }
  onMount(() => {
    if (prefersReducedMotion()) { playing = false; perFrame = 4; }
    inject();
    raf = requestAnimationFrame(loop);
    const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
    if (host) io.observe(host);
    const t = setInterval(() => (statusText = `${nLost} of ${N} protons lost after ${turns} turns. ${N - nLost} remain in the bucket.`), 1000);
    return () => { cancelAnimationFrame(raf); io.disconnect(); clearInterval(t); };
  });

  // Changing the bunch re-injects it; changing the RF does not (the bunch must respond).
  let first = true;
  $effect(() => {
    void sigmaPhiDeg; void sigmaDelta; void seed;
    if (first) { first = false; return; }
    inject();
  });

  const sepPath = $derived.by(() => {
    if (!geom.stable) return '';
    let up = '', dn = '';
    sep.dphi.forEach((x, i) => {
      up += `${i ? 'L' : 'M'}${xs(x * DEG).toFixed(1)} ${ys(sep.delta[i]! * 1e3).toFixed(1)}`;
    });
    for (let i = sep.dphi.length - 1; i >= 0; i--) dn += `L${xs(sep.dphi[i]! * DEG).toFixed(1)} ${ys(-sep.delta[i]! * 1e3).toFixed(1)}`;
    return `${up}${dn}Z`;
  });

  // The RF wave seen by the bunch: sin(φs + Δφ), drawn over the same phase axis.
  const WAVE_H = 96;
  const wavePath = $derived.by(() => {
    let d = '';
    for (let i = 0; i <= 160; i++) {
      const deg = XMIN + ((XMAX - XMIN) * i) / 160;
      const v = Math.sin(params.phiS + deg / DEG);
      d += `${i ? 'L' : 'M'}${xs(deg).toFixed(1)} ${(WAVE_H / 2 - v * (WAVE_H / 2 - 10)).toFixed(1)}`;
    }
    return d;
  });
  const gainY = $derived(WAVE_H / 2 - Math.sin(params.phiS) * (WAVE_H / 2 - 10));

  const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const xticks = [-180, -90, 0, 90, 180];
  const yticks = [-2, -1, 0, 1, 2];

  function reinject() { seed += 1; }
  function overfill() { sigmaPhiDeg = 75; sigmaDelta = 9; }
  function reset() { voltageMV = 8; gainPct = 0; sigmaPhiDeg = 30; sigmaDelta = 3; seed = 1; playing = !prefersReducedMotion(); }
</script>

<Widget title="An RF bucket" subtitle="LHC at injection: 450 GeV protons, harmonic number 35 640" {n} {caption} kind="Explore" onreset={reset}>
  {#snippet controls()}
    <Slider bind:value={voltageMV} min={0.5} max={16} step={0.5} label="RF voltage [MV]" />
    <Slider bind:value={gainPct} min={0} max={85} step={5} label="Acceleration: energy gain as % of the RF crest" format={(v) => v.toFixed(0) + '%'} />
    <Slider bind:value={sigmaPhiDeg} min={5} max={100} step={5} label="Bunch length σ [RF degrees]" format={(v) => v.toFixed(0) + '°'} />
    <Slider bind:value={sigmaDelta} min={0.5} max={12} step={0.5} label="Energy spread σδ [10⁻⁴]" format={(v) => v.toFixed(1)} />
  {/snippet}

  <div bind:this={host}>
    <svg viewBox="0 0 {W} {WAVE_H + 8}" class="wave" role="img" aria-label="The RF voltage as a function of phase; the synchronous particle sits at the marked point, where the wave gives it the energy the ring needs">
      <line x1={xs(XMIN)} x2={xs(XMAX)} y1={WAVE_H / 2} y2={WAVE_H / 2} class="axis" />
      {#if geom.stable}
        <rect x={xs(geom.left * DEG)} y="2" width={xs(geom.right * DEG) - xs(geom.left * DEG)} height={WAVE_H - 4} class="bucketband" />
      {/if}
      <path d={wavePath} class="wave-line" />
      <line x1={xs(XMIN)} x2={xs(XMAX)} y1={gainY} y2={gainY} class="gain" />
      <circle cx={xs(0)} cy={gainY} r="5" class="sync" />
      <text x={xs(XMIN) + 4} y={WAVE_H + 2} class="lbl">RF voltage seen by the bunch (solid), energy gain per turn (dashed)</text>
    </svg>

    <svg viewBox="0 0 {W} {H}" class="phase" role="img" aria-label="Longitudinal phase space. {N - nLost} protons oscillate inside the separatrix; {nLost} have been lost.">
      {#each yticks as t}
        <line x1={PL} x2={W - PR} y1={ys(t)} y2={ys(t)} class="grid" />
        <text x={PL - 7} y={ys(t)} dy="0.32em" text-anchor="end" class="tick">{t}</text>
      {/each}
      {#each xticks as t}
        <line x1={xs(t)} x2={xs(t)} y1={PT} y2={H - PB} class="grid" />
        <text x={xs(t)} y={H - PB + 16} text-anchor="middle" class="tick">{t}°</text>
      {/each}
      <text x={(PL + W - PR) / 2} y={H - 6} text-anchor="middle" class="axlbl">phase relative to the synchronous particle, Δφ</text>
      <text transform="translate(13 {(PT + H - PB) / 2}) rotate(-90)" text-anchor="middle" class="axlbl">momentum offset δ = Δp/p [10⁻³]</text>
      {#if geom.stable}<path d={sepPath} class="bucket" />{/if}
      <path d={inPath} class="dots" />
      <path d={lostPath} class="lostdots" />
      <path d="M{xs(0) - 5} {ys(0)}h10M{xs(0)} {ys(0) - 5}v10" class="syncx" />
      {#if !geom.stable}<text x={W / 2} y={H / 2} text-anchor="middle" class="warn">No stable bucket: no RF voltage, or the wrong phase</text>{/if}
    </svg>
    <ul class="legend ui" aria-hidden="true">
      <li><span class="sw dot"></span> in the bucket</li>
      <li><span class="sw sepsw"></span> separatrix</li>
      <li><span class="sw cross">×</span> lost</li>
      <li><span class="sw plus">+</span> synchronous particle</li>
    </ul>
  </div>

  <div class="bar ui">
    <Button onclick={() => (playing = !playing)} aria-pressed={playing}>{playing ? 'Pause' : 'Play'}</Button>
    <Button onclick={() => step(10)} disabled={playing}>Step 10 turns</Button>
    <Segmented label="Turns per frame" bind:value={perFrame} options={[{ value: 1, label: '1 turn/frame' }, { value: 4, label: '4' }, { value: 16, label: '16' }]} size="sm" />
    <Button onclick={reinject}>Inject a new bunch</Button>
    <Button onclick={overfill} title="A bunch much bigger than the bucket">Overfill the bucket</Button>
  </div>

  <dl class="readout ui">
    <div><dt>Synchrotron tune</dt><dd>{f(Qs * 1e3, 2)} × 10⁻³ <small>({f(Qs * F_REV, 0)} Hz)</small></dd></div>
    <div><dt>Bucket half-height</dt><dd>{f(geom.halfHeight * 1e3, 2)} × 10⁻³</dd></div>
    <div><dt>Bucket area</dt><dd>{f(areaEVs, 2)} eV·s</dd></div>
    <div><dt>Bunch area (4σ)</dt><dd>{f(bunchAreaEVs, 2)} eV·s <small>({f(fill * 100, 0)}% of the bucket)</small></dd></div>
    <div><dt>Turns</dt><dd>{turns.toLocaleString('en-GB')}</dd></div>
    <div class:badline={nLost > 0}><dt>Lost</dt><dd>{nLost} of {N} {nLost > 0 ? '✗' : '✓'}</dd></div>
  </dl>
  <p class="sr" role="status" aria-live="polite">{statusText}</p>
</Widget>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .wave {
    margin-bottom: 0.4rem;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--axis);
  }
  .tick {
    fill: var(--ink-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .axlbl,
  .lbl {
    fill: var(--ink-2);
    font-size: 11.5px;
  }
  .bucket {
    fill: var(--track-soft);
    stroke: var(--sig-high);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .bucketband {
    fill: var(--track-soft);
  }
  .dots {
    stroke: var(--series-1);
    stroke-width: 3.4;
    stroke-linecap: round;
    fill: none;
  }
  .lostdots {
    stroke: var(--bad);
    stroke-width: 1.6;
    fill: none;
  }
  .syncx {
    stroke: var(--fg);
    stroke-width: 1.6;
    fill: none;
  }
  .wave-line {
    fill: none;
    stroke: var(--series-1);
    stroke-width: 2;
  }
  .gain {
    stroke: var(--sig-high);
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
  }
  .sync {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
  }
  .warn {
    fill: var(--bad);
    font-size: 14px;
    font-weight: 600;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.1rem;
    list-style: none;
    margin: 0.4rem 0 0;
    padding: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .sw {
    display: inline-block;
    min-width: 1.1em;
    text-align: center;
    font-weight: 700;
  }
  .dot::before {
    content: '●';
    color: var(--series-1);
  }
  .sepsw {
    height: 3px;
    width: 1.3em;
    background: var(--sig-high);
    vertical-align: middle;
    border-radius: 2px;
  }
  .cross {
    color: var(--bad);
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.7rem 0 0.2rem;
  }
  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 0.4rem 1rem;
    margin: 0.6rem 0 0;
  }
  .readout div {
    border-left: 2px solid var(--line-strong);
    padding-left: 0.5rem;
  }
  .readout .badline {
    border-left-color: var(--bad);
  }
  dt {
    font-size: 0.72rem;
    color: var(--mute);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.86rem;
    font-variant-numeric: tabular-nums;
  }
  dd small {
    color: var(--mute);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    margin: 0;
  }
</style>
