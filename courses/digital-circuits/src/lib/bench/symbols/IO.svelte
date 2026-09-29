<!-- Logic inputs and outputs: slide toggle, pushbutton, clock, constant, indicator LED, probe. -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { uprightAt } from '../geometry';
  import { logicChar } from '../format';
  import { LED_COLOURS } from './colours';

  let { type, params, state, rot, flip, uid }: SymbolProps = $props();

  const on = $derived(!!(state.on ?? params.on));
  const pressed = $derived(!!(state.pressed ?? params.pressed));
  const constant = $derived(Number(params.value ?? 1) ? 1 : 0);
  const colour = $derived(String(params.color ?? 'red'));
  const led = $derived(LED_COLOURS[colour] ?? LED_COLOURS.red!);
  const glow = $derived(Math.max(0, Math.min(1, Number(state.brightness ?? 0))));
  const probe = $derived(Number(state.logic ?? 2));
  const probeFill = $derived(probe === 1 ? 'var(--_hi)' : probe === 0 ? 'var(--_lo)' : probe === 3 ? 'var(--_z)' : 'var(--_x)');
</script>

{#if type === 'toggle'}
  <path class="stub" data-pin="0" d="M36 0 H22" />
  <rect class="body" x="-10" y="-8" width="32" height="16" rx="3" />
  <g class="moving" style:transform={on ? 'translateX(14px)' : 'none'}>
    <rect x="-7.5" y="-5.5" width="15" height="11" rx="2" fill={on ? 'var(--_hi)' : 'var(--_lo)'} stroke="var(--_ink)" stroke-width="1.2" />
    <text class="txt bold" x="0" y="0.3" style="font-size: 8px" style:fill={on ? '#241a05' : '#f4f1ea'} transform={uprightAt(0, 0, rot, flip)}>{on ? '1' : '0'}</text>
  </g>
{:else if type === 'button'}
  <path class="stub" data-pin="0" d="M36 0 H13" />
  <circle class="body" cx="4" cy="0" r="9" />
  <circle cx="4" cy="0" r={pressed ? 5 : 6} fill={pressed ? 'var(--_hi)' : 'var(--_lo)'} stroke="var(--_ink)" stroke-width="1.2" />
{:else if type === 'clock'}
  <path class="stub" data-pin="0" d="M36 0 H22" />
  <rect class="body" x="-20" y="-9" width="42" height="18" rx="2" />
  <path class="ln thin" d="M-15 4 H-10 V-4 H-2 V4 H6 V-4 H14 V4 H17" />
{:else if type === 'const'}
  <path class="stub" data-pin="0" d="M24 0 H10" />
  <rect class="body" x="-10" y="-8" width="20" height="16" rx="2" />
  <text class="txt bold" x="0" y="0.3" transform={uprightAt(0, 0, rot, flip)}>{constant}</text>
{:else if type === 'indicator'}
  <path class="stub" data-pin="0" d="M0 0 H13" />
  {#if glow > 0.01}
    <circle cx="22" cy="0" r={9 + 9 * glow} fill="url(#{uid}-glow-{colour in LED_COLOURS ? colour : 'red'})" opacity={Math.min(1, 0.3 + glow)} />
  {/if}
  <circle
    cx="22"
    cy="0"
    r="9"
    stroke="var(--_ink)"
    stroke-width="2"
    fill={glow > 0.01 ? `color-mix(in oklab, ${led.lit} ${Math.round(40 + 60 * glow)}%, var(--_body))` : `color-mix(in oklab, ${led.lit} 14%, var(--_body))`}
  />
  <circle cx="19" cy="-3" r="2.2" fill="#fff" opacity={0.35 + 0.4 * glow} />
{:else if type === 'probe'}
  <path class="stub" data-pin="0" d="M0 0 H8" />
  <path d="M8 0 L14 -9 H34 V9 H14 Z" fill={probeFill} stroke="var(--_ink)" stroke-width="1.5" stroke-linejoin="round" />
  <text class="txt bold" x="24" y="0.3" style="font-size: 10px" style:fill={probe === 1 ? '#241a05' : '#f7f4ee'} transform={uprightAt(24, 0, rot, flip)}
    >{logicChar(probe)}</text
  >
{/if}
