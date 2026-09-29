<!-- Diode, LED, bipolar transistors, MOSFETs and the comparator. -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { arrowHead } from './draw';
  import { LED_COLOURS } from './colours';
  import { uprightAt } from '../geometry';

  let { type, params, state, uid, rot, flip }: SymbolProps = $props();

  const colour = $derived(String(params.color ?? 'red'));
  const led = $derived(LED_COLOURS[colour] ?? LED_COLOURS.red!);
  const glow = $derived(Math.max(0, Math.min(1, Number(state.brightness ?? 0))));

  // Bipolar geometry: base bar at x = 14, diagonals to (36, ±15), then vertical to the pins.
  const U = [22 / Math.hypot(22, 10), 10 / Math.hypot(22, 10)] as const;
</script>

{#if type === 'diode'}
  <path class="stub" data-pin="0" d="M0 0 H17" />
  <path class="stub" data-pin="1" d="M48 0 H31" />
  <path class="ink" d="M17 -8 L31 0 L17 8 Z" />
  <path class="ln" style="stroke-linecap: butt" d="M31 -8.5 V8.5" />
{:else if type === 'led'}
  <path class="stub" data-pin="0" d="M0 0 H17" />
  <path class="stub" data-pin="1" d="M48 0 H31" />
  {#if glow > 0.01}
    <circle cx="24" cy="0" r={10 + 12 * glow} fill="url(#{uid}-glow-{colour in LED_COLOURS ? colour : 'red'})" opacity={Math.min(1, 0.2 + glow)} />
  {/if}
  <path
    class="body"
    d="M17 -8 L31 0 L17 8 Z"
    style:fill={glow > 0.01 ? `color-mix(in oklab, ${led.lit} ${Math.round(35 + 65 * glow)}%, var(--_body))` : `color-mix(in oklab, ${led.lit} 16%, var(--_body))`}
  />
  <path class="ln" style="stroke-linecap: butt" d="M31 -8.5 V8.5" />
  <g style:color={glow > 0.2 ? led.lit : 'var(--_ink)'}>
    <path class="ln thin" style="stroke: currentColor" d="M23 -10 L28.5 -17.2 M28.5 -8 L34 -15.2" />
    <polygon fill="currentColor" points={arrowHead(30.6, -20, 0.6, -0.8, 5, 2.3)} />
    <polygon fill="currentColor" points={arrowHead(36.1, -18, 0.6, -0.8, 5, 2.3)} />
  </g>
{:else if type === 'npn' || type === 'pnp'}
  <circle class="body thin" cx="23" cy="0" r="14.5" />
  <path class="stub" data-pin="0" d="M0 0 H14" />
  <path class="ln thick" style="stroke-linecap: butt" d="M14 -10 V10" />
  <path class="stub" data-pin="1" d={type === 'npn' ? 'M36 -24 V-15' : 'M36 24 V15'} />
  <path class="stub" data-pin="2" d={type === 'npn' ? 'M36 24 V15' : 'M36 -24 V-15'} />
  <path class="ln" d="M14 -5 L36 -15 M14 5 L36 15" />
  {#if type === 'npn'}
    <!-- Emitter arrow points away from the base. -->
    <polygon class="ink" points={arrowHead(14 + 22 * 0.8, 5 + 10 * 0.8, U[0], U[1], 6.5, 3)} />
  {:else}
    <!-- Emitter (top) arrow points towards the base. -->
    <polygon class="ink" points={arrowHead(14 + 22 * 0.35, -5 - 10 * 0.35, -U[0], U[1], 6.5, 3)} />
  {/if}
{:else if type === 'nmos' || type === 'pmos'}
  <path class="stub" data-pin="0" d="M0 0 H10" />
  <path class="ln" style="stroke-linecap: butt" d="M10 -11 V11" />
  <path class="ln" style="stroke-linecap: butt" d="M15 -12 V-6 M15 -3 V3 M15 6 V12" />
  <path class="stub" data-pin="1" d={type === 'nmos' ? 'M36 -24 V-9' : 'M36 -24 V-9'} />
  <path class="stub" data-pin="2" d={type === 'nmos' ? 'M36 24 V9' : 'M36 24 V9'} />
  <path class="ln" d="M15 -9 H36 M15 9 H36" />
  {#if type === 'nmos'}
    <!-- Body tied to the source (bottom); arrow into the channel. -->
    <path class="ln thin" d="M36 9 V0 H22" />
    <polygon class="ink" points={arrowHead(16, 0, -1, 0, 6.5, 3)} />
  {:else}
    <!-- Body tied to the source (top); arrow out of the channel. -->
    <path class="ln thin" d="M36 -9 V0 H16" />
    <polygon class="ink" points={arrowHead(29, 0, 1, 0, 6.5, 3)} />
  {/if}
{:else if type === 'comparator'}
  <path class="stub" data-pin="0" d="M0 0 H12" />
  <path class="stub" data-pin="1" d="M0 24 H12" />
  <path class="stub" data-pin="2" d="M72 12 H60" />
  <path class="body" d="M12 -10 L60 12 L12 34 Z" />
  <path class="ln thin" d="M16 0 h7 M19.5 -3.5 v7" />
  <path class="ln thin" d="M16 24 h7" transform={uprightAt(19.5, 24, rot, flip)} />
{/if}
