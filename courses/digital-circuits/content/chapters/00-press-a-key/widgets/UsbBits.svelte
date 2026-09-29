<!--
  The bits a USB keyboard sends when a key goes down, as voltages on the two data wires. Pick a key; the
  whole packet is drawn as the D+ and D− signals, and any field of it can be opened up bit by bit. All the
  encoding (HID report, CRC, bit stuffing, NRZI) is in usb.ts and is tested there.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import Segmented from '$lib/components/ui/Segmented.svelte';
  import { BIT_TIME, KEYS, MODIFIER, buildPacket, hidReport, voltages } from './usb';

  let { n, title = 'A keypress on the wire' }: { n?: string | number; title?: string } = $props();

  type Choice = 'a' | 'A' | 'Enter';
  let choice = $state<Choice>('a');
  let selected = $state(4);

  const report = $derived(choice === 'a' ? hidReport(MODIFIER.none, [KEYS.a!]) : choice === 'A' ? hidReport(MODIFIER.shift, [KEYS.a!]) : hidReport(MODIFIER.none, [KEYS.Enter!]));
  const packet = $derived(buildPacket(report));
  const total = $derived(packet.bits.length);
  const field = $derived(packet.fields[Math.min(selected, packet.fields.length - 1)]!);
  const fieldBits = $derived(packet.bits.slice(field.from, field.to));
  const fieldByte = $derived(selected >= 2 && selected <= 9 ? report[selected - 2]! : selected === 1 ? 0xc3 : selected === 0 ? 0x80 : undefined);

  const PLOTS: [number, number][] = [
    [32, 84],
    [118, 170],
  ];
  const HIGH = 3.3;
  /** The receiver's single-ended thresholds (USB 2.0, table 7-3): above 2.0 V is high, below 0.8 V is low. */
  const VIH = 2.0;
  const VIL = 0.8;

  // Overview strip
  const OW = 640;
  const OX0 = 34;
  const OX1 = OW - 6;
  const bitW = $derived((OX1 - OX0) / total);
  function stepPath(bits: typeof packet.bits, which: 'dPlus' | 'dMinus', x0: number, w: number, yHigh: number, yLow: number): string {
    let d = '';
    let prev: number | undefined;
    bits.forEach((b, i) => {
      const v = voltages(b.line, HIGH)[which];
      const y = v > 1.6 ? yHigh : yLow;
      const x = x0 + i * w;
      if (prev === undefined) d += `M${x.toFixed(2)} ${y}`;
      else if (prev !== y) d += `L${x.toFixed(2)} ${prev}L${x.toFixed(2)} ${y}`;
      d += `L${(x + w).toFixed(2)} ${y}`;
      prev = y;
    });
    return d;
  }
  const oPlus = $derived(stepPath(packet.bits, 'dPlus', OX0, bitW, 30, 52));
  const oMinus = $derived(stepPath(packet.bits, 'dMinus', OX0, bitW, 68, 90));

  // Detail strip
  const DX0 = 46;
  const DX1 = 634;
  const dW = $derived((DX1 - DX0) / Math.max(fieldBits.length, 1));
  const dPlus = $derived(stepPath(fieldBits, 'dPlus', DX0, dW, 32, 84));
  const dMinus = $derived(stepPath(fieldBits, 'dMinus', DX0, dW, 118, 170));
  const yV = (v: number, top: number, bottom: number) => bottom - (v / HIGH) * (bottom - top);

  const hex = (b: number) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`;
  const bin = (b: number) => b.toString(2).padStart(8, '0');
  function meaning(): string {
    if (fieldByte === undefined) return field.text;
    return `${hex(fieldByte)} = ${bin(fieldByte)}, sent from the right. ${field.text}`;
  }
  const keyName = $derived(choice === 'a' ? 'a' : choice === 'A' ? 'A (Shift + a)' : 'Enter');
</script>

{#snippet controls()}
  <Segmented
    label="Key"
    bind:value={choice}
    options={[
      { value: 'a', label: 'a' },
      { value: 'A', label: 'Shift + a' },
      { value: 'Enter', label: 'Enter' },
    ]}
  />
  <span class="facts ui">1.5 Mbit/s · {total} bit times · {(total * BIT_TIME * 1e6).toFixed(0)} µs</span>
{/snippet}

<Widget {title} {n} kind="Interactive" live={false} caption={`The keyboard tells the computer “the key ‘${keyName}’ is down” in about ${(total * BIT_TIME * 1e6).toFixed(0)} microseconds. Choose a field of the packet, or click it on the strip, to see its bits as voltages.`} {controls}>
  <div class="ub">
    <svg viewBox="0 0 {OW} 118" class="over" role="img" aria-label="The whole packet as the voltages on D+ and D−, with its fields marked">
      {#each packet.fields as f, i (i)}
        {@const x = OX0 + f.from * bitW}
        {@const w = (f.to - f.from) * bitW}
        <g>
          <rect class="band" class:on={i === selected} class:data={i >= 2 && i <= 9} x={x + 0.5} y="4" width={Math.max(1, w - 1)} height="16" rx="2" />
          {#if w > 24}<text class="bandtxt" x={x + w / 2} y="15.5">{i >= 2 && i <= 9 ? (i === 2 ? 'report' : '') : f.name}</text>{/if}
          <!-- The chips below are the keyboard-accessible way to choose a field. -->
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <rect class="hit" x={x} y="0" width={w} height="100" aria-hidden="true" onclick={() => (selected = i)} />
        </g>
      {/each}
      <path class="sig plus" d={oPlus} />
      <path class="sig minus" d={oMinus} />
      <text class="axis" x="4" y="45">D+</text>
      <text class="axis" x="4" y="83">D−</text>
      <text class="axis end" x={OX1} y="112">0 → {(total * BIT_TIME * 1e6).toFixed(0)} µs</text>
    </svg>

    <div class="chips ui" role="group" aria-label="Fields of the packet">
      {#each packet.fields as f, i (i)}
        {#if !(i >= 3 && i <= 9)}
          <button type="button" class:on={i === selected || (i === 2 && selected >= 2 && selected <= 9)} onclick={() => (selected = i === 2 ? 4 : i)}>{i === 2 ? 'report' : f.name}</button>
        {/if}
      {/each}
      {#if selected >= 2 && selected <= 9}
        <span class="sub">byte:</span>
        {#each [2, 3, 4, 5, 6, 7, 8, 9] as i (i)}
          <button type="button" class="small" class:on={i === selected} onclick={() => (selected = i)}>{packet.fields[i]!.name}</button>
        {/each}
      {/if}
    </div>

    <svg viewBox="0 0 640 200" class="detail" role="img" aria-label="The bits of the field {field.name}, as voltages on D+ and D−">
      {#each PLOTS as [top, bottom], k (k)}
        <line class="thr" x1={DX0} x2={DX1} y1={yV(VIH, top, bottom)} y2={yV(VIH, top, bottom)} />
        <line class="thr" x1={DX0} x2={DX1} y1={yV(VIL, top, bottom)} y2={yV(VIL, top, bottom)} />
        <text class="tick" x={DX0 - 6} y={top + 4} text-anchor="end">3.3 V</text>
        <text class="tick" x={DX0 - 6} y={bottom + 4} text-anchor="end">0 V</text>
      {/each}
      <text class="axis" x="4" y="14">D+</text>
      <text class="axis" x="4" y="100">D−</text>
      {#each fieldBits as b, i (i)}
        <line class="cell" x1={DX0 + i * dW} x2={DX0 + i * dW} y1="22" y2="182" />
        <text class="bit" class:stuff={b.stuffed} x={DX0 + (i + 0.5) * dW} y="196">{b.line === 'SE0' ? 'SE0' : b.value}</text>
      {/each}
      <line class="cell" x1={DX1} x2={DX1} y1="22" y2="182" />
      <path class="sig plus" d={dPlus} />
      <path class="sig minus" d={dMinus} />
      <text class="thrtxt" x={(DX0 + DX1) / 2} y="104" text-anchor="middle">the receiver reads 1 above 2.0 V and 0 below 0.8 V (the dashed lines)</text>
    </svg>

    <p class="says ui"><strong>{field.name}.</strong> {meaning()}
      {#if fieldBits.some((b) => b.stuffed)} A <em>stuffed</em> 0 was inserted after six 1s, so that the line keeps changing and the receiver’s clock stays locked.{/if}
    </p>
  </div>
</Widget>

<style>
  .ub {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
  }
  .facts {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--mute);
    align-self: center;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--font-mono);
  }
  .band {
    fill: color-mix(in srgb, var(--copper) 18%, var(--panel));
    stroke: var(--line-strong);
    stroke-width: 1;
  }
  .band.data {
    fill: color-mix(in srgb, var(--sig-high) 20%, var(--panel));
  }
  .band.on {
    stroke: var(--sig-high);
    stroke-width: 2;
  }
  .bandtxt {
    fill: var(--fg);
    font-size: 9.5px;
    text-anchor: middle;
    font-weight: 600;
  }
  .hit {
    fill: transparent;
    cursor: pointer;
  }
  .sig {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .sig.plus {
    stroke: var(--sig-high);
  }
  .sig.minus {
    stroke: var(--sig-current);
  }
  .axis {
    fill: var(--mute);
    font-size: 10.5px;
    font-weight: 600;
  }
  .axis.end {
    text-anchor: end;
    font-weight: 400;
    font-size: 9.5px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .chips button {
    border: 1px solid var(--line-strong);
    border-radius: 99px;
    background: var(--pn);
    color: var(--ink-2);
    padding: 0.16rem 0.7rem;
    font-size: 0.78rem;
    cursor: pointer;
  }
  .chips button.small {
    padding: 0.1rem 0.5rem;
    font-size: 0.7rem;
  }
  .chips button.on {
    border-color: var(--sig-high);
    color: var(--fg);
    background: color-mix(in srgb, var(--sig-high) 18%, var(--pn));
    font-weight: 600;
  }
  .chips button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  .sub {
    font-size: 0.72rem;
    color: var(--mute);
    margin-left: 0.4rem;
  }
  .detail {
    background: var(--scope-bg);
    border-radius: 6px;
    border: 1px solid var(--line-strong);
  }
  .detail .axis,
  .detail .tick {
    fill: var(--phosphor);
    opacity: 0.8;
  }
  .cell {
    stroke: var(--scope-grid);
    stroke-width: 1;
  }
  .thr {
    stroke: var(--sig-x);
    stroke-width: 1;
    stroke-dasharray: 3 4;
    opacity: 0.55;
  }
  .thrtxt {
    font-size: 9.5px;
    fill: var(--sig-x);
    opacity: 0.9;
  }
  .tick {
    font-size: 9.5px;
  }
  .bit {
    font-size: 11px;
    text-anchor: middle;
    fill: var(--phosphor);
  }
  .bit.stuff {
    fill: var(--sig-x);
    font-weight: 700;
  }
  .says {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--ink-2);
  }
</style>
