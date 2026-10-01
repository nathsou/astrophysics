/** The `reaction` exercises of the chapters agree with the library: every answer, law and force in the Markdown is what `checkReaction` computes. */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { checkReaction, parseReaction } from './index.ts';

const root = path.resolve(import.meta.dirname, '../../../../content/chapters');

describe('reaction exercises in the chapters', () => {
  for (const dir of existsSync(root) ? readdirSync(root) : []) {
    const f = path.join(root, dir, 'index.md');
    if (!existsSync(f)) continue;
    const src = readFileSync(f, 'utf8');
    const blocks = [...src.matchAll(/^```reaction\s*\n([\s\S]*?)^```\s*$/gm)].map((m) => YAML.parse(m[1]!) as { id: string; reactions: { text: string; answer: string; law?: string; force?: string }[] });
    for (const ex of blocks) {
      test(`${dir}: ${ex.id}`, () => {
        expect(ex.reactions.length).toBeGreaterThan(0);
        for (const r of ex.reactions) {
          const p = parseReaction(r.text);
          expect(p.errors, r.text).toEqual([]);
          const res = checkReaction(p.initial, p.final);
          const allowed = res.details.interaction !== 'forbidden';
          expect(allowed ? 'allowed' : 'forbidden', r.text).toBe(r.answer);
          if (r.law) {
            const broken = res.details.exactBroken.length ? res.details.exactBroken : res.details.flavourBroken;
            expect(broken, `${r.text}: law`).toContain(r.law);
          }
          if (r.force) expect(res.details.interaction, `${r.text}: force`).toBe(r.force);
        }
      });
    }
  }
});
