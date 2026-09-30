<!-- Placeholder for the compact pipeline widget (`::pipeline{…}`). Replaced by the Control Room work. -->
<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  let { n, caption, title = 'The pipeline' }: { stage?: string; preset?: string; n?: string | number; caption?: string; title?: string } = $props();
</script>

<Widget {title} {n} {caption} kind="Pipeline"><p class="ui">The pipeline widget is not available yet.</p></Widget>
