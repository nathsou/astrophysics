<!--
  Alternating-gradient focusing with thin lenses. A quadrupole that focuses in x defocuses in y, so a channel has two planes and every quadrupole
  does opposite things in them. Alternate focusing and defocusing quadrupoles (FODO) and both planes are stable for a wide range of strengths; put
  two focusing quadrupoles in a row (FF) and the plane in which they defocus is lost at once.

    ::alternating-gradient{n="20.3" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import Plot from '$lib/charts/Plot.svelte';
  import { drift, apply, thinQuad, oneTurnMatrix, trace, type Element, type Plane } from '$lib/hep/machine';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  type Arr = 'fodo' | 'ff';
  let arr = $state<Arr>('fodo');
  let f = $state(3); // m, focal length of each lens
  const L = 4; // m, distance between lenses
  const NCELL = 6;

  const cellOf = (a: Arr, ff: number): Element[] => [
    { kind: 'thinQuad', kl: 1 / ff, name: 'Q1' },
    { kind: 'drift', length: L },
    { kind: 'thinQuad', kl: a === 'fodo' ? -1 / ff : 1 / ff, name: 'Q2' },
    { kind: 'drift', length: L },
  ];
  const cell = $derived(cellOf(arr, f));
  const tr = $derived({ x: trace(oneTurnMatrix(cell, 'x')), y: trace(oneTurnMatrix(cell, 'y')) });
  const stable = $derived({ x: Math.abs(tr.x) < 2, y: Math.abs(tr.y) < 2 });

  // Two rays through NCELL cells in one plane, sampled every 0.1 m.
  function trajectories(plane: Plane): { s: number; x: number }[][] {
    const starts: [number, number][] = [[1e-3, 0], [0, 0.4e-3]];
    return starts.map(([x0, xp0]) => {
      let x = x0, xp = xp0, s = 0;
      const out = [{ s, x }];
      for (let c = 0; c < NCELL; c++) {
        for (const e of cell) {
          if (e.kind === 'thinQuad') {
            [x, xp] = apply(thinQuad(plane === 'x' ? e.kl : -e.kl), x, xp);
            out.push({ s, x });
          } else if (e.kind === 'drift') {
            const steps = 20;
            for (let i = 1; i <= steps; i++) {
              x += (xp * e.length) / steps;
              s += e.length / steps;
              out.push({ s, x });
            }
          }
        }
      }
      return out;
    });
  }
  const tx = $derived(trajectories('x'));
  const ty = $derived(trajectories('y'));
  const total = NCELL * 2 * L;

  const W = 560, PL = 44, PR = 10, PH = 120, AMP = 8; // mm
  const sx = (s: number) => PL + (s / total) * (W - PL - PR);
  const sy = (x_mm: number) => PH / 2 - (Math.max(-2.5 * AMP, Math.min(2.5 * AMP, x_mm)) / AMP) * (PH / 2 - 8);
  const lensX = Array.from({ length: NCELL * 2 }, (_, i) => i * L);
  const lensSign = (plane: Plane, i: number): number => {
    const k = (i % 2 === 0 ? 1 : arr === 'fodo' ? -1 : 1) * (plane === 'x' ? 1 : -1);
    return k;
  };

  // Stability plot: Tr M against L/f for the current arrangement
  const curve = $derived.by(() => {
    const out: { r: number; x: number; y: number }[] = [];
    for (let i = 0; i <= 200; i++) {
      const r = (4.5 * i) / 200; // L/f
      const ff = r === 0 ? 1e9 : L / r;
      const c = cellOf(arr, ff);
      out.push({ r, x: trace(oneTurnMatrix(c, 'x')), y: trace(oneTurnMatrix(c, 'y')) });
    }
    return out;
  });
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '–');
</script>

<Widget title="Why alternating quadrupoles focus" subtitle="Two lenses of equal strength, two planes" {n} {caption} kind="Explore" onreset={() => { arr = 'fodo'; f = 3; }}>
  {#snippet controls()}
    <Segmented label="Quadrupole sequence" bind:value={arr} options={[{ value: 'fodo', label: 'F, D, F, D (alternating)' }, { value: 'ff', label: 'F, F, F, F (all the same)' }]} />
    <Slider bind:value={f} min={1.2} max={12} step={0.1} label="Focal length of each lens, f [m] (the lenses are 4 m apart)" format={(v) => v.toFixed(1)} />
  {/snippet}

  {#each [['x', tx, 'Horizontal plane (x)'], ['y', ty, 'Vertical plane (y)']] as [pl, tt, name]}
    {@const plane = pl as Plane}
    <h5 class="ui">{name}: {stable[plane] ? 'stable' : 'unstable'}, Tr M = {fmt(tr[plane])}</h5>
    <svg viewBox="0 0 {W} {PH}" class="ray" role="img" aria-label="{name}: two rays through {NCELL} cells. The motion is {stable[plane] ? 'bounded' : 'unbounded, growing at each cell'}.">
      <line x1={PL} x2={W - PR} y1={PH / 2} y2={PH / 2} class="axis" />
      {#each lensX as lx, i}
        {@const sg = lensSign(plane, i)}
        <line x1={sx(lx)} x2={sx(lx)} y1={PH / 2 - 20} y2={PH / 2 + 20} class={sg > 0 ? 'lens foc' : 'lens def'} />
        <text x={sx(lx)} y={PH - 4} text-anchor="middle" class="lb">{sg > 0 ? 'F' : 'D'}</text>
      {/each}
      {#each (tt as { s: number; x: number }[][]) as ray, ri}
        <path d={ray.map((p, i) => `${i ? 'L' : 'M'}${sx(p.s).toFixed(1)} ${sy(p.x * 1e3).toFixed(1)}`).join('')} class="path r{ri}" />
      {/each}
      <text x="6" y="14" class="lb">x [mm]</text>
      <text x={PL - 4} y={sy(AMP)} text-anchor="end" class="lb" dy="0.3em">{AMP}</text>
      <text x={PL - 4} y={sy(-AMP)} text-anchor="end" class="lb" dy="0.3em">−{AMP}</text>
    </svg>
  {/each}

  <h5 class="ui">Trace of the one-cell matrix against L/f: the motion is stable where |Tr M| < 2</h5>
  <Plot
    label="Trace of the cell matrix against the ratio of lens spacing to focal length, for the horizontal and vertical planes. The stable band is between minus 2 and plus 2."
    x={{ domain: [0, 4.5], label: 'L / f' }}
    y={{ domain: [-4, 8], label: 'Tr M', tickValues: [-4, -2, 0, 2, 4, 6, 8] }}
    height={200}
  >
    {#snippet marks({ sx: ax, sy: ay })}
      <rect x={ax(0)} y={ay(2)} width={ax(4.5) - ax(0)} height={ay(-2) - ay(2)} class="band" />
      <path class="cx" d={curve.map((p, i) => `${i ? 'L' : 'M'}${ax(p.r)} ${ay(Math.max(-4, Math.min(8, p.x)))}`).join('')} />
      <path class="cy" d={curve.map((p, i) => `${i ? 'L' : 'M'}${ax(p.r)} ${ay(Math.max(-4, Math.min(8, p.y)))}`).join('')} />
      <circle cx={ax(L / f)} cy={ay(Math.max(-4, Math.min(8, tr.x)))} r="5" class="px" />
      <circle cx={ax(L / f)} cy={ay(Math.max(-4, Math.min(8, tr.y)))} r="5" class="py" />
      <text x={ax(0) + 6} y={ay(2) - 6} class="lb">unstable above</text>
      <text x={ax(0) + 6} y={ay(-2) + 14} class="lb">unstable below</text>
    {/snippet}
  </Plot>
  <p class="leg ui"><span class="kx"></span> horizontal plane · <span class="ky"></span> vertical plane (dashed). Lens strength is L/f = {(L / f).toFixed(2)}; for the alternating sequence Tr M = 2 − (L/f)², so the cell is stable for L/f < 2 in both planes at once.</p>
</Widget>

<style>
  .ray { width: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .axis { stroke: var(--line-strong); stroke-dasharray: 4 4; }
  .lens { stroke-width: 3; stroke-linecap: round; }
  .foc { stroke: var(--series-1); }
  .def { stroke: var(--series-2); stroke-dasharray: 2 3; }
  .lb { font-size: 10.5px; fill: var(--ink-2); }
  .path { fill: none; stroke-width: 1.8; }
  .r0 { stroke: var(--series-3); }
  .r1 { stroke: var(--ink-2); stroke-dasharray: 5 3; }
  h5 { margin: 0.7rem 0 0.25rem; font-size: 0.82rem; color: var(--ink-2); font-weight: 600; }
  .band { fill: var(--accent-soft); opacity: 0.55; }
  .cx { fill: none; stroke: var(--series-1); stroke-width: 2; }
  .cy { fill: none; stroke: var(--series-2); stroke-width: 2; stroke-dasharray: 6 4; }
  .px { fill: var(--series-1); stroke: var(--surface); stroke-width: 1.5; }
  .py { fill: var(--series-2); stroke: var(--surface); stroke-width: 1.5; }
  .leg { font-size: 0.78rem; color: var(--mute); margin: 0.3rem 0 0; }
  .kx, .ky { display: inline-block; width: 1.4rem; border-top: 3px solid var(--series-1); vertical-align: middle; }
  .ky { border-top-color: var(--series-2); border-top-style: dashed; }
</style>
