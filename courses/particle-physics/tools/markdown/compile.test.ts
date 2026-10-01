import { expect, test } from 'vitest';
import path from 'node:path';
import { compile } from 'svelte/compiler';
import { compileMarkdown } from './compile';

const file = path.resolve(import.meta.dirname, '../../content/chapters/audit/index.md');

test('chapter links use the runtime base path, including links inside quiz HTML', async () => {
  const { code } = await compileMarkdown(`Follow [the next chapter](/chapters/next/#section) or [an external link](//example.com).

\`\`\`quiz
q: 'See [the appendix](/appendix/reference/).'
options:
  - text: Continue
    correct: true
\`\`\`
`, file);
  expect(code).toContain('href="{base}/chapters/next/#section"');
  expect(code).toContain('href="//example.com"');
  expect(code).toContain('data={withBase(');
  expect(code).toContain('__COURSE_BASE__/appendix/reference/');
  expect(code).not.toContain('%C2%A7BASE');
  expect(() => compile(code, { filename: file.replace(/\.md$/, '.svelte'), generate: 'server' })).not.toThrow();
});

test('heading ids do not collide with explicit equation ids', async () => {
  const { code } = await compileMarkdown('## Energy\n\n:::equation{#energy}\n$$\nE = mc^2\n$$\n:::', file);
  expect(code).toContain('<h2 id="energy-1">');
  expect(code).toContain('id={"energy"}');
});

test('history hooks render once, keeping footnote targets unique', async () => {
  const { code } = await compileMarkdown(':::history{title="A discovery"}\nHook with a note.[^note]\n\nThe rest of the story.\n:::\n\n[^note]: The source.', file);
  expect(code).toContain('{#snippet hook()}');
  expect(code.match(/id="user-content-fnref-note"/g)).toHaveLength(1);
  expect(() => compile(code, { filename: file.replace(/\.md$/, '.svelte'), generate: 'server' })).not.toThrow();
});

test('standalone one-line double-dollar equations use display layout', async () => {
  const { code } = await compileMarkdown('$$E = mc^2$$', file);
  expect(code).toContain('class="math-display"');
  expect(code).toContain('class="katex-display"');
});
