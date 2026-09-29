import { describe, expect, it } from 'vitest';
import { lex } from './lexer';

/** Tokens as text, with `⏎` for statement-ending newlines. */
function show(src: string): string {
  return lex(src)
    .tokens.filter((t) => t.kind !== 'eof')
    .map((t) => (t.kind === 'newline' ? '⏎' : t.text))
    .join(' ');
}

describe('lexer: tokens', () => {
  it('splits keywords, names, numbers and operators with spans', () => {
    const { tokens, diagnostics } = lex('let x: bits<4> = a<<2 >= 0x1F\n', 'f.dcl');
    expect(diagnostics).toEqual([]);
    expect(tokens.map((t) => [t.kind, t.text])).toEqual([
      ['keyword', 'let'], ['ident', 'x'], ['op', ':'], ['ident', 'bits'], ['op', '<'], ['number', '4'], ['op', '>'],
      ['op', '='], ['ident', 'a'], ['op', '<<'], ['number', '2'], ['op', '>='], ['number', '0x1F'], ['eof', ''],
    ]);
    const x = tokens[1]!;
    expect(x.span).toEqual({ file: 'f.dcl', start: 4, end: 5, line: 1, col: 5 });
    expect(tokens[12]!.span.col).toBe(26);
  });

  it('reads every keyword of HDL.md', () => {
    const words = 'module top fn struct enum type const let reg mem next inst for in if else match on test sim step expect print';
    expect(lex(words).tokens.filter((t) => t.kind === 'keyword').length).toBe(23);
  });

  it('reads decimal, hexadecimal and binary literals with separators', () => {
    const values = lex('42 0x2a 0b10_1010 1_000 0XFF 0B1 0').tokens.filter((t) => t.kind === 'number').map((t) => t.value);
    expect(values).toEqual([42n, 42n, 42n, 1000n, 255n, 1n, 0n]);
  });

  it('reads literals wider than 64 bits exactly', () => {
    expect(lex('0xffff_ffff_ffff_ffff_ffff').tokens[0]!.value).toBe(2n ** 80n - 1n);
  });

  it('reports malformed literals', () => {
    const d = lex('0b102 0x 12ab 0xfg').diagnostics.map((x) => x.message);
    expect(d).toEqual([
      'invalid digit `2` in binary literal',
      'number literal with no digits',
      'invalid digit `a` in decimal literal',
      'invalid digit `g` in hexadecimal literal',
    ]);
  });

  it('reports unexpected characters and unterminated strings and comments, and goes on', () => {
    const r = lex('let a = 1 $ 2\ntest "open\n/* never closed');
    expect(r.diagnostics.map((d) => d.message)).toEqual(['unexpected character `$`', 'unterminated string', 'unterminated block comment']);
    expect(r.diagnostics[0]!.span).toMatchObject({ line: 1, col: 11 });
    expect(r.tokens.some((t) => t.kind === 'error')).toBe(true);
  });

  it('reads strings with escapes', () => {
    expect(lex('"a\\"b\\n"').tokens[0]!.str).toBe('a"b\n');
  });
});

describe('lexer: comments', () => {
  it('keeps line, block and doc comments apart from the tokens', () => {
    const r = lex('/// doc\n//// not doc\n// line\nlet /* inline */ a = 1 // end\n/* multi\nline */');
    expect(r.comments.map((c) => [c.kind, c.text])).toEqual([
      ['doc', '/// doc'], ['line', '//// not doc'], ['line', '// line'], ['block', '/* inline */'], ['line', '// end'],
      ['block', '/* multi\nline */'],
    ]);
    expect(show('/// doc\nlet a = 1 // end\n')).toBe('let a = 1');
  });

  it('nests block comments', () => {
    const r = lex('/* a /* b */ c */ x');
    expect(r.comments).toHaveLength(1);
    expect(r.tokens[0]!.text).toBe('x');
  });

  it('treats a multi-line block comment as a line break', () => {
    expect(show('a = 1 /* x\n */ b = 2')).toBe('a = 1 ⏎ b = 2');
  });
});

describe('lexer: statements and newlines (HDL.md)', () => {
  it('ends a statement at the end of its line', () => {
    expect(show('a = 1\nb = 2\n')).toBe('a = 1 ⏎ b = 2');
  });

  it('ignores blank lines and comment lines between statements', () => {
    expect(show('a = 1\n\n// c\n\nb = 2')).toBe('a = 1 ⏎ b = 2');
  });

  it('keeps `;` as a separator', () => {
    expect(show('a = 1; b = 2;\nc = 3')).toBe('a = 1 ; b = 2 ; ⏎ c = 3');
  });

  it('continues inside unclosed ( and [', () => {
    expect(show('x = f(a,\n  b\n)\ny = z[3\n:0]')).toBe('x = f ( a , b ) ⏎ y = z [ 3 : 0 ]');
  });

  it('continues after a trailing binary operator, =, ,, -> and {', () => {
    for (const op of ['+', '-', '*', '&', '|', '^', '<<', '>>', '==', '!=', '<', '<=', '>', '>=', '&&', '||']) {
      expect(show(`x = a ${op}\n  b`)).toBe(`x = a ${op} b`);
    }
    expect(show('let x =\n  a')).toBe('let x = a');
    expect(show('module M() ->\n(y: bit) {\n}')).toBe('module M ( ) -> ( y : bit ) { }');
    expect(show('next x = if c {\n  a\n} else {\n  b\n}')).toBe('next x = if c { a } else { b }');
  });

  it('continues when the next line starts with an operator, `.`, `)`, `]` or `else`', () => {
    expect(show('let w = a\n  && b\n  || c')).toBe('let w = a && b || c');
    expect(show('let w = a\n  + b')).toBe('let w = a + b');
    expect(show('let w = a\n  - b')).toBe('let w = a - b');
    expect(show('let w = u\n  .port')).toBe('let w = u . port');
    expect(show('x = if c { a }\nelse { b }')).toBe('x = if c { a } else { b }');
    expect(show('x = if c { a }\n  else if d { b }\n  else { e }')).toBe('x = if c { a } else if d { b } else { e }');
  });

  it('ends the statement before a line starting with a name or a keyword', () => {
    expect(show('let a = b\nc = d\nlet e = f')).toBe('let a = b ⏎ c = d ⏎ let e = f');
    expect(show('step\nexpect c.x == 1')).toBe('step ⏎ expect c . x == 1');
  });

  it('handles the RV32I continuation example of HDL.md', () => {
    const src = '  let rd_write: bit = execute && trap == 0\n    && (is_reg || is_imm || is_load || is_jal || is_jalr)\n  y = 1';
    expect(show(src)).toBe('let rd_write : bit = execute && trap == 0 && ( is_reg || is_imm || is_load || is_jal || is_jalr ) ⏎ y = 1');
  });

  it('recovers from an unclosed bracket at the next statement keyword', () => {
    expect(show('let a = f(b\nlet c = d')).toBe('let a = f ( b ⏎ let c = d');
  });

  it('marks tokens that start a line', () => {
    const t = lex('a\n  b c').tokens.filter((x) => x.kind === 'ident');
    expect(t.map((x) => x.lineStart)).toEqual([true, true, false]);
  });

  it('handles \\r\\n line endings', () => {
    expect(show('a = 1\r\nb = 2 // c\r\n')).toBe('a = 1 ⏎ b = 2');
  });
});
