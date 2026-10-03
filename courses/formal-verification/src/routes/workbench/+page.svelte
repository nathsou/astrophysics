<script lang="ts">
  import { COURSE_TITLE } from '$content/outline';
</script>

<svelte:head><title>The Workbench — {COURSE_TITLE}</title></svelte:head>

<div class="wb">
  <h1>The Workbench</h1>
  <p>Write Vouch and verify it. The editor and the language server arrive with milestone M1.</p>
</div>

<style>
  .wb {
    max-width: 60rem;
    margin: 0 auto;
    padding: 3rem 1rem;
  }
</style>
