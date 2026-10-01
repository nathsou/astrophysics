/** Small TypeScript/JavaScript highlighter for the edition’s static examples. */
const keywords = new Set('as async await bigint boolean break case catch class const continue declare default do else enum export extends false finally for from function if implements import in infer instanceof interface keyof let never new null number of private protected public readonly return satisfies static string super switch symbol this throw true try type typeof undefined unknown var void while yield'.split(' '));

export function highlightCode(code: string, escape: (text: string) => string): string {
  const tokens = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|[^`])*`|'(?:\\.|[^'\n])*'|"(?:\\.|[^"\n])*"|\b(?:0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)n?\b|[A-Za-z_$][\w$]*|\s+|[\s\S]/g;
  return [...code.matchAll(tokens)].map((m) => {
    const text = m[0];
    const role = text.startsWith('//') || text.startsWith('/*') ? 'comment'
      : /^[`'"]/.test(text) || /^\d/.test(text) ? 'literal'
      : keywords.has(text) ? 'keyword'
      : /^[A-Za-z_$]/.test(text) && /^\s*\(/.test(code.slice(m.index! + text.length)) ? 'function'
      : undefined;
    const html = escape(text);
    return role ? `<span class="hl-${role}">${html}</span>` : html;
  }).join('');
}
