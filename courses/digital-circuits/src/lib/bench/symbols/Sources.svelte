<!-- Battery, bench power supply and function generator ('-' at (0, 0), '+' at (48, 0) px). -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { uprightAt } from '../geometry';
  import { formatReadout, formatSI } from '../format';

  let { type, params, state, rot, flip }: SymbolProps = $props();

  const volts = $derived(Number(state.voltage ?? params.voltage ?? 0));
  const cc = $derived(!!state.cc || !!state.limiting);
  const wave = $derived(String(params.waveform ?? 'square'));
  const WAVES: Record<string, string> = {
    square: 'M13 -7 H17 V-14 H24 V-7 H31 V-14 H35',
    pulse: 'M13 -7 H18 V-14 H21 V-7 H29 V-14 H32 V-7 H35',
    sine: 'M13 -10.5 C15.5 -17 18.5 -17 21 -10.5 S26.5 -4 29 -10.5 S32.8 -15.5 35 -13',
    triangle: 'M13 -10.5 L16.5 -14 L23.5 -7 L30.5 -14 L35 -9.5',
  };
</script>

{#if type === 'battery'}
  <path class="stub" data-pin="0" d="M0 0 H16" />
  <path class="stub" data-pin="1" d="M48 0 H32" />
  <!-- Two cells: short thick plate (−), long thin plate (+). -->
  <path class="ln thick" style="stroke-linecap: butt" d="M16 -5 V5 M27 -5 V5" />
  <path class="ln" style="stroke-linecap: butt" d="M21 -10 V10 M32 -10 V10" />
  <path class="ln thin" d="M36.5 -9.5 h5 M39 -12 v5" />
{:else}
  <path class="stub" data-pin="0" d="M0 0 H6" />
  <path class="stub" data-pin="1" d="M48 0 H42" />
  <rect class="body" x="6" y="-21" width="36" height="40" rx="3" />
  <rect class="window" x="10" y="-17.5" width="28" height="13" rx="1.5" />
  {#if type === 'supply'}
    <text class="screen-txt" x="24" y="-11" transform={uprightAt(24, -11, rot, flip)}>{formatReadout(volts, 'V', 3).replace(' ', '')}</text>
    <text class="txt small" x="24" y="1" transform={uprightAt(24, 1, rot, flip)} style:fill={cc ? 'var(--_x)' : undefined} style:font-weight={cc ? 700 : undefined}
      >CC</text
    >
  {:else}
    <path class="screen-ln" d={WAVES[wave] ?? WAVES.square} />
    <text class="txt small" x="24" y="1" transform={uprightAt(24, 1, rot, flip)}>{formatSI(Number(params.frequency ?? 0), 'Hz', 2).replace(' ', '')}</text>
  {/if}
  <!-- Terminals: black (−) and red (+). -->
  <circle cx="11.5" cy="10" r="3" fill="var(--_ink)" />
  <circle cx="36.5" cy="10" r="3" fill="#c8322a" stroke="var(--_ink)" stroke-width="1" />
  <path class="ln thin" d="M11.5 7 V0 H6 M36.5 7 V0 H42" />
  <text class="txt small" x="18" y="10.5" transform={uprightAt(18, 10.5, rot, flip)}>−</text>
  <text class="txt small" x="30" y="10.5" transform={uprightAt(30, 10.5, rot, flip)}>+</text>
{/if}
