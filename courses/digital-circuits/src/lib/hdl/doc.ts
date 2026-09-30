/**
 * A small Wadler/Prettier-style pretty printer, used by the formatter.
 *
 * - `line`: a space when its group is flat, a newline when it is broken; `softline`: nothing or a newline.
 * - `hardline`: always a newline; it breaks every enclosing group.
 * - `group(doc, broken)`: printed flat if it fits in the remaining width and contains no hard break.
 * - `ifBreak(broken, flat)`: chooses by the mode of the enclosing group (for trailing commas).
 */
export type Doc =
  | string
  | Doc[]
  | { t: 'line'; soft: boolean; hard: boolean }
  | { t: 'group'; contents: Doc; broken: boolean }
  | { t: 'indent'; contents: Doc }
  | { t: 'ifBreak'; broken: Doc; flat: Doc }
  | { t: 'breakParent' };

export const line: Doc = { t: 'line', soft: false, hard: false };
export const softline: Doc = { t: 'line', soft: true, hard: false };
export const hardline: Doc = { t: 'line', soft: false, hard: true };
export const breakParent: Doc = { t: 'breakParent' };

export function group(contents: Doc, broken = false): Doc {
  return { t: 'group', contents, broken };
}
export function indent(contents: Doc): Doc {
  return { t: 'indent', contents };
}
export function ifBreak(broken: Doc, flat: Doc = ''): Doc {
  return { t: 'ifBreak', broken, flat };
}
export function join(sep: Doc, docs: Doc[]): Doc[] {
  const out: Doc[] = [];
  docs.forEach((d, i) => {
    if (i > 0) out.push(sep);
    out.push(d);
  });
  return out;
}

/** Marks every group that contains a hard break (or a broken group) as broken. Returns whether `doc` does. */
function propagate(doc: Doc): boolean {
  if (typeof doc === 'string') return false;
  if (Array.isArray(doc)) {
    let any = false;
    for (const d of doc) if (propagate(d)) any = true;
    return any;
  }
  switch (doc.t) {
    case 'line':
      return doc.hard;
    case 'breakParent':
      return true;
    case 'group': {
      const inner = propagate(doc.contents);
      if (inner) doc.broken = true;
      return doc.broken;
    }
    case 'indent':
      return propagate(doc.contents);
    case 'ifBreak':
      return propagate(doc.broken);
  }
}

type Mode = 'flat' | 'break';
interface Cmd {
  ind: number;
  mode: Mode;
  doc: Doc;
}

function fits(next: Cmd, rest: Cmd[], width: number): boolean {
  const stack: Cmd[] = [next];
  let restIdx = rest.length - 1;
  let w = width;
  while (w >= 0) {
    let cmd = stack.pop();
    if (!cmd) {
      if (restIdx < 0) return true;
      cmd = rest[restIdx--]!;
    }
    const { ind, mode, doc } = cmd;
    if (typeof doc === 'string') {
      w -= doc.length;
      continue;
    }
    if (Array.isArray(doc)) {
      for (let i = doc.length - 1; i >= 0; i--) stack.push({ ind, mode, doc: doc[i]! });
      continue;
    }
    switch (doc.t) {
      case 'line':
        if (mode === 'break' || doc.hard) return true;
        if (!doc.soft) w -= 1;
        break;
      case 'group':
        stack.push({ ind, mode: doc.broken ? 'break' : mode, doc: doc.contents });
        break;
      case 'indent':
        stack.push({ ind: ind + 2, mode, doc: doc.contents });
        break;
      case 'ifBreak':
        stack.push({ ind, mode, doc: mode === 'break' ? doc.broken : doc.flat });
        break;
      case 'breakParent':
        break;
    }
  }
  return false;
}

/** Prints a document within `width` columns. Trailing spaces are removed from every line. */
export function printDoc(doc: Doc, width = 100): string {
  propagate(doc);
  const out: string[] = [];
  let pos = 0;
  const stack: Cmd[] = [{ ind: 0, mode: 'break', doc }];
  while (stack.length) {
    const { ind, mode, doc } = stack.pop()!;
    if (typeof doc === 'string') {
      out.push(doc);
      pos += doc.length;
      continue;
    }
    if (Array.isArray(doc)) {
      for (let i = doc.length - 1; i >= 0; i--) stack.push({ ind, mode, doc: doc[i]! });
      continue;
    }
    switch (doc.t) {
      case 'line':
        if (mode === 'flat' && !doc.hard) {
          if (!doc.soft) {
            out.push(' ');
            pos += 1;
          }
        } else {
          out.push('\n' + ' '.repeat(ind));
          pos = ind;
        }
        break;
      case 'group': {
        if (mode === 'flat' && !doc.broken) {
          stack.push({ ind, mode: 'flat', doc: doc.contents });
          break;
        }
        const flat: Cmd = { ind, mode: 'flat', doc: doc.contents };
        if (!doc.broken && fits(flat, stack, width - pos)) stack.push(flat);
        else stack.push({ ind, mode: 'break', doc: doc.contents });
        break;
      }
      case 'indent':
        stack.push({ ind: ind + 2, mode, doc: doc.contents });
        break;
      case 'ifBreak':
        stack.push({ ind, mode, doc: mode === 'break' ? doc.broken : doc.flat });
        break;
      case 'breakParent':
        break;
    }
  }
  return out.join('').replace(/[ ]+\n/g, '\n').replace(/[ ]+$/, '');
}

/** The width of a document printed flat, or Infinity if it contains a hard break or a broken group. */
export function flatWidth(doc: Doc): number {
  if (typeof doc === 'string') return doc.includes('\n') ? Infinity : doc.length;
  if (Array.isArray(doc)) {
    let w = 0;
    for (const d of doc) w += flatWidth(d);
    return w;
  }
  switch (doc.t) {
    case 'line':
      return doc.hard ? Infinity : doc.soft ? 0 : 1;
    case 'breakParent':
      return Infinity;
    case 'group':
      return doc.broken ? Infinity : flatWidth(doc.contents);
    case 'indent':
      return flatWidth(doc.contents);
    case 'ifBreak':
      return flatWidth(doc.flat);
  }
}
