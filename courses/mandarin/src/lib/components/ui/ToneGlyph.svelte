<script lang="ts">
  /** A tone drawn as its pitch contour on the five-level Chao scale. */
  import { targetContour } from '$lib/audio/tones';
  let { tone, size = 22 }: { tone: number; size?: number } = $props();
  const pts = $derived(
    tone >= 1 && tone <= 4
      ? targetContour(tone as 1 | 2 | 3 | 4, 12)
          .map((v, i) => `${2 + (i / 11) * 20},${2 + ((5 - v) / 4) * 16}`)
          .join(' ')
      : '',
  );
</script>

<svg width={size} height={size * 0.9} viewBox="0 0 24 20" aria-hidden="true">
  {#if pts}
    <polyline points={pts} fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
  {:else}
    <circle cx="12" cy="12" r="2.6" fill="currentColor" />
  {/if}
</svg>
