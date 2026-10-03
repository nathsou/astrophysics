/** Mock exam papers in the formats of the HSK 1 and 2 tests. Pictures are emoji. */
export type Question =
  /** Does the picture match what you hear/read? */
  | { type: 'tf'; zh: string; picture: string; answer: boolean }
  /** Which picture matches? */
  | { type: 'pictures'; zh: string; pictures: string[]; answer: number }
  /** A question about what you hear/read, with text options. */
  | { type: 'choose'; zh: string; question?: string; options: string[]; answer: number }
  /** Fill the gap from the word bank. */
  | { type: 'fill'; zh: string; options: string[]; answer: number };

export interface Section {
  title: string;
  skill: 'listening' | 'reading';
  instructions: string;
  questions: Question[];
}

export interface Paper {
  id: string;
  title: string;
  level: 1 | 2;
  minutes: number;
  sections: Section[];
}
