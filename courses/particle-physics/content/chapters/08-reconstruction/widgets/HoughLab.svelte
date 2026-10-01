<!--
  The Hough transform for tracks from the origin. Left: the hits of a few tracks in the transverse plane, hidden among random noise hits. Right: the
  accumulator, a grid over (φ₀, κ): every hit votes for all the tracks that could have produced it, and the real tracks are the peaks. Uses the library's
  `houghTransform` (hook reco.houghTransform), or the reader's when "use my code" is on.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { houghTransform, type HoughResult } from '$lib/hep/reco';
  import { hook } from '$lib/hep/hooks';
  import { rng as makeRng, normal } from '$lib/hep/random';
  import { savedFor, useMine } from '$lib/sims/part2/mine';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const RADII = [35, 70, 110, 160, 280, 500, 800, 1100]; // mm: the course detector's layers
  const SIGMA = 0.05; // mm
  const B = 3.8;
  const K = 0.299792458;
  const MAXC = 0.004; // 1/mm: pT > 0.23 GeV at 3.8 T
  let nTracks = $state(4);
  let nNoise = $state(40);
  let nAngle = $state(128);
  let nCurv = $state(48);
  let minVotes = $state(6);
  let seed = $state(1);
  let mineAvailable = $state(false);
  let useMineOn = $state(false);
  let version = $state(0);
  let note = $state('');

  onMount(() => {
    mineAvailable = savedFor(['reco.houghTransform']).length > 0;
    return () => useMine(['reco.houghTransform'], false);
  });
  function toggleMine(on: boolean) {
    const r = useMine(['reco.houghTransform'], on);
    const err = r.errors['reco.houghTransform'];
    note = err ? `Your code failed to load (${err}); the library's transform is used.` : on ? 'Running your houghTransform.' : '';
    version++;
  }

  interface Truth { phi0: number; kappa: number; pt: number }
  const event = $derived.by(() => {
    const r = makeRng(seed);
    const truth: Truth[] = [];
    const hits: { x: number; y: number }[] = [];
    for (let t = 0; t < nTracks; t++) {
      const pt = 0.6 * Math.exp(r() * Math.log(40)); // 0.6 – 24 GeV
      const q = r() < 0.5 ? 1 : -1;
      const kappa = (-q * K * B) / (1000 * pt);
      const phi0 = (2 * r() - 1) * Math.PI;
      truth.push({ phi0, kappa, pt });
      for (const rr of RADII) {
        const a = (kappa * rr) / 2;
        if (Math.abs(a) >= 1) break;
        const phi = phi0 + Math.asin(a) + normal(r) * (SIGMA / rr);
        hits.push({ x: rr * Math.cos(phi), y: rr * Math.sin(phi) });
      }
    }
    for (let i = 0; i < nNoise; i++) {
      const rr = RADII[Math.floor(r() * RADII.length)]!;
      const phi = (2 * r() - 1) * Math.PI;
      hits.push({ x: rr * Math.cos(phi), y: rr * Math.sin(phi) });
    }
    return { truth, hits };
  });

  const result = $derived.by((): { res: HoughResult; ms: number } | null => {
    void version;
    const fn = hook('reco.houghTransform', houghTransform);
    const t0 = performance.now();
    try {
      const res = fn(event.hits, { nAngle: Math.round(nAngle), nCurv: Math.round(nCurv), maxCurv: MAXC, minVotes: Math.round(minVotes) });
      return { res, ms: performance.now() - t0 };
    } catch (e) {
      note = `The transform threw: ${e instanceof Error ? e.message : String(e)}`;
      return null;
    }
  });

  // a peak matches a truth track if φ₀ agrees within two bins and κ within 15 %
  const matches = $derived.by(() => {
    if (!result) return { found: 0, fakes: 0, list: [] as { truth: Truth; peak: number | null }[] };
    const dA = (2 * Math.PI) / result.res.nAngle;
    const used = new Set<number>();
    const list = event.truth.map((t) => {
      let best: number | null = null;
      let bv = -1;
      result.res.peaks.forEach((p, i) => {
        if (used.has(i)) return;
        let d = Math.abs(p.phi0 - t.phi0);
        d = Math.min(d, 2 * Math.PI - d);
        if (d < 2.5 * dA && Math.abs(p.curvature - t.kappa) < Math.max(0.15 * Math.abs(t.kappa), 2 * ((2 * MAXC) / result.res.nCurv)) && p.votes > bv) {
          best = i;
          bv = p.votes;
        }
      });
      if (best !== null) used.add(best);
      return { truth: t, peak: best };
    });
    return { found: list.filter((l) => l.peak !== null).length, fakes: result.res.peaks.length - used.size, list };
  });

  let hitCanvas: HTMLCanvasElement | undefined = $state();
  let accCanvas: HTMLCanvasElement | undefined = $state();
  const css = (el: HTMLElement | undefined, v: string) => (el ? getComputedStyle(el).getPropertyValue(v).trim() || '#888' : '#888');

  function drawHits() {
    const c = hitCanvas;
    if (!c) return;
    const s = c.clientWidth || 300;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = s * dpr;
    c.height = s * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    const k = (s / 2 - 4) / 1150;
    ctx.strokeStyle = css(c, '--line-strong');
    ctx.lineWidth = 0.6;
    for (const r of RADII) {
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, r * k, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = css(c, '--p-hit');
    for (const h of event.hits) {
      ctx.beginPath();
      ctx.arc(s / 2 + h.x * k, s / 2 - h.y * k, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
    // the tracks the transform found, drawn as their circles through the origin
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = css(c, '--series-2');
    if (result) {
      for (const p of result.res.peaks.slice(0, Math.max(1, matches.list.length + 2))) {
        ctx.beginPath();
        for (let r = 5; r <= 1150; r += 10) {
          const a = (p.curvature * r) / 2;
          if (Math.abs(a) >= 1) break;
          const phi = p.phi0 + Math.asin(a);
          const x = s / 2 + r * Math.cos(phi) * k, y = s / 2 - r * Math.sin(phi) * k;
          if (r === 5) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }
  function drawAcc() {
    const c = accCanvas;
    if (!c || !result) return;
    const { accumulator, nAngle: na, nCurv: nc, peaks } = result.res;
    const w = c.clientWidth || 360, h = Math.round(w * 0.62);
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let max = 1;
    for (let i = 0; i < accumulator.length; i++) if (accumulator[i]! > max) max = accumulator[i]!;
    const cw = w / na, ch = h / nc;
    const hue = css(c, '--track');
    ctx.fillStyle = css(c, '--pn');
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hue;
    for (let j = 0; j < na; j++) {
      for (let b = 0; b < nc; b++) {
        const v = accumulator[j * nc + b]!;
        if (v <= 0) continue;
        ctx.globalAlpha = Math.min(1, (v / max) ** 0.8);
        ctx.fillRect(j * cw, h - (b + 1) * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = css(c, '--series-2');
    ctx.lineWidth = 1.6;
    for (const p of peaks.slice(0, 40)) {
      const x = ((p.phi0 + Math.PI) / (2 * Math.PI)) * w;
      const y = h - ((p.curvature + MAXC) / (2 * MAXC)) * h;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.strokeStyle = css(c, '--ok');
    ctx.setLineDash([3, 3]);
    for (const t of event.truth) {
      const x = ((t.phi0 + Math.PI) / (2 * Math.PI)) * w;
      const y = h - ((t.kappa + MAXC) / (2 * MAXC)) * h;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  $effect(() => {
    void event, result;
    void tick().then(() => {
      drawHits();
      drawAcc();
    });
  });
  const pt = (k: number) => (K * B) / (1000 * Math.max(1e-9, Math.abs(k)));
</script>

<Widget title="The Hough transform" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={nTracks} min={1} max={12} step={1} label="Tracks" format={(v) => v.toFixed(0)} />
    <Slider bind:value={nNoise} min={0} max={400} step={10} label="Noise hits" format={(v) => v.toFixed(0)} />
    <Slider bind:value={nAngle} min={32} max={512} step={32} label="Bins in φ₀" format={(v) => v.toFixed(0)} />
    <Slider bind:value={nCurv} min={16} max={128} step={8} label="Bins in κ" format={(v) => v.toFixed(0)} />
    <Slider bind:value={minVotes} min={3} max={8} step={1} label="Votes needed" format={(v) => v.toFixed(0)} />
    <Button onclick={() => (seed += 1)}>New event (seed {seed})</Button>
    {#if mineAvailable}<Toggle bind:checked={useMineOn} label="use my code (houghTransform)" onchange={toggleMine} />{/if}
  {/snippet}
  <div class="grid">
    <div>
      <h5 class="ui">Hits in the transverse plane</h5>
      <canvas bind:this={hitCanvas} class="sq" role="img" aria-label="Hits of several tracks and noise in the transverse plane, with the circles found by the transform"></canvas>
    </div>
    <div>
      <h5 class="ui">The accumulator: φ₀ across, κ up</h5>
      <canvas bind:this={accCanvas} class="wide" role="img" aria-label="The Hough accumulator, brightness showing the number of votes, with the peaks circled"></canvas>
      <p class="ui small">Dashed green: where the true tracks are. Orange rings: peaks found ({result?.res.peaks.length ?? 0}).</p>
    </div>
  </div>
  {#if result}
    <p class="ui out" aria-live="polite">
      <strong>{matches.found} of {event.truth.length}</strong> true tracks found, {matches.fakes} extra peaks (fake tracks or duplicates), {event.hits.length} hits, {result.res.nAngle} × {result.res.nCurv} = {(result.res.nAngle * result.res.nCurv).toLocaleString('en-GB')} cells, {result.ms.toFixed(1)} ms.
    </p>
    <table class="ui">
      <thead><tr><th>true pT [GeV]</th><th>found pT [GeV]</th><th>votes</th></tr></thead>
      <tbody>
        {#each matches.list as l}
          <tr><td>{l.truth.pt.toFixed(2)}</td><td>{l.peak !== null ? pt(result.res.peaks[l.peak]!.curvature).toFixed(2) : 'missed'}</td><td>{l.peak !== null ? result.res.peaks[l.peak]!.votes : ''}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
  {#if note}<p class="ui small">{note}</p>{/if}
</Widget>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 1.1rem;
    align-items: start;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  h5 {
    margin: 0 0 0.3rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mute);
    font-weight: 500;
  }
  canvas {
    width: 100%;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    display: block;
  }
  .sq {
    aspect-ratio: 1;
  }
  .small {
    font-size: 0.8rem;
    color: var(--ink-2);
    margin: 0.3rem 0 0;
  }
  .out {
    margin: 0.7rem 0 0.3rem;
    font-size: 0.86rem;
  }
  table {
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  th,
  td {
    text-transform: none;
    letter-spacing: 0;
    padding: 0.15rem 0.8rem 0.15rem 0;
    text-align: left;
    font-weight: 400;
    border-bottom: 1px solid var(--line);
  }
  thead th {
    color: var(--mute);
    font-size: 0.72rem;
  }
</style>
