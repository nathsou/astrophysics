import { error } from '@sveltejs/kit';
import { LESSONS, lessonBySlug } from '$content/outline';
import { hasLesson, loadLesson } from '$lib/content/lessons';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => LESSONS.filter((l) => hasLesson(l.slug)).map((l) => ({ slug: l.slug }));

export const load: PageLoad = async ({ params }) => {
  const ref = lessonBySlug(params.slug);
  const mod = await loadLesson(params.slug);
  if (!ref || !mod) error(404, 'No such lesson');
  return { ref, Content: mod.default, metadata: mod.metadata, toc: mod.toc };
};
