import { describe, expect, it } from 'vitest';
import { makeEnv, processSource } from '@kernel/frontend.ts';
import { checkExercise } from '@kernel/exercise.ts';
import core from '@kernel/prelude/core.lean?raw';

const env = () => makeEnv('cic', [{ id: 'core', src: core }]).env;
const reference = processSource('def compose {A B C : Type} (f : B → C) (g : A → B) (a : A) : C := f (g a)', env());
const assess = (code: string) => checkExercise(processSource(code, env()), reference, 'compose');

describe('exercise task contracts', () => {
  it('rejects the reproduced same-name, wrong-type submission', () => {
    expect(assess('def compose : Nat := 0')).toContain('type');
  });
  it('accepts a different valid implementation', () => {
    expect(assess('def compose {X Y Z : Type} (f : Y → Z) (g : X → Y) : X → Z := fun x => f (g x)')).toBeNull();
  });
  it('rejects an added axiom even when the requested signature is correct', () => {
    expect(assess('axiom cheat : False\ndef compose {A B C : Type} (f : B → C) (g : A → B) (a : A) : C := False.elim cheat')).not.toBeNull();
  });
  it('infers required declarations when must was omitted', () => {
    expect(checkExercise(processSource('', env()), reference)).not.toBeNull();
  });
  it('does not accept an unfinished proof', () => {
    expect(assess('def compose {A B C : Type} (f : B → C) (g : A → B) (a : A) : C := sorry')).not.toBeNull();
  });
});

// Exercise reference answers must satisfy the same contracts as learner submissions.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import std from '@kernel/prelude/std.lean?raw';
import type { CalculusId } from '@kernel/core/calculus.ts';

function attr(tag: string, name: string) {
  const m = new RegExp(`\\b${name}=(?:"([^"]*)"|\\{\`${'([\\s\\S]*?)'}\`\\})`).exec(tag);
  return m?.[1] ?? m?.[2];
}
for (const course of ['cic', 'proofs-are-programs']) {
  const dir = resolve(__dirname, '../../', course, 'src/content/chapters');
  for (const file of readdirSync(dir).filter(f => f.endsWith('.mdx'))) {
    const src = readFileSync(resolve(dir, file), 'utf8');
    for (const match of src.matchAll(/<Exercise\b/g)) {
      let end = match.index! + match[0].length, depth = 0, quote = '';
      for (; end < src.length; end++) {
        const c = src[end];
        if (quote) { if (c === quote) quote = ''; continue; }
        if (c === '`' || (c === '"' && depth === 0)) quote = c;
        else if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
      }
      const tag = src.slice(match.index!, end);
      if (attr(tag, 'kind') === 'lambda') continue;
      const solution = attr(tag, 'solution');
      if (!solution) continue;
      it(`${course}/${file}: ${attr(tag, 'id')} accepts its reference answer`, () => {
        const calculus = (attr(tag, 'calculus') ?? 'cic') as CalculusId;
        const preludes = course === 'proofs-are-programs' ? [{ id: 'core', src: core }, { id: 'std', src: std }] : calculus === 'cic' || calculus === 'typeInType' ? [{ id: 'core', src: core }] : [];
        const base = makeEnv(calculus, preludes).env;
        let context = '';
        if (course === 'proofs-are-programs' && /\bchapter(?=\s|\/|$)/.test(tag.replace(/\{`[\s\S]*?`\}/g, '').replace(/"[^"]*"/g, ''))) {
          for (const block of src.slice(0, match.index).matchAll(/```lean([^\n]*)\n([\s\S]*?)```/g)) {
            if (!/\b(?:alone|errors|nocheck)\b/.test(block[1])) context += block[2] + '\n\n';
          }
        }
        const answer = processSource(context + (attr(tag, 'setup') ?? '') + '\n' + solution, base);
        expect(checkExercise(answer, answer, attr(tag, 'must'))).toBeNull();
      });
    }
  }
}
