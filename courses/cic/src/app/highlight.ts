// A small, dependency-free syntax highlighter for the static code blocks.
//
// Each language is a tokenizer that returns a flat list of `{ text, cls }`
// tokens; concatenating the texts always gives back the input exactly.
// Token classes (styled in layout.css, coloured by the --c-* tokens):
//
//   hl-kw    keyword                     hl-tac   tactic (Lean, after `by`)
//   hl-cmd   #command (Lean)             hl-sort  Prop / Type / Sort / * / □
//   hl-name  type or capitalised name    hl-fn    function name (definition or call)
//   hl-num   number                      hl-lit   literal: true / false / null …
//   hl-str   string                      hl-com   comment
//   hl-sym   operator                    hl-punct brackets, commas, dots
//   hl-mvar  metavariable (?m)

export interface HlTok {
  text: string;
  cls?: string;
}

/* ------------------------------------------------------------------------
   Lean (and the course's Lean-like kernel language)
   ------------------------------------------------------------------------ */

/** Keywords of the course language (see kernel/syntax/lexer.ts) plus the real-Lean ones the prose compares against. */
export const LEAN_KEYWORDS: ReadonlySet<string> = new Set([
  // the course kernel's language
  'def', 'theorem', 'lemma', 'example', 'abbrev', 'opaque', 'axiom', 'inductive', 'structure', 'mutual', 'variable',
  'universe', 'where', 'fun', 'let', 'in', 'match', 'nomatch', 'with', 'show', 'from', 'sorry', 'open', 'namespace',
  'section', 'end', 'set_option', 'infixl', 'infixr', 'infix', 'prefix', 'init_quot', 'noncomputable',
  // real Lean 4
  'by', 'have', 'calc', 'instance', 'class', 'deriving', 'private', 'protected', 'partial', 'unsafe', 'macro',
  'notation', 'syntax', 'attribute', 'termination_by', 'decreasing_by', 'at', 'do', 'return', 'if', 'then', 'else',
  'for', 'unless', 'mut', 'extends', 'export', 'import', 'suffices', 'obtain',
  // Rocq, for the comparisons in the last chapters
  'Fixpoint', 'Definition', 'Inductive', 'Theorem', 'Lemma', 'Proof', 'Qed', 'Defined',
]);

/** Tactics: only highlighted as such inside a `by` block. */
export const LEAN_TACTICS: ReadonlySet<string> = new Set([
  'intro', 'intros', 'exact', 'apply', 'refine', 'rfl', 'cases', 'rcases', 'induction', 'simp', 'simp_all', 'rw',
  'rewrite', 'constructor', 'omega', 'decide', 'assumption', 'contradiction', 'exfalso', 'unfold', 'left', 'right',
  'exists', 'use', 'split', 'trivial', 'show', 'calc', 'subst', 'specialize', 'generalize', 'revert', 'clear',
  'repeat', 'first', 'try', 'all_goals', 'any_goals', 'next', 'case', 'funext', 'congr', 'ext', 'norm_num', 'linarith',
  'aesop', 'change', 'dsimp', 'injection', 'exact?', 'apply?', 'sorry',
]);

/** Commands that start a new declaration: they end a `by` block. */
const LEAN_COMMANDS = new Set([
  'def', 'theorem', 'lemma', 'example', 'abbrev', 'opaque', 'axiom', 'inductive', 'structure', 'mutual', 'variable',
  'universe', 'open', 'namespace', 'section', 'end', 'set_option', 'instance', 'class', 'noncomputable', 'private',
  'protected', 'infixl', 'infixr', 'infix', 'prefix', 'notation', 'macro', 'attribute',
]);

const LEAN_SORTS = new Set(['Prop', 'Type', 'Sort', '*', '□']);
const LEAN_BINDERS = new Set(['λ', 'Π', 'Σ', '∀', '∃']);

const LEAN_RE =
  /(--[^\n]*|\/-[\s\S]*?(?:-\/|$))|("(?:[^"\\\n]|\\.)*"?)|(#[a-z_]+)|(\?[\p{L}_][\p{L}\p{N}_'₀-₉]*)|((?![λΠΣ])[\p{L}_](?:(?![λΠΣ])[\p{L}\p{N}_'!?₀-₉])*(?:\.[\p{L}_](?:(?![λΠΣ])[\p{L}\p{N}_'!?₀-₉])*)*)|(\d+(?:\.\d+)?)|(:=|=>|<;>|→|->|←|<-|↦|λ|Π|Σ|∀|∃|×|∧|∨|¬|↔|≠|≤|≥|⟨|⟩|[:|@=+*<>□∘^-])|([(){}[\],.;·])|(\s+)|(.)/gu;

function leanTokens(code: string): HlTok[] {
  const out: HlTok[] = [];
  let tactic = false; // inside a `by` block
  let lineStart = true; // no non-blank text yet on this line
  let m: RegExpExecArray | null;
  LEAN_RE.lastIndex = 0;
  while ((m = LEAN_RE.exec(code))) {
    const [text] = m;
    if (m[9]) {
      out.push({ text });
      if (text.includes('\n')) lineStart = true;
      continue;
    }
    const atLineStart = lineStart;
    lineStart = false;
    if (m[1]) out.push({ text, cls: 'hl-com' });
    else if (m[2]) out.push({ text, cls: 'hl-str' });
    else if (m[3]) {
      tactic = false;
      out.push({ text, cls: 'hl-cmd' });
    } else if (m[4]) out.push({ text, cls: 'hl-mvar' });
    else if (m[5]) {
      if (atLineStart && LEAN_COMMANDS.has(text)) tactic = false;
      if (text === 'by') {
        tactic = true;
        out.push({ text, cls: 'hl-kw' });
      } else if (tactic && LEAN_TACTICS.has(text)) out.push({ text, cls: 'hl-tac' });
      else if (LEAN_KEYWORDS.has(text)) out.push({ text, cls: 'hl-kw' });
      else if (LEAN_SORTS.has(text)) out.push({ text, cls: 'hl-sort' });
      else if (/^[A-Z]/.test(text)) out.push({ text, cls: 'hl-name' });
      else out.push({ text });
    } else if (m[6]) out.push({ text, cls: 'hl-num' });
    else if (m[7]) out.push({ text, cls: LEAN_SORTS.has(text) ? 'hl-sort' : LEAN_BINDERS.has(text) ? 'hl-kw' : 'hl-sym' });
    else if (m[8]) out.push({ text, cls: 'hl-punct' });
    else out.push({ text });
  }
  return out;
}

/* ------------------------------------------------------------------------
   Untyped λ-calculus (the λ-lab notation: λx y. M, capitalised definitions)
   ------------------------------------------------------------------------ */

function lambdaTokens(code: string): HlTok[] {
  const out: HlTok[] = [];
  const re = /(--[^\n]*)|([λ\\])|([A-Z][A-Z0-9_']*)|([a-z][\w'₀-₉]*)|(\d+)|([.=])|([()])|(\s+)|(.)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const [text] = m;
    if (m[1]) out.push({ text, cls: 'hl-com' });
    else if (m[2]) out.push({ text, cls: 'hl-kw' });
    else if (m[3]) out.push({ text, cls: 'hl-name' });
    else if (m[5]) out.push({ text, cls: 'hl-num' });
    else if (m[6]) out.push({ text, cls: 'hl-sym' });
    else if (m[7]) out.push({ text, cls: 'hl-punct' });
    else out.push({ text });
  }
  return out;
}

/* ------------------------------------------------------------------------
   TypeScript / JavaScript
   ------------------------------------------------------------------------ */

export const TS_KEYWORDS: ReadonlySet<string> = new Set([
  'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'interface', 'type', 'class', 'extends', 'implements',
  'import', 'export', 'from', 'as', 'readonly', 'enum', 'this', 'super', 'throw', 'try', 'catch', 'finally', 'async',
  'await', 'yield', 'static', 'private', 'protected', 'public', 'abstract', 'declare', 'namespace', 'keyof', 'infer',
  'satisfies', 'is', 'asserts', 'void', 'get', 'set',
]);
const TS_LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
const TS_BUILTIN_TYPES = new Set(['string', 'number', 'boolean', 'bigint', 'symbol', 'object', 'unknown', 'never', 'any']);
/** contextual keywords: plain names when used as a property, parameter or call (`map.get(k)`, `{ type: … }`) */
const TS_SOFT = new Set(['get', 'set', 'type', 'of', 'as', 'is', 'from', 'declare', 'readonly', 'abstract', 'namespace', 'asserts', 'infer', 'satisfies', 'keyof']);

const TS_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^'\\\n]|\\.)*'?|"(?:[^"\\\n]|\\.)*"?)|(`(?:[^`\\]|\\[\s\S])*`?)|(0[xXbBoO][\da-fA-F_]+n?|(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?n?)|([A-Za-z_$][\w$]*)|(=>|\.\.\.|===|!==|\?\?=?|\?\.|&&=?|\|\|=?|\*\*=?|[=!<>]=?|[-+*/%&|^]=?|\+\+|--|[~?:!])|([(){}[\];,.@#])|(\s+)|(.)/g;

function tsTokens(code: string): HlTok[] {
  const out: HlTok[] = [];
  let prev = ''; // previous significant token
  let m: RegExpExecArray | null;
  const re = new RegExp(TS_RE.source, 'g');
  while ((m = re.exec(code))) {
    const [text] = m;
    if (m[8]) {
      out.push({ text });
      continue;
    }
    if (m[1]) out.push({ text, cls: 'hl-com' });
    else if (m[2]) out.push({ text, cls: 'hl-str' });
    else if (m[3]) out.push(...templateTokens(text));
    else if (m[4]) out.push({ text, cls: 'hl-num' });
    else if (m[5]) {
      const rest = code.slice(re.lastIndex);
      const called = /^\s*\(/.test(rest) || /^<[\w$\s,[\]]*>\s*\(/.test(rest);
      const afterDot = prev === '.' || prev === '?.';
      if (afterDot) out.push(called ? { text, cls: 'hl-fn' } : { text });
      else if (TS_LITERALS.has(text)) out.push({ text, cls: 'hl-lit' });
      else if (TS_KEYWORDS.has(text) && !(TS_SOFT.has(text) && /^\s*[:(?,=]/.test(rest))) out.push({ text, cls: 'hl-kw' });
      else if (/^[A-Z]/.test(text) || TS_BUILTIN_TYPES.has(text)) out.push({ text, cls: 'hl-name' });
      else if (prev === 'function' || called) out.push({ text, cls: 'hl-fn' });
      else out.push({ text });
    } else if (m[6]) out.push({ text, cls: 'hl-sym' });
    else if (m[7]) out.push({ text, cls: 'hl-punct' });
    else out.push({ text });
    prev = text;
  }
  return out;
}

/** a template literal: the string parts are strings, `${…}` holes are TypeScript again */
function templateTokens(text: string): HlTok[] {
  const out: HlTok[] = [];
  let i = 0;
  let start = 0;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === '$' && text[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      if (i > start) out.push({ text: text.slice(start, i), cls: 'hl-str' });
      out.push({ text: '${', cls: 'hl-sym' });
      const inner = depth === 0 ? text.slice(i + 2, j - 1) : text.slice(i + 2);
      out.push(...tsTokens(inner));
      if (depth === 0) out.push({ text: '}', cls: 'hl-sym' });
      i = start = j;
      continue;
    }
    i++;
  }
  if (start < text.length) out.push({ text: text.slice(start), cls: 'hl-str' });
  return out;
}

/* ------------------------------------------------------------------------
   JSON and shell (not used by the chapters today, but cheap to support)
   ------------------------------------------------------------------------ */

function jsonTokens(code: string): HlTok[] {
  const out: HlTok[] = [];
  const re = /("(?:[^"\\\n]|\\.)*"?)(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false|null)\b|([{}[\],:])|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[1]) {
      out.push({ text: m[1], cls: m[2] ? 'hl-name' : 'hl-str' });
      if (m[2]) out.push({ text: m[2], cls: 'hl-punct' });
    } else if (m[3]) out.push({ text: m[0], cls: 'hl-num' });
    else if (m[4]) out.push({ text: m[0], cls: 'hl-lit' });
    else if (m[5]) out.push({ text: m[0], cls: 'hl-punct' });
    else out.push({ text: m[0] });
  }
  return out;
}

function shellTokens(code: string): HlTok[] {
  const out: HlTok[] = [];
  const re = /(#[^\n]*)|('[^']*'?|"(?:[^"\\]|\\.)*"?)|(\$\{?\w+\}?)|(\s--?[\w-]+)|(&&|\|\||[|><;])|([^\s'"$|&<>;#]+)|(\s+)|(.)/g;
  let cmd = true; // next word is a command
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const [text] = m;
    if (m[1]) out.push({ text, cls: 'hl-com' });
    else if (m[2]) out.push({ text, cls: 'hl-str' });
    else if (m[3]) out.push({ text, cls: 'hl-name' });
    else if (m[4]) out.push({ text, cls: 'hl-kw' });
    else if (m[5]) {
      out.push({ text, cls: 'hl-sym' });
      cmd = true;
      continue;
    } else if (m[6]) {
      out.push(cmd && !/^\$$/.test(text) ? { text, cls: 'hl-fn' } : { text });
      cmd = false;
      continue;
    } else out.push({ text });
    if (m[7]?.includes('\n')) cmd = true;
  }
  return out;
}

/* ------------------------------------------------------------------------ */

/** canonical language id, or undefined for "no highlighting" */
export function languageOf(lang: string | undefined): 'lean' | 'lambda' | 'ts' | 'json' | 'sh' | undefined {
  switch ((lang ?? '').toLowerCase()) {
    case '':
    case 'lean':
    case 'lean4':
      return 'lean';
    case 'lambda':
      return 'lambda';
    case 'ts':
    case 'typescript':
    case 'tsx':
    case 'js':
    case 'javascript':
    case 'jsx':
    case 'mjs':
      return 'ts';
    case 'json':
      return 'json';
    case 'sh':
    case 'bash':
    case 'shell':
    case 'console':
      return 'sh';
    default:
      return undefined;
  }
}

/** a friendly label for the language badge of a code block */
export function languageLabel(lang: string | undefined): string {
  const l = (lang ?? '').toLowerCase();
  const labels: Record<string, string> = {
    lean: 'Lean 4',
    lean4: 'Lean 4',
    lambda: 'λ',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TSX',
    js: 'JavaScript',
    javascript: 'JavaScript',
    json: 'JSON',
    sh: 'shell',
    bash: 'shell',
    shell: 'shell',
  };
  return labels[l] ?? l;
}

export function highlight(code: string, lang: string): HlTok[] {
  switch (languageOf(lang)) {
    case 'lean':
      return leanTokens(code);
    case 'lambda':
      return lambdaTokens(code);
    case 'ts':
      return tsTokens(code);
    case 'json':
      return jsonTokens(code);
    case 'sh':
      return shellTokens(code);
    default:
      return code ? [{ text: code }] : [];
  }
}
