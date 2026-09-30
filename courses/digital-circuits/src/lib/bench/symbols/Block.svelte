<!--
  Generic block: sequential parts, blocks and subcircuits (sub:…, part:…) without a symbol of
  their own. A rectangle with the title and pin names; a clock triangle on CLK pins and an
  inversion bubble on active-low pins (a trailing n: CLRn, OEn).
-->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { G, uprightAt } from '../geometry';
  import { boundsOf } from '../../sim/netlist/catalog';
  import { activeLow, isClock } from './draw';

  let { def, params, pins, state, rot, flip }: SymbolProps = $props();

  const b = $derived(boundsOf(def, params));
  const side = (p: { x: number; y: number }): 'l' | 'r' | 't' | 'b' => (p.x <= b.x0 ? 'l' : p.x >= b.x1 ? 'r' : p.y <= b.y0 ? 't' : p.y >= b.y1 ? 'b' : 'l');
  const sides = $derived(pins.map(side));
  const box = $derived({
    x0: b.x0 * G + (sides.includes('l') ? G : 2),
    x1: b.x1 * G - (sides.includes('r') ? G : 2),
    y0: b.y0 * G + (sides.includes('t') ? G : -4),
    y1: b.y1 * G - (sides.includes('b') ? G : 2),
  });
  // Short names inside the box, as on a block diagram; anything else shrinks to fit.
  const SHORT: Record<string, string> = {
    srlatch: 'SR',
    dlatch: 'D LATCH',
    dff: 'D FF',
    dffr: 'D FF',
    dffe: 'D FF',
    jkff: 'JK FF',
    tff: 'T FF',
    mux: 'MUX',
    demux: 'DEMUX',
    decoder: 'DEC',
    encoder: 'ENC',
    'priority-encoder': 'PRI ENC',
    adder: 'ADD',
    'magnitude-comparator': 'CMP',
    register: 'REG',
    counter: 'COUNT',
    'shift-register': 'SHIFT',
    lfsr: 'LFSR',
    ram: 'RAM',
    rom: 'ROM',
  };
  const title = $derived(SHORT[def.type] ?? def.name);
  const titleSize = $derived(Math.max(5.5, Math.min(8.5, (box.x1 - box.x0 - 6) / (Math.max(1, [...title].length) * 0.6))));
  const value = $derived(state.value !== undefined ? String(state.value) : undefined);
  // Mirrored or upside down: text anchors swap so names stay inside the box.
  const swap = $derived(!!flip !== (rot === 180));

  interface PinDraw {
    stub: string;
    bubble?: [number, number];
    clock?: string;
    name: string;
    low: boolean;
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
          low,
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
        low,
        tx: px,
        ty: edge + dir * (clk ? 12 : 7),
        anchor: 'middle',
      };
    }),
  );
  const cx = $derived((box.x0 + box.x1) / 2);
  // The title sits in the band above the first pin row.
  const titleY = $derived(box.y0 + (sides.includes('t') ? 8 : 6.5));
</script>

{#each draws as d, i (i)}
  <path class="stub" data-pin={i} d={d.stub} />
{/each}
<rect class="body" x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx="2" />
{#each draws as d, i (i)}
  {#if d.bubble}<circle class="body thin" cx={d.bubble[0]} cy={d.bubble[1]} r={R} />{/if}
  {#if d.clock}<path class="ln thin" d={d.clock} />{/if}
  <text class="txt" style="font-size: 7px" style:text-decoration={d.low ? 'overline' : undefined} style:text-anchor={d.anchor} x={d.tx} y={d.ty} transform={uprightAt(d.tx, d.ty, rot, flip)}
    >{d.name}</text
  >
{/each}
<text class="txt bold" style="font-size: {titleSize}px" x={cx} y={titleY} transform={uprightAt(cx, titleY, rot, flip)}>{title}</text>
{#if value !== undefined}
  <text class="txt" style="font-size: 9px; fill: var(--_hi); font-weight: 700" x={cx} y={(box.y0 + box.y1) / 2 + 4} transform={uprightAt(cx, (box.y0 + box.y1) / 2 + 4, rot, flip)}>{value}</text>
{/if}
