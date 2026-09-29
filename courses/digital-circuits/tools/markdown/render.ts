/**
 * Build-time renderers for maths (KaTeX) and code (Shiki).
 */
import katex from 'katex';
import { createHighlighter, type Highlighter, type ThemeRegistration } from 'shiki';
import { dclHighlighter } from './dcl.ts';

/**
 * Macros available in every equation.
 * `\term{id}{tex}` marks a symbol as hoverable; its documentation comes from a ```terms block
 * in the chapter or from content/terms.yaml.
 */
export const MACROS: Record<string, string> = {
  '\\term': '\\htmlData{term=#1}{#2}',
  '\\R': '\\mathbb{R}',
  '\\E': '\\mathbb{E}',
  '\\softmax': '\\operatorname{softmax}',
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\argmin': '\\operatorname*{arg\\,min}',
  '\\T': '^{\\top}',
};

export function renderMath(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    strict: 'ignore',
    trust: (ctx) => ctx.command === '\\htmlData' || ctx.command === '\\htmlClass',
    macros: { ...MACROS },
    output: 'htmlAndMathml',
  });
}

/** Term ids referenced with \term{id}{…} in a TeX string. */
export function termRefs(tex: string): string[] {
  return [...tex.matchAll(/\\term\{([^}]+)\}/g)].map((m) => m[1]!);
}

/**
 * "Bench" code themes: the same token roles as GitHub's (keyword, string, number, comment, function,
 * type), coloured to sit on the code panel (--pn in app.css: notebook paper / night-lab blue-black).
 * Every role keeps its own hue and at least 4.5:1 contrast on the panel in both themes; the values match
 * the --code-* tokens in app.css so other highlighters (the DCL lexer) can use the same colours.
 */
function benchTheme(name: string, type: 'light' | 'dark', c: Record<'fg' | 'bg' | 'keyword' | 'string' | 'number' | 'comment' | 'fn' | 'type' | 'prop' | 'punct', string>): ThemeRegistration {
  return {
    name,
    type,
    colors: { 'editor.foreground': c.fg, 'editor.background': c.bg },
    fg: c.fg,
    bg: c.bg,
    settings: [
      { settings: { foreground: c.fg, background: c.bg } },
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: c.comment, fontStyle: 'italic' } },
      { scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new', 'keyword.control'], settings: { foreground: c.keyword } },
      { scope: ['keyword.operator', 'punctuation', 'meta.brace'], settings: { foreground: c.punct } },
      { scope: ['string', 'string.quoted', 'punctuation.definition.string', 'constant.other.symbol'], settings: { foreground: c.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.character', 'support.constant'], settings: { foreground: c.number } },
      { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'], settings: { foreground: c.fn } },
      { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], settings: { foreground: c.type } },
      { scope: ['variable.other.property', 'meta.object-literal.key', 'support.type.property-name', 'entity.name.tag', 'entity.other.attribute-name'], settings: { foreground: c.prop } },
      { scope: ['markup.inserted'], settings: { foreground: c.string } },
      { scope: ['markup.deleted', 'invalid'], settings: { foreground: c.keyword } },
    ],
  };
}
const THEME_LIGHT = benchTheme('bench-light', 'light', { fg: '#1c2127', bg: '#eee8dc', keyword: '#8a3f86', string: '#0b6e44', number: '#9c4f1c', comment: '#5d646d', fn: '#1f5fbf', type: '#0c6e69', prop: '#3654b8', punct: '#4a525d' });
const THEME_DARK = benchTheme('bench-dark', 'dark', { fg: '#e2e8ef', bg: '#111a26', keyword: '#e29ad6', string: '#7fe0a8', number: '#f0a870', comment: '#7f8b9b', fn: '#7fb6ff', type: '#5fd6c8', prop: '#9fb0ff', punct: '#aab4c0' });

const LANGS = ['ts', 'typescript', 'js', 'javascript', 'python', 'bash', 'sh', 'json', 'wgsl', 'yaml', 'text', 'svelte', 'html', 'css', 'diff', 'toml'];
let highlighter: Promise<Highlighter> | undefined;

export async function highlight(code: string, lang: string | null | undefined): Promise<string> {
  // DCL is highlighted by the compiler's own lexer, not by a TextMate grammar (HDL.md, Highlighting).
  if (lang === 'dcl') return (await dclHighlighter())(code);
  highlighter ??= createHighlighter({ themes: [THEME_LIGHT, THEME_DARK], langs: LANGS });
  const h = await highlighter;
  const l = lang && LANGS.includes(lang) ? lang : 'text';
  // Shiki makes <pre> focusable (tabindex=0) so wide code can be scrolled from the keyboard,
  // which is right for accessibility, but trips Svelte's generic a11y lint.
  const html = h.codeToHtml(code, {
    lang: l,
    themes: { light: 'bench-light', dark: 'bench-dark' },
    defaultColor: false,
  });
  return `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->${html}`;
}
