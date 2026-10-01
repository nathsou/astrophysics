import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remarkCourseLinks } from './remark-course-links.mjs';

test('Markdown, references and MDX chapter links preserve project prefixes and fragments', () => {
  const tree = { type: 'root', children: [
    { type: 'link', url: '/ch/orbits/#kepler' },
    { type: 'definition', url: '/ch/light/?depth=2#planck' },
    { type: 'mdxJsxTextElement', attributes: [{ type: 'mdxJsxAttribute', name: 'href', value: '/ch/cmb/' }] },
    { type: 'link', url: 'https://example.com/ch/orbits/' },
    { type: 'link', url: '#local' },
  ] };
  remarkCourseLinks({ base: '/courses/astrophysics' })(tree);
  assert.equal(tree.children[0].url, '/courses/astrophysics/ch/orbits/#kepler');
  assert.equal(tree.children[1].url, '/courses/astrophysics/ch/light/?depth=2#planck');
  assert.equal(tree.children[2].attributes[0].value, '/courses/astrophysics/ch/cmb/');
  assert.equal(tree.children[3].url, 'https://example.com/ch/orbits/');
  assert.equal(tree.children[4].url, '#local');
});
