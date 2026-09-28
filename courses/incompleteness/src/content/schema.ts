// The structured form of the upstream LaTeX text, produced by scripts/convert.ts and rendered
// by src/ui/formal. Everything here is data: no React, no KaTeX.

/** A span of lines in a vendored upstream file (path relative to upstream/<repo>/). */
export interface SourceLoc {
  repo: 'OpenLogic' | 'incompleteness-computability';
  file: string;
  line: number;
  endLine: number;
}

export type Inline =
  | { t: 'text'; v: string }
  /** KaTeX-ready TeX (Open Logic macros already expanded); `src` is the original LaTeX. */
  | { t: 'math'; tex: string; src: string; error?: string }
  | { t: 'em'; c: Inline[] }
  | { t: 'strong'; c: Inline[] }
  | { t: 'quote'; c: Inline[]; single?: boolean }
  /** An Open Logic terminology token such as `!!a{formula}`, already resolved to text. */
  | { t: 'term'; token: string; v: string }
  /** A cross-reference; `key` is the fully qualified label, e.g. `inc:art:trm:prop:term-primrec`. */
  | { t: 'ref'; key: string }
  | { t: 'cite'; keys: string[]; text?: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }
  | { t: 'footnote'; c: Block[] }
  /** Something the converter could not translate. Rendered visibly, never dropped. */
  | { t: 'unsupported'; name: string; raw: string };

export interface DisplayRow {
  tex: string;
  /** Equation number shown on the right, if any. */
  tag?: string;
  /** Fully qualified label of this row, if it has one. */
  label?: string;
}

export type EnvKind =
  | 'defn' | 'prop' | 'thm' | 'lem' | 'cor' | 'ex' | 'prob'
  | 'proof' | 'explain' | 'digress' | 'intro' | 'history' | 'quote' | 'center' | 'rem' | 'conv' | 'defish' | 'reading';

export type Block =
  | { t: 'p'; id: string; c: Inline[]; loc: SourceLoc }
  /** Display mathematics. Multi-row environments keep their rows so each can carry a label. */
  | { t: 'display'; id: string; env: string; rows: DisplayRow[]; src: string; loc: SourceLoc; error?: string }
  | { t: 'list'; id: string; ordered: boolean; items: ListItem[]; loc: SourceLoc }
  | {
      t: 'env';
      id: string;
      kind: EnvKind;
      /** Book numbering, e.g. "3.4", for numbered environments. */
      number?: string;
      label?: string;
      title?: Inline[];
      /** For proofs: the fully qualified label of the result being proved, if stated. */
      proves?: string;
      c: Block[];
      loc: SourceLoc;
    }
  | { t: 'table'; id: string; rows: Inline[][][]; loc: SourceLoc }
  /** \\section / \\subsection inside a section file. */
  | { t: 'heading'; id: string; level: 3 | 4; c: Inline[]; loc: SourceLoc }
  /** A derivation tree typeset with bussproofs in the source. */
  | { t: 'prooftree'; id: string; root: ProofTreeNode; loc: SourceLoc };

export interface ProofTreeNode {
  c: Inline[];
  right?: Inline[];
  left?: Inline[];
  /** `dots`: a sub-derivation shown as vertical dots (bussproofs-extra's \\DeduceC). */
  line: 'single' | 'double' | 'dashed' | 'none' | 'dots';
  premises: ProofTreeNode[];
}

export interface ListItem {
  id: string;
  marker?: Inline[];
  label?: string;
  c: Block[];
}

export interface Section {
  /** `part.chapter.section`, e.g. `inc.art.cod`. */
  id: string;
  number: string;
  title: Inline[];
  titleText: string;
  loc: SourceLoc;
  blocks: Block[];
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  loc: SourceLoc;
  sections: Section[];
  /** The book's end-of-chapter summary (from the incompleteness-computability repository). */
  summary?: Block[];
}

export interface LabelTarget {
  kind: EnvKind | 'section' | 'chapter' | 'equation' | 'item';
  /** "Proposition 3.4", "Section 3.2", "(1)", … */
  text: string;
  sectionId: string;
  blockId: string;
}

export interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  loc?: SourceLoc;
}

export interface SourceIndex {
  generatedFrom: Record<string, { url: string; commit: string }>;
  chapters: { id: string; number: string; title: string; file: string; sections: { id: string; number: string; title: string }[] }[];
  labels: Record<string, LabelTarget>;
  /** Macros used by the text, with where their definition came from. */
  macros: { name: string; count: number; origin: 'upstream' | 'override' | 'katex' }[];
}

/** An entry of the search index (src/content/source/search.json). */
export interface SearchEntry {
  /** 'term': a term introduced (emphasized) in a definition; otherwise the block's kind. */
  kind: EnvKind | 'term';
  /** "Definition 3.4", or the term itself. */
  head: string;
  title?: string;
  /** The beginning of the block's text, in plain text. */
  text: string;
  /** Keywords from the block's label, e.g. "fixed point" for lem:fixed-point. */
  keys?: string;
  sectionId: string;
  /** Anchor id of the block in Formal mode. */
  anchor: string;
}
