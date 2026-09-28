import { useMemo } from 'react';
import type { Annotations } from '../../../formal/FormalText';
import { Added, Prov } from '../../../ui/Prov';
import { Tex } from '../../../ui/Tex';
import { useStore } from '../../../ui/store';
import { computationRecord, describeCodeSize, encodeRecord, recordCodeSize, T } from '../../../engine/computability/records';
import { indexStore, inputStore, parseNat, Big } from '../../../workbench/computability/shared';

export function useAnnotations(): Annotations {
  const eText = useStore(indexStore);
  const xText = useStore(inputStore);
  return useMemo(() => {
    const e = parseNat(eText);
    const x = parseNat(xText, 4);
    if (e === null || x === null) return {};
    const r = computationRecord(e, x, 5000);
    const eShow = eText.length > 12 ? 'e' : eText;
    let body;
    if (r.kind === 'halted') {
      const s = encodeRecord(r.root, 14);
      const holds = s !== null ? T(e, x, s).holds : null;
      body = (
        <p>
          The record of <Tex tex={`\\varphi_{${eShow}}(${x})`} /> has {r.nodes} call{r.nodes === 1 ? '' : 's'}; its code is{' '}
          {s !== null ? (
            <>
              s = <Big n={s} max={24} />, <Tex tex={`T(${eShow}, ${x}, s)`} /> {holds ? 'holds' : 'fails'}
            </>
          ) : (
            <>a number with {describeCodeSize(recordCodeSize(r.root)).text}</>
          )}
          , and <Tex tex={`U(s) = ${r.root.value}`} />.
        </p>
      );
    } else if (r.kind === 'notAFunction') {
      body = <p>This index is not a one-place definition: no s satisfies <Tex tex="T(e, x, s)" />, and the search never ends.</p>;
    } else {
      body = <p>No record within 5000 calls: the search for s has not succeeded yet, and may never.</p>;
    }
    return {
      'cmp:thy:nfm:thm:normal-form': (
        <Added label="Computed, in this edition’s coding">
          <div className="ann-title sans">
            <b>T and U for the chapter’s current index and input</b> <Prov kind="computed" />
          </div>
          {body}
          <p className="sans small muted">The coding of definitions and records is this edition’s, one of the many for which the theorem holds. Change e and x in Explore mode.</p>
        </Added>
      ),
    };
  }, [eText, xText]);
}
