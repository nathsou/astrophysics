<script lang="ts">
  import Widget from '$lib/components/ui/Widget.svelte';
  import PythagorasShuffle from '$lib/widgets/PythagorasShuffle.svelte';
</script>

<Widget title="Four triangles in a square" subtitle="The same four triangles, arranged two ways inside a square of side a + b. Change the triangle and rearrange.">
  <PythagorasShuffle controls a={3} b={4} size={340} />
</Widget>
