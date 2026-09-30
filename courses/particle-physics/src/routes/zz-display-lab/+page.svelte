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
  onMount(() => {
    if (page.url.searchParams.get('w') !== 'bench') return;
    const e = sampleEvent('stress', { seed: 1 });
    const t0 = performance.now();
    const scene = buildScene(e, defaultGeometry);
    const tScene = performance.now() - t0;
    const c = document.createElement('canvas');
    c.width = 1000; c.height = 700;
    document.body.appendChild(c);
    const gl = new EventGL(c);
    gl.resize(1000, 700, 1);
    const cam = new Camera();
    cam.resize(1000, 700);
    cam.distance = 11000;
    const pal = defaultColours('dark');
    const t1 = performance.now();
    gl.setScene(scene, { colourBy: 'particle', showTruth: false, showReco: true, showHits: true, showCalo: true, palette: pal });
    const tSet = performance.now() - t1;
    // CPU cost of submitting a frame (no waiting for the GPU).
    const t2 = performance.now();
    for (let i = 0; i < 200; i++) { cam.orbit(0.01, 0); cam.update(); gl.render(cam); }
    const tSubmit = (performance.now() - t2) / 200;
    const full = gl.benchmark(cam, 10);
    bench = JSON.stringify({ tracks: e.reco.tracks.length, hits: e.detector!.hits.length, truth: e.truth!.particles.length, cells: e.detector!.cells.length, polylines: scene.polylines.length, towers: scene.towers.length, stats: gl.stats, sceneMs: +tScene.toFixed(1), setSceneMs: +tSet.toFixed(1), submitMsPerFrame: +tSubmit.toFixed(3), fullMsPerFrameSwiftShader: +full.toFixed(1) });
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
