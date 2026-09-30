<!--
  Sweep an inverter's input from 0 V to 5 V and watch what each transistor does. The curve is measured on the
  analog engine (see sweep.ts). Shaded bands say which transistors conduct: the pull-up alone, both, or the
  pull-down alone. The lower panel is the current from the supply: zero except while both conduct.

    ::inverter-sweep{n="9.3" caption="…"}
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { at, bands, regime, sweep, switchingPoint, type Regime } from './sweep';

  let { n, caption, vin: initialVin = 0.6 }: { n?: string | number; caption?: string; vin?: number } = $props();

  let vin = $state(untrack(() => initialVin));
  let pWidth = $state(2);
  let scale = $state<'linear' | 'log'>('linear');

  const s = $derived(sweep(pWidth));
  const vm = $derived(switchingPoint(s));
  const b = $derived(bands(s));
  const peak = $derived(Math.max(...s.idd));

  // Geometry (SVG user units).
  const X0 = 46;
  const X1 = 388;
  const Y0 = 8;
  const Y1 = 178;
  const S0 = 206;
  const S1 = 290;
  const PANELS = [{ y0: Y0, y1: Y1 }, { y0: S0, y1: S1 }];
  const px = (v: number) => X0 + (v / s.vdd) * (X1 - X0);
  const pyv = (v: number) => Y1 - (v / s.vdd) * (Y1 - Y0);
  // Current axis: linear in mA, or log from 1 pA to the peak (a picoamp is what leaks at the rails).
  const LOG_MIN = 1e-12;
  const pyi = (i: number) => {
    if (scale === 'linear') return S1 - (i / peak) * (S1 - S0 - 6);
    const lo = Math.log10(LOG_MIN);
    const hi = Math.log10(peak);
    return S1 - ((Math.log10(Math.max(i, LOG_MIN)) - lo) / (hi - lo)) * (S1 - S0 - 6);
  };

  const curve = $derived(s.vin.map((x, i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${pyv(s.vout[i]!).toFixed(1)}`).join(''));
  const current = $derived(s.vin.map((x, i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${pyi(s.idd[i]!).toFixed(1)}`).join(''));
  const idx = $derived(Math.round((vin / s.vdd) * (s.vin.length - 1)));
  const voutNow = $derived(at(s, s.vout, vin));
  const iNow = $derived(at(s, s.idd, vin));
  const now = $derived(regime(s, idx));
  const ticks = [0, 1, 2, 3, 4, 5];

  const LABEL: Record<Regime, string> = {
    'pull-up': 'pMOS on, nMOS off: the output is tied to +5 V',
    both: 'both on: a path from +5 V to ground, through two transistors that are only half open',
    'pull-down': 'nMOS on, pMOS off: the output is tied to ground',
    neither: 'both off',
  };
  const SHORT: Record<Regime, string> = { 'pull-up': 'pMOS only', both: 'both on', 'pull-down': 'nMOS only', neither: 'neither' };

  const V = (x: number, d = 2) => `${x.toFixed(d)} V`;
  const amps = (i: number) => (i >= 1e-3 ? `${(i * 1e3).toFixed(1)} mA` : i >= 1e-6 ? `${(i * 1e6).toFixed(1)} µA` : i >= 1e-9 ? `${(i * 1e9).toFixed(1)} nA` : i >= 5e-13 ? `${(i * 1e12).toFixed(0)} pA` : '0 A');
  const stateOf = (r: string) => (r === 'off' ? 'off' : r === 'linear' ? 'on (linear)' : 'on (saturated)');

  const yTicks = $derived(scale === 'log' ? [1e-12, 1e-9, 1e-6, 1e-3].filter((t) => t <= peak) : []);
  const label = $derived(
    `Transfer curve of a CMOS inverter with a 5 V supply. The output is 5 V for inputs below 1 V and 0 V above 4 V, and falls steeply through ${V(vm)}. The supply current is a peak of ${amps(peak)} in the middle and nothing outside it.`,
  );
</script>

<Widget {n} title="One inverter, swept" subtitle="Measured on the analog engine, 201 points" kind="Lab bench" {caption} onreset={() => { vin = initialVin; pWidth = 2; scale = 'linear'; }}>
  {#snippet controls()}
    <Slider label="Input" bind:value={vin} min={0} max={5} step={0.025} format={(v) => V(v)} />
    <Segmented label="pMOS width" bind:value={pWidth} options={[{ value: 1, label: 'pMOS 1×', title: 'A p-channel transistor the same size as the n-channel one: half as strong' }, { value: 2, label: 'pMOS 2×', title: 'Twice as wide: as strong as the n-channel one' }]} />
    <Segmented label="Current axis" bind:value={scale} options={[{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }]} />
  {/snippet}

  <div class="is">
    <svg viewBox="0 0 400 320" class="plot" role="img" aria-label={label}>
      <!-- Bands: which transistors conduct. -->
      {#each b as band (band.from)}
        {#each PANELS as p (p.y0)}
          <rect x={px(band.from)} y={p.y0} width={px(band.to) - px(band.from)} height={p.y1 - p.y0} class="band {band.regime}" />
        {/each}
        <text class="bl" x={(px(band.from) + px(band.to)) / 2} y={Y0 + 14} text-anchor="middle">{SHORT[band.regime]}</text>
      {/each}

      {#each ticks as t (t)}
        <line class="grid" x1={px(t)} y1={Y0} x2={px(t)} y2={S1} />
        <text class="tick" x={px(t)} y={S1 + 13} text-anchor="middle">{t}</text>
      {/each}
      {#each ticks as t (t)}
        <line class="grid" x1={X0} y1={pyv(t)} x2={X1} y2={pyv(t)} />
        <text class="tick" x={X0 - 6} y={pyv(t) + 3} text-anchor="end">{t}</text>
      {/each}
      {#each yTicks as t (t)}
        <line class="grid" x1={X0} y1={pyi(t)} x2={X1} y2={pyi(t)} />
        <text class="tick" x={X0 - 6} y={pyi(t) + 3} text-anchor="end">{t >= 1e-3 ? '1 mA' : t >= 1e-6 ? '1 µA' : t >= 1e-9 ? '1 nA' : '1 pA'}</text>
      {/each}
      <rect class="frame" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
      <rect class="frame" x={X0} y={S0} width={X1 - X0} height={S1 - S0} />
      <text class="axis" x="12" y={(Y0 + Y1) / 2} text-anchor="middle" transform="rotate(-90 12 {(Y0 + Y1) / 2})">Vout (V)</text>
      <text class="axis" x="12" y={(S0 + S1) / 2} text-anchor="middle" transform="rotate(-90 12 {(S0 + S1) / 2})">supply</text>
      <text class="axis" x={(X0 + X1) / 2} y="316" text-anchor="middle">Vin (V)</text>
      {#if scale === 'linear'}
        <text class="axis halo" x={X1 - 4} y={S0 + 14} text-anchor="end">peak {amps(peak)}</text>
      {/if}

      <path class="curve" d={curve} />
      <path class="icurve" d={current} />

      <line class="cursor" x1={px(vin)} y1={Y0} x2={px(vin)} y2={S1} />
      <circle class="op" cx={px(vin)} cy={pyv(voutNow)} r="5" />
      <circle class="op" cx={px(vin)} cy={pyi(iNow)} r="3.5" />
    </svg>

    <div class="side ui">
      <div class="chips" aria-hidden="true">
        <span class="chip" class:on={s.mp[idx] !== 'off'}>pMOS {stateOf(s.mp[idx]!)}</span>
        <span class="chip" class:on={s.mn[idx] !== 'off'}>nMOS {stateOf(s.mn[idx]!)}</span>
      </div>
      <p class="now" aria-live="polite">
        At Vin = <b>{V(vin)}</b> the output is <b>{V(voutNow)}</b> and the supply gives <b>{amps(iNow)}</b>.
        <span class="why">{LABEL[now]}.</span>
      </p>
      <dl class="facts">
        <div><dt>Switching point</dt><dd>{V(vm)}</dd></div>
        <div><dt>Peak supply current</dt><dd>{amps(peak)}</dd></div>
        <div><dt>At either rail</dt><dd>{amps(Math.max(s.idd[0]!, s.idd[s.idd.length - 1]!))}</dd></div>
      </dl>
    </div>
  </div>
</Widget>

<style>
  .is {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 0.8rem 1.3rem;
    align-items: start;
  }
  @media (max-width: 44rem) {
    .is {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .plot {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    font-family: var(--font-mono);
  }
  .frame {
    fill: none;
    stroke: var(--line-strong);
    stroke-width: 1.2;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .tick {
    fill: var(--mute);
    font-size: 10px;
  }
  .axis {
    fill: var(--ink-2);
    font-size: 10.5px;
  }
  .axis.halo {
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
  }
  .band {
    opacity: 0.9;
  }
  .band.pull-up {
    fill: color-mix(in srgb, var(--sig-high) 13%, transparent);
  }
  .band.pull-down {
    fill: color-mix(in srgb, var(--sig-low) 15%, transparent);
  }
  .band.both {
    fill: color-mix(in srgb, var(--sig-x) 11%, transparent);
  }
  .bl {
    fill: var(--ink-2);
    font-size: 9.5px;
  }
  .curve {
    fill: none;
    stroke: var(--copper);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .icurve {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .cursor {
    stroke: var(--ink-2);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .op {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2;
  }
  .side {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .chip {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    color: var(--mute);
    background: var(--pn);
  }
  .chip.on {
    color: #fff;
    background: light-dark(#0d8a3c, #1f8d4d);
    border-color: light-dark(#0d8a3c, #63e08a);
  }
  .now {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .now b {
    font-family: var(--font-mono);
    color: var(--fg);
  }
  .why {
    display: block;
    margin-top: 0.25rem;
    color: var(--mute);
  }
  .facts {
    margin: 0;
    display: grid;
    gap: 0.25rem;
    font-size: 0.82rem;
  }
  .facts div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.2rem;
  }
  .facts dt {
    color: var(--mute);
  }
  .facts dd {
    margin: 0;
    font-family: var(--font-mono);
    color: var(--fg);
  }
</style>
