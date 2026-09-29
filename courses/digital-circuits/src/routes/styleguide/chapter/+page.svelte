<!-- A chapter page with sample content, to review the chapter chrome (header, TOC, pager) in the style guide. -->
<script lang="ts">
  import ChapterPage from '$lib/components/layout/ChapterPage.svelte';
  import { ALL_ENTRIES } from '$lib/content/registry';
  import type { ContentModule } from '$lib/content/types';
  import SampleBody from './SampleBody.svelte';

  const entry = { ...ALL_ENTRIES.find((e) => e.slug === 'shannons-switches')!, available: true };
  const mod: ContentModule = {
    default: SampleBody,
    metadata: { slug: entry.slug, title: entry.title, summary: entry.summary, number: entry.number, kind: 'chapter', duration: '45 min + labs', prerequisites: ['relays'] },
    toc: [
      { id: 'series-is-and', text: 'Series is AND', depth: 2 },
      { id: 'parallel-is-or', text: 'Parallel is OR', depth: 2 },
      { id: 'truth-tables', text: 'Truth tables', depth: 3 },
    ],
    terms: {},
    references: [],
    glossary: {},
  };
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<ChapterPage {mod} {entry} />
