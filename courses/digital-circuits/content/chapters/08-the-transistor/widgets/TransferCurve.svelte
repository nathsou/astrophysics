<!--
  The transfer curve of the RTL inverter: output voltage against input voltage, measured on the analog
  engine (./vtc.ts sweeps the circuit of Figure 8.5 from −0.5 V to 5.5 V when the figure first appears).
  The curve is coloured by the region the transistor is in (cut-off, active, saturation). Slide the input
  and read the output, the slope (the gain) and the region. The dashed lines mark where the slope is −1:
  outside them a small error shrinks, inside them it is amplified.

    ::transfer-curve{n="8.6" caption="…"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { VCC, gainAt, noiseMargins, rtlVtc, transfer, type Region } from './vtc';

  let { title = 'An inverter’s transfer curve', caption, n }: { title?: string; caption?: string; n?: string | number } = $props();

  let vin = $state(0.5);
  const table = rtlVtc();
  const margins = noiseMargins(table);

  const S = 300;
  const L = 40;
  const B = 34;
  const T = 12;
  const R = 12;
  const px = (v: number) => L + (v / VCC) * (S - L - R);
  const py = (v: number) => T + (1 - v / VCC) * (S - T - B);

  const NAMES: Record<Region, string> = { cutoff: 'cut-off (switch open)', active: 'active (amplifier)', saturation: 'saturation (switch closed)' };
  const index = (v: number) => Math.min(table.vin.length - 1, Math.max(0, Math.round((v - table.vin[0]!) / 0.02)));
  const region = $derived(table.region![index(vin)]!);
  const vout = $derived(transfer(table, vin));
  const gain = $derived(gainAt(table, vin));

  /** Path segments of the curve, one per region. */
  const segments = (() => {
    const runs: { region: Region; pts: string[] }[] = [];
    for (let i = 0; i < table.vin.length; i++) {
      const v = table.vin[i]!;
      if (v < 0 || v > VCC) continue;
      const r = table.region![i]!;
      const pt = `${px(v).toFixed(1)} ${py(Math.min(VCC, Math.max(0, table.vout[i]!))).toFixed(1)}`;
      let cur = runs[runs.length - 1];
      if (!cur || cur.region !== r) {
        // Start the next run at the last point of the previous one, so the segments join up.
        cur = { region: r, pts: cur ? [cur.pts[cur.pts.length - 1]!] : [] };
        runs.push(cur);
      }
      cur.pts.push(pt);
    }
    return runs.map((s) => ({ region: s.region, d: 'M' + s.pts.join(' L') }));
  })();

  const summary = $derived(
    `Input ${vin.toFixed(2)} volts, output ${vout.toFixed(2)} volts, gain ${gain.toFixed(1)}, transistor ${NAMES[region]}.`,
  );
</script>

<Widget {title} {caption} {n} kind="Interactive" onreset={() => (vin = 0.5)}>
  {#snippet controls()}
    <Slider bind:value={vin} min={0} max={VCC} step={0.01} label="Input voltage" format={(v) => `${v.toFixed(2)} V`} />
  {/snippet}

  <div class="tc">
    <svg viewBox="0 0 {S} {S}" role="img" aria-label="Output voltage of an RTL inverter against input voltage. {summary}">
      {#if margins}
        <rect class="band" x={px(margins.vil)} y={T} width={px(margins.vih) - px(margins.vil)} height={S - T - B} />
      {/if}
      {#each [0, 1, 2, 3, 4, 5] as v (v)}
        <line class="grid" x1={px(v)} x2={px(v)} y1={T} y2={S - B} />
        <line class="grid" x1={L} x2={S - R} y1={py(v)} y2={py(v)} />
        <text class="tick" x={px(v)} y={S - B + 14} text-anchor="middle">{v}</text>
        <text class="tick" x={L - 6} y={py(v)} text-anchor="end" dominant-baseline="middle">{v}</text>
      {/each}
      <text class="tick" x={(L + S - R) / 2} y={S - 4} text-anchor="middle">input voltage (V)</text>
      <text class="tick" x="8" y={(T + S - B) / 2} text-anchor="middle" transform="rotate(-90 8 {(T + S - B) / 2})">output voltage (V)</text>
      {#if margins}
        <line class="mark" x1={px(margins.vil)} x2={px(margins.vil)} y1={T} y2={S - B} />
        <line class="mark" x1={px(margins.vih)} x2={px(margins.vih)} y1={T} y2={S - B} />
        <text class="mk" x={px(margins.vih) + 4} y={T + 12}>slope −1</text>
      {/if}
      {#each segments as s, i (i)}
        <path class="curve {s.region}" d={s.d} />
      {/each}
      <line class="drop" x1={px(vin)} x2={px(vin)} y1={S - B} y2={py(vout)} />
      <line class="drop" x1={L} x2={px(vin)} y1={py(vout)} y2={py(vout)} />
      <circle class="dot" cx={px(vin)} cy={py(vout)} r="6" />
    </svg>

    <div class="side ui">
      <dl class="read">
        <div>
          <dt>Output</dt>
          <dd class="big">{vout.toFixed(2)} V</dd>
        </div>
        <div>
          <dt>Gain, ΔVout ÷ ΔVin</dt>
          <dd class="big" class:steep={Math.abs(gain) > 1}>{gain.toFixed(1)}</dd>
          <dd class="sub">{Math.abs(gain) > 1 ? 'steeper than −1: errors are amplified' : 'flatter than −1: errors shrink'}</dd>
        </div>
        <div class="wide">
          <dt>Transistor</dt>
          <dd class="big">{NAMES[region]}</dd>
        </div>
      </dl>
      <ul class="legend" aria-label="Key">
        <li><i class="ln cutoff"></i> cut-off</li>
        <li><i class="ln active"></i> active</li>
        <li><i class="ln saturation"></i> saturation</li>
        <li><i class="bd"></i> gain steeper than −1</li>
      </ul>
      {#if margins}
        <p class="note">Any input below {margins.vil.toFixed(2)} V is a solid 0 (it leaves the output at {margins.voh.toFixed(2)} V), and any above {margins.vih.toFixed(2)} V a solid 1 ({margins.vol.toFixed(2)} V out). Noise margins: {margins.nml.toFixed(2)} V for a 0, {margins.nmh.toFixed(2)} V for a 1.</p>
      {/if}
    </div>
    <p class="sr-only" role="status" aria-live="polite">{summary}</p>
  </div>
</Widget>

<style>
  .tc {
    display: grid;
    grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
    gap: 1rem 1.5rem;
    align-items: start;
  }
  @media (max-width: 44rem) {
    .tc {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .grid {
    stroke: color-mix(in srgb, var(--fg) 10%, transparent);
  }
  .tick {
    fill: var(--mute);
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .band {
    fill: color-mix(in srgb, var(--copper) 16%, transparent);
  }
  .mark {
    stroke: var(--copper);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
  }
  .mk {
    fill: var(--copper-ink);
    font-family: var(--font-mono);
    font-size: 10px;
  }
  .curve {
    fill: none;
    stroke-width: 3.4;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .curve.cutoff {
    stroke: var(--sig-low);
  }
  .curve.active {
    stroke: var(--sig-current);
  }
  .curve.saturation {
    stroke: var(--sig-high);
  }
  .drop {
    stroke: var(--fg);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.55;
  }
  .dot {
    fill: var(--sig-current);
    stroke: var(--panel);
    stroke-width: 2;
  }
  .side {
    display: grid;
    gap: 0.7rem;
    min-width: 0;
  }
  .read {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0;
  }
  .read > div {
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--pn);
    min-width: 0;
  }
  .wide {
    grid-column: 1 / -1;
  }
  dt {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mute);
  }
  dd {
    margin: 0;
  }
  .big {
    font-family: var(--font-mono);
    font-size: 1.02rem;
    font-weight: 500;
    color: var(--fg);
    font-variant-numeric: tabular-nums;
  }
  .big.steep {
    color: var(--copper-ink);
  }
  .sub,
  .note {
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--ink-2);
    margin: 0;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .ln {
    display: inline-block;
    width: 1.1rem;
    border-top: 3px solid;
    border-radius: 2px;
  }
  .ln.cutoff {
    border-color: var(--sig-low);
  }
  .ln.active {
    border-color: var(--sig-current);
  }
  .ln.saturation {
    border-color: var(--sig-high);
  }
  .bd {
    display: inline-block;
    width: 0.9rem;
    height: 0.9rem;
    background: color-mix(in srgb, var(--copper) 20%, transparent);
    border: 1px dashed var(--copper);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
