<script lang="ts">
  import { base } from '$app/paths';
  import { PARTS } from '$content/outline';
</script>

<div class="home">
  <h1>Mandarin, Out Loud</h1>
  {#each PARTS as p (p.id)}
    <h2>{p.title}</h2>
    <ul>{#each p.lessons as l (l.slug)}<li><a href="{base}/learn/{l.slug}/">{l.title}</a></li>{/each}</ul>
  {/each}
</div>
