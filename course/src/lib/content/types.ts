/** Shapes shared by the markdown compiler (build time) and the site (run time). */
import type { Component } from 'svelte';

/** What a compiled .md file exports. */
export interface ContentModule {
  default: Component;
  metadata: ChapterMetadata;
  toc: TocEntry[];
  terms: Record<string, TermDef>;
  references: Reference[];
  glossary: Record<string, GlossaryEntry>;
}

export interface ChapterMetadata {
  /** URL slug, e.g. "text-as-data". */
  slug: string;
  title: string;
  /** Short subtitle shown under the title and on cards. */
  summary: string;
  /** Chapter number ("1") or appendix letter ("A"). */
  number: string;
  kind: 'chapter' | 'appendix';
  /** Estimated reading + lab time. */
  duration?: string;
  /** Slugs of chapters/appendices assumed. */
  prerequisites?: string[];
  /** What you will have built by the end. */
  builds?: string[];
}

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

/** Hover documentation for a symbol inside an equation (`\term{id}{…}`). */
export interface TermDef {
  /** Rendered HTML of the symbol and its name, e.g. "<katex>s</katex> — Zipf exponent". */
  label: string;
  /** What the symbol represents. HTML. */
  what: string;
  /** Why it appears in the equation. HTML. */
  why?: string;
  /** How changing it affects the model or the curve. HTML. */
  effect?: string;
  /** Optional binding to a live parameter that widgets on the page read. */
  param?: TermParam;
}

export interface TermParam {
  /** Key in the shared parameter store, e.g. "zipf.s". */
  key: string;
  min: number;
  max: number;
  step: number;
  /** Initial value if nothing has set the parameter yet. */
  value: number;
  /** Log-scale slider. */
  log?: boolean;
}

export interface Reference {
  key: string;
  authors: string;
  year: number | string;
  title: string;
  venue?: string;
  url?: string;
  note?: string;
}

export interface GlossaryEntry {
  term: string;
  /** HTML definition. */
  definition: string;
  /** Slug of the chapter that introduces it. */
  chapter?: string;
}

export interface QuizOption {
  text: string;
  correct?: boolean;
  why?: string;
}

export interface QuizData {
  question: string;
  options: QuizOption[];
}

/** An in-browser exercise. Code strings are real .ts files imported with `?raw`. */
export interface ExerciseSpec {
  id: string;
  title: string;
  /** Code shown initially in the editor. */
  starter: string;
  /** Reference solution (revealed on request). */
  solution: string;
  /** Test module; imports the learner's code from "./solution.ts" and helpers from "@lm/test". */
  tests: string;
  hints?: string[];
  /**
   * If set, a passing implementation can replace the reference implementation used by widgets:
   * maps exported names in the learner's module to implementation-registry keys.
   */
  provides?: Record<string, string>;
}
