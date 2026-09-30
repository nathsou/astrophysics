// A small syntax highlighter for static code blocks.

const KW = new Set(['def', 'theorem', 'lemma', 'example', 'abbrev', 'axiom', 'inductive', 'structure', 'class', 'instance', 'deriving', 'attribute', 'where', 'fun', 'let', 'have', 'in', 'match', 'nomatch', 'with', 'show', 'from', 'by', 'calc', 'namespace', 'section', 'end', 'open', 'variable', 'universe', 'mutual', 'set_option', 'infixl', 'infixr', 'infix', 'prefix', 'init_quot', 'noncomputable', 'opaque', 'do', 'return', 'if', 'then', 'else']);
const TAC = new Set(['intro', 'intros', 'rintro', 'exact', 'apply', 'refine', 'rfl', 'constructor', 'left', 'right', 'exists', 'use', 'exfalso', 'contradiction', 'assumption', 'trivial', 'decide', 'omega', 'simp', 'simp_all', 'rw', 'rwa', 'cases', 'induction', 'rcases', 'obtain', 'unfold', 'specialize', 'change', 'subst', 'revert', 'clear', 'funext', 'by_cases', 'split', 'generalize', 'suffices', 'next', 'case', 'all_goals', 'any_goals', 'try', 'repeat', 'first', 'skip', 'done', 'sorry', 'generalizing', 'at', 'only']);
const SORTS = new Set(['Prop', 'Type', 'Sort', '*', '□']);

export interface HlTok {
  text: string;
  cls?: string;
}

export function highlight(code: string, lang: string): HlTok[] {
  const out: HlTok[] = [];
  const re =
    lang === 'lambda'
      ? /(--[^\n]*)|([λ\\])|([A-Z][A-Z0-9_]*)|([a-z][\w'₀-₉]*)|(\d+)|([.()=])|(\s+)|(.)/gu
      : /(--[^\n]*|\/-[\s\S]*?-\/)|(#\w+)|([\p{L}_][\p{L}\p{N}_'!?₀-₉.]*)|(\d+)|(:=|=>|→|->|↦|λ|Π|∀|∃|×|∧|∨|¬|↔|≠|⟨|⟩|[(){}[\]:,|@.=+*<>□-])|(\s+)|(.)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const [text] = m;
    if (lang === 'lambda') {
      if (m[1]) out.push({ text, cls: 'hl-com' });
      else if (m[2]) out.push({ text, cls: 'hl-kw' });
      else if (m[3]) out.push({ text, cls: 'hl-name' });
      else if (m[5]) out.push({ text, cls: 'hl-num' });
      else if (m[6]) out.push({ text, cls: 'hl-sym' });
      else out.push({ text });
      continue;
    }
    if (m[1]) out.push({ text, cls: 'hl-com' });
    else if (m[2]) out.push({ text, cls: 'hl-cmd' });
    else if (m[3]) {
      if (KW.has(text)) out.push({ text, cls: 'hl-kw' });
      else if (TAC.has(text)) out.push({ text, cls: 'hl-tac' });
      else if (SORTS.has(text)) out.push({ text, cls: 'hl-sort' });
      else if (/^[A-Z]/.test(text)) out.push({ text, cls: 'hl-name' });
      else out.push({ text });
    } else if (m[4]) out.push({ text, cls: 'hl-num' });
    else if (m[5]) out.push({ text, cls: SORTS.has(text) ? 'hl-sort' : 'hl-sym' });
    else out.push({ text });
  }
  return out;
}
