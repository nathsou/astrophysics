import { describe, expect, test } from 'vitest';
import { highlight } from './render';

describe('code rendering', () => {
  test.each([
    ['verilog', "module counter(input clk); reg [7:0] count = 8'd0; endmodule"],
    ['vhdl', 'entity counter is port(clk : in bit); end counter;'],
    ['c', 'int main(void) { return 42; }'],
    ['ts', 'const value: number = 42;'],
    ['python', 'def square(x): return x * x'],
  ])('highlights %s with distinct token colours in both themes', async (lang, code) => {
    const html = await highlight(code, lang);
    expect(new Set([...html.matchAll(/--shiki-light:(#[a-fA-F0-9]+)/g)].map((m) => m[1])).size).toBeGreaterThan(1);
    expect(new Set([...html.matchAll(/--shiki-dark:(#[a-fA-F0-9]+)/g)].map((m) => m[1])).size).toBeGreaterThan(1);
  });

  test('keeps unknown languages readable and escapes code', async () => {
    const html = await highlight('<example>&', 'unknown-language');
    expect(html).toMatch(/(?:&lt;|&#x3C;)example/);
    expect(html).toMatch(/&amp;|&#x26;/);
  });
});

test('Vouch code blocks are highlighted with the shared grammar', async () => {
  const { highlight } = await import('./render');
  const html = await highlight('fn f(x: int) -> int\n  requires x > 0\n{ return x }', 'vouch');
  expect(html).toContain('requires');
  expect(html).toMatch(/--shiki-light:#8A5D00|--shiki-light:#8a5d00/i);
});
