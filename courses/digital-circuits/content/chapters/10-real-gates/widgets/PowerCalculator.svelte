<!--
  Dynamic and static power of CMOS logic, P = α·C·V²·f + leakage, as a calculator with two presets (one gate
  on a bench, a billion-transistor chip). The plot shows power against clock frequency at the chosen supply
  voltage and, dashed, at 5 V, with a line at about what a heat sink and fan can remove.

    ::power-calculator{n="10.4"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { PRESETS, dynamicPower, energyPerCycle, heatFlux, powerAt, staticPower, totalPower, type Chip } from './power';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  type Preset = keyof typeof PRESETS;
  let preset = $state<Preset>('chip');
  let chip = $state<Chip>({ ...PRESETS.chip.chip });

  function choose(p: Preset) {
    preset = p;
    chip = { ...PRESETS[p].chip };
  }

  const dyn = $derived(dynamicPower(chip));
  const stat = $derived(staticPower(chip));
  const total = $derived(dyn + stat);
  const cTotal = $derived(chip.nodes * chip.cNode);

  const si = (x: number, unit: string): string => {
    const steps: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
    if (!(x > 0)) return `0 ${unit}`;
    const [m, p] = steps.find(([m]) => x >= m * 0.9995) ?? steps[steps.length - 1]!;
    const v = x / m;
    return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${p}${unit}`;
  };
  const count = (x: number) => (x >= 1e9 ? `${(x / 1e9).toPrecision(2)} billion` : x >= 1e6 ? `${(x / 1e6).toPrecision(3)} million` : x >= 1e3 ? `${(x / 1e3).toPrecision(3)} thousand` : `${Math.round(x)}`);

  // Log–log plot of power against frequency.
  const FMIN = 1e6;
  const FMAX = 1e10;
  const PMIN = 1e-5;
  const PMAX = 1e4;
  const X0 = 52;
  const X1 = 400;
  const Y0 = 10;
  const Y1 = 176;
  const px = (f: number) => X0 + ((Math.log10(f) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN))) * (X1 - X0);
  const py = (p: number) => Y1 - ((Math.log10(Math.min(PMAX, Math.max(PMIN, p))) - Math.log10(PMIN)) / (Math.log10(PMAX) - Math.log10(PMIN))) * (Y1 - Y0);
  const fs = Array.from({ length: 41 }, (_, i) => 10 ** (6 + (i * 4) / 40));
  const curve = (vdd: number) => fs.map((f, i) => `${i ? 'L' : 'M'}${px(f).toFixed(1)} ${py(powerAt(chip, f, vdd)).toFixed(1)}`).join('');
  const LIMIT = 150;
  const PTICKS: [number, string][] = [[1e-4, '100 µW'], [1e-2, '10 mW'], [1, '1 W'], [1e2, '100 W'], [1e4, '10 kW']];
  const FTICKS: [number, string][] = [[1e6, '1 MHz'], [1e7, '10 MHz'], [1e8, '100 MHz'], [1e9, '1 GHz'], [1e10, '10 GHz']];
  const die = 1.5;
  const label = $derived(`Power against clock frequency. At ${si(chip.f, 'Hz')} and ${chip.vdd.toFixed(2)} volts the logic draws ${si(total, 'W')}.`);
</script>

<Widget {n} title="Where the power goes" subtitle="P = α · C · V² · f, plus leakage" kind="Calculator" {caption} onreset={() => choose(preset)}>
  {#snippet controls()}
    <Segmented label="Example" value={preset} onchange={choose} options={(Object.keys(PRESETS) as Preset[]).map((k) => ({ value: k, label: PRESETS[k].label }))} />
  {/snippet}

  <div class="pc">
    <div class="sliders">
      <Slider label="Switching nodes" bind:value={chip.nodes} min={1} max={1e10} log format={(v) => count(v)} />
      <Slider label="Capacitance per node" bind:value={chip.cNode} min={1e-16} max={1e-10} log format={(v) => si(v, 'F')} />
      <Slider label="Supply voltage V" bind:value={chip.vdd} min={0.5} max={5} step={0.05} format={(v) => `${v.toFixed(2)}\u202fV`} />
      <Slider label="Clock frequency f" bind:value={chip.f} min={FMIN} max={FMAX} log format={(v) => si(v, 'Hz')} />
      <Slider label="Activity α" bind:value={chip.alpha} min={0.01} max={1} step={0.01} format={(v) => v.toFixed(2)} />
      <Slider label="Leakage per node" bind:value={chip.leak} min={1e-12} max={1e-7} log format={(v) => si(v, 'A')} />
    </div>

    <div class="out">
      <p class="note ui">{PRESETS[preset].note}</p>
      <dl class="ui">
        <div class="big"><dt>Total power</dt><dd>{si(total, 'W')}</dd></div>
        <div><dt>Dynamic α C V² f</dt><dd>{si(dyn, 'W')}</dd></div>
        <div><dt>Static (leakage)</dt><dd>{si(stat, 'W')}</dd></div>
        <div><dt>Switched capacitance</dt><dd>{si(cTotal, 'F')}</dd></div>
        <div><dt>Energy per cycle C V²</dt><dd>{si(energyPerCycle(chip.alpha * cTotal, chip.vdd), 'J')}</dd></div>
        <div><dt>On a 1.5 cm² die</dt><dd>{heatFlux(total, die).toFixed(total / die >= 10 ? 0 : 2)} W/cm²</dd></div>
      </dl>
      <p class="verdict ui" class:hot={total > LIMIT} role="status">
        {#if total > LIMIT}
          {si(total, 'W')} is more than a heat sink and a fan can remove from a chip of this size (about {LIMIT} W). Lower the voltage, the clock or the activity.
        {:else}
          Within what air cooling can handle ({si(total, 'W')} against about {LIMIT} W).
        {/if}
      </p>
    </div>

    <svg viewBox="0 0 420 210" class="plot" role="img" aria-label={label}>
      {#each PTICKS as [p, name] (p)}
        <line class="grid" x1={X0} x2={X1} y1={py(p)} y2={py(p)} />
        <text class="tick" x={X0 - 6} y={py(p) + 3} text-anchor="end">{name}</text>
      {/each}
      {#each FTICKS as [f, name] (f)}
        <line class="grid" x1={px(f)} x2={px(f)} y1={Y0} y2={Y1} />
        <text class="tick" x={px(f)} y={Y1 + 14} text-anchor="middle">{name}</text>
      {/each}
      <rect class="frame" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
      <line class="limit" x1={X0} x2={X1} y1={py(LIMIT)} y2={py(LIMIT)} />
      <text class="lim" x={X0 + 6} y={py(LIMIT) - 5}>≈ {LIMIT} W: air-cooling limit</text>
      <path class="c5" d={curve(5)} />
      <path class="cnow" d={curve(chip.vdd)} />
      <circle class="dot" cx={px(chip.f)} cy={py(total)} r="5" />
      <text class="axis" x={(X0 + X1) / 2} y="206" text-anchor="middle">clock frequency</text>
      <text class="key now" x={X1 - 6} y={Y1 - 24} text-anchor="end">solid: at {chip.vdd.toFixed(2)} V</text>
      <text class="key five" x={X1 - 6} y={Y1 - 10} text-anchor="end">dashed: at 5 V</text>
    </svg>
  </div>
</Widget>

<style>
  .pc {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1rem 1.6rem;
    align-items: start;
  }
  .plot {
    grid-column: 1 / -1;
    display: block;
    width: 100%;
    max-width: 38rem;
    justify-self: center;
    height: auto;
    overflow: visible;
    font-family: var(--font-mono);
  }
  @media (max-width: 44rem) {
    .pc {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .sliders {
    display: grid;
    gap: 0.35rem;
  }
  .out {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .note {
    margin: 0;
    font-size: 0.82rem;
    color: var(--ink-2);
  }
  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0.9rem;
    margin: 0;
  }
  dl div {
    display: grid;
    gap: 0.05rem;
    border-left: 3px solid var(--line-strong);
    padding-left: 0.55rem;
  }
  dl .big {
    grid-column: 1 / -1;
    border-left-color: var(--copper);
  }
  dt {
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.98rem;
  }
  dl .big dd {
    font-size: 1.5rem;
  }
  .verdict {
    margin: 0;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    border: 1px solid var(--ok);
    background: var(--ok-soft);
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .verdict.hot {
    border-color: var(--bad);
    background: var(--bad-soft);
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
    font-size: 9.5px;
  }
  .axis {
    fill: var(--ink-2);
    font-size: 10.5px;
  }
  .limit {
    stroke: var(--bad);
    stroke-width: 1.4;
    stroke-dasharray: 5 4;
  }
  .lim {
    fill: var(--bad);
    font-size: 10px;
  }
  .cnow {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 2.6;
  }
  .c5 {
    fill: none;
    stroke: var(--sig-low);
    stroke-width: 1.8;
    stroke-dasharray: 5 4;
  }
  .dot {
    fill: var(--copper);
    stroke: var(--panel);
    stroke-width: 1.8;
  }
  .key {
    font-size: 10px;
    font-weight: 600;
  }
  .key.now {
    fill: var(--sig-high);
  }
  .key.five {
    fill: var(--sig-low);
  }
</style>
