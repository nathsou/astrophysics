<!--
  The GAL22V10's fuse map, to scale: 132 rows of 44 columns (the AND array), then the 20 macrocell configuration
  fuses and the 64 signature fuses. Regions come from the model's own tables (pld/devices/gal22v10.ts).

    ::gal-fuse-layout{}
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { ARRAY_FUSES, COLUMNS, CONFIG_BASE, FUSE_COUNT, OLMC_PINS, PRODUCT_TERMS, ROWS, SIGNATURE_BASE, columnSignal, olmcRows, rowInfo } from '$lib/pld/devices/gal22v10';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const CW = 8;
  const RH = 3.2;
  const LEFT = 8;
  const TOP = 58;
  const arrayW = COLUMNS * CW;
  const arrayH = ROWS * RH;
  const W = LEFT + arrayW + 250;
  const H = TOP + arrayH + 130;

  const tone = (pin: number): number => OLMC_PINS.indexOf(pin as (typeof OLMC_PINS)[number]) % 2;
  const groups = OLMC_PINS.map((pin) => olmcRows(pin));
  const signals = Array.from({ length: COLUMNS / 2 }, (_, k) => columnSignal(2 * k));
</script>

<Widget title="GAL22V10 fuse map layout" {n} kind="Diagram" live={false} {caption}>
  <div class="wrap">
    <svg viewBox="0 0 {W} {H}" role="img" aria-label="Fuse map: {ROWS} rows of {COLUMNS} array fuses ({ARRAY_FUSES.toLocaleString('en-GB')}), then 20 configuration fuses and 64 signature fuses, {FUSE_COUNT.toLocaleString('en-GB')} in all">
      <!-- column headers: the pin of each pair of columns -->
      {#each signals as s, k (k)}
        <text class="pin" x={LEFT + k * 2 * CW + CW} y={TOP - 8} text-anchor="middle">{s.pin}</text>
      {/each}
      <text class="sub" x={LEFT} y="12">Column pairs, true then complement, by the pin they read:</text>
      <text class="sub" x={LEFT} y="26">pins 1 to 11 and 13 are dedicated inputs; pins 14 to 23 read the macrocells</text>
      {#each Array.from({ length: ROWS }, (_, r) => r) as r (r)}
        {@const info = rowInfo(r)}
        <rect
          x={LEFT}
          y={TOP + r * RH}
          width={arrayW}
          height={RH - 0.4}
          class="row {info.kind}"
          class:alt={info.pin !== undefined && tone(info.pin) === 1}
          class:oe={info.kind === 'OE'}
        />
      {/each}
      {#each Array.from({ length: COLUMNS / 2 + 1 }, (_, k) => k) as k (k)}
        <path class="grid" d="M{LEFT + k * 2 * CW} {TOP} V{TOP + arrayH}" />
      {/each}
      <!-- labels to the right -->
      <text class="lab" x={LEFT + arrayW + 10} y={TOP + 3}>row 0: AR</text>
      {#each groups as g (g.pin)}
        {@const y0 = TOP + g.oeRow * RH}
        {@const h = (g.terms + 1) * RH}
        <path class="brace" d="M{LEFT + arrayW + 6} {y0 + 1} V{y0 + h - 1}" />
        <text class="lab" x={LEFT + arrayW + 12} y={y0 + h / 2 + 4}>pin {g.pin}: rows {g.oeRow}–{g.oeRow + g.terms} ({PRODUCT_TERMS[g.pin]} terms)</text>
      {/each}
      <text class="lab" x={LEFT + arrayW + 10} y={TOP + (ROWS - 1) * RH + 14}>row {ROWS - 1}: SP</text>
      <text class="sub" x={LEFT + arrayW + 12} y={TOP + arrayH + 26}>the first row of a group is its output enable</text>

      <!-- configuration and signature -->
      <text class="lab" x={LEFT} y={TOP + arrayH + 40}>Fuses {CONFIG_BASE}–{SIGNATURE_BASE - 1}: S0 and S1 of each macrocell, pin 23 first</text>
      {#each Array.from({ length: 20 }, (_, i) => i) as i (i)}
        <rect x={LEFT + i * 16} y={TOP + arrayH + 48} width="14" height="14" rx="2" class="cfg" class:s1={i % 2 === 1} />
        <text class="tiny" x={LEFT + i * 16 + 7} y={TOP + arrayH + 59} text-anchor="middle">{i % 2 === 0 ? 'S0' : 'S1'}</text>
      {/each}
      {#each OLMC_PINS as pin, i (pin)}
        <text class="tiny" x={LEFT + i * 32 + 15} y={TOP + arrayH + 76} text-anchor="middle">{pin}</text>
      {/each}
      <text class="lab" x={LEFT} y={TOP + arrayH + 100}>Fuses {SIGNATURE_BASE}–{FUSE_COUNT - 1}: the user signature, 8 bytes, most significant bit first</text>
      {#each Array.from({ length: 64 }, (_, i) => i) as i (i)}
        <rect x={LEFT + i * 5} y={TOP + arrayH + 108} width="4" height="10" class="sig" class:byte={Math.floor(i / 8) % 2 === 1} />
      {/each}
    </svg>
  </div>
</Widget>

<style>
  .wrap {
    padding: 0.6rem;
    overflow-x: auto;
  }
  svg {
    width: 100%;
    min-width: 34rem;
    max-width: 52rem;
    height: auto;
    display: block;
    margin: 0 auto;
  }
  .row {
    fill: var(--series-1);
    opacity: 0.32;
  }
  .row.alt {
    fill: var(--series-3);
  }
  .row.oe {
    opacity: 0.85;
  }
  .row.AR,
  .row.SP {
    fill: var(--series-7);
    opacity: 0.8;
  }
  .grid {
    stroke: var(--bg);
    stroke-width: 0.6;
    opacity: 0.7;
  }
  .pin {
    font: 8px var(--font-mono);
    fill: var(--mute);
  }
  .sub {
    font: 10.5px var(--font-ui);
    fill: var(--ink-2);
  }
  .lab {
    font: 11px var(--font-ui);
    fill: var(--fg);
  }
  .tiny {
    font: 8px var(--font-mono);
    fill: var(--fg);
  }
  .brace {
    stroke: var(--line-strong);
    stroke-width: 1.5;
  }
  .cfg {
    fill: var(--copper-soft);
    stroke: var(--copper);
  }
  .cfg.s1 {
    fill: var(--panel);
  }
  .sig {
    fill: var(--series-4);
    opacity: 0.5;
  }
  .sig.byte {
    opacity: 0.9;
  }
</style>
