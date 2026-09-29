// `omega`: linear arithmetic over the natural numbers.
import type { Span } from '../syntax/ast.ts';
import type { TacticRunner } from './tactics.ts';

export function omegaTactic(runner: TacticRunner, g: number, span: Span): void {
  void g;
  runner.fail(span, 'omega: not implemented yet');
}
