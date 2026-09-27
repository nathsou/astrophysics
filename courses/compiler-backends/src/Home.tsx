import { CHAPTERS, PARTS } from './content/course';

const STRIP: [string, string, string][] = [
  ['Source', 'Kiln', 'ir'],
  ['IR', 'KIR', 'ir'],
  ['CFG', 'blocks', 'cfg'],
  ['SSA', 'mem2reg', 'ssa'],
  ['ISel', 'tiling', 'isel'],
  ['Legalize', 'imm, ops', 'legalization'],
  ['ABI', 'calls', 'abi'],
  ['Out of SSA', 'copies', 'ssa-destruction'],
  ['Liveness', 'dataflow', 'liveness'],
  ['RegAlloc', 'colouring', 'regalloc'],
  ['Frames', 'prologue', 'frames'],
  ['Schedule', 'list', 'scheduling'],
  ['Peephole', 'cleanup', 'peephole'],
  ['Encode', 'bytes', 'encoding'],
  ['Object', 'ELF + relocs', 'objects'],
  ['Link & run', 'emulator', 'linking'],
];

export function Home() {
  return (
    <div className="home">
      <div className="kicker sans" style={{ color: 'var(--accent)', fontWeight: 650, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 12.5, marginBottom: 10 }}>An interactive course on compiler backends</div>
      <h1>SSA to Silicon</h1>
      <p className="lede">
        Build a real compiler backend, one stage at a time — from a small SSA-based IR to executable RISC-V machine code, with AArch64, x86-64 and WebAssembly alongside. Every data structure is live: hover, step, edit, and watch your own programs flow down to the bytes.
      </p>
      <div className="cta">
        <a className="go" href="#/ch/intro">Start with chapter 0 →</a>
        <a className="alt" href="#/playground">Open the playground</a>
      </div>
      <div className="pipeline-strip">
        {STRIP.map(([a, b, slug], i) => (
          <span key={a} style={{ display: 'contents' }}>
            {i > 0 && <span className="arr">→</span>}
            <a href={`#/ch/${slug}`}>{a}<small>{b}</small></a>
          </span>
        ))}
      </div>
      <div className="feature-grid">
        <div className="feature"><b>A real backend, not a sketch</b>SSA construction, BURS instruction selection, iterated register coalescing, linear scan, list scheduling, ELF objects, a linker — all running in your browser.</div>
        <div className="feature"><b>Validated against real toolchains</b>RISC-V output is byte-identical to GNU as; AArch64 and x86-64 encodings match LLVM; executables are differentially tested against a reference interpreter.</div>
        <div className="feature"><b>Everything is hoverable</b>Instructions explain what they do and why the compiler put them there. Registers, operands, blocks and terms all explain themselves.</div>
        <div className="feature"><b>Step through the algorithms</b>Dominators, phi placement, liveness fixpoints, graph colouring, linear scan, tiling, scheduling, relocation — one step at a time.</div>
      </div>
      <div className="part-grid">
        {PARTS.map((p) => (
          <div className="part-card" key={p}>
            <h3>{p}</h3>
            {CHAPTERS.filter((c) => c.part === p).map((c) => (
              <a key={c.slug} href={`#/ch/${c.slug}`}><span className="num">{c.num}</span><span>{c.title}</span></a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
