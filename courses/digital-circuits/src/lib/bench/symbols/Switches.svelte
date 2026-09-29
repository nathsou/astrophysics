<!-- SPST switch, changeover switch, pushbutton and relay. Moving parts follow params/state. -->
<script lang="ts">
  import type { SymbolProps } from './types';

  let { type, params, state }: SymbolProps = $props();

  const closed = $derived(state.closed ?? !!params.closed);
  const pressed = $derived(state.closed ?? !!params.pressed);
  const thrown = $derived(Number(state.throw ?? params.throw ?? 0) >= 0.5);
  const energised = $derived(!!(state.closed ?? (state.throw !== undefined ? Number(state.throw) >= 0.5 : false)) || !!state.energised);
  // Relay lever: from the pivot (80, 24) towards NC (56, 40) at rest, NO (56, 8) when energised.
  const RELAY_ANGLE = (Math.atan2(16, 24) * 180) / Math.PI;
</script>

{#if type === 'switch'}
  <path class="stub" data-pin="0" d="M0 0 H9.5" />
  <path class="stub" data-pin="1" d="M48 0 H38.5" />
  <circle class="body thin" cx="36" cy="0" r="2.5" />
  <line class="ln moving" x1="12" y1="0" x2="37.5" y2="0" style="transform-origin: 12px 0px" style:transform={closed ? 'rotate(-3deg)' : 'rotate(-27deg)'} />
  <circle class="ink" cx="12" cy="0" r="2.6" />
{:else if type === 'spdt'}
  <!-- Pivot at (8, 0); contacts on a circle of radius 30: "0" at (38, 0), "1" at (26, −24). -->
  <path class="stub" data-pin="0" d="M0 0 H8" />
  <path class="stub" data-pin="1" d="M48 0 H40.5" />
  <path class="stub" data-pin="2" d="M48 -24 H28.5" />
  <circle class="body thin" cx="38" cy="0" r="2.5" />
  <circle class="body thin" cx="26" cy="-24" r="2.5" />
  <line class="ln moving" x1="8" y1="0" x2="38" y2="0" style="transform-origin: 8px 0px" style:transform={thrown ? 'rotate(-50deg)' : 'rotate(-3.5deg)'} />
  <circle class="ink" cx="8" cy="0" r="2.6" />
  <text class="txt small" x="42" y="-6">0</text>
  <text class="txt small" x="36" y="-29">1</text>
{:else if type === 'pushbutton'}
  <path class="stub" data-pin="0" d="M0 0 H9.5" />
  <path class="stub" data-pin="1" d="M48 0 H38.5" />
  <circle class="body thin" cx="12" cy="0" r="2.5" />
  <circle class="body thin" cx="36" cy="0" r="2.5" />
  <g class="moving" style:transform={pressed ? 'translateY(4px)' : 'none'}>
    <path class="ln" d="M7 -7 H41 M24 -7 V-17 M18 -17 H30" />
  </g>
{:else if type === 'relay'}
  <!-- Coil between A (0, 0) and B (0, 48), wound on a core. -->
  <path class="stub" data-pin="0" d="M0 0 H16 V8" />
  <path class="stub" data-pin="1" d="M0 48 H16 V40" />
  {#if energised}
    <path class="ln copper" style="stroke-width: 6; opacity: 0.28" d="M16 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8" />
  {/if}
  <path class="ln copper" d="M16 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8" />
  <path class="ln thin" d="M25 5 V43 M28.5 5 V43" />
  <!-- Mechanical link from the armature to the moving contact. -->
  <path class="ln dash" d="M31 24 H{energised ? 62 : 60}" />
  <!-- Contacts: COM pivot at (80, 24); NO at (56, 8); NC at (56, 40). -->
  <path class="stub" data-pin="2" d="M96 0 H56 V5.5" />
  <path class="stub" data-pin="3" d="M96 24 H80" />
  <path class="stub" data-pin="4" d="M96 48 H56 V42.5" />
  <circle class="body thin" cx="56" cy="8" r="2.5" />
  <circle class="body thin" cx="56" cy="40" r="2.5" />
  <line
    class="ln moving"
    x1="80"
    y1="24"
    x2="51"
    y2="24"
    style="transform-origin: 80px 24px"
    style:transform={energised ? `rotate(${RELAY_ANGLE + 1.5}deg)` : `rotate(${-RELAY_ANGLE - 1.5}deg)`}
  />
  <circle class="ink" cx="80" cy="24" r="2.6" />
  <text class="txt small start" x="84" y="-4.5">NO</text>
  <text class="txt small start" x="84" y="19.5">COM</text>
  <text class="txt small start" x="84" y="43.5">NC</text>
{/if}
