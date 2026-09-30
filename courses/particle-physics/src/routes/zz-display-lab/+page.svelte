<script lang="ts">
  import { onMount } from 'svelte';
  import EventDisplay from '$lib/display/EventDisplay.svelte';
  import EventDisplayWidget from '$lib/display/EventDisplayWidget.svelte';
  import TruthRecoCompare from '$lib/display/TruthRecoCompare.svelte';
  import ParticleLegend from '$lib/display/ParticleLegend.svelte';
  import ParticleGun3D from '$lib/display/ParticleGun3D.svelte';
  import { sampleEvent } from '$lib/display/sampleEvents';
  import { buildScene } from '$lib/display/scene';
  import { defaultGeometry } from '$lib/display/geometry';
  import { EventGL } from '$lib/display/gl';
  import { Camera } from '$lib/display/camera';
  import { defaultColours } from '$lib/theme/particles';
  import { page } from '$app/state';
  const which = $derived(page.url.searchParams.get('w') ?? 'all');
  const sample = $derived(page.url.searchParams.get('s') ?? 'zmumu');
  const views = $derived(page.url.searchParams.get('v') ?? '3d,rphi,rz,lego');
  const truth = $derived(page.url.searchParams.get('t') === '1');
  const ev = $derived(sampleEvent(sample, { seed: 3 }));
  let bench = $state('');
  onMount(async () => {
    if (page.url.searchParams.get('w') !== 'bench') return;
    const e = sampleEvent('stress', { seed: 1 });
    const scene = buildScene(e, defaultGeometry);
    const pal = defaultColours('dark');
    const W = 500, H = 350;
    const results: Record<string, number> = {};
    const base = { colourBy: 'particle' as const, showTruth: false, showReco: true, showHits: true, showCalo: true, palette: pal };
    const variants: [string, Partial<typeof base>, boolean][] = [
      ['all aa', {}, true],
      ['all noaa', {}, false],
      ['no points', { showHits: false }, false],
      ['no towers', { showCalo: false }, false],
      ['no hits no towers', { showHits: false, showCalo: false }, false],
      ['wire only', { showHits: false, showCalo: false, showReco: false }, false],
    ];
    for (const [name, o, aa] of variants) {
      const c = document.createElement('canvas');
      document.body.appendChild(c);
      const gl = new EventGL(c, { antialias: aa });
      gl.resize(W, H, 1);
      const cam = new Camera();
      cam.resize(W, H);
      cam.distance = 11000;
      gl.setScene(scene, { ...base, ...o });
      gl.render(cam);
      gl.readPixel(1, 1);
      results[name] = +gl.benchmark(cam, 2).toFixed(0);
      results[name + ' (segs/pts/towers)'] = gl.stats.segments + gl.stats.points / 1e6 + gl.stats.towers / 1e12;
      gl.dispose();
      c.remove();
      bench = JSON.stringify(results);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
</script>

<div class="lab">
  {#if which === 'all' || which === 'display'}
    <EventDisplayWidget {sample} n="7.1" caption="Test" {views} showTruth={truth} />
  {/if}
  {#if which === 'compare'}<TruthRecoCompare sample={sample} n="7.3" />{/if}
  {#if which === 'legend'}<ParticleLegend title="Key" extras />{/if}
  {#if which === 'gun'}<ParticleGun3D n="7.2" />{/if}
  {#if which === 'bare'}<EventDisplay event={ev} {views} showTruth={truth} />{/if}
  {#if which === 'bench'}<pre id="bench">{bench}</pre>{/if}
</div>

<style>
  .lab { max-width: 70rem; margin: 1rem auto; padding: 0 1rem; }
</style>
