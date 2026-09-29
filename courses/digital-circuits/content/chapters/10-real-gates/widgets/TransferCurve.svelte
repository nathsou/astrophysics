<!--
  The voltage transfer curve of a CMOS inverter, measured on the analog engine by stepping the input from
  0 V to the supply (see vtc.ts). The points where the slope is −1 give VIL and VIH; the shaded bands are
  the noise margins; the hatched band between them is the forbidden zone where a gate's answer is not
  guaranteed. Sliders change the supply, the strength of the pMOS relative to the nMOS, and the threshold
  voltage; a noise slider shows whether a noisy 0 and a noisy 1 are still read correctly by the next gate.

    ::transfer-curve{n="10.1"}
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { DEFAULTS, judge, levels, sweep, type Reading } from './vtc';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  // The supply presets also pick a sensible threshold: a 1 V threshold would leave a 1.8 V inverter hardly any room.
  const PRESETS: Record<number, { vt: number; noise: number }> = { 5: { vt: 1, noise: 1.2 }, 3.3: { vt: 0.8, noise: 0.8 }, 1.8: { vt: 0.5, noise: 0.45 } };
  let vdd = $state(5);
  let strength = $state(1); // kp / kn
  let vt = $state(1);
  let noise = $state(1.2);
  let vin = $state(2.3);

  function pick(v: number) {
    const p = PRESETS[v]!;
    vdd = v;
    vt = p.vt;
    noise = p.noise;
    vin = Math.min(vin, v);
  }
  function reset() {
    strength = 1;
    pick(5);
    vin = 2.3;
  }

  const params = $derived({ ...DEFAULTS, vdd, vt, kp: DEFAULTS.kn * strength });
  const curve = $derived(sweep(params));
  const lv = $derived(levels(curve, vdd));
  const noiseV = $derived(Math.min(noise, vdd / 2));
  const verdict = $derived(judge(curve, lv, noiseV));

  // Geometry (SVG user units).
  const X0 = 48;
  const X1 = 388;
  const Y0 = 10; // top of the main plot
  const Y1 = 280; // its bottom
  const S0 = 318; // the current strip
  const S1 = 366;
  const PANELS: [number, number][] = [[Y0, Y1], [S0, S1]];
  const px = (v: number) => X0 + (v / vdd) * (X1 - X0);
  const py = (v: number) => Y1 - (v / vdd) * (Y1 - Y0);
  const peak = $derived(Math.max(1e-9, ...curve.idd));
  const sy = (i: number) => S1 - (i / peak) * (S1 - S0 - 4);

  const path = $derived(curve.vin.map((x, i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)} ${py(curve.vout[i]!).toFixed(1)}`).join(''));
  const area = $derived(
    `M${px(0)} ${S1}` + curve.vin.map((x, i) => `L${px(x).toFixed(1)} ${sy(curve.idd[i]!).toFixed(1)}`).join('') + `L${px(vdd)} ${S1}Z`,
  );
  const ticks = $derived(vdd <= 2 ? [0, 0.5, 1, 1.5, vdd] : vdd < 4 ? [0, 1, 2, 3, vdd] : [0, 1, 2, 3, 4, 5]);

  const at = (arr: number[], x: number) => {
    const t = (x / vdd) * (arr.length - 1);
    const i = Math.max(0, Math.min(arr.length - 2, Math.floor(t)));
    const f = t - i;
    return arr[i]! * (1 - f) + arr[i + 1]! * f;
  };
  const voutNow = $derived(at(curve.vout, vin));
  const iNow = $derived(at(curve.idd, vin));

  const V = (x: number, d = 2) => `${x.toFixed(d)} V`;
  const mA = (i: number) => (i >= 1e-3 ? `${(i * 1e3).toFixed(2)} mA` : i >= 1e-6 ? `${(i * 1e6).toFixed(1)} µA` : i >= 1e-9 ? `${(i * 1e9).toFixed(1)} nA` : '≈ 0');

  const say = (r: Reading, sent: 0 | 1) =>
    r === '0' || r === '1' ? `read correctly as ${r}` : r === 'wrong' ? `read as ${sent ? 0 : 1}: an error` : 'in the forbidden zone: the answer is not guaranteed';
  const cls = (r: Reading) => (r === 'wrong' ? 'bad' : r === 'forbidden' ? 'maybe' : 'ok');

  const label = $derived(
    lv.vil === null || lv.vih === null
      ? `Voltage transfer curve of an inverter with a ${V(vdd, 1)} supply. Its gain never exceeds one, so it has no valid logic levels.`
      : `Voltage transfer curve of an inverter with a ${V(vdd, 1)} supply. VOH ${V(lv.voh)}, VOL ${V(lv.vol)}, VIL ${V(lv.vil)}, VIH ${V(lv.vih)}, noise margins ${V(lv.nml!)} low and ${V(lv.nmh!)} high.`,
  );
</script>

<Widget {n} title="Transfer curve" subtitle="A CMOS inverter, measured on the analog engine" kind="Lab bench" {caption} onreset={reset}>
  {#snippet controls()}
    <Segmented label="Supply voltage" value={vdd} onchange={pick} options={[{ value: 5, label: '5 V' }, { value: 3.3, label: '3.3 V' }, { value: 1.8, label: '1.8 V' }]} />
    <Slider label="pMOS strength kp/kn" bind:value={strength} min={0.25} max={4} log format={(v) => `${v.toFixed(2)}×`} />
    <Slider label="Threshold Vt" bind:value={vt} min={0.2} max={Math.min(2, vdd / 2 - 0.05)} step={0.05} format={(v) => V(v)} />
    <Slider label="Input Vin" bind:value={vin} min={0} max={vdd} step={vdd / 200} format={(v) => V(v)} />
    <Slider label="Noise on the wire" bind:value={noise} min={0} max={vdd / 2} step={0.05} format={(v) => V(Math.min(v, vdd / 2))} />
  {/snippet}

  <div class="tc">
    <svg viewBox="0 0 400 400" class="plot" role="img" aria-label={label}>
      <defs>
        <pattern id="tc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="hatch" />
        </pattern>
      </defs>

      <!-- Bands: the forbidden zone (hatched) and the two noise margins. -->
      {#if lv.vil !== null && lv.vih !== null}
        {@const il = lv.vil}
        {@const ih = lv.vih}
        {#each PANELS as [a, b] (a)}
          <rect x={px(il)} y={a} width={px(ih) - px(il)} height={b - a} fill="url(#tc-hatch)" class="zone" />
          <rect x={px(lv.vol)} y={a} width={px(il) - px(lv.vol)} height={b - a} class="band low" />
          <rect x={px(ih)} y={a} width={px(lv.voh) - px(ih)} height={b - a} class="band high" />
        {/each}
        <text class="bl low" x={(px(lv.vol) + px(lv.vil)) / 2} y={(Y0 + Y1) / 2} text-anchor="middle">NML</text>
        <text class="bl high" x={(px(lv.vih) + px(lv.voh)) / 2} y={(Y0 + Y1) / 2} text-anchor="middle">NMH</text>
      {/if}

      <!-- Grid, axes, ticks. -->
      {#each ticks as t (t)}
        <line class="grid" x1={px(t)} y1={Y0} x2={px(t)} y2={Y1} />
        <line class="grid" x1={X0} y1={py(t)} x2={X1} y2={py(t)} />
        <text class="tick" x={px(t)} y={Y1 + 14} text-anchor="middle">{t}</text>
        <text class="tick" x={X0 - 6} y={py(t) + 3} text-anchor="end">{t}</text>
      {/each}
      <rect class="frame" x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
      <rect class="frame" x={X0} y={S0} width={X1 - X0} height={S1 - S0} />
      <line class="diag" x1={px(0)} y1={py(0)} x2={px(vdd)} y2={py(vdd)} />
      <text class="axis" x="14" y={(Y0 + Y1) / 2} text-anchor="middle" transform="rotate(-90 14 {(Y0 + Y1) / 2})">Vout (V)</text>
      <text class="axis" x={(X0 + X1) / 2} y="394" text-anchor="middle">Vin (V)</text>
      <text class="axis halo" x={X0 + 6} y={S0 + 12}>supply current, peak {mA(peak)}</text>

      <!-- The curve and the supply current. -->
      <path class="ia" d={area} />
      <path class="curve" d={path} />

      <!-- VIL and VIH: where the slope is −1. -->
      {#if lv.vil !== null && lv.vih !== null}
        <circle class="pt" cx={px(lv.vil)} cy={py(lv.voutAtVil!)} r="4.5" />
        <circle class="pt" cx={px(lv.vih)} cy={py(lv.voutAtVih!)} r="4.5" />
        <text class="ptl" x={px(lv.vil) - 8} y={py(lv.voutAtVil!) - 6} text-anchor="end">VIL {lv.vil.toFixed(2)}</text>
        <text class="ptl" x={px(lv.vih) + 8} y={py(lv.voutAtVih!) + 15}>VIH {lv.vih.toFixed(2)}</text>
      {/if}

      <!-- Noise: the worst case for a sent 0 and a sent 1, and what the receiver makes of them. -->
      {#if noiseV > 0}
        <g class="noise {cls(verdict.low)}">
          <line x1={px(lv.vol)} y1={Y1 - 5} x2={px(verdict.lowIn)} y2={Y1 - 5} class="span" />
          <line x1={px(verdict.lowIn)} y1={Y1} x2={px(verdict.lowIn)} y2={py(verdict.lowOut)} class="drop" />
          <rect x={px(verdict.lowIn) - 4} y={py(verdict.lowOut) - 4} width="8" height="8" class="nd" />
        </g>
        <g class="noise {cls(verdict.high)}">
          <line x1={px(verdict.highIn)} y1={Y1 - 5} x2={px(lv.voh)} y2={Y1 - 5} class="span" />
          <line x1={px(verdict.highIn)} y1={Y1} x2={px(verdict.highIn)} y2={py(verdict.highOut)} class="drop" />
          <rect x={px(verdict.highIn) - 4} y={py(verdict.highOut) - 4} width="8" height="8" class="nd" />
        </g>
      {/if}

      <!-- The operating point. -->
      <line class="cursor" x1={px(vin)} y1={Y0} x2={px(vin)} y2={S1} />
      <circle class="op" cx={px(vin)} cy={py(voutNow)} r="5" />
      <circle class="op" cx={px(vin)} cy={sy(iNow)} r="3.5" />
    </svg>

    <div class="side ui">
      <dl class="levels">
        <div><dt>VOH</dt><dd>{V(lv.voh)}</dd></div>
        <div><dt>VOL</dt><dd>{V(lv.vol)}</dd></div>
        <div><dt>VIH</dt><dd>{lv.vih === null ? '–' : V(lv.vih)}</dd></div>
        <div><dt>VIL</dt><dd>{lv.vil === null ? '–' : V(lv.vil)}</dd></div>
        <div class="m"><dt>NMH = VOH − VIH</dt><dd>{lv.nmh === null ? '–' : V(lv.nmh)}</dd></div>
        <div class="m"><dt>NML = VIL − VOL</dt><dd>{lv.nml === null ? '–' : V(lv.nml)}</dd></div>
        <div><dt>Switching point Vm</dt><dd>{V(lv.vm)}</dd></div>
        <div><dt>Peak gain</dt><dd>{lv.gain.toFixed(1)}×</dd></div>
      </dl>

      <p class="now" aria-live="polite">
        At Vin = <b>{V(vin)}</b> the output is <b>{V(voutNow)}</b> and the supply gives <b>{mA(iNow)}</b>.
      </p>

      {#if lv.vil === null || lv.vih === null}
        <p class="verdict maybe" role="status">The gain never reaches 1, so no input level is guaranteed to give a clean output. This inverter regenerates nothing: it is not a logic gate.</p>
      {:else}
        <div class="verdict" role="status">
          <p class={cls(verdict.low)}>
            <b>A 0 with +{V(noiseV)} of noise</b> arrives as {V(verdict.lowIn)}: {say(verdict.low, 0)}. The receiver outputs {V(verdict.lowOut)}.
          </p>
          <p class={cls(verdict.high)}>
            <b>A 1 with −{V(noiseV)} of noise</b> arrives as {V(verdict.highIn)}: {say(verdict.high, 1)}. The receiver outputs {V(verdict.highOut)}.
          </p>
        </div>
      {/if}
    </div>
  </div>
</Widget>

<style>
  .tc {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 1rem 1.4rem;
    align-items: start;
  }
  @media (max-width: 44rem) {
    .tc {
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
  .diag {
    stroke: var(--mute);
    stroke-width: 1.2;
    stroke-dasharray: 4 4;
    opacity: 0.7;
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
  .hatch {
    stroke: var(--sig-x);
    stroke-width: 1.3;
    opacity: 0.55;
  }
  .zone {
    opacity: 0.8;
  }
  .band.low {
    fill: var(--sig-low);
    opacity: 0.2;
  }
  .band.high {
    fill: var(--sig-high);
    opacity: 0.2;
  }
  .bl {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .bl.low {
    fill: var(--sig-low);
  }
  .bl.high {
    fill: var(--sig-high);
  }
  .curve {
    fill: none;
    stroke: var(--fg);
    stroke-width: 2.6;
    stroke-linejoin: round;
  }
  .ia {
    fill: var(--sig-current);
    opacity: 0.28;
  }
  .pt {
    fill: var(--panel);
    stroke: var(--copper);
    stroke-width: 2.4;
  }
  .ptl {
    fill: var(--copper-ink);
    font-size: 10.5px;
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
  }
  .cursor {
    stroke: var(--sig-current);
    stroke-width: 1.4;
    stroke-dasharray: 3 3;
  }
  .op {
    fill: var(--sig-current);
    stroke: var(--panel);
    stroke-width: 1.6;
  }
  .noise .span {
    stroke-width: 4;
    stroke-linecap: round;
  }
  .noise .drop {
    stroke-width: 1.6;
    stroke-dasharray: 3 3;
  }
  .noise .nd {
    stroke: var(--panel);
    stroke-width: 1.4;
  }
  .noise.ok .span,
  .noise.ok .drop {
    stroke: var(--ok);
  }
  .noise.ok .nd {
    fill: var(--ok);
  }
  .noise.maybe .span,
  .noise.maybe .drop {
    stroke: var(--maybe);
  }
  .noise.maybe .nd {
    fill: var(--maybe);
  }
  .noise.bad .span,
  .noise.bad .drop {
    stroke: var(--bad);
  }
  .noise.bad .nd {
    fill: var(--bad);
  }

  .side {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }
  .levels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem 0.8rem;
    margin: 0;
    font-size: 0.84rem;
  }
  .levels div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.2rem;
  }
  .levels .m {
    grid-column: 1 / -1;
  }
  dt {
    color: var(--ink-2);
  }
  dd {
    margin: 0;
    font-family: var(--font-mono);
    font-weight: 600;
    white-space: nowrap;
  }
  .now {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .verdict {
    display: grid;
    gap: 0.45rem;
  }
  .verdict p,
  p.verdict {
    margin: 0;
    padding: 0.5rem 0.65rem;
    border-radius: 6px;
    font-size: 0.84rem;
    line-height: 1.45;
    border: 1px solid transparent;
  }
  .verdict p.ok {
    background: var(--ok-soft);
    border-color: var(--ok);
  }
  .verdict p.maybe,
  p.verdict.maybe {
    background: var(--maybe-soft);
    border-color: var(--maybe);
  }
  .verdict p.bad {
    background: var(--bad-soft);
    border-color: var(--bad);
  }
</style>
