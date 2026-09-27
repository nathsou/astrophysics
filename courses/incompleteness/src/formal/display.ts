import type { DisplayRow } from '../content/schema';

/** Assembles display rows into one KaTeX source string (shared by the converter and the app). */
export function assembleDisplay(env: string, rows: DisplayRow[]): string {
  const withTags = rows.map((r) => (r.tag !== undefined ? `${r.tex} \\tag{${r.tag}}` : r.tex));
  if (env === 'equation' && rows.length === 1) return withTags[0];
  const e = env === 'align' || env === 'eqnarray' ? 'align*' : env === 'gather' ? 'gather*' : env === 'equation' ? 'gather*' : `${env.replace('*', '')}*`;
  return `\\begin{${e}}${withTags.join(' \\\\ ')}\\end{${e}}`;
}
