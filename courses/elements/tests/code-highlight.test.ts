import { expect, test } from 'vitest';
import { mdToHtml } from '../src/ui/markdown-core';

test('code gets syntax colours while literals, comments and markup remain intact', () => {
  const html = mdToHtml('```ts\nconst x = 0xff; // return $math$ @AB\nconst text = "<b>";\n```');
  expect(html).toContain('<span class="hl-keyword">const</span>');
  expect(html).toContain('<span class="hl-literal">0xff</span>');
  expect(html).toContain('<span class="hl-comment">// return $math$ @AB</span>');
  expect(html).toContain('&lt;b&gt;');
  expect(html).not.toContain('katex');
  expect(html).not.toContain('data-label');
  expect(html).toContain('tabindex="0"');
});

test('unrecognized code languages remain escaped plain text', () => {
  const html = mdToHtml('```example\n<a>&\n```');
  expect(html).toContain('&lt;a&gt;&amp;');
  expect(html).not.toContain('hl-keyword');
});


test('code and history blocks remain block elements between prose paragraphs', () => {
  const html = mdToHtml('Before.\n```ts\nconst value = 1;\n```\nAfter.\n\n:::history Discovery\nA story.\n:::\n');
  expect(html).not.toMatch(/<p>\s*<(?:pre|aside)/);
  expect(html).toContain('<p>Before.</p>');
  expect(html).toContain('<p>After.</p>');
  expect(html).toContain('<aside class="callout history">');
});
