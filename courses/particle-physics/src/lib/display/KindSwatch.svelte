<!--
  A small sample of a particle kind's colour and line style (solid, thick, wavy, dotted, dashed), drawn with the --p-* tokens
  so it matches every other figure. Colour is never the only cue: the line style differs too.
-->
<script lang="ts">
  import { styleFor, type ParticleClass } from '../theme/particles.ts';
  import { wavyPolyline } from './helix.ts';

  let { kind, width = 52, height = 16 }: { kind: ParticleClass; width?: number; height?: number } = $props();
  const st = $derived(styleFor(kind));
  const y = $derived(height / 2);
  const wave = $derived.by(() => {
    if (st.line !== 'wavy') return '';
    const a = wavyPolyline(3, height / 2, width - 3, height / 2, 3.2, 12, 10);
    const out: string[] = [];
    for (let i = 0; i < a.length; i += 2) out.push(`${a[i]!.toFixed(1)},${a[i + 1]!.toFixed(1)}`);
    return out.join(' ');
  });
</script>

<svg class="sw" {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true" style="color: var({st.cssVar})">
  {#if kind === 'jet'}
    <path d="M3 {y} L{width - 3} {y - 6} L{width - 3} {y + 6} Z" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1" stroke-dasharray="4 2" />
    <line x1="3" x2={width - 3} y1={y} y2={y - 2} stroke="currentColor" stroke-width="1.2" />
    <line x1="3" x2={width - 3} y1={y} y2={y + 2} stroke="currentColor" stroke-width="1.2" />
  {:else if st.line === 'wavy'}
    <polyline points={wave} fill="none" stroke="currentColor" stroke-width={st.width} stroke-linecap="round" stroke-linejoin="round" />
  {:else}
    <line
      x1="3"
      x2={width - 3}
      y1={y}
      y2={y}
      stroke="currentColor"
      stroke-width={st.width}
      stroke-dasharray={st.line === 'dotted' ? '0.1 4.5' : st.dash || undefined}
      stroke-linecap={st.line === 'dotted' ? 'round' : 'butt'}
    />
  {/if}
</svg>

<style>
  .sw {
    flex: none;
    display: block;
  }
</style>
