/**
 * Build-time renderers for maths (KaTeX) and code (Shiki).
 */
import katex from 'katex';
import { bundledLanguages, createHighlighter, type Highlighter } from 'shiki';

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

let highlighter: Promise<Highlighter> | undefined;

export async function highlight(code: string, lang: string | null | undefined): Promise<string> {
  highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] });
  const h = await highlighter;
  // Load any bundled grammar (including aliases) instead of silently losing highlighting.
  const requested = lang?.trim().toLowerCase() ?? 'text';
  const l = Object.hasOwn(bundledLanguages, requested) ? requested : 'text';
  if (l !== 'text') await h.loadLanguage(bundledLanguages[l as keyof typeof bundledLanguages]);
  // Shiki makes <pre> focusable (tabindex=0) so wide code can be scrolled from the keyboard,
  // which is right for accessibility, but trips Svelte's generic a11y lint.
  const html = h.codeToHtml(code, {
    lang: l,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
  return `<!-- svelte-ignore a11y_no_noninteractive_tabindex -->${html}`;
}
