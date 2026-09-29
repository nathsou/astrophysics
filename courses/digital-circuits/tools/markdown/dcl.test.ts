/** ```dcl code blocks in chapters are highlighted by the DCL lexer, in the structure of the Shiki blocks. */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { compileMarkdown } from './compile';
import { highlightDclHtml } from '../../src/lib/hdl/editor/highlightHtml';

const file = path.resolve(import.meta.dirname, '../../content/chapters/zz-test/index.md');

describe('DCL code blocks', () => {
  it('are highlighted with the lexer and the --code-* tokens', async () => {
    const md = ['A counter:', '', '```dcl title="counter.dcl"', '/// Counts.', 'module Counter(clk: clock) -> (q: bits<4>) {', '  reg v: bits<4> = 0x0', '  next v = v + 1', '  q = v', '}', '```', '', 'And TypeScript:', '', '```ts', 'const x = 1', '```', ''].join('\n');
    const { code } = await compileMarkdown(md, file);
    // Same figure and pre structure as the Shiki block next to it.
    expect(code).toContain('<figure class="code-block" data-lang="dcl"><figcaption>counter.dcl</figcaption>');
    expect(code).toMatch(/<pre class="shiki shiki-themes bench-light bench-dark dcl"[^>]*tabindex="0"><code><span class="line">/);
    expect(code).toMatch(/<pre class="shiki shiki-themes bench-light bench-dark" [^>]*><code>/);
    // Tokens: keywords, types, numbers and doc comments use the design tokens; braces are escaped for Svelte.
    expect(code).toContain('class="tok-keyword" style="--shiki-light:var(--code-keyword);--shiki-dark:var(--code-keyword)">module</span>');
    expect(code).toContain('>Counter</span>');
    expect(code).toContain('--code-number');
    expect(code).toContain('class="tok-doc"');
    expect(code).toContain('&#123;');
    expect(code.split('<span class="line">').length - 1).toBe(7);
  });

  it('keeps every character of the source, and classifies every kind of token', () => {
    const src = 'test "t" {\n  let c = sim Counter(clk: 1)\n  expect c.q == 0 // ok\n}\n\n/* block\n   comment */\nfn f(x: bits<4>) -> bit { x[0] }\n@onehot enum E { A, B }';
    const html = highlightDclHtml(src);
    const text = html
      .replace(/<!--.*?-->/, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    expect(text).toBe(src);
    for (const kind of ['keyword', 'type', 'number', 'string', 'comment', 'operator', 'punctuation', 'function', 'module']) expect(html).toContain(`tok-${kind}`);
  });
});
