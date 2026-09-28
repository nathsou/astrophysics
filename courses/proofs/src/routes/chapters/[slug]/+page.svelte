<script lang="ts">
  import ChapterPage from '$lib/components/layout/ChapterPage.svelte';
  let { data } = $props();
</script>

{#key data.entry.slug}
  <ChapterPage mod={data.mod} entry={data.entry} />
{/key}
