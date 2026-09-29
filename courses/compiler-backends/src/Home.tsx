import { CHAPTERS, PARTS, kindOf } from './content/course';
import { ThemeToggle } from './ui/ThemeToggle';

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

const pin = (num: string) => (/^\d+$/.test(num) ? num.padStart(2, '0') : num);

export function Home() {
  const chapters = CHAPTERS.filter((c) => c.part !== 'Appendices').length;
  const appendices = CHAPTERS.length - chapters;
  return (
    <div className="home">
      <div className="ds-top">
        <a className="chip-btn" href="#/playground">▶ Playground</a>
        <ThemeToggle />
      </div>
      <header className="ds-head">
        <div>
          <div className="ds-kicker">Datasheet · Rev 1.0 · Compiler backends</div>
          <h1>SSA to Silicon</h1>
        </div>
        <div className="ds-logo" aria-hidden="true" />
      </header>
      <div className="ds-intro">
        <div>
          <p className="lede">
            Build a real compiler backend, one stage at a time — from a small SSA-based IR to executable RISC-V machine code, with AArch64, x86-64 and WebAssembly alongside. Every data structure is live: hover, step, edit, and watch your own programs flow down to the bytes.
          </p>
          <div className="cta">
            <a className="go" href="#/ch/intro">Start with chapter 0 →</a>
            <a className="alt" href="#/playground">Open the playground</a>
          </div>
        </div>
        <div className="ds-box">
          <div className="hd">FEATURES</div>
          <div className="bd">
            {chapters} chapters · {appendices} appendices<br />
            30+ interactive widgets<br />
            Targets: RISC-V · AArch64 · x86-64 · Wasm<br />
            Runs in your browser
          </div>
        </div>
      </div>

      <div className="ds-sec">Block diagram <small>the whole pipeline, source to executable</small></div>
      <div className="pipeline-strip">
        {STRIP.map(([a, b, slug], i) => (
          <span key={a} style={{ display: 'contents' }}>
            {i > 0 && <span className="arr" aria-hidden="true">→</span>}
            <a href={`#/ch/${slug}`}>{a}<small>{b}</small></a>
          </span>
        ))}
      </div>

      <div className="ds-sec">Description</div>
      <div className="feature-grid">
        <div className="feature"><b>A real backend, not a sketch</b><span>SSA construction, BURS instruction selection, iterated register coalescing, linear scan, list scheduling, ELF objects, a linker — all running in your browser.</span></div>
        <div className="feature"><b>Validated against real toolchains</b><span>RISC-V output is byte-identical to GNU as; AArch64 and x86-64 encodings match LLVM; executables are differentially tested against a reference interpreter.</span></div>
        <div className="feature"><b>Everything is hoverable</b><span>Instructions explain what they do and why the compiler put them there. Registers, operands, blocks and terms all explain themselves.</span></div>
        <div className="feature"><b>Step through the algorithms</b><span>Dominators, phi placement, liveness fixpoints, graph colouring, linear scan, tiling, scheduling, relocation — one step at a time.</span></div>
      </div>

      <div className="ds-sec">Pin configuration <small>chapters in reading order</small></div>
      <nav className="pins" aria-label="Chapters">
        <div className="pins-h" aria-hidden="true"><span>PIN</span><span>CHAPTER</span><span className="s">STAGE</span><span className="k">TYPE</span></div>
        {PARTS.map((p) => {
          const cs = CHAPTERS.filter((c) => c.part === p);
          return (
            <div key={p} role="group" aria-label={p}>
              <div className="pin-part">{p} <small>{cs.length} {cs.length === 1 ? 'page' : 'pages'}</small></div>
              {cs.map((c) => (
                <a key={c.slug} className="pin-row" href={`#/ch/${c.slug}`}>
                  <span className="pin">{pin(c.num)}</span>
                  <span className="t">{c.title}</span>
                  <span className="s">{c.stage}</span>
                  <span className="k">{kindOf(c)}</span>
                </a>
              ))}
            </div>
          );
        })}
      </nav>
      <footer className="ds-foot"><span>SSA to Silicon · Rev 1.0</span><span>kiln · a compiler backend in TypeScript</span></footer>
    </div>
  );
}
