/** Course exercise contracts. Kernel acceptance alone does not establish that the task was answered. */
import type { ProcessResult } from './frontend.ts';
import { TypeChecker } from './core/typechecker.ts';
import { instantiateLevelParamsExpr, forEachExpr } from './core/expr.ts';
import { lparam } from './core/level.ts';
import { Parser } from './syntax/parser.ts';
import type { Notation } from './core/env.ts';

/** Required names come from the task, never from an optional helper in its sample answer. */
export function exerciseNames(source: string, notations: Notation[] = []): string {
  const parser = new Parser(source, notations);
  const names: string[] = [];
  let cmd;
  while ((cmd = parser.nextCommand())) {
    if (cmd.k === 'def' && cmd.kind !== 'example') names.push(cmd.name);
    if (cmd.k === 'inductive') names.push(...cmd.types.map(t => t.name));
    if (cmd.k === 'structure') names.push(cmd.name);
  }
  return names.join(' ');
}

export function checkExercise(result: ProcessResult, reference: ProcessResult, required?: string, checkFrom = 0): string | null {
  if (reference.messages.some(m => m.severity === 'error')) return 'The exercise contract could not be loaded.';
  if (result.messages.some(m => m.severity === 'error')) return 'Resolve the errors before checking this answer.';
  if (result.messages.some(m => m.severity === 'warning' && m.msg.some(p => typeof p === 'string' && p.includes('sorry')))) return 'Replace every sorry with a proof.';
  const names = required?.split(/[\s,]+/).filter(Boolean) ?? [];
  if (!names.length) {
    for (const r of reference.results) if (r.output?.k === 'decl') names.push(...r.output.names);
  }
  if (!names.length) return 'This example has no assessed declarations.';
  // Never let an added axiom stand in for the requested proof.
  for (const d of result.env.all()) {
    if (d.kind === 'axiom' && (reference.env.get(d.name)?.kind !== 'axiom' || !new TypeChecker(reference.env).isDefEq(d.type, reference.env.get(d.name)!.type))) return `Remove the added axiom ${d.name}.`;
  }
  const tc = new TypeChecker(reference.env);
  for (const name of names) {
    const expected = reference.env.get(name), actual = result.env.get(name);
    if (!expected || !actual) return `Keep the declaration ${name}.`;
    if (actual.kind !== expected.kind || actual.levelParams.length !== expected.levelParams.length) return `Keep the requested declaration and type of ${name}.`;
    try {
      const actualType = instantiateLevelParamsExpr(actual.type, actual.levelParams, expected.levelParams.map(lparam));
      // A learner must not change a type alias or proposition used by the goal.
      let changedContext = false;
      const seen = new Set<string>();
      const inspect = (expr: typeof expected.type) => forEachExpr(expr, node => {
        if (node.k !== 'const' || seen.has(node.name) || names.includes(node.name)) return;
        seen.add(node.name);
        const before = reference.env.get(node.name), after = result.env.get(node.name);
        if (!before || before.builtin) return;
        if (!after || before.kind !== after.kind || !tc.isDefEq(before.type, after.type)) { changedContext = true; return; }
        if ('value' in before) {
          if (!('value' in after) || !tc.isDefEq(before.value, after.value)) changedContext = true;
          inspect(before.value);
        }
      });
      inspect(expected.type);
      if (changedContext) return `Keep the definitions used by the type of ${name}.`;
      if (!tc.isDefEq(actualType, expected.type)) return `Keep the requested type of ${name}.`;
    } catch { return `The type of ${name} does not match the task.`; }
  }
  // Re-check authored examples even if the learner removed or weakened them in the editor.
  // These are finite examples, not a claim of full functional equivalence.
  for (const entry of reference.results) {
    if (entry.span.from < checkFrom) continue;
    const out = entry.output;
    try {
      if (entry.cmd.k === 'def' && entry.cmd.kind === 'example' && out?.k === 'check') {
        new TypeChecker(result.env, out.lctx).check(out.expr, out.type);
      }
      if (out?.k === 'reduce' && !new TypeChecker(result.env, out.lctx).isDefEq(out.input, out.result)) {
        return 'The result does not match an example in the task.';
      }
    } catch { return 'An example assertion in the task does not hold for this implementation.'; }
  }
  return null;
}
