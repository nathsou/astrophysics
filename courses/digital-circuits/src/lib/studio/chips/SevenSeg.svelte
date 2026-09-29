<!-- A seven-segment display: `segments` is a bit mask with a = bit 0 … g = bit 6. -->
<script lang="ts">
  let { segments = 0, size = 64, label }: { segments?: number; size?: number; label?: string } = $props();
  // a b c d e f g
  const SEG = [
    'M12 6 L16 3 H40 L44 6 L40 9 H16 Z',
    'M46 8 L49 12 V30 L46 34 L43 30 V12 Z',
    'M46 42 L49 46 V64 L46 68 L43 64 V46 Z',
    'M12 72 L16 69 H40 L44 72 L40 75 H16 Z',
    'M10 42 L13 46 V64 L10 68 L7 64 V46 Z',
    'M10 8 L13 12 V30 L10 34 L7 30 V12 Z',
    'M12 39 L16 36 H40 L44 39 L40 42 H16 Z',
  ];
</script>

<svg viewBox="0 0 56 78" width={size} height={size * (78 / 56)} role="img" aria-label={label ?? `Seven-segment display showing segments ${SEG.map((_, i) => ((segments >> i) & 1 ? 'abcdefg'[i] : '')).join('') || 'none'}`}>
  <rect x="0" y="0" width="56" height="78" rx="5" fill="#070a10" stroke="var(--metal-dim, #555)" />
  {#each SEG as d, i (i)}
    <path {d} fill={(segments >> i) & 1 ? 'var(--sig-high, #ffb23e)' : 'rgb(255 255 255 / 0.07)'} style={(segments >> i) & 1 ? 'filter: drop-shadow(0 0 3px var(--sig-high-glow, rgb(255 178 62 / 0.5)))' : ''} />
  {/each}
</svg>
