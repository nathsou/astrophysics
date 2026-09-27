// Open Logic macros → KaTeX.
//
// The macro definitions are *read from the upstream configuration files* (open-logic-config.sty,
// then ic-config.sty, exactly as the book loads them), so that a change of notation upstream
// flows through to the web edition. The definitions are interpreted by a small xparse
// interpreter: argument specifications (m, o, s, t…, d…, O{…}) and the conditionals
// \IfNoValueTF, \IfBooleanTF and friends are supported.
//
// A few macros are defined upstream with TeX primitives that have no KaTeX counterpart
// (box registers, \ooalign, font declarations). Those are listed in OVERRIDES below, each with
// the reason. Anything else that KaTeX does not know is reported by the converter as an
// `unsupported-macro` error and rendered visibly; nothing is silently dropped.

export type ArgSpec =
  | { kind: 'm' }
  | { kind: 'o'; default?: string }
  | { kind: 't'; char: string }
  | { kind: 'd'; open: string; close: string; default?: string };

export interface MacroDef {
  name: string;
  args: ArgSpec[];
  body: string;
  origin: 'upstream' | 'override';
  /** Where the definition came from (file:line), for diagnostics. */
  from: string;
}

export const NO_VALUE = '-NoValue-';
export const BOOL_TRUE = '\\BooleanTrue';
export const BOOL_FALSE = '\\BooleanFalse';

/** Macros whose upstream definition relies on TeX internals KaTeX cannot run. */
export const OVERRIDES: Record<string, { args: string; body: string; why: string }> = {
  gn: {
    args: 'm',
    body: '\\ulcorner #1 \\urcorner',
    why: 'defined in sty/open-logic.sty with box registers (\\setbox, \\raise) to align the corners',
  },
  pto: { args: '', body: '\\mathrel{\\rightharpoonup}', why: 'built with \\ooalign and \\mapstochar' },
  mathbi: {
    args: 'm',
    body: '\\boldsymbol{\\mathit{#1}}',
    why: 'declared in ic-config.sty with \\DeclareMathAlphabet (a font declaration)',
  },
  boxright: { args: '', body: '\\mathbin{\\Box\\kern-0.2em\\rightarrow}', why: 'a symbol from the ntxsyc font' },
  fishhookright: { args: '', body: '\\mathbin{\\prec}', why: 'a symbol from the ntxsyc font' },
  iddots: { args: '', body: '\\mathinner{\\kern1mu\\raisebox{0.1em}{.}\\kern2mu\\raisebox{0.4em}{.}\\kern2mu\\raisebox{0.7em}{.}}', why: 'from the mathdots package, unknown to KaTeX' },
  VDash: { args: '', body: '\\mathrel{|}\\!\\vDash', why: 'defined in assignments.tex with \\joinrel and \\Relbar, which KaTeX lacks' },
  nsless: { args: '', body: '\\mathbin{\\ominus}', why: '\\varolessthan comes from the stmaryrd font' },
};

/** TeX/LaTeX commands with a direct KaTeX equivalent, applied while expanding. */
export const COMPAT: Record<string, string> = {
  mbox: 'text',
  textrm: 'text',
  ensuremath: '', // identity (handled specially)
};

export function parseArgSpec(spec: string): ArgSpec[] {
  const out: ArgSpec[] = [];
  let i = 0;
  const s = spec.replace(/\s+/g, ' ');
  const readBraced = (): string => {
    if (s[i] !== '{') {
      const c = s[i];
      i++;
      return c;
    }
    let depth = 0;
    const start = i + 1;
    for (; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}' && --depth === 0) break;
    }
    i++;
    return s.slice(start, i - 1);
  };
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '!' || c === '+' || c === '>') {
      // `!` (no space skipping), `+` (long) and `>` (processors) do not change the arguments.
      if (c === '>') {
        i++;
        readBraced();
        continue;
      }
      i++;
      continue;
    }
    i++;
    if (c === 'm') out.push({ kind: 'm' });
    else if (c === 'o') out.push({ kind: 'o' });
    else if (c === 'O') out.push({ kind: 'o', default: readBraced() });
    else if (c === 's') out.push({ kind: 't', char: '*' });
    else if (c === 't') out.push({ kind: 't', char: readBraced() });
    else if (c === 'd') out.push({ kind: 'd', open: s[i++], close: s[i++] });
    else if (c === 'D') {
      const open = s[i++];
      const close = s[i++];
      out.push({ kind: 'd', open, close, default: readBraced() });
    } else if (c === 'r') {
      const open = s[i++];
      const close = s[i++];
      out.push({ kind: 'd', open, close });
    } else throw new Error(`unsupported xparse argument type "${c}" in {${spec}}`);
  }
  return out;
}

// ------------------------------------------------------------------ reading definitions

export interface ConfigState {
  macros: Map<string, MacroDef>;
  tags: Map<string, boolean>;
  tokens: Map<string, { s: string; p: string; S: string; P: string; an: boolean }>;
  /** `!A` → this table (latin formulas map every letter to itself). */
  formulaLetters: Record<string, string> | null;
}

export function emptyConfig(): ConfigState {
  return { macros: new Map(), tags: new Map(), tokens: new Map(), formulaLetters: null };
}

const GREEK: Record<string, string> = {
  A: '\\varphi', B: '\\psi', C: '\\chi', D: '\\theta', E: '\\alpha', F: '\\beta', G: '\\gamma',
  H: '\\delta', K: '\\xi', L: '\\zeta', O: '\\omega', R: '\\rho', S: '\\sigma', T: '\\tau',
};

/** Strips `%` comments, keeping line structure. */
export function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\') {
          i++;
          continue;
        }
        if (line[i] === '%') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

function readGroupAt(s: string, i: number): { content: string; end: number } | null {
  while (i < s.length && /\s/.test(s[i])) i++;
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') {
      j++;
      continue;
    }
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { content: s.slice(i + 1, j), end: j + 1 };
  }
  throw new Error('unbalanced group');
}

function readOptAt(s: string, i: number): { content: string; end: number } | null {
  while (i < s.length && /[ \t]/.test(s[i])) i++;
  if (s[i] !== '[') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') depth--;
    else if (s[j] === ']' && depth === 0) return { content: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

/** Reads macro, tag, token and formula-style declarations from a .sty file into `state`. */
export function readConfig(state: ConfigState, source: string, file: string): void {
  const s = stripComments(source);
  const lineOf = (i: number) => s.slice(0, i).split('\n').length;
  const re =
    /\\(DeclareDocumentCommand|NewDocumentCommand|RenewDocumentCommand|ProvideDocumentCommand|DeclareDocumentMacro|newcommand\*?|renewcommand\*?|providecommand\*?|DeclareRobustCommand|def|let|tagtrue|tagfalse|settexttoken|DeclareMathOperator\*?|ollatinformulas|olgreekformulas|olalphagreekformulas)(?![a-zA-Z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const cmd = m[1];
    let i = m.index + m[0].length;
    const from = `${file}:${lineOf(m.index)}`;
    if (cmd === 'ollatinformulas') {
      state.formulaLetters = null;
      continue;
    }
    if (cmd === 'olgreekformulas') {
      state.formulaLetters = GREEK;
      continue;
    }
    if (cmd === 'olalphagreekformulas') {
      // Only used by other Open Logic texts; not needed for this book.
      continue;
    }
    if (cmd === 'tagtrue' || cmd === 'tagfalse') {
      const g = readGroupAt(s, i);
      if (!g) continue;
      for (const tag of g.content.split(',').map((t) => t.trim()).filter(Boolean)) {
        state.tags.set(tag, cmd === 'tagtrue');
        state.tags.set(`not${tag}`, cmd !== 'tagtrue');
      }
      re.lastIndex = g.end;
      continue;
    }
    if (cmd === 'settexttoken') {
      const token = readGroupAt(s, i);
      if (!token) continue;
      i = token.end;
      while (/\s/.test(s[i])) i++;
      const an = s[i] === '*';
      if (an) i++;
      const sing = readGroupAt(s, i)!;
      const plur = readGroupAt(s, sing.end)!;
      i = plur.end;
      const S = readOptAt(s, i);
      if (S) i = S.end;
      const P = S ? readOptAt(s, i) : null;
      if (P) i = P.end;
      const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
      state.tokens.set(token.content, {
        s: sing.content,
        p: plur.content,
        S: S?.content ?? cap(sing.content),
        P: P?.content ?? cap(plur.content),
        an,
      });
      re.lastIndex = i;
      continue;
    }
    // Macro definitions. The name is `\X` or `{\X}`.
    while (/\s/.test(s[i])) i++;
    let braced = false;
    if (s[i] === '{') {
      braced = true;
      i++;
    }
    const nm = /^\\([a-zA-Z@]+)/.exec(s.slice(i));
    if (!nm) continue;
    const name = nm[1];
    i += nm[0].length;
    if (braced) {
      while (s[i] !== '}') i++;
      i++;
    }
    if (cmd === 'let') {
      while (/[\s=]/.test(s[i])) i++;
      const target = /^\\([a-zA-Z@]+)/.exec(s.slice(i));
      if (!target) continue;
      const existing = state.macros.get(target[1]);
      if (existing) state.macros.set(name, { ...existing, name, from });
      else if (target[1] !== name) state.macros.set(name, { name, args: [], body: `\\${target[1]}`, origin: 'upstream', from });
      re.lastIndex = i + target[0].length;
      continue;
    }
    let args: ArgSpec[] = [];
    if (cmd.startsWith('DeclareMathOperator')) {
      const body = readGroupAt(s, i);
      if (!body) continue;
      const op = cmd.endsWith('*') ? 'operatorname*' : 'operatorname';
      state.macros.set(name, { name, args: [], body: `\\${op}{${body.content.trim()}}`, origin: 'upstream', from });
      re.lastIndex = body.end;
      continue;
    }
    if (cmd === 'DeclareDocumentMacro') {
      // no arguments
    } else if (cmd.endsWith('DocumentCommand')) {
      const spec = readGroupAt(s, i);
      if (!spec) continue;
      args = parseArgSpec(spec.content);
      i = spec.end;
    } else if (cmd === 'def') {
      // \def\X#1#2{…}: count the parameters.
      const params = /^((?:#\d)*)/.exec(s.slice(i))![1];
      args = Array.from({ length: params.length / 2 }, () => ({ kind: 'm' as const }));
      i += params.length;
    } else {
      // \newcommand{\X}[n][default]{…}
      const n = readOptAt(s, i);
      if (n) {
        i = n.end;
        args = Array.from({ length: Number(n.content) }, () => ({ kind: 'm' as const }));
        const def = readOptAt(s, i);
        if (def) {
          i = def.end;
          args[0] = { kind: 'o', default: def.content };
        }
      }
    }
    const body = readGroupAt(s, i);
    if (!body) continue;
    if (cmd.startsWith('provide') || cmd === 'ProvideDocumentCommand') {
      if (state.macros.has(name)) continue;
    }
    state.macros.set(name, { name, args, body: body.content.trim(), origin: 'upstream', from });
    re.lastIndex = body.end;
  }
}

export function applyOverrides(state: ConfigState): void {
  for (const [name, o] of Object.entries(OVERRIDES)) {
    state.macros.set(name, { name, args: parseArgSpec(o.args), body: o.body, origin: 'override', from: `override: ${o.why}` });
  }
}
