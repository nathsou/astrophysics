<!-- Resistor, capacitor, inductor, potentiometer and lamp (pins at (0, 0) and (48, 0) px). -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { arrowHead } from './draw';

  let { type, params, state, uid }: SymbolProps = $props();

  const ZIGZAG = 'M9 0 L11.5 -5 L16.5 5 L21.5 -5 L26.5 5 L31.5 -5 L36.5 5 L39 0';
  const polarised = $derived(!!params.polarised);
  const wiperX = $derived(Math.max(11, Math.min(37, 9 + 30 * Number(params.position ?? 0.5))));
  const glow = $derived(Math.max(0, Math.min(1, Number(state.brightness ?? 0))));
</script>

{#if type === 'resistor' || type === 'potentiometer'}
  <path class="stub" data-pin="0" d="M0 0 H9" />
  <path class="stub" data-pin="1" d="M48 0 H39" />
  <path class="ln" d={ZIGZAG} />
  {#if type === 'potentiometer'}
    <path class="stub" data-pin="2" d="M24 -24 V-15" />
    <path class="ln thin" d="M24 -15 H{wiperX} V-11" />
    <polygon class="ink" points={arrowHead(wiperX, -6, 0, 1, 5.5, 2.8)} />
  {/if}
{:else if type === 'capacitor'}
  <path class="stub" data-pin="0" d="M0 0 H21" />
  <path class="ln" d="M21 -9 V9" />
  {#if polarised}
    <path class="stub" data-pin="1" d="M48 0 H28" />
    <path class="ln" d="M31 -9 Q25 0 31 9" />
    <path class="ln thin" d="M13 -9 h5 M15.5 -11.5 v5" />
  {:else}
    <path class="stub" data-pin="1" d="M48 0 H27" />
    <path class="ln" d="M27 -9 V9" />
  {/if}
{:else if type === 'inductor'}
  <path class="stub" data-pin="0" d="M0 0 H8" />
  <path class="stub" data-pin="1" d="M48 0 H40" />
  <path class="ln copper" d="M8 0 a4 4 0 0 1 8 0 a4 4 0 0 1 8 0 a4 4 0 0 1 8 0 a4 4 0 0 1 8 0" />
{:else if type === 'lamp'}
  <path class="stub" data-pin="0" d="M0 0 H13" />
  <path class="stub" data-pin="1" d="M48 0 H35" />
  {#if glow > 0.01}
    <circle cx="24" cy="0" r={12 + 10 * glow} fill="url(#{uid}-glow-warm)" opacity={Math.min(1, 0.25 + glow)} />
  {/if}
  <circle class="body" cx="24" cy="0" r="11" />
  <circle cx="24" cy="0" r="10" fill="url(#{uid}-glow-warm)" opacity={glow} />
  <path class="ln thin" d="M13 0 H17 V-1.5 M35 0 H31 V-1.5" />
  <path
    class="ln thin"
    d="M17 -1.5 q1.2 -6 2.33 0 t2.33 0 t2.33 0 t2.33 0 t2.33 0 t2.33 0"
    style:stroke={glow > 0.05 ? `color-mix(in oklab, #ffd24a ${Math.round(40 + 60 * glow)}%, var(--_ink))` : undefined}
  />
{/if}
