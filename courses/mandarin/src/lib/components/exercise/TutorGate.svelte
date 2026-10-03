<script lang="ts">
  /** Shown in place of AI exercises until the learner adds an API key. */
  import { base } from '$app/paths';
  let { what }: { what: string } = $props();
</script>

<div class="gate ui">
  <p><strong>{what}</strong> uses Claude as a live partner, with your own Anthropic API key.</p>
  <p class="small">It is optional: everything else in the course works without it. Add a key in <a href="{base}/settings/#tutor">Settings</a>; it stays in this browser and is sent only to Anthropic.</p>
</div>

<style>
  .gate {
    padding: 0.4rem 0;
    font-size: 0.92rem;
  }
  .gate p {
    margin: 0 0 0.4rem;
  }
  .small {
    color: var(--mute);
    font-size: 0.85rem;
  }
</style>
