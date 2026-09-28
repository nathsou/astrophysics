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

const LANGS = ['ts', 'typescript', 'js', 'javascript', 'python', 'bash', 'sh', 'json', 'wgsl', 'yaml', 'text', 'svelte', 'html', 'css', 'diff', 'toml'];

/**
 * One Shiki theme whose colours are the course's `--code-*` CSS variables (app.css), the same ones the
 * exercise editor uses. The variables change with the light/dark theme, so a single class of output
 * serves both and the two palettes cannot drift apart.
 */
const v = (name: string) => `var(--code-${name})`;
const notebookTheme: ThemeRegistration = {
  name: 'notebook',
  type: 'light',
  fg: v('def'),
  bg: 'transparent',
  settings: [
    { settings: { foreground: v('def') } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: v('comment'), fontStyle: 'italic' } },
    { scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical', 'variable.language', 'constant.language'], settings: { foreground: v('keyword') } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'string.regexp', 'markup.inserted'], settings: { foreground: v('string') } },
    { scope: ['constant.numeric', 'constant.character', 'constant.other', 'support.constant', 'markup.changed'], settings: { foreground: v('number') } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'entity.name.tag', 'markup.heading'], settings: { foreground: v('fn') } },
    { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class', 'meta.type.annotation', 'storage.type.primitive'], settings: { foreground: v('type') } },
    { scope: ['variable.other.property', 'variable.other.object.property', 'support.type.property-name', 'meta.object-literal.key', 'entity.other.attribute-name', 'variable.other.enummember'], settings: { foreground: v('prop') } },
    { scope: ['punctuation', 'meta.brace', 'keyword.operator', 'punctuation.separator', 'punctuation.terminator'], settings: { foreground: v('punct') } },
    { scope: ['markup.deleted'], settings: { foreground: v('keyword') } },
  ],
};

let highlighter: Promise<Highlighter> | undefined;

export async function highlight(code: string, lang: string | null | undefined): Promise<string> {
  highlighter ??= createHighlighter({ themes: [notebookTheme], langs: LANGS });
  const h = await highlighter;
  const l = lang && LANGS.includes(lang) ? lang : 'text';
  // Shiki makes <pre> focusable (tabindex=0) so wide code can be scrolled from the keyboard,
  // which is right for accessibility, but trips Svelte's generic a11y lint.
  const html = h.codeToHtml(code, { lang: l, theme: 'notebook' });
  return `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->${html}`;
}
