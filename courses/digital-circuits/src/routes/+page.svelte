<script lang="ts">
  import { base } from '$app/paths';
  import { PARTS, APPENDICES, COURSE_TITLE, COURSE_SUBTITLE } from '$content/outline';
  import { ALL_ENTRIES } from '$lib/content/registry';

  const available = new Set(ALL_ENTRIES.filter((e) => e.available).map((e) => `${e.kind}:${e.slug}`));
</script>

<svelte:head>
  <title>{COURSE_TITLE}</title>
  <meta name="description" content="An interactive course on digital circuits for software engineers: from a battery and a switch to a CPU you build yourself and map onto an FPGA." />
</svelte:head>

<article class="home">
  <header>
    <h1>{COURSE_TITLE}</h1>
    <p class="lede">{COURSE_SUBTITLE}</p>
  </header>
  {#each PARTS as part (part.id)}
    <section>
      <h2>{part.id === '0' || part.id === 'E' ? part.title : `Part ${part.id} · ${part.title}`}</h2>
      <p>{part.blurb}</p>
      <ol>
        {#each part.chapters as c (c.slug)}
          <li>
            {#if available.has(`chapter:${c.slug}`)}
              <a href="{base}/chapters/{c.slug}/">{c.number}. {c.title}</a>
            {:else}
              <span class="planned">{c.number}. {c.title}</span>
            {/if}
          </li>
        {/each}
      </ol>
    </section>
  {/each}
  <section>
    <h2>Appendices</h2>
    <ol>
      {#each APPENDICES as a (a.slug)}
        <li>{a.number}. {a.title}</li>
      {/each}
    </ol>
  </section>
</article>

<style>
  .home {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .planned {
    color: var(--mute);
  }
</style>
