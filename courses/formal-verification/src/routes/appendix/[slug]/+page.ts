import { error } from '@sveltejs/kit';
import { availableSlugs, findEntry, loadContent } from '$lib/content/registry';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => availableSlugs('appendix').map((slug) => ({ slug }));

export const load: PageLoad = async ({ params }) => {
  const loader = loadContent('appendix', params.slug);
  const entry = findEntry('appendix', params.slug);
  if (!loader || !entry) error(404, 'Not written yet');
  return { mod: await loader(), entry };
};
