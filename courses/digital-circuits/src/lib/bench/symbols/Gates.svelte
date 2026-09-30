<!-- Logic gates, ANSI distinctive shapes: AND/OR/XOR families, inverter, buffer, tri-state buffer. -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { gateShape } from './draw';

  let { type, params }: SymbolProps = $props();

  const single = $derived(type === 'not' || type === 'buffer' || type === 'tristate');
  const shape = $derived(single ? undefined : gateShape(type, Number(params.inputs ?? 2)));
</script>

{#if single}
  <path class="stub" data-pin="0" d="M0 0 H12" />
  {#if type === 'tristate'}
    <!-- EN enters the top edge of the triangle, which runs from (12, −12) to (44, 0). -->
    <path class="stub" data-pin="1" d="M24 -24 V-7.5" />
    <path class="stub" data-pin="2" d="M60 0 H44" />
  {:else}
    <path class="stub" data-pin="1" d={type === 'not' ? 'M60 0 H51' : 'M60 0 H44'} />
  {/if}
  <path class="body" d="M12 -12 L44 0 L12 12 Z" />
  {#if type === 'not'}
    <circle class="body" cx="47.5" cy="0" r="3.5" />
  {/if}
{:else if shape}
  {#each shape.inputs as d, i (i)}
    <path class="stub" data-pin={i} {d} />
  {/each}
  <path class="stub" data-pin={shape.inputs.length} d={shape.output} />
  <path class="body" d={shape.body} />
  {#if shape.extra}<path class="ln" d={shape.extra} />{/if}
  {#if shape.bubble}<circle class="body" cx={shape.bubble.cx} cy={shape.bubble.cy} r={shape.bubble.r} />{/if}
{/if}
