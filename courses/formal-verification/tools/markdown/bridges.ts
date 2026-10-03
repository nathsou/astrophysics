/**
 * Cross-course links (`:::bridge{course=… chapter=…}`), resolved and validated at build time.
 *
 * Each course in the collection has its own router. This module knows each one's URL scheme and reads the
 * course's own chapter list from its sources, so a bridge to a chapter that does not exist fails the build.
 * Links are relative to the collection root (`/<course>/…`); the compiler rewrites them so they work under any
 * base path.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const COURSES_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

interface CourseScheme {
  title: string;
  /** Valid chapter identifiers, read from the course's sources. */
  chapters: () => Set<string>;
  /** URL (relative to the collection root) of a chapter, optionally at a section anchor. */
  href: (chapter: string, section?: string) => string;
}

function slugsFrom(file: string, re = /\bslug:\s*'([^']+)'/g): Set<string> {
  const f = path.join(COURSES_DIR, file);
  if (!existsSync(f)) return new Set();
  return new Set([...readFileSync(f, 'utf8').matchAll(re)].map((m) => m[1]!));
}

function dirsIn(dir: string): Set<string> {
  const d = path.join(COURSES_DIR, dir);
  return existsSync(d) ? new Set(readdirSync(d)) : new Set();
}

/** Hash-routed SolidJS/React courses use `#/ch/<slug>?s=<section>`; SvelteKit courses use paths and anchors. */
const hashRoute = (course: string) => (chapter: string, section?: string) => `/${course}/#/ch/${chapter}${section ? `?s=${section.replace(/^#/, '')}` : ''}`;
const pathRoute = (course: string) => (chapter: string, section?: string) => `/${course}/chapters/${chapter}/${section ? (section.startsWith('#') ? section : `#${section}`) : ''}`;

export const COURSES: Record<string, CourseScheme> = {
  cic: { title: 'The Calculus of Inductive Constructions', chapters: () => slugsFrom('cic/src/content/chapters.ts'), href: hashRoute('cic') },
  'proofs-are-programs': { title: 'Proofs Are Programs', chapters: () => slugsFrom('proofs-are-programs/src/content/chapters.ts'), href: hashRoute('proofs-are-programs') },
  'compiler-backends': { title: 'SSA to Silicon', chapters: () => slugsFrom('compiler-backends/src/content/course.ts'), href: hashRoute('compiler-backends') },
  incompleteness: {
    title: 'Incompleteness and Computability',
    chapters: () => dirsIn('incompleteness/src/content/sections'),
    href: (chapter) => `/incompleteness/#/s/${chapter}`,
  },
  proofs: { title: 'Proofcraft', chapters: () => slugsFrom('proofs/content/outline.ts'), href: pathRoute('proofs') },
  'digital-circuits': { title: 'Digital Circuits', chapters: () => slugsFrom('digital-circuits/content/outline.ts'), href: pathRoute('digital-circuits') },
  'particle-physics': { title: 'Particle Physics', chapters: () => slugsFrom('particle-physics/content/outline.ts'), href: pathRoute('particle-physics') },
  'language-models': { title: 'Language Models from Scratch', chapters: () => slugsFrom('language-models/course/content/outline.ts'), href: pathRoute('language-models') },
};

const cache = new Map<string, Set<string>>();

export interface ResolvedBridge {
  course: string;
  courseTitle: string;
  chapter: string;
  href: string;
}

/** Resolve a bridge or throw with a message naming the valid choices. */
export function resolveBridge(course: string, chapter: string, section?: string): ResolvedBridge {
  const scheme = COURSES[course];
  if (!scheme) throw new Error(`unknown course "${course}" in a bridge; expected one of ${Object.keys(COURSES).join(', ')}`);
  let valid = cache.get(course);
  if (!valid) cache.set(course, (valid = scheme.chapters()));
  if (!valid.has(chapter)) {
    const sample = [...valid].slice(0, 40).join(', ');
    throw new Error(`bridge to ${course}: no chapter "${chapter}". Chapters: ${sample}${valid.size > 40 ? ', …' : ''}`);
  }
  return { course, courseTitle: scheme.title, chapter, href: scheme.href(chapter, section) };
}
