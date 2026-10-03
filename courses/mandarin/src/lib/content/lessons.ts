/** Lazy access to compiled lessons. */
import type { Component } from 'svelte';
import type { LessonMeta } from './types';

type LessonModule = { default: Component; metadata: LessonMeta; toc: { id: string; text: string }[] };

const modules = import.meta.glob<LessonModule>('/content/lessons/*.md');
export function hasLesson(slug: string): boolean {
  return `/content/lessons/${slug}.md` in modules;
}

export async function loadLesson(slug: string): Promise<LessonModule | undefined> {
  return modules[`/content/lessons/${slug}.md`]?.();
}

