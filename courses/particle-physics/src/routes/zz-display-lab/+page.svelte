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
  import { View2D } from '$lib/display/camera';
  import { drawPlane, fitPlane } from '$lib/display/draw2d';
  import { highlightStates } from '$lib/display/scene';
  import { ScenePicker } from '$lib/display/scenePick';
  const which = $derived(page.url.searchParams.get('w') ?? 'all');
  const sample = $derived(page.url.searchParams.get('s') ?? 'zmumu');
  const views = $derived(page.url.searchParams.get('v') ?? '3d,rphi,rz,lego');
  const truth = $derived(page.url.searchParams.get('t') === '1');
  const ev = $derived(sampleEvent(sample, { seed: 3 }));
  let bench = $state('');
  if (typeof window !== 'undefined' && page.url.searchParams.get('nogl')) {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = function (type: string, ...a: unknown[]) { return type === 'webgl2' ? null : (orig as any).call(this, type, ...a); };
  }
  onMount(async () => {
    if (page.url.searchParams.get('w') === 'bench2d') {
      const e = sampleEvent('stress', { seed: 1 });
      const scene = buildScene(e, defaultGeometry);
      const pal = defaultColours('dark');
      const c = document.createElement('canvas');
      c.width = 700; c.height = 500;
      const ctx = c.getContext('2d')!;
      const v = new View2D();
      v.resize(700, 500);
      fitPlane('rphi', v, scene, 'calo');
      const o = { colourBy: 'particle' as const, showTruth: false, showReco: true, showHits: true, showCalo: true, palette: pal };
      const out: Record<string, number> = {};
      for (const [name, mode, states] of [['rphi', 'rphi', null], ['rz', 'rz', null]] as const) {
        fitPlane(mode, v, scene, 'calo');
        drawPlane(ctx, scene, mode, v, o, states);
        const t = performance.now();
        for (let i = 0; i < 5; i++) drawPlane(ctx, scene, mode, v, o, states);
        out[name] = +((performance.now() - t) / 5).toFixed(1);
      }
      const st = highlightStates(scene, 'track:5');
      fitPlane('rphi', v, scene, 'calo');
      const t2 = performance.now();
      for (let i = 0; i < 5; i++) drawPlane(ctx, scene, 'rphi', v, o, st);
      out['rphi highlighted'] = +((performance.now() - t2) / 5).toFixed(1);
      const t3 = performance.now();
      const pk = new ScenePicker(scene);
      const pj = (x: number, y: number, z: number, s: number, o2: Float64Array) => { o2[0] = v.toScreenX(x); o2[1] = v.toScreenY(y); return true; };
      const fl = { showTruth: false, showReco: true, showHits: true, showCalo: true };
      pk.pick(pj, 300, 200, fl);
      const t4 = performance.now();
      for (let i = 0; i < 100; i++) pk.pick(pj, 300 + i, 200, fl);
      out['pick cached'] = +((performance.now() - t4) / 100).toFixed(3);
      out['pick first (projects all)'] = +(t4 - t3).toFixed(2);
      bench = JSON.stringify(out);
      return;
    }
    if (page.url.searchParams.get('w') !== 'bench') return;
    const e = sampleEvent('stress', { seed: 1 });
    const scene = buildScene(e, defaultGeometry);
    const pal = defaultColours('dark');
    const W = 500, H = 350;
    const results: Record<string, number> = {};
    const base = { colourBy: 'particle' as const, showTruth: false, showReco: true, showHits: true, showCalo: true, palette: pal };
    const variants: [string, Partial<typeof base>, boolean][] = [
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
  {#if which === 'bench' || which === 'bench2d'}<pre id="bench">{bench}</pre>{/if}
</div>

<style>
  .lab { max-width: 70rem; margin: 1rem auto; padding: 0 1rem; }
</style>
