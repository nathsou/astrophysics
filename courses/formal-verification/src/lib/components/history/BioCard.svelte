<!-- A biography from content/bios.yaml: `::bio-card{id="hoare"}`. -->
<script lang="ts">
  import Bio from '../content/Bio.svelte';
  import type { BioEntry } from './types';
  let { bio }: { bio: BioEntry } = $props();
</script>

<Bio name={bio.name} born={bio.born} died={bio.died}>
  {@html bio.summary}
</Bio>
