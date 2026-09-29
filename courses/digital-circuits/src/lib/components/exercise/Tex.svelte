<!-- Client-side KaTeX for live previews. -->
<script lang="ts">
  import katex from 'katex';

  let { tex, display = false }: { tex: string; display?: boolean } = $props();
  const html = $derived.by(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' });
    } catch {
      return tex;
    }
  });
</script>

<span class="tex">{@html html}</span>
