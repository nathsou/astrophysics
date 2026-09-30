import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { ALPHABET, TERMS, groupByLetter, inlineHtml, letterOf, parseGlossary } from './glossary';

const yamlCount = Object.keys(YAML.parse(readFileSync(new URL('../../../glossary.yaml', import.meta.url), 'utf8'))).length;

describe('inlineHtml', () => {
  test('emphasis, strong text and code', () => {
    expect(inlineHtml('True only when *both* inputs are true, written `a && b`.')).toBe('True only when <em>both</em> inputs are true, written <code>a &amp;&amp; b</code>.');
    expect(inlineHtml('a **strong** word')).toBe('a <strong>strong</strong> word');
  });
  test('the exponent style of the entries: 2^*n* has an emphasised n', () => {
    expect(inlineHtml('A function of *n* inputs has 2^*n* rows.')).toBe('A function of <em>n</em> inputs has 2^<em>n</em> rows.');
  });
  test('HTML in an entry is text, not markup', () => {
    expect(inlineHtml('a <script>alert(1)</script> & "b"')).toBe('a &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;b&quot;');
    expect(inlineHtml('`<b>` stays code')).toBe('<code>&lt;b&gt;</code> stays code');
  });
  test('a lone asterisk or underscore is left alone', () => {
    expect(inlineHtml('t_cq + t_pd, 3 * 4')).toBe('t_cq + t_pd, 3 * 4');
  });
});

describe('grouping', () => {
  test('letters', () => {
    expect(letterOf('AND')).toBe('A');
    expect(letterOf('Ørsted')).toBe('O');
    expect(letterOf('Éclair')).toBe('E');
    expect(letterOf('(SPDT)')).toBe('S');
    expect(letterOf('§ 4')).toBe('#');
    expect(letterOf('2’s complement')).toBe('#');
    expect(letterOf('  hole')).toBe('H');
  });
  test('groups are in alphabetical order, with # first, and terms in order within a group', () => {
    const g = groupByLetter(parseGlossary('b-x:\n  term: banana\n  definition: d\nc:\n  term: 2 things\n  definition: d\na1:\n  term: Apple\n  definition: d\na2:\n  term: apricot\n  definition: d\n'));
    expect(g.map((x) => x.letter)).toEqual(['#', 'A', 'B']);
    expect(g[1]!.terms.map((t) => t.term)).toEqual(['Apple', 'apricot']);
  });
  test('the real glossary: every entry appears once, under its own letter, and the alphabet index offers every letter used', () => {
    expect(TERMS).toHaveLength(yamlCount);
    expect(yamlCount).toBeGreaterThan(250);
    const groups = groupByLetter(TERMS);
    expect(groups.reduce((n, g) => n + g.terms.length, 0)).toBe(TERMS.length);
    for (const g of groups) {
      expect(ALPHABET).toContain(g.letter);
      for (const t of g.terms) expect(letterOf(t.term)).toBe(g.letter);
    }
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
  });
  test('no definition shows raw Markdown after rendering, and none contains stray tags', () => {
    for (const t of TERMS) {
      const text = t.html.replace(/<\/?(em|strong|code)>/g, '');
      expect(text, t.id).not.toMatch(/[<>]/);
      expect(text, t.id).not.toMatch(/`|\*\*/);
      // an asterisk left over is one that was not part of a pair
      expect((text.match(/\*/g) ?? []).length % 2, t.id).toBe(0);
    }
  });
});
