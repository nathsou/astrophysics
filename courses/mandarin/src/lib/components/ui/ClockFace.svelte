<script lang="ts">
  /** A simple analogue clock. */
  let { h, m, size = 140 }: { h: number; m: number; size?: number } = $props();
  const minA = $derived((m / 60) * 360);
  const hourA = $derived(((h % 12) / 12) * 360 + (m / 60) * 30);
</script>

<svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="A clock showing {h}:{String(m).padStart(2, '0')}">
  <circle cx="50" cy="50" r="46" class="face" />
  {#each Array(12) as _, i (i)}
    <line x1="50" y1="8" x2="50" y2={i % 3 === 0 ? 15 : 12} transform="rotate({i * 30} 50 50)" class="tick" />
  {/each}
  <line x1="50" y1="50" x2="50" y2="27" transform="rotate({hourA} 50 50)" class="hour" />
  <line x1="50" y1="50" x2="50" y2="15" transform="rotate({minA} 50 50)" class="min" />
  <circle cx="50" cy="50" r="3" class="pin" />
</svg>

<style>
  .face {
    fill: var(--panel);
    stroke: var(--fg);
    stroke-width: 2.5;
  }
  .tick {
    stroke: var(--ink-2);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .hour {
    stroke: var(--fg);
    stroke-width: 5;
    stroke-linecap: round;
  }
  .min {
    stroke: var(--accent);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .pin {
    fill: var(--fg);
  }
</style>
