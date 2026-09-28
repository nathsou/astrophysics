// The converted text of Heath's translation. Produced by scripts/convert.ts from the pinned Perseus
// TEI file and committed under src/text/data/; the app and the tests only ever read these types.

/** A run of inline content inside a paragraph. */
export type Inline =
  | string
  /** A lettered object: a point, a line, an angle, a figure, a number, e.g. `ABC`. */
  | { t: 'label'; v: string }
  /** A citation Heath added in square brackets, or a cross-reference in a note. */
  | { t: 'ref'; to: string; text: string }
  | { t: 'em'; c: Inline[] }
  | { t: 'strong'; c: Inline[] }
  | { t: 'foreign'; lang: string; c: Inline[] }
  | { t: 'quote'; c: Inline[] }
  /** Heath prints the conclusion of a step centred on its own line. */
  | { t: 'centre'; c: Inline[] };

export type ParaRole =
  /** The general statement (protasis). */
  | 'enunciation'
  /** "Porism." and "Lemma." paragraphs that follow a proposition. */
  | 'porism'
  | 'lemma'
  /** Q.E.D. / Q.E.F. */
  | 'qed'
  | 'text';

export interface Para {
  /** Stable within an item: p0, p1, … */
  id: string;
  role: ParaRole;
  c: Inline[];
  /** The printed page this paragraph starts on (volume_page, e.g. "V1_242"). */
  page?: string;
}

export interface Note {
  /** Heath's lemma for the note, e.g. "8. let the circle BCD be described." */
  lemma?: string;
  paras: Inline[][];
}

export type ItemKind = 'def' | 'post' | 'cn' | 'prop';

export interface Item {
  /** "1.def.15", "1.post.5", "1.cn.1", "1.47", "10.def2.3" */
  id: string;
  book: number;
  kind: ItemKind;
  /** The number printed in the book (for Book X definitions the number within its group). */
  n: number;
  /** For Book X, which of the three groups of definitions. */
  group?: number;
  paras: Para[];
  notes: Note[];
  /** Citations made by the text (not by notes), in order, deduplicated. */
  cites: string[];
  /** Every label that occurs in the text, in order of first occurrence. */
  labels: string[];
  /** Constructions (problems) end "what it was required to do"; theorems "what it was required to prove". */
  problem?: boolean;
}

export interface Section {
  kind: ItemKind;
  group?: number;
  title: string;
  items: Item[];
}

export interface Book {
  n: number;
  roman: string;
  sections: Section[];
}

export interface UpstreamInfo {
  file: string;
  sha256: string;
  source: string;
  licence: string;
}
