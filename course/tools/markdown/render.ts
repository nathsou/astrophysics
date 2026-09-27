/**
 * Build-time renderers for maths (KaTeX) and code (Shiki).
 */
import katex from 'katex';
import { createHighlighter, type Highlighter } from 'shiki';

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
let highlighter: Promise<Highlighter> | undefined;

export async function highlight(code: string, lang: string | null | undefined): Promise<string> {
  highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS });
  const h = await highlighter;
  const l = lang && LANGS.includes(lang) ? lang : 'text';
  return h.codeToHtml(code, {
    lang: l,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}
