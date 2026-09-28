// Other recursions (section "Other Recursions"): course-of-values recursion and simultaneous
// recursion, each carried out as an ordinary primitive recursion on a sequence code.

import { useMemo, useState } from 'react';
import { COV_PRESETS, runCourseOfValues, runSimultaneous, SIM_PRESETS } from '../../engine/computability/recursions';
import { nthPrime } from '../../engine/numbers/primes';
import { Panel } from '../coding';
import { Stepper } from '../../ui/Stepper';
import { Tex } from '../../ui/Tex';
import { NotAProof, Prov } from '../../ui/Prov';
import { fmtBig, useRemembered } from './common';

export function CourseOfValuesLab() {
  const [st, setSt] = useRemembered('cov', { kind: 'cov' as 'cov' | 'sim', cov: 'fib', sim: 'parity' });
  return (
    <div className="workbench">
      <div className="seg" role="group" aria-label="Kind of recursion">
        <button className="chip-btn" aria-pressed={st.kind === 'cov'} onClick={() => setSt({ ...st, kind: 'cov' })}>
          course-of-values recursion
        </button>
        <button className="chip-btn" aria-pressed={st.kind === 'sim'} onClick={() => setSt({ ...st, kind: 'sim' })}>
          simultaneous recursion
        </button>
      </div>
      {st.kind === 'cov' ? <Cov id={st.cov} onId={(cov) => setSt({ ...st, cov })} /> : <Sim id={st.sim} onId={(sim) => setSt({ ...st, sim })} />}
    </div>
  );
}

function Cov({ id, onId }: { id: string; onId: (s: string) => void }) {
  const p = COV_PRESETS.find((x) => x.id === id) ?? COV_PRESETS[0];
  const rows = useMemo(() => runCourseOfValues(p, p.maxY), [p]);
  const [step, setStep] = useState(3);
  const s = Math.min(step, rows.length - 1);
  const r = rows[s];
  const vals = rows.slice(0, s).map((x) => x.value);
  return (
    <>
      <Panel n={1} title={<>A course-of-values recursion <Tex tex="h(y) = g(y, \langle h(0), \ldots, h(y-1)\rangle)" /></>} prov={<Prov kind="computed" />}>
        <div className="rc-presets" role="group" aria-label="Examples">
          {COV_PRESETS.map((q) => (
            <button key={q.id} className="chip-btn" aria-pressed={q.id === p.id} onClick={() => onId(q.id)}>
              {q.name}
            </button>
          ))}
        </div>
        <div className="rc-eqs">
          <Tex tex={p.tex} />
        </div>
        <p className="wb-note">
          The trick: recurse not on <Tex tex="h" /> but on the code of its history, <Tex tex="H(y) = \langle h(0), \ldots, h(y-1)\rangle" />. Then{' '}
          <Tex tex="H(0) = 0" /> and <Tex tex="H(y+1) = \mathrm{append}(H(y), g(y, H(y)))" /> — an ordinary primitive recursion, which only ever uses the previous value{' '}
          <Tex tex="H(y)" />. Finally <Tex tex="h(y) = (H(y+1))_y" />. The step <Tex tex="g" /> reads earlier values out of the code with <Tex tex="(s)_i" />.
        </p>
      </Panel>
      <Panel n={2} title={<>Step <Tex tex={`y = ${r.y}`} /></>} prov={<Prov kind="computed" />}>
        <Stepper step={s} count={rows.length} onStep={setStep} label="y" describe={() => <><Tex tex={`h(${r.y}) = ${r.value}`} />, reading {r.reads.length ? <Tex tex={r.reads.map((rd) => `(s)_{${rd.i}} = ${rd.value}`).join(',\\ ')} /> : 'nothing'} from the code of the history</>} />
        <div className="rc-flow">
          <div className="rc-flow-row">
            <span className="rc-kicker">history</span>
            <Tex tex={`s = H(${r.y}) = \\langle ${vals.join(', ')} \\rangle ${r.history === 0n ? '= 0' : `= ${vals.map((v, i) => `${nthPrime(i)}^{${v + 1n}}`).join(' \\cdot ')}`}`} />
          </div>
          <div className="rc-flow-row">
            <span className="rc-kicker">as a number</span>
            <span className="rc-mono">{fmtBig(r.history, 50)}</span>
          </div>
          <div className="rc-flow-row">
            <span className="rc-kicker">g reads</span>
            {r.reads.length === 0 ? <span className="muted small">nothing</span> : r.reads.map((rd) => <Tex key={rd.i} tex={`(s)_{${rd.i}} = ${rd.value}`} />)}
          </div>
          <div className="rc-flow-row out">
            <span className="rc-kicker">value</span>
            <Tex tex={`h(${r.y}) = g(${r.y}, s) = ${r.value}`} />
          </div>
          <div className="rc-flow-row">
            <span className="rc-kicker">next</span>
            <Tex tex={`H(${r.y + 1n}) = \\mathrm{append}(s, ${r.value}) = s \\cdot ${nthPrime(Number(r.y))}^{${r.value + 1n}}`} />
            <span className="rc-hint">{r.next.toString().length} digits</span>
          </div>
        </div>
        <div className="rc-scroll" style={{ marginTop: 10 }}>
          <table className="rc-table rc-grid">
            <tbody>
              <tr>
                <th scope="row">y</th>
                {rows.map((x) => (
                  <td key={String(x.y)} className={x.y === r.y ? 'one' : ''}>
                    {x.y.toString()}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">h(y)</th>
                {rows.map((x, i) => (
                  <td key={String(x.y)}>{i <= s ? x.value.toString() : ''}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <NotAProof>The values are computed; that every course-of-values recursion can be turned into a primitive recursion is the general construction described above.</NotAProof>
      </Panel>
    </>
  );
}

function Sim({ id, onId }: { id: string; onId: (s: string) => void }) {
  const p = SIM_PRESETS.find((x) => x.id === id) ?? SIM_PRESETS[0];
  const rows = useMemo(() => runSimultaneous(p, p.maxY), [p]);
  const [step, setStep] = useState(3);
  const s = Math.min(step, rows.length - 1);
  return (
    <>
      <Panel n={1} title="A simultaneous recursion" prov={<Prov kind="computed" />}>
        <div className="rc-presets" role="group" aria-label="Examples">
          {SIM_PRESETS.map((q) => (
            <button key={q.id} className="chip-btn" aria-pressed={q.id === p.id} onClick={() => onId(q.id)}>
              {q.name}
            </button>
          ))}
        </div>
        <div className="rc-eqs">
          <Tex display tex={p.tex} />
        </div>
        <p className="wb-note">
          Recurse on the pair instead: <Tex tex="P(y) = \langle h_0(y), h_1(y)\rangle" />. Then <Tex tex={`P(0) = \\langle ${p.f[0]}, ${p.f[1]}\\rangle`} /> and{' '}
          <Tex tex="P(y+1) = \langle g_0(y, (P(y))_0, (P(y))_1),\ g_1(y, (P(y))_0, (P(y))_1)\rangle" /> is one ordinary primitive recursion; <Tex tex="h_i(y) = (P(y))_i" />.
        </p>
      </Panel>
      <Panel n={2} title="The pair codes" prov={<Prov kind="computed" />}>
        <Stepper step={s} count={rows.length} onStep={setStep} label="y" describe={(i) => <Tex tex={`P(${rows[i].y}) = \\langle ${rows[i].h0}, ${rows[i].h1} \\rangle = 2^{${rows[i].h0 + 1n}} \\cdot 3^{${rows[i].h1 + 1n}} = ${fmtBig(rows[i].code, 30)}`} />} />
        <div className="rc-scroll">
          <table className="rc-table">
            <thead>
              <tr>
                <th scope="col" className="num">y</th>
                <th scope="col" className="num"><Tex tex="h_0(y)" /></th>
                <th scope="col" className="num"><Tex tex="h_1(y)" /></th>
                <th scope="col" className="num"><Tex tex="P(y)" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={String(r.y)} className={i === s ? 'current' : i > s ? 'future' : ''}>
                  <td className="num">{r.y.toString()}</td>
                  <td className="num">{i <= s ? r.h0.toString() : ''}</td>
                  <td className="num">{i <= s ? r.h1.toString() : ''}</td>
                  <td className="num">{i <= s ? fmtBig(r.code, 20) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
