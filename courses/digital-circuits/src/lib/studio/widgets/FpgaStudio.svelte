<!--
  A compact FPGA Studio inside a chapter:

    ::fpga-studio{size="M" design="alu" views="source,chip,logic,report"}

  `design`: an example id (counter, traffic-light, hex-counter, alu, regfile, rv32i). `size`: S, M, L or auto (the
  smallest device the design fits). `views`: any of source, chip, logic, bits, report, replay (placement and routing
  tabs), board (the virtual board), hand (the by-hand mode). "Open in the Studio" carries the design to the workspace.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '../../components/ui/Widget.svelte';
  import '../studio.css';
  import { FpgaSession, type SizeChoice } from '../fpga/session.svelte';
  import { fpgaExample } from '../fpga/examples';
  import FpgaWorkspace from '../panes/fpga/FpgaWorkspace.svelte';

  let {
    design = 'counter',
    size = 'auto',
    views = 'source,chip,logic,report',
    title,
    caption,
    n,
    auto = false,
  }: { design?: string; size?: string; views?: string; title?: string; caption?: string; n?: string | number; auto?: boolean } = $props();

  const choice = untrack(() => (['S', 'M', 'L'].includes(size.toUpperCase()) ? (size.toUpperCase() as SizeChoice) : 'auto'));
  const session = new FpgaSession({ example: untrack(() => design), size: choice, auto: untrack(() => auto) });
  const list = $derived(views.split(',').map((v) => v.trim()).filter(Boolean));
  const href = $derived(`${base}/studio/${session.hash()}`);
  const name = $derived(fpgaExample(session.exampleId)?.title ?? 'your design');
  onMount(() => () => session.destroy());
</script>

<Widget title={title ?? `vFPGA: ${name}`} kind="FPGA Studio" {caption} {n} wide fullscreen>
  {#snippet actions()}
    <a class="w-action" href={href}>Open in the Studio</a>
  {/snippet}
  <div class="studio compact">
    <FpgaWorkspace {session} views={list} compact />
  </div>
</Widget>
