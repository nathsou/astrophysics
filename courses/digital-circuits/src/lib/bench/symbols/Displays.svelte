<!-- Seven-segment display (inputs a–g, dp) and hex display (inputs D0–D3), with LED segments. -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { HEX_SEGMENTS, segmentPaths } from './sevenseg';
  import { LED_COLOURS } from './colours';
  import { G } from '../geometry';

  let { type, pins, state, uid }: SymbolProps = $props();

  const seven = $derived(type === 'seven-seg');
  // Geometry: body from x = 12, a dark window with the digit.
  const body = $derived(seven ? { x: 12, y: -10, w: 82, h: 188 } : { x: 12, y: -10, w: 58, h: 92 });
  const win = $derived(seven ? { x: 30, y: -4, w: 60, h: 176 } : { x: 26, y: -4, w: 40, h: 80 });
  const digit = $derived(seven ? { x: 42, y: 22, w: 36, h: 124, t: 8 } : { x: 34, y: 8, w: 22, h: 56, t: 5 });
  const segs = $derived(segmentPaths(digit.x, digit.y, digit.w, digit.h, digit.t));
  const mask = $derived.by(() => {
    if (seven) return Number(state.segments ?? 0);
    const v = state.value;
    return v === undefined || !Number.isFinite(Number(v)) ? -1 : HEX_SEGMENTS[Number(v) & 15]!;
  });
  const red = LED_COLOURS.red!.lit;
</script>

{#each pins as p, i (p.name)}
  <path class="stub" data-pin={i} d="M{p.x * G} {p.y * G} H{body.x}" />
{/each}
<rect class="body" x={body.x} y={body.y} width={body.w} height={body.h} rx="3" />
<rect class="window" x={win.x} y={win.y} width={win.w} height={win.h} rx="2" style="fill: #17130f" />
{#each pins as p (p.name)}
  <text class="txt small start" x={body.x + 3} y={p.y * G}>{p.name}</text>
{/each}
<g transform="translate({digit.x + digit.w / 2} {digit.y + digit.h / 2}) skewX(-6) translate({-(digit.x + digit.w / 2)} {-(digit.y + digit.h / 2)})">
  {#each segs as d, i (i)}
    {@const lit = mask >= 0 && (mask & (1 << i)) !== 0}
    <path {d} fill={lit ? red : '#3a2520'} opacity={lit ? 1 : 0.55} filter={lit ? `url(#${uid}-seg-glow)` : undefined} />
  {/each}
  {#if seven}
    {@const lit = (mask & 128) !== 0}
    <circle cx={digit.x + digit.w + 8} cy={digit.y + digit.h - 4} r="4.5" fill={lit ? red : '#3a2520'} opacity={lit ? 1 : 0.55} />
  {:else if mask < 0}
    <path d="M{digit.x + 4} {digit.y + digit.h / 2} h{digit.w - 8}" stroke="#7a5048" stroke-width="3" stroke-linecap="round" />
  {/if}
</g>
