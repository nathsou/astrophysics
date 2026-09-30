<!-- Ground, supply rail, net label and subcircuit port. -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { textWidth, uprightAt } from '../geometry';
  import { formatSI } from '../format';

  let { type, params, rot, flip }: SymbolProps = $props();

  const name = $derived(String(params.name ?? ''));
  const volts = $derived(Number(params.voltage ?? 5));
  const railText = $derived(`${volts >= 0 ? '+' : ''}${formatSI(volts, 'V')}`.replace('−', '−'));
  // Label flag: point at the pin, width from the name.
  const flagW = $derived(Math.max(26, 14 + textWidth(name, 9)));
  const dir = $derived(String(params.dir ?? 'in'));
  const portW = $derived(Math.max(34, 16 + textWidth(name, 9)));
</script>

{#if type === 'ground'}
  <path class="stub" data-pin="0" d="M0 0 V10" />
  <path class="ln" d="M-10 10 H10 M-6.5 15 H6.5 M-3 20 H3" />
{:else if type === 'rail'}
  <path class="stub" data-pin="0" d="M0 0 V-11" />
  <path class="ln" d="M-8 -11 H8" />
  <text class="txt bold" x="0" y="-18" transform={uprightAt(0, -18, rot, flip)}>{railText}</text>
{:else if type === 'label'}
  <path class="stub" data-pin="0" d="M0 0 H0.01" />
  <path class="body thin" d="M0 0 L7 -7.5 H{flagW} V7.5 H7 Z" />
  <text class="txt bold" x={(7 + flagW) / 2 + 0.5} y="0" transform={uprightAt((7 + flagW) / 2 + 0.5, 0, rot, flip)}>{name}</text>
{:else if type === 'port'}
  <path class="stub" data-pin="0" d="M0 0 H0.01" />
  {#if dir === 'out'}
    <path class="body thin" d="M0 -7.5 H{-portW + 8} L{-portW} 0 L{-portW + 8} 7.5 H0 Z" />
  {:else if dir === 'io'}
    <path class="body thin" d="M0 0 L-8 -7.5 H{-portW + 8} L{-portW} 0 L{-portW + 8} 7.5 H-8 Z" />
  {:else}
    <path class="body thin" d="M0 0 L-8 -7.5 H{-portW} V7.5 H-8 Z" />
  {/if}
  <text class="txt bold" x={-portW / 2 - 2} y="0" transform={uprightAt(-portW / 2 - 2, 0, rot, flip)}>{name}</text>
{/if}
