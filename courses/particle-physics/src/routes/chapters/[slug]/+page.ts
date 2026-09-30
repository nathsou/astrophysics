import { error } from '@sveltejs/kit';
import { availableSlugs, findEntry, loadContent } from '$lib/content/registry';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => availableSlugs('chapter').map((slug) => ({ slug }));

export const load: PageLoad = async ({ params }) => {
  const loader = loadContent('chapter', params.slug);
  const entry = findEntry('chapter', params.slug);
  if (!loader || !entry) error(404, 'Not written yet');
  return { mod: await loader(), entry };
};
