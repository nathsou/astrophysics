// Expansion of mathematics: Open Logic macros → KaTeX-ready TeX.

import { BOOL_FALSE, BOOL_TRUE, NO_VALUE, type ArgSpec, type ConfigState } from './macros.ts';

export interface ExpandHooks {
  config: ConfigState;
  /** Counts every macro that was expanded (for the conversion report). */
  used: Map<string, { count: number; origin: 'upstream' | 'override' | 'katex' }>;
  /** Resolves a cross-reference key (already qualified) to display text. */
  refText: (key: string) => string;
  /** Qualifies a label written in the current file. */
  qualify: (opt: (string | undefined)[], label: string) => string;
  /** Called for \ollabel / \label met inside mathematics. */
  onLabel?: (key: string) => void;
  warn: (code: string, message: string) => void;
}

const isLetter = (c: string | undefined) => !!c && /[a-zA-Z@]/.test(c);

export function skipSpaces(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

/** Reads a balanced `{…}` group starting at s[i] === '{'. Returns the content and the index after `}`. */
export function readBalanced(s: string, i: number): { content: string; end: number } {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return { content: s.slice(i + 1, j), end: j + 1 };
  }
  // Unbalanced (an upstream typo, or mathematics cut short by a $): take the rest.
  return { content: s.slice(i + 1), end: s.length };
}

/** Reads one mandatory argument: a group, a control sequence, `!X`, or a single character. */
export function readArg(s: string, i: number): { content: string; end: number } {
  i = skipSpaces(s, i);
  if (s[i] === '{') return readBalanced(s, i);
  if (s[i] === '\\') {
    let j = i + 1;
    if (isLetter(s[j])) while (isLetter(s[j])) j++;
    else j++;
    return { content: s.slice(i, j), end: j };
  }
  if (s[i] === '!' && /[A-Z]/.test(s[i + 1] ?? '')) return { content: s.slice(i, i + 2), end: i + 2 };
  return { content: s[i] ?? '', end: i + 1 };
}

export function readArgs(s: string, i: number, specs: ArgSpec[]): { values: string[]; end: number } {
  const values: string[] = [];
  for (const spec of specs) {
    if (spec.kind === 'm') {
      const a = readArg(s, i);
      values.push(a.content);
      i = a.end;
      continue;
    }
    const j = skipSpaces(s, i);
    if (spec.kind === 't') {
      if (s.startsWith(spec.char, j)) {
        values.push(BOOL_TRUE);
        i = j + spec.char.length;
      } else values.push(BOOL_FALSE);
      continue;
    }
    const open = spec.kind === 'o' ? '[' : spec.open;
    const close = spec.kind === 'o' ? ']' : spec.close;
    if (s[j] === open) {
      // Find the matching close at brace depth 0. Like xparse, nested delimiters pair up:
      // \lforall[y][(\eq[u(x)][u(y)] \lif …)] takes everything up to the outer ].
      let depth = 0;
      let nest = 0;
      let k = j + 1;
      for (; k < s.length; k++) {
        if (s[k] === '\\') {
          k++;
          continue;
        }
        if (s[k] === '{') depth++;
        else if (s[k] === '}') depth--;
        else if (depth === 0 && s[k] === open && open !== close) nest++;
        else if (s[k] === close && depth === 0) {
          if (nest === 0) break;
          nest--;
        }
      }
      values.push(s.slice(j + 1, k));
      i = k + 1;
    } else values.push(spec.default ?? NO_VALUE);
  }
  return { values, end: i };
}

const ACCENTS: Record<string, string> = { '"': '̈', "'": '́', '`': '̀', '^': '̂', '~': '̃', '=': '̄', '.': '̇', u: '̆', v: '̌', H: '̋', c: '̧', k: '̨' };
const SYMBOLS: Record<string, string> = { ss: 'ß', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', l: 'ł', L: 'Ł', i: 'ı', aa: 'å', AA: 'Å', S: '§', P: '¶', dots: '…', ldots: '…', textellipsis: '…', LaTeX: 'LaTeX', TeX: 'TeX', textendash: '–', textemdash: '—', textbackslash: '\\', textbar: '|' };

/** Applies an accent command to the following character (NFC-composed). */
export function accent(cmd: string, ch: string): string | null {
  const mark = ACCENTS[cmd];
  if (!mark) return null;
  return (ch === '\\i' ? 'ı' : ch) .normalize('NFD').concat(mark).normalize('NFC');
}

export function textSymbol(name: string): string | undefined {
  return SYMBOLS[name];
}

export function tokenText(config: ConfigState, token: string, caps: boolean, article: boolean, plural: boolean): string {
  const t = config.tokens.get(token);
  if (!t) return token;
  // Token texts may carry TeX spacing commands (\@ after an abbreviation such as “c.e.\@”, \/).
  const word = (plural ? (caps && !article ? t.P : t.p) : caps && !article ? t.S : t.s).replace(/\\[@/]/g, '');
  if (!article) return word;
  const art = t.an ? 'an' : 'a';
  return `${caps ? art.charAt(0).toUpperCase() + art.slice(1) : art} ${word}`;
}

/** Reads a `!!` terminology token starting at s[i] === '!' && s[i+1] === '!'. */
export function readToken(s: string, i: number): { token: string; caps: boolean; article: boolean; plural: boolean; end: number } {
  let j = i + 2;
  let caps = false;
  let article = false;
  if (s[j] === '^') {
    caps = true;
    j++;
  }
  if (s[j] === 'a' && s[j + 1] === '{') {
    article = true;
    j++;
  }
  const g = readBalanced(s, j);
  j = g.end;
  let plural = false;
  if (s[j] === 's') {
    plural = true;
    j++;
  }
  return { token: g.content.replace(/\s+/g, ' ').trim(), caps, article, plural, end: j };
}

/**
 * Converts the text inside \text{…} (inside mathematics) to something KaTeX's \text accepts:
 * tokens resolved, accents composed, quotes typographic, nested $…$ expanded.
 */
export function expandTextInMath(s: string, hooks: ExpandHooks, depth: number): string {
  let out = '';
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === '!' && s[i + 1] === '!') {
      const t = readToken(s, i);
      out += tokenText(hooks.config, t.token, t.caps, t.article, t.plural);
      i = t.end;
    } else if (c === '$') {
      let j = i + 1;
      let depthB = 0;
      for (; j < s.length; j++) {
        if (s[j] === '\\') {
          j++;
          continue;
        }
        if (s[j] === '{') depthB++;
        else if (s[j] === '}') depthB--;
        else if (s[j] === '$' && depthB === 0) break;
      }
      out += '$' + expandMath(s.slice(i + 1, j), hooks, depth + 1) + '$';
      i = j + 1;
    } else if (c === '`' && s[i + 1] === '`') {
      out += '“';
      i += 2;
    } else if (c === "'" && s[i + 1] === "'") {
      out += '”';
      i += 2;
    } else if (c === '~') {
      out += ' ';
      i++;
    } else if (c === '\\') {
      let j = i + 1;
      if (isLetter(s[j])) while (isLetter(s[j])) j++;
      else j++;
      const name = s.slice(i + 1, j);
      if (name === '/' || name === '@') {
        i = j;
      } else if (ACCENTS[name] !== undefined) {
        const a = readArg(s, j);
        out += accent(name, a.content) ?? a.content;
        i = a.end;
      } else if (name === 'olref' || name === 'Olref') {
        const r = readArgs(s, j, [{ kind: 'o' }, { kind: 'o' }, { kind: 'o' }, { kind: 'm' }]);
        const opts = r.values.slice(0, 3).map((v) => (v === NO_VALUE ? undefined : v));
        out += hooks.refText(hooks.qualify(opts, r.values[3]));
        i = r.end;
      } else if (name === 'emph' || name === 'textit') {
        const a = readArg(s, j);
        out += `\\textit{${expandTextInMath(a.content, hooks, depth + 1)}}`;
        i = a.end;
      } else if (name === 'textbf') {
        const a = readArg(s, j);
        out += `\\textbf{${expandTextInMath(a.content, hooks, depth + 1)}}`;
        i = a.end;
      } else if (SYMBOLS[name] !== undefined) {
        out += SYMBOLS[name];
        i = skipAfterWord(s, j, name);
      } else {
        out += s.slice(i, j);
        i = j;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function skipAfterWord(s: string, j: number, name: string): number {
  if (!isLetter(name[0])) return j;
  if (s.startsWith('{}', j)) return j + 2;
  return j;
}

const TEXT_IN_MATH = new Set(['text', 'mbox', 'textrm', 'textit', 'textbf', 'textsf', 'texttt', 'emph']);

/** Expands Open Logic macros in a piece of mathematics. */
export function expandMath(src: string, hooks: ExpandHooks, depth = 0): string {
  if (depth > 60) throw new Error(`macro expansion too deep: ${src.slice(0, 80)}`);
  const { config } = hooks;
  let out = '';
  // Never let a control word fuse with a following letter (\lnot + A ≠ \lnotA).
  const emit = (x: string) => {
    if (x && /^[a-zA-Z]/.test(x) && /\\[a-zA-Z@]+$/.test(out)) out += ' ';
    out += x;
  };
  let i = 0;
  const s = src;
  while (i < s.length) {
    const c = s[i];
    if (c === '!') {
      // `!` is active in Open Logic mathematics: `!A` is a formula metavariable.
      const next = s[i + 1];
      if (next && /[A-Z]/.test(next)) {
        emit(config.formulaLetters?.[next] ?? next);
        i += 2;
      } else i++;
      continue;
    }
    if (c !== '\\') {
      emit(c);
      i++;
      continue;
    }
    let j = i + 1;
    if (isLetter(s[j])) while (isLetter(s[j])) j++;
    else j++;
    const name = s.slice(i + 1, j);
    if (!isLetter(name[0])) {
      emit(s.slice(i, j));
      i = j;
      continue;
    }
    // --- built-ins
    if (name === 'IfNoValueTF' || name === 'IfValueTF' || name === 'IfBooleanTF') {
      const r = readArgs(s, j, [{ kind: 'm' }, { kind: 'm' }, { kind: 'm' }]);
      const test = r.values[0].trim();
      const yes = name === 'IfNoValueTF' ? test === NO_VALUE : name === 'IfValueTF' ? test !== NO_VALUE : test === BOOL_TRUE;
      emit(expandMath(yes ? r.values[1] : r.values[2], hooks, depth + 1));
      i = r.end;
      continue;
    }
    if (/^If(NoValue|Value|Boolean)[TF]$/.test(name)) {
      const r = readArgs(s, j, [{ kind: 'm' }, { kind: 'm' }]);
      const test = r.values[0].trim();
      const kind = name.slice(2, -1);
      const truth = kind === 'NoValue' ? test === NO_VALUE : kind === 'Value' ? test !== NO_VALUE : test === BOOL_TRUE;
      const want = name.endsWith('T');
      if (truth === want) emit(expandMath(r.values[1], hooks, depth + 1));
      i = r.end;
      continue;
    }
    if (name === 'ensuremath') {
      const a = readArg(s, j);
      emit(expandMath(a.content, hooks, depth + 1));
      i = a.end;
      continue;
    }
    if (name === 'applytofirst') {
      const f = readArg(s, j);
      const a = readArg(s, f.end);
      const first = readArg(a.content, 0);
      emit(`{${expandMath(`${f.content}{${first.content}}${a.content.slice(first.end)}`, hooks, depth + 1)}}`);
      i = a.end;
      continue;
    }
    if (name === 'iftag') {
      const r = readArgs(s, j, [{ kind: 'm' }, { kind: 'm' }, { kind: 'm' }]);
      const on = r.values[0].split(',').map((t) => t.trim()).some((t) => config.tags.get(t) === true);
      emit(expandMath(on ? r.values[1] : r.values[2], hooks, depth + 1));
      i = r.end;
      continue;
    }
    if (name === 'raisebox') {
      // The box content is text mode in LaTeX as in KaTeX, but LaTeX's \big… work there too.
      const h = readArg(s, j);
      const a = readArg(s, h.end);
      const inner = a.content.trim();
      emit(/^\\(text|mbox)\b/.test(inner) ? `\\raisebox{${h.content}}{${expandTextInMath(readArg(inner, inner.indexOf('{')).content, hooks, depth + 1)}}` : `\\raisebox{${h.content}}{$${expandMath(inner, hooks, depth + 1)}$}`);
      i = a.end;
      continue;
    }
    if (name === 'relax') {
      i = j;
      continue;
    }
    if (name === 'mathexclaim') {
      emit('!');
      i = j;
      continue;
    }
    if (name === 'ollabel' || name === 'label') {
      const a = readArg(s, j);
      hooks.onLabel?.(name === 'ollabel' ? hooks.qualify([], a.content) : a.content);
      i = a.end;
      continue;
    }
    if (name === 'olref' || name === 'Olref') {
      const r = readArgs(s, j, [{ kind: 'o' }, { kind: 'o' }, { kind: 'o' }, { kind: 'm' }]);
      const opts = r.values.slice(0, 3).map((v) => (v === NO_VALUE ? undefined : v));
      emit(`\\text{${hooks.refText(hooks.qualify(opts, r.values[3]))}}`);
      i = r.end;
      continue;
    }
    if (TEXT_IN_MATH.has(name)) {
      const a = readArg(s, j);
      const cmd = name === 'mbox' || name === 'textrm' ? 'text' : name === 'emph' ? 'textit' : name;
      emit(`\\${cmd}{${expandTextInMath(a.content, hooks, depth + 1)}}`);
      bump(hooks, name, 'katex');
      i = a.end;
      continue;
    }
    const def = config.macros.get(name);
    if (def) {
      const r = readArgs(s, j, def.args);
      let body = def.body.replace(/#(\d)/g, (_, n) => r.values[Number(n) - 1] ?? '');
      // Macros defined for text as well as mathematics wrap their body in \ensuremath.
      body = expandMath(body, hooks, depth + 1);
      bump(hooks, name, def.origin);
      // Keep the expansion a single unit, and keep a following letter from fusing with it.
      emit(body);
      i = r.end;
      continue;
    }
    bump(hooks, name, 'katex');
    emit(s.slice(i, j));
    i = j;
  }
  return out;
}

function bump(hooks: ExpandHooks, name: string, origin: 'upstream' | 'override' | 'katex') {
  const e = hooks.used.get(name);
  if (e) e.count++;
  else hooks.used.set(name, { count: 1, origin });
}
