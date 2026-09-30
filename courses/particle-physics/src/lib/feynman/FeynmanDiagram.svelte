<!--
  A Feynman diagram in the textbook style, from a diagram object or from a process string.

    <FeynmanDiagram process="e+ e- > mu+ mu-" index={0} />
    <FeynmanDiagram {diagram} caption="Bhabha scattering, s-channel" />

  Time runs left to right. Fermions are straight lines with an arrow (an antifermion's arrow points against the flow of time), photons,
  W and Z are wavy, gluons are coils, the Higgs boson is dashed. Colours come from the particle tokens, and the drawing is
  fully legible without them (`mono`).
-->
<script lang="ts">
  import { enumerateTreeDiagrams, tryParseProcess, describeDiagram, type Diagram, type EnumerateOptions } from '$lib/hep/diagrams';
  import { renderDiagram } from './render';
  import DiagramSvg from './DiagramSvg.svelte';

  let {
    diagram,
    process,
    index = 0,
    options = {},
    caption,
    width = 360,
    height = 230,
    mono = false,
    labels = true,
    virtualStar = false,
    fontSize = 15,
    maxWidth,
  }: {
    diagram?: Diagram;
    /** The text form of a process; renders the `index`-th enumerated tree diagram. */
    process?: string;
    index?: number;
    options?: EnumerateOptions;
    caption?: string;
    width?: number;
    height?: number;
    mono?: boolean;
    labels?: boolean;
    virtualStar?: boolean;
    fontSize?: number;
    maxWidth?: number;
  } = $props();

  const resolved = $derived.by((): { d: Diagram | null; error: string } => {
    if (diagram) return { d: diagram, error: '' };
    if (!process) return { d: null, error: 'No diagram or process given.' };
    const p = tryParseProcess(process);
    if (!p.ok) return { d: null, error: p.error };
    const all = enumerateTreeDiagrams(p.process.initial, p.process.final, options);
    if (!all.length) return { d: null, error: `"${process}" has no tree diagram with these interactions.` };
    const d = all[index];
    if (!d) return { d: null, error: `"${process}" has ${all.length} tree diagram${all.length === 1 ? '' : 's'}; there is no index ${index}.` };
    return { d, error: '' };
  });
  const model = $derived(resolved.d ? renderDiagram(resolved.d, { width, height, mono, labels, virtualStar, fontSize }) : null);
  const description = $derived(resolved.d ? describeDiagram(resolved.d) : '');
</script>

<figure class="fig" style:max-width="{maxWidth ?? width}px">
  {#if model}
    <DiagramSvg {model} title="Feynman diagram: {description}" />
  {:else}
    <p class="ui err" role="alert">{resolved.error}</p>
  {/if}
  {#if caption}<figcaption class="ui">{caption}</figcaption>{/if}
</figure>

<style>
  .fig {
    margin: 0 auto;
  }
  figcaption {
    font-size: 0.85rem;
    color: var(--ink-2, #3d4550);
    margin-top: 0.3rem;
    text-align: center;
  }
  .err {
    color: var(--bad, #b8322a);
    font-size: 0.85rem;
  }
</style>
