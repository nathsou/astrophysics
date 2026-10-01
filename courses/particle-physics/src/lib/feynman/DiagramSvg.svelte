<!--
  The SVG of a render model: lines in the textbook styles, arrows, vertex dots and particle labels. Used by FeynmanDiagram, DiagramGallery
  and the sketchpad. Colours come from the theme tokens; the line style (straight, wavy, coil, dashed) carries the meaning.
-->
<script lang="ts">
  import type { RenderModel } from './render';

  let {
    model,
    title,
    decorative = false,
    highlight = {},
    bare = false,
    class: klass = '',
  }: {
    model: RenderModel;
    title?: string;
    /** Hide from assistive technology (when a caption already says it). */
    decorative?: boolean;
    /** Vertices or lines to draw in the warning colour: `{ nodes: [ids], edges: [ids] }`. */
    highlight?: { nodes?: number[]; edges?: number[] };
    /** Emit only the `<g>` with the drawing, to be placed inside another SVG. */
    bare?: boolean;
    class?: string;
  } = $props();

  const isItalic = (b: string) => /^[a-zA-Zα-ωΑ-Ω]$/.test(b) && !['W', 'Z', 'H', 'γ'].includes(b);
</script>

{#snippet drawing()}
  {#each model.lines as l (l.id)}
    <path d={l.path} fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width={l.width} stroke-dasharray={l.dash} class:bad={highlight.edges?.includes(l.id)} style="stroke:{l.stroke}" />
    {#if l.arrow}
      <path d="M-4.6 -3.6L4.6 0L-4.6 3.6z" transform="translate({l.arrow.x} {l.arrow.y}) rotate({l.arrow.angle})" style="fill:{l.stroke}" />
    {/if}
  {/each}
  {#each model.dots as dot (dot.id)}
    <circle cx={dot.x} cy={dot.y} r={dot.r} class="dot" class:bad={highlight.nodes?.includes(dot.id)} />
  {/each}
  {#each model.labels as l, i (i)}
    <text x={l.x} y={l.y + l.fontSize * 0.35} text-anchor={l.anchor} font-size={l.fontSize} class="lbl"
      ><tspan text-decoration={l.label.bar ? 'overline' : undefined} font-style={isItalic(l.label.base) ? 'italic' : 'normal'}>{l.label.base}</tspan
      >{#if l.label.sub}<tspan font-size={l.fontSize * 0.7} dy={l.fontSize * 0.25} font-style="normal">{l.label.sub}</tspan
        >{/if}{#if l.label.sup}<tspan font-size={l.fontSize * 0.7} dy={-l.fontSize * 0.42} font-style="normal">{l.label.sup}</tspan
        >{/if}{#if l.star}<tspan font-size={l.fontSize * 0.7} dy={l.label.sup ? 0 : -l.fontSize * 0.42} font-style="normal">*</tspan>{/if}</text
    >
  {/each}
{/snippet}

{#if bare}
  <g>{@render drawing()}</g>
{:else}
  <svg class="fd {klass}" viewBox="0 0 {model.width} {model.height}" role={decorative ? 'presentation' : 'img'} aria-label={decorative ? undefined : (title ?? model.description)} aria-hidden={decorative ? 'true' : undefined} xmlns="http://www.w3.org/2000/svg">
    {@render drawing()}
  </svg>
{/if}

<style>
  .fd {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .dot {
    fill: var(--ink, #1c2127);
  }
  .lbl {
    fill: var(--ink, #1c2127);
    font-family: var(--font-body, 'Newsreader', Georgia, serif);
  }
  .bad {
    stroke: var(--bad, #b8322a) !important;
    fill: var(--bad, #b8322a);
  }
  path.bad {
    fill: none;
  }
</style>
