import type { Annotations } from '../../../formal/FormalText';
import * as Lib from '../../../engine/computability/library';
import { WhyPrimitiveRecursive } from '../../../workbench/recursion/annotations';

const add = Lib.add();

export function useAnnotations(): Annotations {
  return {
    'cmp.rec.prf:proof:1': <WhyPrimitiveRecursive f={add} title="The proof as a tree of clauses" />,
  };
}
