import type { Annotations } from '../../../formal/FormalText';
import { OfficialDefinition } from '../../../workbench/recursion/annotations';

const S = {
  exp: [[2n, 5n], [3n, 3n]],
  pred: [[0n], [5n]],
  fac: [[4n], [5n]],
  tsub: [[7n, 3n], [3n, 7n]],
  dist: [[3n, 8n], [8n, 3n]],
  max: [[3n, 8n], [8n, 3n]],
};

export function useAnnotations(): Annotations {
  return {
    'cmp.rec.exa:proof:1': <OfficialDefinition name="exp" samples={S.exp} />,
    'cmp.rec.exa:proof:2': <OfficialDefinition name="pred" samples={S.pred} />,
    'cmp.rec.exa:proof:3': <OfficialDefinition name="fac" samples={S.fac} />,
    'cmp.rec.exa:proof:4': <OfficialDefinition name="tsub" samples={S.tsub} />,
    'cmp.rec.exa:proof:5': <OfficialDefinition name="dist" samples={S.dist} />,
    'cmp.rec.exa:proof:6': <OfficialDefinition name="max" samples={S.max} />,
  };
}
