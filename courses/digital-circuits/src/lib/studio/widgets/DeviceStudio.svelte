<!--
  A compact Device Studio inside a chapter:

    ::device-studio{device="gal22v10" example="traffic-light" views="source,chip,logic"}

  `device`: prom, pla, gal22v10 or cpld32. `example`: an example id of that device (the first one by default).
  `views`: any of source, chip, logic, bits, report, jtag. "Open in the Studio" carries the design (and any
  edits to the source) to the full workspace.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import Widget from '../../components/ui/Widget.svelte';
  import { Studio } from '../studio.svelte';
  import StudioApp from '../StudioApp.svelte';
  import { getAdapter } from '../adapters';

  let {
    device = 'gal22v10',
    example,
    views = 'source,chip,logic',
    title,
    caption,
    n,
    blank = false,
    picker = false,
  }: { device?: string; example?: string; views?: string; title?: string; caption?: string; n?: string | number; blank?: boolean; picker?: boolean } = $props();

  const studio = new Studio({ device: untrack(() => device), example: untrack(() => example), blank: untrack(() => blank) });
  const list = $derived(views.split(',').map((v) => v.trim()).filter(Boolean));
  const href = $derived(`${base}/studio/${studio.hash()}`);
  const name = $derived(getAdapter(studio.deviceId)?.name ?? 'Device');
  onMount(() => () => studio.destroy());
</script>

<Widget title={title ?? `${name}: ${studio.fit?.title ?? 'Device Studio'}`} kind="Device Studio" {caption} {n} wide fullscreen>
  <StudioApp {studio} views={list} compact {picker} openHref={href} />
</Widget>
