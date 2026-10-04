/**
 * Every Vouch exercise in the chapters is checked the way a reader's answer would be: the starter must not already
 * pass, and the reference solution must pass (locked lines intact, no forbidden words). For `spec` exercises, the
 * solution's contract must let the correct implementation verify and reject every adversary, and the starter must
 * let at least one adversary through. Slow (it runs the verifier on every exercise), but it is the only check that
 * the exercises in the text can actually be solved.
 */
import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { parse } from '$lib/fv/vouch/syntax/parser';
import { check } from '$lib/fv/vouch/check/checker';
import { verifyDocument, type DeclVerdicts } from '$lib/fv/verify/document';
import { forbidden, judge, lockedIntact, replaceBody, fnVerified, type Expectation } from '$lib/components/exercise/vouch/check';

const root = path.resolve(import.meta.dirname, '../../content/chapters');
const chapters = existsSync(root) ? readdirSync(root).filter((c) => existsSync(path.join(root, c, 'index.md'))) : [];

interface Ex {
  kind: string;
  id: string;
  starter?: string;
  solution?: string;
  locked?: [number, number][];
  forbid?: string[];
  expect?: Expectation[];
  fn?: string;
  adversaries?: { name: string; body: string }[];
  cases?: unknown[];
}

function exercises(md: string): Ex[] {
  const out: Ex[] = [];
  for (const m of md.matchAll(/^```(verify|invariant|spec)\n([\s\S]*?)^```$/gm)) out.push({ kind: m[1]!, ...(YAML.parse(m[2]!) as Omit<Ex, 'kind'>) });
  return out;
}

async function verdicts(text: string): Promise<{ errors: string[]; verdicts: DeclVerdicts[] }> {
  const p = parse(text);
  const c = check(p.program);
  const errors = [...p.diagnostics, ...c.diagnostics].filter((d) => d.severity === 'error').map((d) => d.message);
  if (errors.length) return { errors, verdicts: [] };
  return { errors, verdicts: await verifyDocument(c, { timeout: 20000 }) };
}

/**
 * The solution as a whole program. Solutions are written three ways: a whole program; a body (starting with `{`),
 * which replaces the last function body of the starter; or the text of the one unlocked region of the starter
 * (closing braces at its end stay).
 */
function solutionText(ex: Ex): string {
  const sol = ex.solution!.replace(/\n$/, '');
  const starter = ex.starter!.replace(/\n$/, '');
  if (!lockedIntact(starter, sol, ex.locked ?? []).length && !sol.trimStart().startsWith('{')) return sol;
  if (!sol.trimStart().startsWith('{')) {
    const lines = starter.split('\n');
    const locked = new Set<number>();
    for (const [a, b] of ex.locked ?? []) for (let i = a; i <= b; i++) locked.add(i);
    // A short solution edits lines: each of its lines replaces the unlocked starter line that begins with the same
    // two words, or, if there is none, is added at the end of the unlocked region (before its closing braces).
    const solLines = sol.split('\n');
    if (solLines.length <= 3) {
      const key = (l: string) => l.trim().split(/[\s(:{]+/).slice(0, 2).join(' ');
      const out = [...lines];
      const added: string[] = [];
      for (const l of solLines) {
        const i = out.findIndex((x, k) => !locked.has(k + 1) && key(x) === key(l) && key(l).includes(' '));
        if (i >= 0) out[i] = out[i]!.match(/^\s*/)![0] + l.trim();
        else added.push(l);
      }
      if (added.length) {
        let at = out.length;
        while (at > 0 && /^\s*\}?\s*$/.test(out[at - 1]!)) at--;
        out.splice(at, 0, ...added.map((l) => '  ' + l.trim()));
      }
      return out.join('\n');
    }
    const free = lines.map((_, i) => i + 1).filter((n) => !locked.has(n));
    if (!free.length) return sol;
    let lo = free[0]!;
    let hi = free[free.length - 1]!;
    if (free.length !== hi - lo + 1) throw new Error(`${ex.id}: several unlocked regions; write the solution as a whole program`);
    // Keep as many closing braces at the end of the region as the solution does not close itself.
    const balance = (t: string) => (t.match(/\{/g)?.length ?? 0) - (t.match(/\}/g)?.length ?? 0);
    let keep = balance(sol) - balance(lines.slice(lo - 1, hi).join('\n'));
    while (keep > 0 && hi >= lo && /^\s*\}\s*$/.test(lines[hi - 1]!)) {
      hi--;
      keep--;
    }
    while (hi >= lo && /^\s*$/.test(lines[hi - 1]!)) hi--;
    while (lo <= hi && /^\s*$/.test(lines[lo - 1]!)) lo++;
    return [...lines.slice(0, lo - 1), sol, ...lines.slice(hi)].join('\n');
  }
  const fns = parse(starter).program.decls.filter((d) => d.k === 'fn' && d.body);
  const last = fns[fns.length - 1];
  if (!last || last.k !== 'fn') throw new Error(`${ex.id}: no function body to replace`);
  return replaceBody(starter, last.name, sol)!;
}

describe('exercises can be solved', () => {
  for (const ch of chapters) {
    const list = exercises(readFileSync(path.join(root, ch, 'index.md'), 'utf8'));
    for (const ex of list) {
      if (!ex.starter || !ex.solution || ex.cases) continue;
      test(`${ex.id}`, async () => {
        const starter = ex.starter!.replace(/\n$/, '');
        const solution = solutionText(ex);
        if (ex.kind === 'spec') {
          const ref = await verdicts(solution);
          expect(ref.errors).toEqual([]);
          expect(fnVerified(ref.verdicts, ex.fn!), 'the reference implementation verifies against the solution contract').toBe(true);
          let leaks = 0;
          for (const a of ex.adversaries ?? []) {
            const bad = await verdicts(replaceBody(solution, ex.fn!, a.body)!);
            expect([a.name, fnVerified(bad.verdicts, ex.fn!)]).toEqual([a.name, false]);
            const weak = await verdicts(replaceBody(starter, ex.fn!, a.body)!);
            if (fnVerified(weak.verdicts, ex.fn!)) leaks++;
          }
          expect(leaks, 'the starter contract lets some adversary through').toBeGreaterThan(0);
          return;
        }
        expect(lockedIntact(starter, solution, ex.locked ?? [])).toEqual([]);
        expect(forbidden(solution, ex.forbid ?? ['assume'])).toEqual([]);
        const s = await verdicts(starter);
        if (!s.errors.length) expect(judge(s.verdicts, ex.expect).ok, 'the starter already passes').toBe(false);
        const r = await verdicts(solution);
        expect(r.errors).toEqual([]);
        const j = judge(r.verdicts, ex.expect);
        expect(j.unmet.map((u) => u.reason)).toEqual([]);
      }, 120000);
    }
  }
});
