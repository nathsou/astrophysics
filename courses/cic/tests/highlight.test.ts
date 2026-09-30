// The static-code-block highlighter: per-language tokenizers.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { highlight, languageOf, languageLabel, LEAN_KEYWORDS } from '../src/app/highlight.ts';
import { KEYWORDS as LEXER_KEYWORDS } from '@kernel/syntax/lexer.ts';

/** the class given to each occurrence of `word` */
function classesOf(code: string, lang: string, word: string): (string | undefined)[] {
  return highlight(code, lang)
    .filter((t) => t.text === word)
    .map((t) => t.cls);
}
const cls = (code: string, lang: string, word: string) => classesOf(code, lang, word)[0];

describe('highlight: round trip', () => {
  const samples: [string, string][] = [
    ['lean', 'def double : Nat → Nat\n  | 0 => 0\n  | n + 1 => double n + 2 -- ok\n/- block\ncomment -/ #check @double'],
    ['lambda', 'K = λx y. x\n(\\x. x x) 3 -- comment'],
    ['ts', "const s = `a ${b + `c${d}`} e`; // x\n/* y */ if (x !== 'q') return 1.5e3;"],
    ['json', '{ "a": [1, true, null, "s"] }'],
    ['sh', 'npm run build && echo "done" # hi\nFOO=$BAR ls -la'],
    ['text', 'just some text'],
  ];
  for (const [lang, code] of samples) {
    it(`${lang}: tokens concatenate back to the input`, () => {
      expect(highlight(code, lang).map((t) => t.text).join('')).toBe(code);
    });
  }
  it('every fenced block in the chapters round-trips', () => {
    const dir = join(__dirname, '../src/content/chapters');
    let n = 0;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.mdx'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/```(\w*)[^\n]*\n([\s\S]*?)```/g)) {
        n++;
        expect(highlight(m[2], m[1]).map((t) => t.text).join('')).toBe(m[2]);
      }
    }
    expect(n).toBeGreaterThan(10);
  });
  it('every fence language used by the chapters is supported', () => {
    const dir = join(__dirname, '../src/content/chapters');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.mdx'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/^```(\w+)/gm)) expect(languageOf(m[1]), `${f}: ${m[1]}`).toBeDefined();
    }
  });
});

describe('highlight: Lean', () => {
  it('knows every keyword of the course kernel', () => {
    for (const k of LEXER_KEYWORDS) {
      if (k.startsWith('#') || ['Prop', 'Type', 'Sort'].includes(k)) continue;
      expect(LEAN_KEYWORDS.has(k), k).toBe(true);
    }
  });
  it('classifies keywords, sorts, names, numbers, commands and comments', () => {
    const code = 'theorem t (p : Prop) : Nat.succ 0 = 1 := sorry -- note\n#check t';
    expect(cls(code, 'lean', 'theorem')).toBe('hl-kw');
    expect(cls(code, 'lean', 'sorry')).toBe('hl-kw');
    expect(cls(code, 'lean', 'Prop')).toBe('hl-sort');
    expect(cls(code, 'lean', 'Nat.succ')).toBe('hl-name');
    expect(cls(code, 'lean', '0')).toBe('hl-num');
    expect(cls(code, 'lean', '#check')).toBe('hl-cmd');
    expect(cls(code, 'lean', '-- note')).toBe('hl-com');
    expect(cls(code, 'lean', ':=')).toBe('hl-sym');
    expect(cls(code, 'lean', '(')).toBe('hl-punct');
    expect(cls(code, 'lean', 'p')).toBeUndefined();
  });
  it('treats λ, Π and ∀ as binder keywords, also when glued to a name', () => {
    expect(cls('λ (x : A) => x', 'lean', 'λ')).toBe('hl-kw');
    expect(cls('λx. x', 'lean', 'λ')).toBe('hl-kw');
    expect(cls('Π (X : *), X', 'lean', 'Π')).toBe('hl-kw');
    expect(cls('∀ n, n = n', 'lean', '∀')).toBe('hl-kw');
    expect(cls('Π (X : *), X', 'lean', '*')).toBe('hl-sort');
  });
  it('highlights tactics only inside a `by` block', () => {
    const code = 'def intro (a : A) : A := a\ntheorem t : p → p := by\n  intro h\n  exact h\ndef rfl := intro';
    expect(classesOf(code, 'lean', 'intro')).toEqual([undefined, 'hl-tac', undefined]);
    expect(cls(code, 'lean', 'exact')).toBe('hl-tac');
    expect(cls(code, 'lean', 'by')).toBe('hl-kw');
    expect(cls(code, 'lean', 'rfl')).toBeUndefined();
  });
  it('real-Lean keywords', () => {
    for (const k of ['have', 'calc', 'instance', 'deriving', 'private', 'at', 'if', 'then', 'else', 'do', 'return'])
      expect(cls(`${k} x`, 'lean', k), k).toBe('hl-kw');
  });
  it('strings, metavariables and nested-looking comments', () => {
    expect(cls('#eval "hi -- there"', 'lean', '"hi -- there"')).toBe('hl-str');
    expect(cls('exact ?m', 'lean', '?m')).toBe('hl-mvar');
    expect(cls('/- a\n b -/ x', 'lean', '/- a\n b -/')).toBe('hl-com');
  });
  it('untagged code is Lean', () => {
    expect(cls('def x := 1', '', 'def')).toBe('hl-kw');
  });
});

describe('highlight: λ-calculus', () => {
  it('classifies the λ-lab notation', () => {
    const code = 'TWO = λf x. f (f x) -- two';
    expect(cls(code, 'lambda', 'TWO')).toBe('hl-name');
    expect(cls(code, 'lambda', 'λ')).toBe('hl-kw');
    expect(cls(code, 'lambda', '.')).toBe('hl-sym');
    expect(cls(code, 'lambda', '-- two')).toBe('hl-com');
    expect(cls('\\x. x', 'lambda', '\\')).toBe('hl-kw');
  });
});

describe('highlight: TypeScript', () => {
  const code = `function instantiateRev(e: Expr, subst: Expr[]): Expr {
  const n = subst.length;
  if (n === 0 || e.lb === 0) return e;          // closed: nothing to do
  return replaceExpr(e, (x, off) => {
    if (x.k === 'bvar') return liftLooseBVars(subst[n - 1 - x.i], 0, off);
    return undefined;
  });
}`;
  it('keywords', () => {
    for (const k of ['function', 'const', 'if', 'return']) expect(cls(code, 'ts', k), k).toBe('hl-kw');
    const more = 'let a = new B(); for (;;) { switch (a) { case 1: break; default: continue; } } while (x instanceof Y) {} typeof a; interface I extends J {} type T = readonly string[]; class C implements D {} import { a as b } from "m"; export enum E {} this; throw e; try {} catch {}';
    for (const k of ['let', 'new', 'for', 'switch', 'case', 'break', 'default', 'continue', 'while', 'instanceof', 'typeof', 'interface', 'extends', 'type', 'readonly', 'class', 'implements', 'import', 'as', 'from', 'export', 'enum', 'this', 'throw', 'try', 'catch'])
      expect(cls(more, 'ts', k), k).toBe('hl-kw');
  });
  it('literals, numbers, strings and comments', () => {
    expect(cls(code, 'ts', 'undefined')).toBe('hl-lit');
    expect(cls('x = true; y = null', 'ts', 'true')).toBe('hl-lit');
    expect(cls(code, 'ts', '0')).toBe('hl-num');
    expect(cls('1.5e3 + 0xff + 10n', 'ts', '0xff')).toBe('hl-num');
    expect(cls(code, 'ts', "'bvar'")).toBe('hl-str');
    expect(cls('"a\\"b"', 'ts', '"a\\"b"')).toBe('hl-str');
    expect(cls(code, 'ts', '// closed: nothing to do')).toBe('hl-com');
    expect(cls('/* a */ b', 'ts', '/* a */')).toBe('hl-com');
  });
  it('types, function names and calls', () => {
    expect(cls(code, 'ts', 'Expr')).toBe('hl-name');
    expect(cls(code, 'ts', 'instantiateRev')).toBe('hl-fn');
    expect(cls(code, 'ts', 'replaceExpr')).toBe('hl-fn');
    expect(cls(code, 'ts', 'liftLooseBVars')).toBe('hl-fn');
    expect(cls('function id<T>(x: T): T { return x; }', 'ts', 'id')).toBe('hl-fn');
    expect(cls('const x: string = y', 'ts', 'string')).toBe('hl-name');
    expect(cls('ctx.get(t.name)', 'ts', 'get')).toBe('hl-fn');
    expect(cls(code, 'ts', 'length')).toBeUndefined();
    expect(cls('({ type: 1 })', 'ts', 'type')).toBeUndefined();
  });
  it('operators and punctuation', () => {
    expect(cls(code, 'ts', '=>')).toBe('hl-sym');
    expect(cls(code, 'ts', '===')).toBe('hl-sym');
    expect(cls(code, 'ts', '||')).toBe('hl-sym');
    expect(cls(code, 'ts', '{')).toBe('hl-punct');
  });
  it('template literals: string parts and highlighted holes', () => {
    const toks = highlight('throw new Error(`unbound variable ${t.name}`);', 'ts');
    expect(toks.find((t) => t.text === '`unbound variable ')?.cls).toBe('hl-str');
    expect(toks.find((t) => t.text === '${')?.cls).toBe('hl-sym');
    expect(toks.find((t) => t.text === 'Error')?.cls).toBe('hl-name');
    expect(toks.find((t) => t.text === 't')?.cls).toBeUndefined();
  });
  it('js is highlighted like ts', () => {
    expect(cls('const x = 1', 'js', 'const')).toBe('hl-kw');
    expect(cls('const x = 1', 'javascript', 'const')).toBe('hl-kw');
  });
});

describe('highlight: other languages', () => {
  it('json', () => {
    const code = '{ "k": "v", "n": 1.5, "b": false }';
    expect(cls(code, 'json', '"k"')).toBe('hl-name');
    expect(cls(code, 'json', '"v"')).toBe('hl-str');
    expect(cls(code, 'json', '1.5')).toBe('hl-num');
    expect(cls(code, 'json', 'false')).toBe('hl-lit');
  });
  it('shell', () => {
    const code = 'npm run build --silent # build\necho "$HOME"';
    expect(cls(code, 'sh', 'npm')).toBe('hl-fn');
    expect(cls(code, 'sh', 'echo')).toBe('hl-fn');
    expect(cls(code, 'sh', ' --silent')).toBe('hl-kw');
    expect(cls(code, 'sh', '# build')).toBe('hl-com');
    expect(cls(code, 'sh', '"$HOME"')).toBe('hl-str');
  });
  it('unknown languages are left alone', () => {
    expect(highlight('def x', 'text')).toEqual([{ text: 'def x' }]);
    expect(languageOf('text')).toBeUndefined();
  });
  it('labels', () => {
    expect(languageLabel('lean')).toBe('Lean 4');
    expect(languageLabel('ts')).toBe('TypeScript');
    expect(languageLabel('lambda')).toBe('λ');
  });
});
