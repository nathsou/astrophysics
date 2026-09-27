// A small structured-text format shared by every code view in the course.
// The compiler emits Lines of Toks; the UI renders them and resolves `info`
// descriptors into rich tooltips. `key` is used for cross-highlighting: every
// token/line with the same key lights up together, across all visible views.

export type TokClass =
  | 'kw' | 'op' | 'vreg' | 'preg' | 'imm' | 'label' | 'sym' | 'comment' | 'type' | 'punct' | 'dir' | 'frame' | 'plain' | 'hex' | 'err';

export type Info =
  | { kind: 'irop'; op: string; pred?: string }
  | { kind: 'value'; name: string; type?: string; def?: string; note?: string }
  | { kind: 'block'; name: string; preds?: string[]; succs?: string[] }
  | { kind: 'sym'; name: string; what?: string }
  | { kind: 'reg'; target: string; reg: number }
  | { kind: 'vreg'; name: string; assigned?: string; spilled?: boolean; note?: string }
  | { kind: 'mop'; target: string; op: string; note?: string; tag?: string }
  | { kind: 'imm'; value: string; note?: string }
  | { kind: 'frame'; slot: number; desc?: string }
  | { kind: 'term'; term: string }
  | { kind: 'text'; title: string; body: string };

export interface Tok {
  t: string;
  c?: TokClass;
  key?: string;
  info?: Info;
}

export interface Line {
  toks: Tok[];
  /** cross-highlight key for the whole line */
  key?: string;
  /** additional keys lit when the line is hovered (e.g. src line, IR instr) */
  links?: string[];
  kind?: 'label' | 'instr' | 'comment' | 'header' | 'blank' | 'directive';
  indent?: number;
  /** explanation of why the instruction exists */
  note?: string;
  /** provenance tag: 'spill', 'reload', 'prologue', 'copy', ... */
  tag?: string;
  /** highlight state set by visualisations (e.g. 'changed', 'removed', 'added') */
  mark?: string;
  addr?: number;
  bytes?: string;
  /** accent colour (left border), e.g. the tile that produced an instruction */
  color?: string;
}

export const tok = (t: string, c?: TokClass, key?: string, info?: Info): Tok => ({ t, c, key, info });
export const sp: Tok = { t: ' ' };

export function lineText(l: Line): string {
  return ' '.repeat(l.indent ?? 0) + l.toks.map((t) => t.t).join('');
}

export function listingText(lines: Line[]): string {
  return lines.map(lineText).join('\n');
}
