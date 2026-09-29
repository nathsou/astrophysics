<!--
  Generic block: sequential parts, blocks and subcircuits (sub:…, part:…) without a symbol of
  their own. A rectangle with the title and pin names; a clock triangle on CLK pins and an
  inversion bubble on active-low pins (a trailing n: CLRn, OEn).
-->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { G, textWidth, uprightAt } from '../geometry';
  import { boundsOf } from '../../sim/netlist/catalog';
  import { activeLow, isClock } from './draw';

  let { def, params, pins, state, rot, flip }: SymbolProps = $props();

  const b = $derived(boundsOf(def, params));
  const side = (p: { x: number; y: number }): 'l' | 'r' | 't' | 'b' => (p.x <= b.x0 ? 'l' : p.x >= b.x1 ? 'r' : p.y <= b.y0 ? 't' : p.y >= b.y1 ? 'b' : 'l');
  const sides = $derived(pins.map(side));
  const box = $derived({
    x0: b.x0 * G + (sides.includes('l') ? G : 2),
    x1: b.x1 * G - (sides.includes('r') ? G : 2),
    y0: b.y0 * G + (sides.includes('t') ? G : 2),
    y1: b.y1 * G - (sides.includes('b') ? G : 2),
  });
  const title = $derived(def.name);
  const value = $derived(state.value !== undefined ? String(state.value) : undefined);
  // Mirrored or upside down: text anchors swap so names stay inside the box.
  const swap = $derived(!!flip !== (rot === 180));

  interface PinDraw {
    stub: string;
    bubble?: [number, number];
    clock?: string;
    name: string;
    tx: number;
    ty: number;
    anchor: 'start' | 'end' | 'middle';
  }
  const R = 3;
  const draws = $derived(
    pins.map((p, i): PinDraw => {
      const s = sides[i]!;
      const px = p.x * G;
      const py = p.y * G;
      const low = activeLow(p.name);
      const clk = isClock(p.name);
      const name = low ? p.name.slice(0, -1) : p.name;
      if (s === 'l' || s === 'r') {
        const edge = s === 'l' ? box.x0 : box.x1;
        const dir = s === 'l' ? 1 : -1;
        const end = low ? edge - dir * 2 * R : edge;
        const inset = clk ? 10 : 4;
        return {
          stub: `M${px} ${py} H${end}`,
          bubble: low ? [edge - dir * R, py] : undefined,
          clock: clk ? `M${edge} ${py - 4.5} L${edge + dir * 6.5} ${py} L${edge} ${py + 4.5}` : undefined,
          name,
          tx: edge + dir * inset,
          ty: py,
          anchor: (s === 'l') !== swap ? 'start' : 'end',
        };
      }
      const edge = s === 't' ? box.y0 : box.y1;
      const dir = s === 't' ? 1 : -1;
      const end = low ? edge - dir * 2 * R : edge;
      return {
        stub: `M${px} ${py} V${end}`,
        bubble: low ? [px, edge - dir * R] : undefined,
        clock: clk ? `M${px - 4.5} ${edge} L${px} ${edge + dir * 6.5} L${px + 4.5} ${edge}` : undefined,
        name,
        tx: px,
        ty: edge + dir * (clk ? 12 : 7),
        anchor: 'middle',
      };
    }),
  );
  const cx = $derived((box.x0 + box.x1) / 2);
  // Title inside when it fits between the left and right pin names, else above the box.
  const longest = (s: 'l' | 'r') => Math.max(0, ...pins.filter((_, i) => sides[i] === s).map((p) => textWidth(p.name, 7) + 6));
  const inside = $derived(textWidth(title, 8.5) + longest('l') + longest('r') + 8 <= box.x1 - box.x0);
  const titleY = $derived(inside ? (box.y0 + box.y1) / 2 : box.y0 - 7);
</script>

{#each draws as d, i (i)}
  <path class="stub" data-pin={i} d={d.stub} />
{/each}
<rect class="body" x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx="2" />
{#each draws as d, i (i)}
  {#if d.bubble}<circle class="body thin" cx={d.bubble[0]} cy={d.bubble[1]} r={R} />{/if}
  {#if d.clock}<path class="ln thin" d={d.clock} />{/if}
  <text class="txt" style="font-size: 7px" style:text-anchor={d.anchor} x={d.tx} y={d.ty} transform={uprightAt(d.tx, d.ty, rot, flip)}
    >{d.name}</text
  >
  {#if activeLow(pins[i]!.name)}
    <!-- Overbar for active-low names. -->
    <path
      class="ln"
      style="stroke-width: 0.8"
      transform={uprightAt(d.tx, d.ty, rot, flip)}
      d="M{d.anchor === 'end' ? d.tx - textWidth(d.name, 7) : d.anchor === 'middle' ? d.tx - textWidth(d.name, 7) / 2 : d.tx} {d.ty - 4.8} h{textWidth(d.name, 7)}"
    />
  {/if}
{/each}
<text class="txt bold" style="font-size: 8.5px" x={cx} y={titleY} transform={uprightAt(cx, titleY, rot, flip)}>{title}</text>
{#if value !== undefined}
  <text class="txt" style="font-size: 8px; fill: var(--_hi)" x={cx} y={titleY + 11} transform={uprightAt(cx, titleY + 11, rot, flip)}>{value}</text>
{/if}
