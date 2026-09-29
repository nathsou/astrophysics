<!--
  Dennard scaling on a slider. Each generation shrinks every dimension by 1/√2 (a transistor takes half the
  area). If the voltage falls with the dimensions, the power of a transistor falls just fast enough that the
  power of a square millimetre of chip stays put. If the voltage cannot fall (leakage), it doubles every
  generation, unless the clock stops rising.

    ::dennard-scaling{n="10.5"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { BASE, scale, type Regime } from './power';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  let gen = $state(6);
  let regime = $state<Regime>('dennard');
  const s = $derived(scale(gen, regime));
  const MAXG = 12;

  const REGIMES: { value: Regime; label: string; title: string }[] = [
    { value: 'dennard', label: 'Dennard: V scales', title: 'Voltage, dimensions and capacitance shrink together; the clock rises' },
    { value: 'voltage-stuck', label: 'V stuck, clock rises', title: 'The voltage cannot fall, but the clock keeps rising (what happened until about 2005)' },
    { value: 'clock-frozen', label: 'V stuck, clock frozen', title: 'The voltage cannot fall and the clock stays put (what designers do now)' },
  ];
  const COLOURS: Record<Regime, string> = { dennard: 'var(--ok)', 'voltage-stuck': 'var(--bad)', 'clock-frozen': 'var(--sig-high)' };

  const len = (m: number) => (m >= 1e-6 ? `${(m * 1e6).toPrecision(2)} µm` : `${(m * 1e9).toFixed(0)} nm`);
  const volts = (v: number) => `${v.toFixed(v < 1 ? 2 : 1)} V`;
  const hz = (f: number) => (f >= 1e9 ? `${(f / 1e9).toPrecision(2)} GHz` : `${(f / 1e6).toPrecision(2)} MHz`);
  const rel = (x: number) => (x >= 100 ? `×${x.toFixed(0)}` : x >= 10 ? `×${x.toFixed(1)}` : x >= 1 ? `×${x.toFixed(2)}` : x >= 0.01 ? `×${x.toFixed(3)}` : `×${x.toExponential(1)}`);

  // Plot: power density (log) against generation, one line per regime.
  const X0 = 46;
  const X1 = 400;
  const Y0 = 10;
  const Y1 = 160;
  const YMAX = Math.log10(2 ** MAXG);
  const px = (g: number) => X0 + (g / MAXG) * (X1 - X0);
  const py = (d: number) => Y1 - (Math.log10(d) / YMAX) * (Y1 - Y0);
  const lineFor = (r: Regime) => Array.from({ length: MAXG + 1 }, (_, g) => `${g ? 'L' : 'M'}${px(g).toFixed(1)} ${py(scale(g, r).powerDensity).toFixed(1)}`).join('');
  const label = $derived(`Power per unit area after ${gen} generations of scaling: ${rel(s.powerDensity)} the starting value.`);
</script>

<Widget {n} title="Dennard scaling" subtitle="Shrink everything by 1/√2, generation after generation" kind="Interactive" {caption} onreset={() => ((gen = 6), (regime = 'dennard'))}>
  {#snippet controls()}
    <Slider label="Generations of scaling" bind:value={gen} min={0} max={MAXG} step={1} format={(v) => `${v}`} />
    <Segmented label="What happens to the voltage and the clock" value={regime} onchange={(v) => (regime = v)} options={REGIMES} />
  {/snippet}

  <div class="ds">
    <dl class="ui">
      <div><dt>Transistor size</dt><dd>{len(BASE.length * s.length)}</dd><small>{rel(s.length)}</small></div>
      <div><dt>Supply voltage</dt><dd>{volts(BASE.voltage * s.voltage)}</dd><small>{rel(s.voltage)}</small></div>
      <div><dt>Clock</dt><dd>{hz(BASE.frequency * s.frequency)}</dd><small>{rel(s.frequency)}</small></div>
      <div><dt>Transistors per mm²</dt><dd>{rel(s.density)}</dd><small>half the area each generation</small></div>
      <div><dt>Power of one transistor</dt><dd>{rel(s.perTransistor)}</dd><small>C · V² · f</small></div>
      <div class="big" class:flat={Math.abs(s.powerDensity - 1) < 1e-9}><dt>Power per mm² of chip</dt><dd>{rel(s.powerDensity)}</dd><small>{Math.abs(s.powerDensity - 1) < 1e-9 ? 'constant: the chip does not get hotter' : 'the chip gets hotter'}</small></div>
    </dl>

    <svg viewBox="0 0 420 190" class="plot" role="img" aria-label={label}>
      {#each [1, 10, 100, 1000] as d (d)}
        <line class="grid" x1={X0} x2={X1} y1={py(d)} y2={py(d)} />
        <text class="tick" x={X0 - 6} y={py(d) + 3} text-anchor="end">×{d}</text>
      {/each}
      {#each [0, 2, 4, 6, 8, 10, 12] as g (g)}
        <line class="grid" x1={px(g)} x2={px(g)} y1={Y0} y2={Y1} />
        <text class="tick" x={px(g)} y={Y1 + 14} text-anchor="middle">{g}</text>
      {/each}
      <rect class="frame" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
      <text class="axis" x={(X0 + X1) / 2} y="186" text-anchor="middle">generations (about two years each)</text>
      {#each REGIMES as r (r.value)}
        <path class="ln" class:sel={r.value === regime} d={lineFor(r.value)} style:stroke={COLOURS[r.value]} />
      {/each}
      <line class="cur" x1={px(gen)} x2={px(gen)} y1={Y0} y2={Y1} />
      <circle class="dot" cx={px(gen)} cy={py(s.powerDensity)} r="5" style:fill={COLOURS[regime]} />
      <text class="key" x={X0 + 6} y={py(1) - 9} fill="var(--ok)">Dennard</text>
      <text class="key" x={px(6.2)} y={py(scale(6, 'clock-frozen').powerDensity) - 24} fill="var(--sig-high)">clock frozen</text>
      <text class="key" x={px(4.4)} y={py(scale(4.4, 'voltage-stuck').powerDensity) - 8} fill="var(--bad)" text-anchor="end">V stuck, clock rising</text>
    </svg>
  </div>
</Widget>

<style>
  .ds {
    display: grid;
    gap: 1rem;
  }
  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.6rem 1rem;
    margin: 0;
  }
  @media (max-width: 34rem) {
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  dl div {
    display: grid;
    gap: 0.05rem;
    border-left: 3px solid var(--line-strong);
    padding-left: 0.55rem;
  }
  dl .big {
    border-left-color: var(--bad);
  }
  dl .big.flat {
    border-left-color: var(--ok);
  }
  dt {
    font-size: 0.76rem;
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 1.1rem;
  }
  small {
    font-size: 0.72rem;
    color: var(--mute);
  }
  .plot {
    display: block;
    width: 100%;
    max-width: 38rem;
    justify-self: center;
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
    font-size: 9.5px;
  }
  .axis {
    fill: var(--ink-2);
    font-size: 10.5px;
  }
  .ln {
    fill: none;
    stroke-width: 1.8;
    opacity: 0.55;
  }
  .ln.sel {
    stroke-width: 3;
    opacity: 1;
  }
  .cur {
    stroke: var(--mute);
    stroke-dasharray: 3 3;
  }
  .dot {
    stroke: var(--panel);
    stroke-width: 1.8;
  }
  .key {
    font-size: 10px;
    font-weight: 600;
  }
</style>
