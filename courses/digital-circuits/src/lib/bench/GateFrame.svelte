<!--
  The dashed outline around an opened-up gate (the `frame` part of an expansion, see
  sim/expand/frame.ts): a rounded box with the gate's id and type in its corner. Drawn behind the
  transistors and never in the way of the pointer.
-->
<script lang="ts">
  import type { SymbolProps } from './symbols/types';
  import { G } from './geometry';

  let { params }: SymbolProps = $props();
  const w = $derived(Number(params.w ?? 10) * G);
  const h = $derived(Number(params.h ?? 10) * G);
  const title = $derived(String(params.title ?? ''));
</script>

<rect class="gate-frame" x="0" y="0" width={w} height={h} rx="7" />
<text class="gate-title" x="9" y="16">{title}</text>

<style>
  .gate-frame {
    fill: color-mix(in srgb, var(--_ink2, #6b6459) 5%, transparent);
    stroke: var(--_ink2, #6b6459);
    stroke-width: 1.3;
    stroke-dasharray: 5 4;
  }
  .gate-title {
    font-family: var(--font-ui, system-ui, sans-serif);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    fill: var(--_ink2, #6b6459);
    dominant-baseline: auto;
  }
  :global(.sch g.comp:has(.gate-frame)) {
    pointer-events: none;
  }
</style>
