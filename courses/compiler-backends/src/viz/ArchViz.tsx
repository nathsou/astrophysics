// Appendix widgets: a classic 5-stage pipeline diagram, glossary and bibliography.

import { useMemo, useState, type ReactNode } from 'react';
import { parseRVAsm, expandRV } from '../compiler/emit/rv64asm';
import { Figure } from '../ui/prose';
import { Check } from '../ui/controls';
import { GLOSSARY } from '../content/glossary';
import { CHAPTERS } from '../content/course';

const PRESET = `ld   a0, 0(a1)
add  a0, a0, a2
addi a3, a3, 1
sd   a0, 8(a1)
beq  a3, a4, 16
addi a5, a5, 1`;

interface PInstr { text: string; rd: number; rs: number[]; load: boolean; branch: boolean }

function parse(src: string): PInstr[] | string {
  try {
    const out: PInstr[] = [];
    for (const it of parseRVAsm(src)) {
      if (it.k !== 'instr') continue;
      const i = it.ins;
      // branches with numeric offsets: treat specially
      if (['beq', 'bne', 'blt', 'bge'].includes(i.op)) {
        const regs = i.ops.filter((o) => o.k === 'reg').map((o) => (o as { r: number }).r);
        out.push({ text: `${i.op} ${regs.map((r) => `x${r}`).join(', ')}`, rd: 0, rs: regs, load: false, branch: true });
        continue;
      }
      for (const r of expandRV(i, () => 'L')) {
        const isStore = ['sd', 'sw', 'sb'].includes(r.op);
        out.push({ text: r.text, rd: isStore ? 0 : r.rd, rs: [r.rs1, ...(r.rs2 || isStore ? [r.rs2] : [])].filter((x) => x !== 0), load: ['ld', 'lw', 'lb', 'lbu'].includes(r.op), branch: false });
      }
    }
    return out;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Classic IF ID EX MEM WB pipeline; returns the cycle each instruction enters each stage. */
function simulate(prog: PInstr[], forwarding: boolean, predictTaken: boolean) {
  const rows: { stages: (string | null)[]; stall: number }[] = [];
  let ifCycle = 0;
  const wbCycle: number[] = [];
  const exCycle: number[] = [];
  const memCycle: number[] = [];
  prog.forEach((p, k) => {
    let id = ifCycle + 1;
    // earliest EX: operands ready
    let ex = id + 1;
    for (const r of p.rs) {
      for (let j = k - 1; j >= 0; j--) {
        if (prog[j].rd !== r) continue;
        if (forwarding) ex = Math.max(ex, prog[j].load ? memCycle[j] + 1 : exCycle[j] + 1);
        else ex = Math.max(ex, wbCycle[j] + 1); // read in ID after WB half-cycle: needs ID >= WB
        break;
      }
    }
    if (!forwarding) ex = Math.max(ex, id + 1);
    const stall = ex - (id + 1);
    id = ex - 1;
    const mem = ex + 1, wb = ex + 2;
    exCycle.push(ex); memCycle.push(mem); wbCycle.push(wb);
    const stages: (string | null)[] = [];
    stages[ifCycle] = 'IF';
    for (let c = ifCycle + 1; c < id; c++) stages[c] = 'stall';
    stages[id] = 'ID'; stages[ex] = 'EX'; stages[mem] = 'MEM'; stages[wb] = 'WB';
    rows.push({ stages, stall });
    // next instruction fetches after this one leaves IF (stalls hold the front end)
    ifCycle = id;
    if (p.branch && !predictTaken) ifCycle = ex; // resolve branch in EX: 2 bubbles on a taken branch
  });
  return rows;
}

const STAGE_COLOR: Record<string, string> = { IF: 'var(--blue)', ID: 'var(--teal)', EX: 'var(--accent)', MEM: 'var(--violet)', WB: 'var(--green)', stall: 'var(--red)' };

export function PipelineSim({ caption }: { caption?: ReactNode }) {
  const [src, setSrc] = useState(PRESET);
  const [fwd, setFwd] = useState(true);
  const [pred, setPred] = useState(true);
  const prog = useMemo(() => parse(src), [src]);
  const rows = useMemo(() => (typeof prog === 'string' ? [] : simulate(prog, fwd, pred)), [prog, fwd, pred]);
  const cycles = Math.max(0, ...rows.map((r) => r.stages.length));
  return (
    <Figure title="A 5-stage pipeline, cycle by cycle" caption={caption} controls={<><Check checked={fwd} onChange={setFwd}>forwarding</Check><Check checked={pred} onChange={setPred}>perfect branch prediction</Check></>}>
      <div className="panes" style={{ gridTemplateColumns: 'minmax(220px, 0.6fr) 1.4fr' }}>
        <div className="pane">
          <textarea value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} className="code inv" style={{ border: 'none', resize: 'vertical', padding: 12, minHeight: 200, width: '100%' }} />
        </div>
        <div className="pane" style={{ overflow: 'auto' }}>
          {typeof prog === 'string' ? <div className="error-box">{prog}</div> : (
            <table className="dtable" style={{ width: 'auto' }}>
              <thead><tr><th>instruction</th>{Array.from({ length: cycles }, (_, c) => <th key={c} style={{ textAlign: 'center' }}>{c + 1}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, k) => (
                  <tr key={k}>
                    <td style={{ whiteSpace: 'nowrap' }}>{(prog as PInstr[])[k].text}{r.stall ? <span className="pill red" style={{ marginLeft: 6 }}>+{r.stall}</span> : null}</td>
                    {Array.from({ length: cycles }, (_, c) => {
                      const s = r.stages[c];
                      return <td key={c} style={{ textAlign: 'center', padding: '3px 4px', fontSize: 10.5, fontFamily: 'var(--sans)', fontWeight: 650, color: s ? 'white' : undefined, background: s ? STAGE_COLOR[s] : undefined, opacity: s === 'stall' ? 0.55 : 1 }}>{s === 'stall' ? '·' : s ?? ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="stat-row"><span>total: <b>{cycles}</b> cycles for <b>{rows.length}</b> instructions</span><span>stalls: <b>{rows.reduce((s, r) => s + r.stall, 0)}</b></span><span>edit the program on the left (RISC-V syntax)</span></div>
    </Figure>
  );
}

export function Glossary() {
  const entries = Object.entries(GLOSSARY).sort((a, b) => a[1].term.localeCompare(b[1].term));
  return (
    <dl style={{ margin: '10px 0 30px' }}>
      {entries.map(([k, g]) => {
        const ch = CHAPTERS.find((c) => c.slug === g.see);
        return (
          <div key={k} id={`g-${k}`} style={{ marginBottom: 14 }}>
            <dt style={{ fontWeight: 650 }}>{g.term}</dt>
            <dd style={{ margin: '2px 0 0 0', color: 'var(--ink-2)' }}>{g.def}{ch && <> <a href={`#/ch/${ch.slug}`} className="sans" style={{ fontSize: 13 }}>→ {ch.num}. {ch.short ?? ch.title}</a></>}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export const BIB: [string, string][] = [
  ['Aho, Ganapathi, Tjiang 1989', 'Code generation using tree matching and dynamic programming. ACM TOPLAS 11(4).'],
  ['Aho, Johnson 1976', 'Optimal code generation for expression trees. Journal of the ACM 23(3).'],
  ['Aho, Sethi, Ullman 1986', 'Compilers: Principles, Techniques, and Tools (the Dragon Book). Addison-Wesley.'],
  ['Allen 1970', 'Control flow analysis. SIGPLAN Notices 5(7).'],
  ['Appel 1998', 'Modern Compiler Implementation in ML / Java / C. Cambridge University Press.'],
  ['Belady 1966', 'A study of replacement algorithms for a virtual-storage computer. IBM Systems Journal 5(2).'],
  ['Boissinot et al. 2009', 'Revisiting out-of-SSA translation for correctness, code quality and efficiency. CGO.'],
  ['Braun et al. 2013', 'Simple and efficient construction of static single assignment form. Compiler Construction (CC).'],
  ['Briggs, Cooper, Harvey, Simpson 1998', 'Practical improvements to the construction and destruction of static single assignment form. Software: Practice and Experience 28(8).'],
  ['Briggs, Cooper, Torczon 1992', 'Rematerialization. PLDI.'],
  ['Briggs, Cooper, Torczon 1994', 'Improvements to graph coloring register allocation. ACM TOPLAS 16(3).'],
  ['Cattell 1980', 'Automatic derivation of code generators from machine descriptions. ACM TOPLAS 2(2).'],
  ['Chaitin et al. 1981', 'Register allocation via coloring. Computer Languages 6(1).'],
  ['Chaitin 1982', 'Register allocation & spilling via graph coloring. SIGPLAN Symposium on Compiler Construction.'],
  ['Cooper, Harvey, Kennedy 2001', 'A simple, fast dominance algorithm. Rice University technical report; Software Practice and Experience.'],
  ['Cooper, Torczon 2022', 'Engineering a Compiler, 3rd edition. Morgan Kaufmann.'],
  ['Cytron et al. 1991', 'Efficiently computing static single assignment form and the control dependence graph. ACM TOPLAS 13(4).'],
  ['Davidson, Fraser 1980', 'The design and application of a retargetable peephole optimizer. ACM TOPLAS 2(2).'],
  ['Fisher 1981', 'Trace scheduling: a technique for global microcode compaction. IEEE Transactions on Computers C-30(7).'],
  ['Fraser, Hanson, Proebsting 1992', 'Engineering a simple, efficient code-generator generator (iburg). ACM LOPLAS 1(3).'],
  ['Fraser, Henry, Proebsting 1992', 'BURG — fast optimal instruction selection and tree parsing. SIGPLAN Notices 27(4).'],
  ['George, Appel 1996', 'Iterated register coalescing. ACM TOPLAS 18(3).'],
  ['Gibbons, Muchnick 1986', 'Efficient instruction scheduling for a pipelined architecture. SIGPLAN Symposium on Compiler Construction.'],
  ['Glanville, Graham 1978', 'A new method for compiler code generation. POPL.'],
  ['Hack, Grund, Goos 2006', 'Register allocation for programs in SSA-form. Compiler Construction (CC).'],
  ['Hecht, Ullman 1972', 'Flow graph reducibility. SIAM Journal on Computing 1(2).'],
  ['Hwu et al. 1993', 'The superblock: an effective technique for VLIW and superscalar compilation. Journal of Supercomputing 7.'],
  ['Kam, Ullman 1977', 'Monotone data flow analysis frameworks. Acta Informatica 7.'],
  ['Kildall 1973', 'A unified approach to global program optimization. POPL.'],
  ['Lam 1988', 'Software pipelining: an effective scheduling technique for VLIW machines. PLDI.'],
  ['Lattner, Adve 2004', 'LLVM: a compilation framework for lifelong program analysis & transformation. CGO.'],
  ['Lengauer, Tarjan 1979', 'A fast algorithm for finding dominators in a flowgraph. ACM TOPLAS 1(1).'],
  ['Levine 2000', 'Linkers and Loaders. Morgan Kaufmann.'],
  ['Massalin 1987', 'Superoptimizer: a look at the smallest program. ASPLOS.'],
  ['McKeeman 1965', 'Peephole optimization. Communications of the ACM 8(7).'],
  ['Patterson, Ditzel 1980', 'The case for the reduced instruction set computer. SIGARCH Computer Architecture News 8(6).'],
  ['Poletto, Sarkar 1999', 'Linear scan register allocation. ACM TOPLAS 21(5).'],
  ['Ramsey 2022', 'Beyond Relooper: recursive translation of unstructured control flow to structured control flow. ICFP.'],
  ['Rastello, Bouchez Tichadou (eds.) 2022', 'SSA-based Compiler Design. Springer.'],
  ['Rau 1994', 'Iterative modulo scheduling: an algorithm for software pipelining loops. MICRO.'],
  ['Schkufza, Sharma, Aiken 2013', 'Stochastic superoptimization (STOKE). ASPLOS.'],
  ['Sethi, Ullman 1970', 'The generation of optimal code for arithmetic expressions. Journal of the ACM 17(4).'],
  ['Sreedhar et al. 1999', 'Translating out of static single assignment form. Static Analysis Symposium (SAS).'],
  ['Szymanski 1978', 'Assembling code for machines with span-dependent instructions. Communications of the ACM 21(4).'],
  ['Tomasulo 1967', 'An efficient algorithm for exploiting multiple arithmetic units. IBM Journal of Research and Development 11(1).'],
  ['Traub, Holloway, Smith 1998', 'Quality and speed in linear-scan register allocation. PLDI.'],
  ['Wimmer, Mössenböck 2005', 'Optimized interval splitting in a linear scan register allocator. VEE.'],
  ['Wimmer, Franz 2010', 'Linear scan register allocation on SSA form. CGO.'],
  ['Zakai 2011', 'Emscripten: an LLVM-to-JavaScript compiler (the Relooper). OOPSLA companion.'],
];

export function Bibliography() {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {BIB.map(([k, v]) => (
        <li key={k} style={{ marginBottom: 8 }}><b>{k}.</b> <span style={{ color: 'var(--ink-2)' }}>{v}</span></li>
      ))}
    </ul>
  );
}
