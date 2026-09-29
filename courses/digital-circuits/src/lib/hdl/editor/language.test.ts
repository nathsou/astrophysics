import { describe, expect, it } from 'vitest';
import { format } from '../index';
import { indentFor } from './language';

/** The indentation the editor would give each line of an already formatted source. */
function indentsOf(text: string): { got: number; want: number; line: string }[] {
  const out: { got: number; want: number; line: string }[] = [];
  let pos = 0;
  for (const line of text.split('\n')) {
    if (line.trim() && !line.trim().startsWith('//')) out.push({ got: indentFor(text, pos), want: line.length - line.trimStart().length, line });
    pos += line.length + 1;
  }
  return out;
}

describe('indentation', () => {
  it('reproduces the formatter for nested bodies, port lists and continuation lines', () => {
    const src = format(
      [
        'module M(a: bits<8>, b: bits<8>, sel: bit) -> (y: bits<8>, z: bit) {',
        '  let sum: bits<8> = a + b',
        '  let big: bit = sum == 0xff && sel',
        '    && a != b',
        '  y = match sel {',
        '    0 => sum,',
        '    1 => if big { a } else { b },',
        '  }',
        '  z = big',
        '}',
        '',
        'test "t" {',
        '  let m = sim M(a: 1, b: 2, sel: 0)',
        '  expect m.y == 3',
        '}',
      ].join('\n') + '\n',
    );
    const bad = indentsOf(src).filter((l) => l.got !== l.want);
    expect(bad).toEqual([]);
  });

  it('indents a new line after an opening brace and dedents a closing one', () => {
    expect(indentFor('module M() {\n', 13)).toBe(2);
    expect(indentFor('module M() {\n  let x = 1\n}', 25)).toBe(0);
    expect(indentFor('module M(\n', 10)).toBe(2);
  });
});
