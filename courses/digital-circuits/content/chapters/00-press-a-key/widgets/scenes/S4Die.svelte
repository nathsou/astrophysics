<!-- Level 4: the die, 5 mm across (128 px per mm); the die is 3 mm square. -->
<script lang="ts">
  const die = { x: 128, y: 8, s: 384 };
  const idx = Array.from({ length: 12 }, (_, i) => i);
  const step = (die.s - 40) / 11;
  const at = (k: number) => 20 + k * step;
  // functional blocks (die coordinates)
  const flash = { x: 168, y: 48, w: 150, h: 120 };
  const ram = { x: 328, y: 48, w: 144, h: 120 };
  const usb = { x: 168, y: 178, w: 100, h: 174 };
  const cpu = { x: 278, y: 178, w: 194, h: 174 };
  const stripes = Array.from({ length: 16 }, (_, i) => i);
  const dots = Array.from({ length: 9 }, (_, i) => i);
</script>

<g class="s4">
  <defs>
    <pattern id="kz-cells" width="6" height="7" patternUnits="userSpaceOnUse">
      <rect width="6" height="7" fill="none" />
      <path d="M0 0.5H6M0 3.5H6" stroke="var(--silicon-metal)" stroke-width="0.7" opacity="0.55" />
      <path d="M2 0V7M5 0V7" stroke="var(--sig-current)" stroke-width="0.6" opacity="0.5" />
    </pattern>
    <pattern id="kz-grid" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.3" fill="var(--sig-high)" opacity="0.65" />
    </pattern>
    <pattern id="kz-lines" width="4" height="4" patternUnits="userSpaceOnUse">
      <path d="M0 2H4" stroke="var(--series-3)" stroke-width="1" opacity="0.7" />
    </pattern>
  </defs>
  <rect class="pkg" x="0" y="0" width="640" height="400" />
  <rect class="die" x={die.x} y={die.y} width={die.s} height={die.s} rx="3" />
  <rect class="seal" x={die.x + 9} y={die.y + 9} width={die.s - 18} height={die.s - 18} rx="2" />

  {#each idx as k (k)}
    <rect class="bp" x={die.x + at(k)} y={die.y + 14} width="14" height="14" />
    <rect class="bp" x={die.x + at(k)} y={die.y + die.s - 28} width="14" height="14" />
    {#if k > 0 && k < 11}
      <rect class="bp" x={die.x + 14} y={die.y + at(k)} width="14" height="14" />
      <rect class="bp" x={die.x + die.s - 28} y={die.y + at(k)} width="14" height="14" />
    {/if}
  {/each}

  <!-- flash: dense, regular -->
  <g>
    <rect class="blk flash" x={flash.x} y={flash.y} width={flash.w} height={flash.h} />
    <rect x={flash.x} y={flash.y} width={flash.w} height={flash.h} fill="url(#kz-lines)" />
    {#each stripes as k (k)}<path class="sep" d="M{flash.x + 10 + k * 8.6} {flash.y}v{flash.h}" />{/each}
    <text class="bl" x={flash.x + flash.w / 2} y={flash.y + flash.h / 2 + 5}>program memory</text>
  </g>
  <!-- RAM -->
  <g>
    <rect class="blk ram" x={ram.x} y={ram.y} width={ram.w} height={ram.h} />
    <rect x={ram.x} y={ram.y} width={ram.w} height={ram.h} fill="url(#kz-grid)" />
    <text class="bl" x={ram.x + ram.w / 2} y={ram.y + ram.h / 2 + 5}>RAM</text>
  </g>
  <!-- USB and analogue -->
  <g>
    <rect class="blk usb" x={usb.x} y={usb.y} width={usb.w} height={usb.h} />
    {#each dots as k (k)}
      <rect class="cellblk" x={usb.x + 8 + (k % 3) * 30} y={usb.y + 10 + Math.floor(k / 3) * 30} width="24" height="22" rx="2" />
    {/each}
    <text class="bl" x={usb.x + usb.w / 2} y={usb.y + usb.h - 14}>USB, ADC</text>
  </g>
  <!-- CPU: standard cells -->
  <g>
    <rect class="blk cpu" x={cpu.x} y={cpu.y} width={cpu.w} height={cpu.h} />
    <rect x={cpu.x} y={cpu.y} width={cpu.w} height={cpu.h} fill="url(#kz-cells)" />
    <rect class="cpubox" x={cpu.x + 6} y={cpu.y + 6} width={cpu.w - 12} height={cpu.h - 12} />
    <text class="bl big" x={cpu.x + cpu.w / 2 - 34} y={cpu.y + 30}>CPU</text>
    <rect class="hot" x="372" y="290" width="6" height="4" />
  </g>

  <text class="cap" x="12" y="30">the die</text>
  <text class="cap" x="12" y="46">3 × 3 mm</text>
</g>

<style>
  .pkg {
    fill: var(--silicon);
    opacity: 0.55;
  }
  .die {
    fill: color-mix(in srgb, var(--series-1) 30%, var(--silicon));
    stroke: var(--wire);
    stroke-width: 2;
  }
  .seal {
    fill: none;
    stroke: var(--silicon-metal);
    stroke-width: 1.4;
    opacity: 0.7;
  }
  .bp {
    fill: var(--silicon-metal);
    stroke: var(--copper-ink);
    stroke-width: 0.8;
  }
  .blk {
    stroke: var(--silicon-metal);
    stroke-width: 1;
    opacity: 0.95;
  }
  .flash {
    fill: color-mix(in srgb, var(--series-3) 28%, var(--silicon));
  }
  .ram {
    fill: color-mix(in srgb, var(--series-5) 22%, var(--silicon));
  }
  .usb {
    fill: color-mix(in srgb, var(--series-4) 30%, var(--silicon));
  }
  .cpu {
    fill: color-mix(in srgb, var(--series-1) 20%, var(--silicon));
  }
  .cellblk {
    fill: color-mix(in srgb, var(--series-4) 60%, var(--silicon));
    stroke: var(--silicon-metal);
    stroke-width: 0.6;
    opacity: 0.8;
  }
  .sep {
    stroke: var(--silicon);
    stroke-width: 1.2;
    opacity: 0.6;
  }
  .cpubox {
    fill: none;
    stroke: var(--sig-current);
    stroke-width: 0.8;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }
  .hot {
    fill: none;
    stroke: var(--sig-high);
    stroke-width: 1.4;
  }
  .bl {
    fill: var(--silicon-metal);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    text-anchor: middle;
    paint-order: stroke;
    stroke: var(--silicon);
    stroke-width: 3px;
  }
  .bl.big {
    font-size: 15px;
  }
  .cap {
    fill: var(--fg);
    font-family: var(--font-mono);
    font-size: 11.5px;
    opacity: 0.85;
  }
</style>
