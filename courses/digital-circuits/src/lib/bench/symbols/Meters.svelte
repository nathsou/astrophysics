<!-- Voltmeter and ammeter: a circle with V or A and a live readout above. -->
<script lang="ts">
  import type { SymbolProps } from './types';
  import { uprightAt } from '../geometry';
  import { formatReadout } from '../format';

  let { type, state, rot, flip }: SymbolProps = $props();

  const volt = $derived(type === 'voltmeter');
  const reading = $derived(Number(state.value ?? state.reading ?? NaN));
  const text = $derived(formatReadout(reading, volt ? 'V' : 'A', 3));
  // The + terminal: right for the voltmeter (pins −, +), left for the ammeter (pins +, −).
  const plusX = $derived(volt ? 42 : 6);
  const minusX = $derived(volt ? 6 : 42);
  const ry = $derived(rot === 90 || rot === 270 ? -34 : -19.5);
</script>

<path class="stub" data-pin="0" d="M0 0 H11.5" />
<path class="stub" data-pin="1" d="M48 0 H36.5" />
<circle class="body" cx="24" cy="0" r="12.5" />
<text class="txt bold" x="24" y="0.5" style="font-size: 12px" transform={uprightAt(24, 0, rot, flip)}>{volt ? 'V' : 'A'}</text>
<path class="ln thin" d="M{plusX - 2.5} -6 h5 M{plusX} -8.5 v5" />
<path class="ln thin" d="M{minusX - 2.5} -6 h5" transform={uprightAt(minusX, -6, rot, flip)} />
<!-- Readout: above the meter; further out when the meter stands upright, so it clears the circle. -->
<g transform="translate(0 {ry + 19.5}) {uprightAt(24, -19.5, rot, flip) ?? ''}">
  <rect class="window" x="5" y="-24.5" width="38" height="10" rx="1.5" />
  <text class="screen-txt" x="24" y="-19.3">{text}</text>
</g>
