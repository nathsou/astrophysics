<!--
  vFPGA-S by hand: fill LUT truth tables and choose routing multiplexers by clicking, against a goal. The logic these
  bits make is recovered from the bits and drawn beside the chip.

    ::fpga-by-hand{}
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '../../components/ui/Widget.svelte';
  import '../studio.css';
  import { FpgaSession } from '../fpga/session.svelte';
  import FpgaWorkspace from '../panes/fpga/FpgaWorkspace.svelte';

  let { title, caption, n, views = 'hand,chip,bits' }: { title?: string; caption?: string; n?: string | number; views?: string } = $props();

  const session = new FpgaSession({});
  session.setMode('hand');
  session.hand.edit(() => {});
  const list = $derived(views.split(',').map((v) => v.trim()).filter(Boolean));
  onMount(() => () => session.destroy());
</script>

<Widget title={title ?? 'vFPGA-S by hand'} kind="FPGA by hand" {caption} {n} wide fullscreen>
  {#snippet actions()}
    <a class="w-action" href="{base}/studio/#d=fpga&e=counter">Open in the Studio</a>
  {/snippet}
  <div class="studio" style="height: 42rem">
    <FpgaWorkspace {session} views={list} compact autofit={false} />
  </div>
</Widget>
