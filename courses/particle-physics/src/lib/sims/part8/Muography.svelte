<!--
  Muography: the flagship figure of Chapter 33. A detector at the foot of a stone pyramid counts cosmic-ray muons arriving at each angle. Stone absorbs muons, so the count in
  a direction falls with the thickness of stone along it; a hidden chamber makes that thickness smaller in the directions that cross it, and the count rises. A TOY in two
  dimensions, from hep/muography: a uniform pyramid, one empty box, the sea-level spectrum of the PDG's parametrisation, a continuous energy-loss model for rock. Poisson noise
  from a fixed seed.

    ::muography{n="33.1" caption="…"}    Props: `seed`, `n`, `caption`, `title`.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Toggle from '$lib/components/ui/Toggle.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinePlot from './LinePlot.svelte';
  import { slantThickness, expectedCount, lengthInBox, minimumEnergy, type Box } from '$lib/hep/muography';
  import { poisson, rng as makeRng } from '$lib/hep/random';
  import { linspace, sig } from './format';

  let { seed: seed0 = 3, n, caption, title = 'Muography: is there a hidden chamber?' }: { seed?: number; n?: string | number; caption?: string; title?: string } = $props();

  const PYR = { base: 230, height: 139 };
  const DET = { x: 0, z: 5 };
  let present = $state(true);
  let cx = $state(-12);
  let cz = $state(85);
  let cw = $state(12);
  let ch = $state(5);
  let density = $state(2.4);
  let days = $state(20);
  let area = $state(0.5);
  let binDeg = $state(3);
  let seed = $state(untrack(() => seed0));

  const chamber = $derived<Box>({ x: cx, z: cz, w: cw, h: ch });
  const dOm = $derived((binDeg * Math.PI / 180) ** 2);
  const edges = $derived(linspace(-60, 60, Math.round(120 / binDeg) + 1));
  const centres = $derived(edges.slice(0, -1).map((e, i) => 0.5 * (e + edges[i + 1]!)));
  const seconds = $derived(days * 86400);

  const rows = $derived(
    centres.map((deg) => {
      const th = (deg * Math.PI) / 180;
      const dx = Math.sin(th), dz = Math.cos(th);
      const X0 = slantThickness(PYR, DET, th, density, null);
      const X1 = slantThickness(PYR, DET, th, density, chamber);
      const n0 = expectedCount(X0, th, area, dOm, seconds);
      const n1 = expectedCount(X1, th, area, dOm, seconds);
      const through = lengthInBox(DET.x, DET.z, dx, dz, chamber) > 0;
      return { deg, n0, n1, through, X0 };
    }),
  );
  const data = $derived.by(() => {
    const r = makeRng(seed);
    return rows.map((row) => poisson(r, present ? row.n1 : row.n0));
  });
  const ratioPts = $derived(
    rows.map((row, i) => ({ x: row.deg, y: (data[i]! / row.n0 - 1) * 100, yerr: (Math.sqrt(Math.max(data[i]!, 1)) / row.n0) * 100, color: row.through ? 'var(--sig-high)' : 'var(--series-1)' })),
  );
  const shadow = $derived(rows.map((r, i) => ({ ...r, d: data[i]! })).filter((r) => r.through));
  const obsS = $derived(shadow.reduce((a, r) => a + r.d, 0));
  const expS = $derived(shadow.reduce((a, r) => a + r.n0, 0));
  const z = $derived(expS > 0 ? (obsS - expS) / Math.sqrt(expS) : 0);
  const shadowRange = $derived(shadow.length ? `${shadow[0]!.deg.toFixed(0)}° to ${shadow[shadow.length - 1]!.deg.toFixed(0)}°` : 'none');
  const Emin = $derived(minimumEnergy(rows[Math.floor(rows.length / 2)]?.X0 ?? 0));

  // Drawing in metres → pixels.
  const VW = 470, VH = 230, S = 1.8, OX = VW / 2, OY = VH - 26;
  const px = (x: number) => OX + x * S, py = (z: number) => OY - z * S;
  const apex = `${px(0)},${py(PYR.height)}`;
  const fan = [-60, -40, -20, 0, 20, 40, 60];
</script>

<Widget {title} {n} {caption} kind="Simulation">
  {#snippet controls()}
    <div class="row ui">
      <Toggle bind:checked={present} label="The chamber is really there" />
      <Button onclick={() => (seed = seed + 1)}>Re-roll the muons <span class="seed">seed {seed}</span></Button>
    </div>
    <Slider bind:value={cw} min={2} max={30} step={1} label="Chamber width [m]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={ch} min={1} max={15} step={1} label="Chamber height [m]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={cx} min={-60} max={60} step={1} label="Chamber position across [m]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={cz} min={20} max={110} step={1} label="Chamber height above the base [m]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={days} min={1} max={365} log label="Exposure [days]" format={(v) => sig(v, 3)} />
    <Slider bind:value={area} min={0.1} max={10} log label="Detector area [m²]" format={(v) => sig(v, 2)} />
    <Slider bind:value={binDeg} min={2} max={6} step={1} label="Angular bin [°]" format={(v) => v.toFixed(0)} />
    <Slider bind:value={density} min={1.8} max={2.8} step={0.05} label="Stone density [g/cm³]" format={(v) => v.toFixed(2)} />
  {/snippet}
  <div class="grid">
    <div class="pane">
      <svg viewBox="0 0 {VW} {VH}" role="img" aria-label="Cross-section of a stone pyramid with a detector at the base and a hidden chamber inside">
        <line x1="0" x2={VW} y1={py(0)} y2={py(0)} class="ground" />
        <polygon points="{px(-PYR.base / 2)},{py(0)} {apex} {px(PYR.base / 2)},{py(0)}" class="stone" />
        {#each fan as deg}
          {@const th = (deg * Math.PI) / 180}
          <line x1={px(DET.x)} y1={py(DET.z)} x2={px(DET.x + 150 * Math.sin(th))} y2={py(DET.z + 150 * Math.cos(th))} class="ray" />
        {/each}
        <rect x={px(cx - cw / 2)} y={py(cz + ch / 2)} width={cw * S} height={ch * S} class="chamber" class:absent={!present} />
        <text x={px(cx)} y={py(cz + ch / 2) - 5} text-anchor="middle" class="lbl">{present ? 'hidden chamber' : 'chamber absent (outline only)'}</text>
        <polygon points="{px(DET.x) - 6},{py(0)} {px(DET.x) + 6},{py(0)} {px(DET.x)},{py(DET.z + 4)}" class="det" />
        <text x={px(DET.x) + 10} y={py(0) + 14} class="lbl">detector</text>
        <text x={VW - 6} y="14" text-anchor="end" class="lbl">cross-section, base {PYR.base} m, height {PYR.height} m</text>
      </svg>
    </div>
    <div class="pane">
      <LinePlot
        lines={[
          { x: centres, y: rows.map((r) => r.n0), label: 'expected, no chamber', color: 'var(--series-8)', dash: '6 3' },
          { x: centres, y: rows.map((r) => r.n1), label: 'expected, with this chamber', color: 'var(--series-5)' },
        ]}
        points={centres.map((c, i) => ({ x: c, y: data[i]!, yerr: Math.sqrt(data[i]!), color: rows[i]!.through ? 'var(--sig-high)' : 'var(--series-1)' }))}
        x={{ domain: [-60, 60], label: 'zenith angle in the plane of the section [°] (0 = straight up)' }}
        y={{ domain: [0, Math.max(10, ...rows.map((r) => Math.max(r.n0, r.n1, 1))) * 1.35], label: 'muons per bin' }}
        height={230}
        label="Muon counts against zenith angle with and without the hidden chamber, and the simulated data"
        format={(v) => sig(v, 4)}
      />
    </div>
  </div>
  <h5 class="ui">Data divided by the no-chamber expectation, minus 1 [%]</h5>
  <LinePlot
    points={ratioPts}
    hmarks={[{ value: 0, color: 'var(--mute)' }]}
    x={{ domain: [-60, 60], label: 'zenith angle [°]' }}
    y={{ domain: [-15, 25], label: 'excess [%]' }}
    height={190}
    label="Relative excess of the data over the no-chamber prediction against zenith angle; bins whose line of sight crosses the chamber are highlighted"
    format={(v) => sig(v, 3)}
  />
  <p class="ui out" aria-live="polite">
    Bins that look through the chamber (orange, {shadowRange}): {obsS} muons seen, {sig(expS, 4)} expected without a chamber: {z >= 0 ? 'an excess' : 'a deficit'} of <strong>{Math.abs(z).toFixed(1)}σ</strong>
    (a search that knew where to look; looking everywhere would need the look-elsewhere correction of Chapter 28). Muons need about {sig(Emin, 2)} GeV to cross the stone straight overhead.
  </p>
</Widget>

<style>
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1rem;
    align-items: center;
    width: 100%;
  }
  .seed {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.3rem;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 1rem;
    align-items: start;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .pane {
    min-width: 0;
  }
  svg {
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .ground {
    stroke: var(--line-strong);
  }
  .stone {
    fill: var(--pn);
    stroke: var(--ink-2);
    stroke-width: 1.4;
  }
  .ray {
    stroke: var(--mute);
    stroke-width: 0.8;
    stroke-dasharray: 3 3;
    opacity: 0.7;
  }
  .chamber {
    fill: var(--panel);
    stroke: var(--sig-high);
    stroke-width: 1.6;
  }
  .chamber.absent {
    fill: none;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }
  .det {
    fill: var(--series-1);
  }
  .lbl {
    font-size: 11px;
    fill: var(--ink-2);
  }
  h5 {
    margin: 0.9rem 0 0.2rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--ink-2);
    text-transform: none;
    letter-spacing: 0;
  }
  .out {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }
</style>
