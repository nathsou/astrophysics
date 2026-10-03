/**
 * Build-time renderers for maths (KaTeX) and code (Shiki).
 */
import katex from 'katex';
import { bundledLanguages, createHighlighter, type Highlighter, type LanguageRegistration, type ThemeRegistration } from 'shiki';
import { readFileSync } from 'node:fs';

/** The Vouch grammar is shared with the VS Code extension (editors/vscode). */
const VOUCH_GRAMMAR = { ...JSON.parse(readFileSync(new URL('../../editors/vscode/syntaxes/vouch.tmLanguage.json', import.meta.url), 'utf8')), name: 'vouch' } as LanguageRegistration;

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
function benchTheme(name: string, type: 'light' | 'dark', c: Record<'fg' | 'bg' | 'keyword' | 'string' | 'number' | 'comment' | 'fn' | 'type' | 'prop' | 'punct' | 'spec', string>): ThemeRegistration {
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
      { scope: ['keyword.other.specification'], settings: { foreground: c.spec, fontStyle: 'italic' } },
      { scope: ['entity.name.label'], settings: { foreground: c.number } },
      { scope: ['variable.other.property', 'meta.object-literal.key', 'support.type.property-name', 'entity.name.tag', 'entity.other.attribute-name'], settings: { foreground: c.prop } },
      { scope: ['markup.inserted'], settings: { foreground: c.string } },
      { scope: ['markup.deleted', 'invalid'], settings: { foreground: c.keyword } },
    ],
  };
}
// "Notary" code themes: the --code-* tokens of app.css (specification keywords in gold italics).
const THEME_LIGHT = benchTheme('notary-light', 'light', { fg: '#1b2333', bg: '#ede6d3', keyword: '#7b2f6e', string: '#0b6e44', number: '#9c4f1c', comment: '#6b6658', fn: '#1f4f9f', type: '#0c6a66', prop: '#34509f', punct: '#4d5462', spec: '#8a5d00' });
const THEME_DARK = benchTheme('notary-dark', 'dark', { fg: '#ebe5d6', bg: '#181b22', keyword: '#e3a0d6', string: '#8ee0b0', number: '#f0a870', comment: '#8f8a7d', fn: '#8fbaff', type: '#66d6c8', prop: '#a7b6ff', punct: '#b1b7c2', spec: '#e6c06a' });

let highlighter: Promise<Highlighter> | undefined;

export async function highlight(code: string, lang: string | null | undefined): Promise<string> {
  highlighter ??= createHighlighter({ themes: [THEME_LIGHT, THEME_DARK], langs: [VOUCH_GRAMMAR] });
  const h = await highlighter;
  // Load any bundled grammar (including aliases) instead of silently losing highlighting.
  const requested = lang?.trim().toLowerCase() ?? 'text';
  const l = requested === 'vouch' ? 'vouch' : Object.hasOwn(bundledLanguages, requested) ? requested : 'text';
  if (l !== 'text' && l !== 'vouch') await h.loadLanguage(bundledLanguages[l as keyof typeof bundledLanguages]);
  // Shiki makes <pre> focusable (tabindex=0) so wide code can be scrolled from the keyboard,
  // which is right for accessibility, but trips Svelte's generic a11y lint.
  const html = h.codeToHtml(code, {
    lang: l,
    themes: { light: 'notary-light', dark: 'notary-dark' },
    defaultColor: false,
  });
  return `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->${html}`;
}
