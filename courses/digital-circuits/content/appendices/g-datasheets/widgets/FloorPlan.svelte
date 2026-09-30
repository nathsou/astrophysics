<!--
  The three vFPGA floorplans to scale, from the device model (`getVFpga`): the I/O ring, the logic tiles and the block
  RAM columns.

    ::floor-plan{}
-->
<script lang="ts">
  import '../../a-reference/widgets/appendix.css';
  import Widget from '$lib/components/ui/Widget.svelte';
  import { TILE_BRAM, TILE_IO, TILE_LOGIC, getVFpga } from '$lib/pld/devices/vfpga';
  import type { VFpgaSize } from '$lib/pld/devices/vfpga-arch';

  let { n, caption }: { n?: string | number; caption?: string } = $props();

  const SIZES: { size: VFpgaSize; px: number }[] = [
    { size: 'S', px: 34 },
    { size: 'M', px: 13 },
    { size: 'L', px: 8 },
  ];
  const plans = SIZES.map(({ size, px }) => {
    const d = getVFpga(size);
    const tiles: { x: number; y: number; kind: number }[] = [];
    for (let x = 0; x < d.width; x++) for (let y = 0; y < d.height; y++) tiles.push({ x, y: d.height - 1 - y, kind: d.tileKind[d.tid(x, y)]! });
    return { size, px, d, tiles, text: `vFPGA-${size}: ${d.width} by ${d.height} tiles, ${d.counts.logicTiles} logic tiles (${d.counts.lcs} cells), ${d.counts.brams} block RAMs, ${d.counts.pads} pads` };
  });
</script>

<Widget title="vFPGA floorplans" {n} kind="Diagram" live={false} {caption}>
  {#snippet controls()}
    <ul class="legend" aria-label="Key">
      <li><span class="k logic"></span>logic tile (8 cells)</li>
      <li><span class="k ram"></span>block RAM tile (4 Kbit)</li>
      <li><span class="k io"></span>I/O tile (pads)</li>
    </ul>
  {/snippet}
  <div class="plans">
    {#each plans as p (p.size)}
      <figure>
        <svg viewBox="0 0 {p.d.width * p.px} {p.d.height * p.px}" width={p.d.width * p.px} height={p.d.height * p.px} role="img" aria-label={p.text}>
          {#each p.tiles as t (`${t.x},${t.y}`)}
            {#if t.kind !== 0}
              <rect
                class="tile {t.kind === TILE_LOGIC ? 'logic' : t.kind === TILE_BRAM ? 'ram' : t.kind === TILE_IO ? 'io' : ''}"
                x={t.x * p.px + 0.5}
                y={t.y * p.px + 0.5}
                width={p.px - 1}
                height={p.px - 1}
                rx={p.px > 20 ? 3 : 1}
              />
            {/if}
          {/each}
        </svg>
        <figcaption>
          <strong>vFPGA-{p.size}</strong>
          <span>{p.d.width} × {p.d.height} tiles</span>
        </figcaption>
      </figure>
    {/each}
  </div>
</Widget>

<style>
  .plans {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: center;
    gap: 1.4rem 2rem;
    padding: 1rem 0.8rem;
  }
  figure {
    margin: 0;
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    max-width: 100%;
  }
  svg {
    max-width: 100%;
    height: auto;
  }
  figcaption {
    font-family: var(--font-ui);
    font-size: 0.8rem;
    color: var(--ink-2);
    display: grid;
    text-align: center;
  }
  .tile.logic,
  .k.logic {
    fill: var(--copper-soft);
    stroke: var(--copper);
    stroke-width: 0.8;
  }
  .tile.ram,
  .k.ram {
    fill: var(--ok-soft);
    stroke: var(--phosphor);
    stroke-width: 0.8;
  }
  .tile.io,
  .k.io {
    fill: var(--panel);
    stroke: var(--series-1);
    stroke-width: 0.8;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.2rem;
    margin: 0;
    padding: 0.2rem 0.9rem;
    list-style: none;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    color: var(--ink-2);
  }
  .k {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    margin-right: 0.4rem;
    vertical-align: -0.1rem;
    border-radius: 2px;
    border: 1px solid;
  }
  .k.logic {
    background: var(--copper-soft);
    border-color: var(--copper);
  }
  .k.ram {
    background: var(--ok-soft);
    border-color: var(--phosphor);
  }
  .k.io {
    background: var(--panel);
    border-color: var(--series-1);
  }
</style>
