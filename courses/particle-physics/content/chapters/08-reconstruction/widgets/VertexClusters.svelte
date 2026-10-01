<!--
  Primary vertices in a crossing with pile-up. Tracks are found in the hits of one simulated bunch crossing (a hard collision plus `pile-up` minimum-bias
  collisions spread along the beam, σz = 50 mm) and the z of the point where each track passes closest to the beam is histogrammed. Collisions show up as clumps;
  the vertex finder (hep/reco `findPrimaryVertices`) fits one vertex to each clump. The hard-scatter collision is the one with the largest Σ pT².
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from '$lib/sims/part2/LinePlot.svelte';
  import { simulateCrossing, DEFAULT_QUALITY, configFor } from '$lib/sims/part2/pileup';
  import { findTracks, findPrimaryVertices } from '$lib/hep/reco';

  let { n, caption }: { n?: string | number; caption?: string } = $props();
  let pu = $state(25);
  let seed = $state(1);

  const result = $derived.by(() => {
    const x = simulateCrossing(pu, 5000 + seed, DEFAULT_QUALITY);
    const cfg = configFor(DEFAULT_QUALITY);
    const tracks = findTracks(x.det.hits, cfg);
    const vs = findPrimaryVertices(tracks, undefined, { x: 0, y: 0, sigma: Math.max(cfg.beamSpot.sigmaXY, 0.005) });
    // histogram of z0 (mm) in 1 mm bins from −200 to 200
    const nb = 200, lo = -200, hi = 200;
    const counts = new Array<number>(nb).fill(0);
    for (const t of tracks) {
      const b = Math.floor(((t.z0Raw - lo) / (hi - lo)) * nb);
      if (b >= 0 && b < nb) counts[b]!++;
    }
    const xs = counts.map((_, i) => lo + ((i + 0.5) * (hi - lo)) / nb);
    // truth: the vertices that have at least 3 tracks found near them
    const trueZ = x.vertices;
    const hard = vs.find((v) => v.kind === 'primary');
    const near = hard ? Math.abs(hard.z - trueZ[0]!) : NaN;
    // each found vertex is matched to the nearest true one
    const matched = new Set<number>();
    for (const v of vs) {
      let best = -1, bd = Infinity;
      trueZ.forEach((z, i) => {
        const d = Math.abs(z - v.z);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd < 1) matched.add(best);
    }
    return { xs, counts, vs, trueZ, hard, near, nTracks: tracks.length, matched: matched.size, nHits: x.det.hits.length };
  });
  const maxC = $derived(Math.max(5, ...result.counts));
</script>

<Widget title="Vertices in a crowded crossing" {n} {caption} kind="Explore">
  {#snippet controls()}
    <Slider bind:value={pu} min={1} max={60} step={1} label="Pile-up collisions" format={(v) => v.toFixed(0)} />
    <Button onclick={() => (seed += 1)}>New crossing (seed {seed})</Button>
  {/snippet}
  <LinePlot
    lines={[{ x: result.xs, y: result.counts, label: 'tracks per mm', dash: '', fill: true }]}
    vmarks={[
      ...result.trueZ.slice(1).map((z) => ({ value: z, color: 'var(--series-8)', dash: '1 3' })),
      ...result.vs.filter((v) => v.kind !== 'primary').map((v) => ({ value: v.z, color: 'var(--series-2)', dash: '' })),
      ...(result.hard ? [{ value: result.hard.z, label: 'hard scatter', color: 'var(--series-3)', dash: '' }] : []),
    ]}
    x={{ domain: [-200, 200], label: 'z of the track at its closest approach to the beam [mm]' }}
    y={{ domain: [0, maxC * 1.1], label: 'tracks per mm', format: (v) => v.toFixed(0) }}
    height={250}
    legend={false}
    label="Histogram of the z position of the closest approach of each reconstructed track to the beam line, with the fitted vertices and the true collision positions marked"
  />
  <p class="ui note" aria-live="polite">
    {pu + 1} collisions in this crossing, {result.nHits.toLocaleString('en-GB')} hits, {result.nTracks} tracks, <strong>{result.vs.length}</strong> vertices found,
    {result.matched} of them within 1 mm of a true collision.
    {#if result.hard}The hard-scatter vertex is at z = {result.hard.z.toFixed(3)} mm, {(1000 * result.near).toFixed(0)} μm from the true position.{/if}
    <span class="key"><span class="k" style="border-color: var(--series-8); border-top-style: dotted"></span> true collision</span>
    <span class="key"><span class="k" style="border-color: var(--series-2)"></span> fitted pile-up vertex</span>
    <span class="key"><span class="k" style="border-color: var(--series-3)"></span> fitted hard-scatter vertex</span>
  </p>
</Widget>

<style>
  .note {
    font-size: 0.84rem;
    color: var(--ink-2);
    margin: 0.5rem 0 0;
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 0.8rem;
    white-space: nowrap;
  }
  .k {
    display: inline-block;
    width: 1.2rem;
    border-top: 3px solid;
  }
</style>
