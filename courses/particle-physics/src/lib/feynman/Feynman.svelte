<!--
  A Feynman diagram as a figure: `::feynman{process="e+ e- > mu+ mu-" index=0 n="15.1" caption="…"}`.
  `forces="qed"` restricts the interactions (comma-separated: qed, qcd, weak, higgs, fermi); `mono` draws in ink only.
-->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import FeynmanDiagram from './FeynmanDiagram.svelte';
  import { tryParseProcess, processSymbols, type Force } from '$lib/hep/diagrams';

  let {
    process,
    index = 0,
    forces,
    n,
    caption,
    title,
    mono = false,
    virtualStar = false,
    width = 420,
    height = 250,
  }: {
    process: string;
    index?: number;
    forces?: string;
    n?: string | number;
    caption?: string;
    title?: string;
    mono?: boolean;
    virtualStar?: boolean;
    width?: number;
    height?: number;
  } = $props();

  const parsed = $derived(tryParseProcess(process));
  const heading = $derived(title ?? (parsed.ok ? `Feynman diagram: ${processSymbols(parsed.process)}` : 'Feynman diagram'));
  const options = $derived(forces ? { forces: forces.split(/[,\s]+/).filter(Boolean) as Force[] } : {});
</script>

<Widget title={heading} {n} {caption} kind="Diagram" live={false}>
  <FeynmanDiagram {process} {index} {options} {mono} {virtualStar} {width} {height} />
</Widget>
