/**
 * Build-time renderers for maths (KaTeX) and code (Shiki).
 */
import katex from 'katex';
import { createHighlighter, type Highlighter, type ThemeRegistration } from 'shiki';

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
 * Byrne-tinted code themes: the same token roles as GitHub's (keyword, string, number, comment,
 * function, type), re-coloured to sit on the cream / dark-umber pages. Every role keeps its own hue
 * and at least 4.5:1 contrast on the code panel (--pn), so tokens stay distinct in both themes.
 */
function byrneTheme(name: string, type: 'light' | 'dark', c: Record<'fg' | 'bg' | 'keyword' | 'string' | 'number' | 'comment' | 'fn' | 'type' | 'prop' | 'punct', string>): ThemeRegistration {
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
const THEME_LIGHT = byrneTheme('byrne-light', 'light', { fg: '#1a1917', bg: '#e8ddc7', keyword: '#a3211c', string: '#1f5aa6', number: '#7d5200', comment: '#5f574b', fn: '#6a3f8f', type: '#1d6470', prop: '#1f5aa6', punct: '#3f3b34' });
const THEME_DARK = byrneTheme('byrne-dark', 'dark', { fg: '#f3ead9', bg: '#2b2521', keyword: '#ff7a6b', string: '#7aa9ec', number: '#e9a91b', comment: '#a89d8a', fn: '#c3a3f0', type: '#62c2cf', prop: '#7aa9ec', punct: '#d9cfbb' });

const LANGS = ['ts', 'typescript', 'js', 'javascript', 'python', 'bash', 'sh', 'json', 'wgsl', 'yaml', 'text', 'svelte', 'html', 'css', 'diff', 'toml'];
let highlighter: Promise<Highlighter> | undefined;

export async function highlight(code: string, lang: string | null | undefined): Promise<string> {
  highlighter ??= createHighlighter({ themes: [THEME_LIGHT, THEME_DARK], langs: LANGS });
  const h = await highlighter;
  const l = lang && LANGS.includes(lang) ? lang : 'text';
  // Shiki makes <pre> focusable (tabindex=0) so wide code can be scrolled from the keyboard,
  // which is right for accessibility, but trips Svelte's generic a11y lint.
  const html = h.codeToHtml(code, {
    lang: l,
    themes: { light: 'byrne-light', dark: 'byrne-dark' },
    defaultColor: false,
  });
  return `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->${html}`;
}
