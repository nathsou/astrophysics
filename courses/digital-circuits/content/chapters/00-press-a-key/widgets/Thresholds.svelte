<!--
  The digital abstraction as a promise: senders drive a wire to within 0.1 V of 0 or 5 V, receivers read
  anything above 3.5 V as 1 and anything below 1.5 V as 0. Add noise to the wire and see how much of it the
  message survives (the noise margin, 1.4 V). Numbers and the read rule are in thresholds.ts.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Slider from '$lib/components/ui/Slider.svelte';
  import { MESSAGE, V_IH, V_IL, errors, noiseMargin, received, wireVoltage } from './thresholds';

  let { n, title = 'The promise' }: { n?: string | number; title?: string } = $props();

  let noise = $state(0.8);

  const W = 640;
  const H = 270;
  const X0 = 96;
  const X1 = 632;
  const YT = 16; // 5 V
  const YB = 216; // 0 V
  const yOf = (v: number) => YB - (v / 5) * (YB - YT);
  const bw = (X1 - X0) / MESSAGE.length;
  const read = $derived(received(noise));
  const bad = $derived(errors(noise));

  const clean = $derived(
    MESSAGE.map((b, i) => `${i === 0 ? 'M' : 'L'}${X0 + i * bw} ${yOf(b ? 4.9 : 0.1)}L${X0 + (i + 1) * bw} ${yOf(b ? 4.9 : 0.1)}`).join(''),
  );
  const wire = $derived(
    MESSAGE.map((_, i) => {
      const y = yOf(wireVoltage(i, noise));
      const prev = i === 0 ? y : yOf(wireVoltage(i - 1, noise));
      const x = X0 + i * bw;
      return `${i === 0 ? 'M' : 'L'}${x} ${prev}L${x} ${y}L${x + bw} ${y}`;
    }).join(''),
  );
  const symbol = (r: number | string) => (r === 'undefined' ? '?' : String(r));
</script>

<Widget {title} {n} kind="Interactive" live={false} caption="A sender puts 0.1 V or 4.9 V on the wire; the wire adds noise; the receiver applies two thresholds. Below 1.4 V of noise every bit is read correctly; above it, bits fall into the forbidden band or cross to the wrong side.">
  {#snippet controls()}
    <Slider label="Noise on the wire (peak)" bind:value={noise} min={0} max={3} step={0.05} format={(v) => `±${v.toFixed(2)} V`} />
    <span class="verdict ui" class:ok={bad === 0} class:bad={bad > 0} role="status">{bad === 0 ? `All ${MESSAGE.length} bits read correctly.` : `${bad} of ${MESSAGE.length} bits read wrongly.`}</span>
  {/snippet}
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="A 16-bit message on a noisy wire, with the 1.5 V and 3.5 V thresholds, and what the receiver reads. {bad === 0 ? 'Every bit is read correctly.' : `${bad} bits are misread.`}">
    <!-- the three regions -->
    <rect class="r1" x={X0} y={yOf(5)} width={X1 - X0} height={yOf(V_IH) - yOf(5)} />
    <rect class="rx" x={X0} y={yOf(V_IH)} width={X1 - X0} height={yOf(V_IL) - yOf(V_IH)} />
    <rect class="r0" x={X0} y={yOf(V_IL)} width={X1 - X0} height={yOf(0) - yOf(V_IL)} />
    <line class="thr" x1={X0} x2={X1} y1={yOf(V_IH)} y2={yOf(V_IH)} />
    <line class="thr" x1={X0} x2={X1} y1={yOf(V_IL)} y2={yOf(V_IL)} />
    {#each [0, 1.5, 3.5, 5] as v (v)}<text class="tick" x={X0 - 8} y={yOf(v) + 4} text-anchor="end">{v} V</text>{/each}
    <text class="reg" x="6" y={(yOf(5) + yOf(V_IH)) / 2 + 4}>reads 1</text>
    <text class="reg" x="6" y={(yOf(V_IH) + yOf(V_IL)) / 2 + 4}>forbidden</text>
    <text class="reg" x="6" y={(yOf(V_IL) + yOf(0)) / 2 + 4}>reads 0</text>

    <path class="clean" d={clean} />
    <path class="wire" d={wire} />

    <!-- what the receiver reads -->
    <text class="lab" x="6" y="246">sent</text>
    <text class="lab" x="6" y="262">read</text>
    {#each MESSAGE as b, i (i)}
      <text class="bit" x={X0 + (i + 0.5) * bw} y="246">{b}</text>
      <text class="bit read" class:wrong={read[i] !== b} x={X0 + (i + 0.5) * bw} y="262">{symbol(read[i]!)}</text>
    {/each}
    <text class="margin" x={X1} y={yOf(V_IH) - 5} text-anchor="end">noise margin: {noiseMargin.toFixed(1)} V</text>
  </svg>
</Widget>

<style>
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font-mono);
  }
  .r1 {
    fill: color-mix(in srgb, var(--sig-high) 14%, var(--panel));
  }
  .r0 {
    fill: color-mix(in srgb, var(--sig-low) 14%, var(--panel));
  }
  .rx {
    fill: color-mix(in srgb, var(--sig-x) 10%, var(--panel));
  }
  .thr {
    stroke: var(--sig-x);
    stroke-width: 1.2;
    stroke-dasharray: 5 4;
  }
  .tick {
    font-size: 10px;
    fill: var(--mute);
  }
  .reg {
    font-size: 10.5px;
    fill: var(--ink-2);
    font-weight: 600;
  }
  .clean {
    fill: none;
    stroke: var(--mute);
    stroke-width: 1.2;
    stroke-dasharray: 3 4;
  }
  .wire {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 2.4;
    stroke-linejoin: round;
  }
  .lab {
    font-size: 10px;
    fill: var(--mute);
  }
  .bit {
    font-size: 13px;
    text-anchor: middle;
    fill: var(--fg);
  }
  .bit.read {
    fill: var(--ok);
    font-weight: 700;
  }
  .bit.read.wrong {
    fill: var(--bad);
  }
  .margin {
    font-size: 10px;
    fill: var(--sig-x);
  }
  .verdict {
    font-size: 0.86rem;
    align-self: center;
  }
  .verdict.ok {
    color: var(--ok);
  }
  .verdict.bad {
    color: var(--bad);
    font-weight: 600;
  }
</style>
