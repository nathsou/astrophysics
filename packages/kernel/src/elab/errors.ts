import type { Msg } from '../core/typechecker.ts';
import type { Span } from '../syntax/ast.ts';

export class ElabError extends Error {
  constructor(
    readonly msg: Msg,
    readonly span: Span,
  ) {
    super(msg.map((p) => (typeof p === 'string' ? p : '‹term›')).join(''));
  }
}

/** thrown when an unknown single-letter identifier appears in a header */
export class AutoBound extends Error {
  constructor(readonly name: string) {
    super(`auto-bound ${name}`);
  }
}
