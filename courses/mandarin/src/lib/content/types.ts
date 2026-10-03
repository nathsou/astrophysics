/** What a compiled lesson exports from its module script. */
export interface LessonMeta {
  slug: string;
  title: string;
  zh?: string;
  summary?: string;
  minutes?: number;
  goals?: string[];
  /** Every word taught in the lesson (from ```words blocks and the front matter). */
  words: string[];
  exercises: number;
}
