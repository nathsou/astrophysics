<!-- A tooltip over a chip view: `x`, `y` in CSS pixels inside the die container. -->
<script lang="ts">
  let { x, y, title, lines, width }: { x: number; y: number; title?: string; lines: string[]; width: number } = $props();
  const left = $derived(Math.max(4, Math.min(x + 14, width - 250)));
</script>

<div class="tip" style:left="{left}px" style:top="{y + 16}px" role="tooltip">
  {#if title}<strong>{title}</strong>{/if}
  {#each lines as l, i (i)}<div>{l}</div>{/each}
</div>
