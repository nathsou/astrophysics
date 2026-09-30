<!--
  Block diagrams of the virtual devices, drawn with the design tokens (never fixed colours). Numbers come from the
  device models, so a diagram cannot say what the model does not.

    ::block-diagram{device="gal22v10"}    prom, pla, gal22v10, cpld32 or fpga
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { VPROM_ADDRESS_BITS, VPROM_WIDTH } from '$lib/pld/devices/prom';
  import { VPLA_SIZE } from '$lib/pld/devices/pla';
  import { COLUMNS, FUSE_COUNT, ROWS } from '$lib/pld/devices/gal22v10';
  import { FB_INPUTS, FUNCTION_BLOCKS, LITERAL_COLUMNS, MACROCELLS_PER_FB, TERMS_PER_FB, IO_PINS } from '$lib/pld/devices/vcpld32-arch';
  import { LCS_PER_TILE } from '$lib/pld/devices/vfpga-arch';

  let { device = 'gal22v10', n, caption }: { device?: 'prom' | 'pla' | 'gal22v10' | 'cpld32' | 'fpga'; n?: string | number; caption?: string } = $props();

  const titles = { prom: 'vPROM block diagram', pla: 'vPLA block diagram', gal22v10: 'GAL22V10 block diagram', cpld32: 'vCPLD-32 block diagram', fpga: 'vFPGA block diagram' } as const;

  const words = 2 ** VPROM_ADDRESS_BITS;
</script>

<Widget title={titles[device]} {n} kind="Diagram" live={false} {caption}>
  <div class="wrap">
    {#if device === 'prom'}
      <svg viewBox="0 0 640 318" role="img" aria-label="vPROM: {VPROM_ADDRESS_BITS} address lines into a decoder that selects one of {words} word lines; each word line crosses {VPROM_WIDTH} bit lines at a fuse; the bit lines drive {VPROM_WIDTH} output buffers">
        <text class="lab" x="8" y="60">A{VPROM_ADDRESS_BITS - 1}</text>
        <text class="lab" x="8" y="84">…</text>
        <text class="lab" x="8" y="108">A0</text>
        <path class="wire" d="M40 56 H100 M40 80 H100 M40 104 H100" />
        <text class="sub" x="8" y="30">{VPROM_ADDRESS_BITS} address lines</text>
        <rect class="box prog" x="100" y="36" width="90" height="240" rx="4" />
        <text class="lab" x="145" y="140" text-anchor="middle">{VPROM_ADDRESS_BITS}-to-{words}</text>
        <text class="lab" x="145" y="158" text-anchor="middle">decoder</text>
        <!-- word lines -->
        {#each [0, 1, 2, 3, 4, 5, 6, 7] as r (r)}
          <path class="wire" d="M190 {52 + r * 28} H470" />
          {#each [0, 1, 2, 3, 4, 5, 6, 7] as c (c)}
            <circle class="fuse" cx={230 + c * 34} cy={52 + r * 28} r="3.2" />
          {/each}
        {/each}
        {#each [0, 1, 2, 3, 4, 5, 6, 7] as c (c)}
          <path class="wire thin" d="M{230 + c * 34} 40 V262" />
          <path class="tri" d="M{222 + c * 34} 268 h16 l-8 14 z" />
          <path class="wire" d="M{230 + c * 34} 282 V292" />
        {/each}
        <text class="sub" x="350" y="26" text-anchor="middle">{words} words × {VPROM_WIDTH} bits: one fuse at every crossing</text>
        <text class="sub" x="480" y="200">word lines</text>
        <text class="sub" x="480" y="216">(the first 8</text>
        <text class="sub" x="480" y="232">of {words} drawn)</text>
        <text class="lab" x="230" y="312" text-anchor="middle">D{VPROM_WIDTH - 1}</text>
        <text class="lab" x="468" y="312" text-anchor="middle">D0</text>
      </svg>
    {:else if device === 'pla'}
      <svg viewBox="0 0 700 330" role="img" aria-label="vPLA: {VPLA_SIZE.inputs} inputs with true and complement buffers feed an AND plane of {VPLA_SIZE.terms} product terms, whose outputs feed an OR plane of {VPLA_SIZE.outputs} sums, each through a polarity XOR">
        <text class="sub" x="8" y="20">{VPLA_SIZE.inputs} inputs</text>
        {#each [0, 1, 2, 3] as i (i)}
          <path class="wire" d="M8 {40 + i * 16} H60" />
        {/each}
        <rect class="box" x="60" y="30" width="60" height="76" rx="4" />
        <text class="sub" x="90" y="64" text-anchor="middle">true /</text>
        <text class="sub" x="90" y="78" text-anchor="middle">complement</text>
        <text class="sub" x="90" y="92" text-anchor="middle">buffers</text>
        <!-- AND plane -->
        <rect class="box prog" x="150" y="30" width="220" height="250" rx="4" />
        <text class="lab" x="260" y="298" text-anchor="middle">AND plane</text>
        <text class="sub" x="260" y="314" text-anchor="middle">{VPLA_SIZE.terms} terms × {VPLA_SIZE.inputs * 2} literal columns</text>
        {#each [0, 1, 2, 3, 4, 5] as r (r)}
          <path class="wire" d="M150 {54 + r * 40} H370" />
          {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as c (c)}
            <circle class="fuse" cx={166 + c * 20} cy={54 + r * 40} r="2.6" />
          {/each}
        {/each}
        <text class="sub" x="380" y="150">{VPLA_SIZE.terms}</text>
        <text class="sub" x="380" y="164">product</text>
        <text class="sub" x="380" y="178">terms</text>
        <!-- OR plane -->
        <rect class="box prog" x="440" y="30" width="150" height="250" rx="4" />
        <text class="lab" x="515" y="298" text-anchor="middle">OR plane</text>
        <text class="sub" x="515" y="314" text-anchor="middle">{VPLA_SIZE.outputs} sums × {VPLA_SIZE.terms} terms</text>
        {#each [0, 1, 2, 3, 4, 5, 6, 7] as c (c)}
          <path class="wire thin" d="M{456 + c * 18} 30 V280" />
          {#each [0, 1, 2, 3, 4, 5] as r (r)}
            <circle class="fuse" cx={456 + c * 18} cy={54 + r * 40} r="2.6" />
          {/each}
        {/each}
        <path class="wire" d="M370 54 H440 M370 94 H440 M370 134 H440 M370 174 H440 M370 214 H440 M370 254 H440" />
        <!-- polarity and outputs -->
        {#each [0, 1, 2, 3] as c (c)}
          <path class="wire" d="M{456 + c * 18} 280 V286" />
        {/each}
        <rect class="box prog" x="610" y="120" width="60" height="70" rx="4" />
        <text class="sub" x="640" y="150" text-anchor="middle">XOR</text>
        <text class="sub" x="640" y="164" text-anchor="middle">polarity</text>
        <text class="sub" x="640" y="178" text-anchor="middle">fuse</text>
        <path class="wire" d="M590 155 H610 M670 155 H696" />
        <text class="sub" x="640" y="110" text-anchor="middle">{VPLA_SIZE.outputs} outputs</text>
      </svg>
    {:else if device === 'gal22v10'}
      <svg viewBox="0 0 720 420" role="img" aria-label="GAL22V10: 12 inputs and the macrocell feedbacks make {COLUMNS} columns of an AND array of {ROWS} rows; each of the 10 output macrocells ORs 8 to 16 product terms, inverts them or not, and passes them through a register or straight to a tri-state output buffer">
        <text class="sub" x="8" y="22">12 inputs</text>
        <text class="sub" x="8" y="36">(pin 1 also the clock)</text>
        <path class="wire" d="M8 60 H60" />
        <path class="wire" d="M8 100 H60" />
        <rect class="box" x="60" y="44" width="56" height="80" rx="4" />
        <text class="sub" x="88" y="80" text-anchor="middle">true /</text>
        <text class="sub" x="88" y="94" text-anchor="middle">comp.</text>
        <!-- AND array -->
        <rect class="box prog" x="150" y="30" width="190" height="340" rx="4" />
        <text class="lab" x="245" y="60" text-anchor="middle">AND array</text>
        <text class="sub" x="245" y="78" text-anchor="middle">{ROWS} rows × {COLUMNS} columns</text>
        <text class="sub" x="245" y="94" text-anchor="middle">= {(ROWS * COLUMNS).toLocaleString('en-GB')} fuses</text>
        <text class="sub" x="245" y="130" text-anchor="middle">row 0: asynchronous reset (AR)</text>
        <text class="sub" x="245" y="146" text-anchor="middle">rows 1 to {ROWS - 2}: output enables and</text>
        <text class="sub" x="245" y="162" text-anchor="middle">product terms, by macrocell</text>
        <text class="sub" x="245" y="178" text-anchor="middle">row {ROWS - 1}: synchronous preset (SP)</text>
        {#each [0, 1, 2, 3, 4, 5] as r (r)}
          <path class="wire thin" d="M150 {210 + r * 22} H340" />
          {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as c (c)}
            <circle class="fuse" cx={166 + c * 17} cy={210 + r * 22} r="2.4" />
          {/each}
        {/each}
        <!-- feedback -->
        <path class="wire dash" d="M600 392 H130 V108 H116" />
        <text class="sub" x="370" y="408" text-anchor="middle">feedback: the pin, or the inverted register output</text>
        <!-- macrocell list -->
        <path class="wire" d="M340 60 H380 M340 100 H380 M340 140 H380 M340 180 H380 M340 220 H380 M340 260 H380 M340 300 H380 M340 340 H380" />
        <text class="sub" x="360" y="26" text-anchor="middle">to the macrocells</text>
        <!-- OLMC detail -->
        <rect class="box" x="380" y="30" width="330" height="340" rx="4" />
        <text class="lab" x="545" y="52" text-anchor="middle">One output macrocell (OLMC), ×10</text>
        <text class="sub" x="545" y="68" text-anchor="middle">8 to 16 product terms, by pin (see the table)</text>
        <rect class="box" x="400" y="130" width="60" height="60" rx="4" />
        <text class="lab" x="430" y="158" text-anchor="middle">OR</text>
        <text class="sub" x="430" y="174" text-anchor="middle">8–16 terms</text>
        <path class="wire" d="M380 160 H400" />
        <path class="wire" d="M460 160 H480" />
        <circle class="box" cx="500" cy="160" r="16" />
        <text class="lab" x="500" y="165" text-anchor="middle">⊕</text>
        <text class="sub" x="500" y="204" text-anchor="middle">S0: polarity</text>
        <path class="wire" d="M516 160 H540" />
        <rect class="box prog" x="540" y="120" width="50" height="80" rx="4" />
        <text class="lab" x="565" y="144" text-anchor="middle">D</text>
        <text class="lab" x="565" y="180" text-anchor="middle">Q</text>
        <path class="wire" d="M540 176 H528 M540 152 H540" />
        <text class="sub" x="565" y="216" text-anchor="middle">S1: register</text>
        <text class="sub" x="565" y="230" text-anchor="middle">or bypass (M)</text>
        <path class="wire" d="M516 160 V110 H620 V160" />
        <path class="wire" d="M590 160 H620" />
        <rect class="box" x="620" y="144" width="24" height="32" rx="3" />
        <text class="sub" x="632" y="164" text-anchor="middle">M</text>
        <path class="wire" d="M644 160 H660" />
        <path class="tri side" d="M660 146 v28 l24 -14 z" />
        <path class="wire" d="M684 160 H706" />
        <text class="sub" x="695" y="140" text-anchor="middle">pin</text>
        <path class="wire" d="M672 100 V148" />
        <text class="sub" x="672" y="92" text-anchor="middle">OE term</text>
        <text class="sub" x="545" y="266" text-anchor="middle">AR resets every register at once (asynchronous);</text>
        <text class="sub" x="545" y="282" text-anchor="middle">SP sets every register at the next clock edge.</text>
        <text class="sub" x="545" y="304" text-anchor="middle">Clock: pin 1, rising edge, for all ten.</text>
        <text class="sub" x="545" y="336" text-anchor="middle">{FUSE_COUNT.toLocaleString('en-GB')} fuses in all: array, 20 macrocell, 64 signature</text>
      </svg>
    {:else if device === 'cpld32'}
      <svg viewBox="0 0 720 440" role="img" aria-label="vCPLD-32: {IO_PINS} I/O pins and {IO_PINS} macrocell feedbacks enter a global interconnect matrix that gives each of {FUNCTION_BLOCKS} function blocks {FB_INPUTS} signals; each block has an AND array of {TERMS_PER_FB} terms, a product-term allocator and {MACROCELLS_PER_FB} macrocells that drive its I/O pins; a JTAG port programs the configuration">
        <text class="sub" x="8" y="20">GCLK, GSR, GOE (to every block)</text>
        <path class="wire" d="M8 28 H712" />
        <!-- interconnect -->
        <rect class="box prog" x="60" y="70" width="600" height="60" rx="4" />
        <text class="lab" x="360" y="96" text-anchor="middle">Global interconnect matrix</text>
        <text class="sub" x="360" y="114" text-anchor="middle">{FB_INPUTS} multiplexers per block, each 64-to-1 over {IO_PINS} pins and {IO_PINS} macrocell outputs</text>
        {#each [0, 1, 2, 3] as b (b)}
          {@const x = 60 + b * 152}
          <path class="wire" d="M{x + 68} 130 V160" />
          <text class="sub" x={x + 74} y="150">{FB_INPUTS}</text>
          <rect class="box" x={x} y="160" width="136" height="220" rx="4" />
          <text class="lab" x={x + 68} y="180" text-anchor="middle">Function block {b}</text>
          <rect class="box prog" x={x + 10} y="192" width="116" height="50" rx="3" />
          <text class="sub" x={x + 68} y="212" text-anchor="middle">AND array</text>
          <text class="sub" x={x + 68} y="228" text-anchor="middle">{TERMS_PER_FB} terms × {LITERAL_COLUMNS} cols</text>
          <path class="wire" d="M{x + 68} 242 V254" />
          <rect class="box prog" x={x + 10} y="254" width="116" height="34" rx="3" />
          <text class="sub" x={x + 68} y="275" text-anchor="middle">term allocator</text>
          <path class="wire" d="M{x + 68} 288 V300" />
          <rect class="box prog" x={x + 10} y="300" width="116" height="50" rx="3" />
          <text class="sub" x={x + 68} y="320" text-anchor="middle">{MACROCELLS_PER_FB} macrocells</text>
          <text class="sub" x={x + 68} y="336" text-anchor="middle">OR, XOR, D/T flip-flop</text>
          <path class="wire" d="M{x + 68} 350 V380" />
          <text class="sub" x={x + 68} y="396" text-anchor="middle">IO{b * 8}–IO{b * 8 + 7}</text>
          <path class="wire dash" d="M{x + 136} 340 H{x + 146} V140 H{x + 130} " />
        {/each}
        <rect class="box" x="60" y="410" width="600" height="24" rx="4" />
        <text class="sub" x="360" y="426" text-anchor="middle">JTAG port (TCK, TMS, TDI, TDO): programs the 9,024 configuration bits, and scans the pins</text>
      </svg>
    {:else}
      <svg viewBox="0 0 720 380" role="img" aria-label="vFPGA: a grid of tiles ringed by I/O tiles; each logic tile has {LCS_PER_TILE} logic cells, a connection box in front of its inputs and a switch box driving its wires">
        <rect class="box" x="10" y="20" width="230" height="230" rx="4" />
        {#each Array.from({ length: 8 }, (_, i) => i) as x (x)}
          {#each Array.from({ length: 8 }, (_, j) => j) as y (y)}
            {@const ring = x === 0 || y === 0 || x === 7 || y === 7}
            {@const corner = (x === 0 || x === 7) && (y === 0 || y === 7)}
            {#if !corner}
              <rect class="tile {ring ? 'io' : x === 3 || x === 5 ? (x === 3 ? 'ram' : 'logic') : 'logic'}" x={18 + x * 27} y={28 + y * 27} width="23" height="23" rx="2" />
            {/if}
          {/each}
        {/each}
        <text class="sub" x="125" y="270" text-anchor="middle">the die: I/O ring, logic tiles,</text>
        <text class="sub" x="125" y="284" text-anchor="middle">block RAM columns (M and L)</text>
        <!-- tile detail -->
        <path class="wire" d="M240 135 L280 135" />
        <rect class="box" x="280" y="20" width="430" height="300" rx="4" />
        <text class="lab" x="495" y="44" text-anchor="middle">One logic tile</text>
        <rect class="box prog" x="296" y="70" width="90" height="220" rx="3" />
        <text class="sub" x="341" y="150" text-anchor="middle">connection</text>
        <text class="sub" x="341" y="166" text-anchor="middle">box</text>
        <text class="sub" x="341" y="182" text-anchor="middle">(pins ← wires)</text>
        <rect class="box" x="416" y="70" width="140" height="220" rx="3" />
        <text class="lab" x="486" y="90" text-anchor="middle">{LCS_PER_TILE} logic cells</text>
        {#each [0, 1, 2] as k (k)}
          <rect class="box prog" x="428" y={102 + k * 44} width="52" height="34" rx="3" />
          <text class="sub" x="454" y={123 + k * 44} text-anchor="middle">LUT4</text>
          <path class="wire" d="M480 {119 + k * 44} H492" />
          <rect class="box" x="492" y={102 + k * 44} width="52" height="34" rx="3" />
          <text class="sub" x="518" y={123 + k * 44} text-anchor="middle">D FF</text>
        {/each}
        <text class="sub" x="486" y="248" text-anchor="middle">… ×{LCS_PER_TILE}, with a</text>
        <text class="sub" x="486" y="264" text-anchor="middle">carry chain upwards</text>
        <path class="wire" d="M386 180 H416 M556 180 H586" />
        <rect class="box prog" x="586" y="70" width="110" height="220" rx="3" />
        <text class="sub" x="641" y="150" text-anchor="middle">switch box</text>
        <text class="sub" x="641" y="166" text-anchor="middle">(wires ← wires</text>
        <text class="sub" x="641" y="182" text-anchor="middle">and outputs)</text>
        <path class="wire" d="M641 70 V56 H300 V70" />
        <text class="sub" x="470" y="72" text-anchor="middle" style="display:none">wires</text>
        <text class="sub" x="495" y="340" text-anchor="middle">Wires of span 1, 4 and 12 tiles, driven by one multiplexer each</text>
        <text class="sub" x="495" y="360" text-anchor="middle">Everything shaded is configuration memory.</text>
      </svg>
    {/if}
  </div>
</Widget>

<style>
  .wrap {
    padding: 0.8rem 0.6rem;
    display: flex;
    justify-content: center;
  }
  svg {
    width: 100%;
    max-width: 44rem;
    height: auto;
  }
  .box {
    fill: var(--panel);
    stroke: var(--line-strong);
    stroke-width: 1.4;
  }
  .box.prog {
    fill: var(--copper-soft);
    stroke: var(--copper);
  }
  .tile {
    stroke-width: 1;
  }
  .tile.logic {
    fill: var(--copper-soft);
    stroke: var(--copper);
  }
  .tile.io {
    fill: var(--panel);
    stroke: var(--series-1);
  }
  .tile.ram {
    fill: var(--ok-soft);
    stroke: var(--phosphor);
  }
  .wire {
    stroke: var(--wire);
    stroke-width: 1.6;
    fill: none;
  }
  .wire.thin {
    stroke-width: 1;
    opacity: 0.7;
  }
  .wire.dash {
    stroke-dasharray: 5 4;
  }
  .fuse {
    fill: var(--copper);
  }
  .tri {
    fill: var(--panel);
    stroke: var(--wire);
    stroke-width: 1.4;
  }
  .lab {
    font: 600 12.5px var(--font-ui);
    fill: var(--fg);
  }
  .sub {
    font: 11px var(--font-ui);
    fill: var(--ink-2);
  }
</style>
