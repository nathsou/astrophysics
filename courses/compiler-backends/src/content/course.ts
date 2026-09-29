import type { ComponentType } from 'react';

export interface ChapterMeta {
  slug: string;
  num: string;
  title: string;
  short?: string;
  part: string;
  /** pipeline stage this chapter belongs to (the STAGE column on the home page) */
  stage: string;
  load: () => Promise<{ default: ComponentType<any> }>;
}

const P1 = 'Foundations', P2 = 'Selecting instructions', P3 = 'Registers & frames', P4 = 'Down to the bytes', P5 = 'Beyond', PA = 'Appendices';

export const CHAPTERS: ChapterMeta[] = [
  { slug: 'intro', num: '0', title: 'What a compiler backend does', short: 'Introduction', part: P1, stage: 'Overview', load: () => import('./chapters/00-intro.mdx') },
  { slug: 'ir', num: '1', title: 'An SSA-shaped IR, and lowering into it', short: 'The IR', part: P1, stage: 'IR', load: () => import('./chapters/01-ir.mdx') },
  { slug: 'cfg', num: '2', title: 'Control-flow graphs', part: P1, stage: 'CFG', load: () => import('./chapters/02-cfg.mdx') },
  { slug: 'dominance', num: '3', title: 'Dominance', part: P1, stage: 'Dominance', load: () => import('./chapters/03-dominance.mdx') },
  { slug: 'ssa', num: '4', title: 'Constructing SSA form', short: 'SSA construction', part: P1, stage: 'SSA', load: () => import('./chapters/04-ssa.mdx') },
  { slug: 'optimize', num: '5', title: 'Just enough optimisation', part: P1, stage: 'IR opt', load: () => import('./chapters/05-optimize.mdx') },
  { slug: 'targets', num: '6', title: 'Meet the targets', part: P2, stage: 'Target', load: () => import('./chapters/06-targets.mdx') },
  { slug: 'isel', num: '7', title: 'Instruction selection', part: P2, stage: 'ISel', load: () => import('./chapters/07-isel.mdx') },
  { slug: 'legalization', num: '8', title: 'Legalization', part: P2, stage: 'Legalize', load: () => import('./chapters/08-legalization.mdx') },
  { slug: 'abi', num: '9', title: 'Calling conventions and ABIs', short: 'Calling conventions', part: P2, stage: 'ABI', load: () => import('./chapters/09-abi.mdx') },
  { slug: 'ssa-destruction', num: '10', title: 'Out of SSA', part: P3, stage: 'Out-of-SSA', load: () => import('./chapters/10-ssa-destruction.mdx') },
  { slug: 'liveness', num: '11', title: 'Liveness analysis', part: P3, stage: 'Liveness', load: () => import('./chapters/11-liveness.mdx') },
  { slug: 'regalloc', num: '12', title: 'Register allocation by graph colouring', short: 'Graph colouring', part: P3, stage: 'RegAlloc', load: () => import('./chapters/12-regalloc.mdx') },
  { slug: 'linear-scan', num: '13', title: 'Linear-scan allocation', short: 'Linear scan', part: P3, stage: 'RegAlloc', load: () => import('./chapters/13-linear-scan.mdx') },
  { slug: 'spilling', num: '14', title: 'Spilling and rematerialisation', short: 'Spilling', part: P3, stage: 'RegAlloc', load: () => import('./chapters/14-spilling.mdx') },
  { slug: 'frames', num: '15', title: 'Stack frames, prologues and epilogues', short: 'Stack frames', part: P3, stage: 'Frames', load: () => import('./chapters/15-frames.mdx') },
  { slug: 'scheduling', num: '16', title: 'Instruction scheduling', part: P4, stage: 'Sched', load: () => import('./chapters/16-scheduling.mdx') },
  { slug: 'peephole', num: '17', title: 'Peephole and machine optimisations', short: 'Peephole', part: P4, stage: 'Peephole', load: () => import('./chapters/17-peephole.mdx') },
  { slug: 'encoding', num: '18', title: 'Machine-code emission', short: 'Encoding', part: P4, stage: 'Emit', load: () => import('./chapters/18-encoding.mdx') },
  { slug: 'objects', num: '19', title: 'Object files and relocations', short: 'Object files', part: P4, stage: 'Object', load: () => import('./chapters/19-objects.mdx') },
  { slug: 'linking', num: '20', title: 'Linking, loading and running', short: 'Linking', part: P4, stage: 'Link', load: () => import('./chapters/20-linking.mdx') },
  { slug: 'wasm', num: '21', title: 'A different kind of target: WebAssembly', short: 'WebAssembly', part: P5, stage: 'Wasm', load: () => import('./chapters/21-wasm.mdx') },
  { slug: 'capstone', num: '22', title: 'The whole pipeline', short: 'Capstone', part: P5, stage: 'Pipeline', load: () => import('./chapters/22-capstone.mdx') },
  { slug: 'asm-primer', num: 'A', title: 'Assembly primer', part: PA, stage: 'Target', load: () => import('./appendix/a-assembly.mdx') },
  { slug: 'arch-primer', num: 'B', title: 'Computer architecture primer', short: 'Architecture primer', part: PA, stage: 'Target', load: () => import('./appendix/b-architecture.mdx') },
  { slug: 'ssa-primer', num: 'C', title: 'SSA primer', part: PA, stage: 'IR', load: () => import('./appendix/c-ssa.mdx') },
  { slug: 'graph-primer', num: 'D', title: 'Graph algorithms primer', short: 'Graph algorithms', part: PA, stage: 'Analysis', load: () => import('./appendix/d-graphs.mdx') },
  { slug: 'objfile-primer', num: 'E', title: 'Object file formats primer', short: 'Object formats', part: PA, stage: 'Object', load: () => import('./appendix/e-objects.mdx') },
  { slug: 'linking-primer', num: 'F', title: 'Linking primer', part: PA, stage: 'Link', load: () => import('./appendix/f-linking.mdx') },
  { slug: 'abi-primer', num: 'G', title: 'ABI primer', part: PA, stage: 'ABI', load: () => import('./appendix/g-abi.mdx') },
  { slug: 'glossary', num: 'H', title: 'Glossary and bibliography', short: 'Glossary', part: PA, stage: 'Reference', load: () => import('./appendix/h-glossary.mdx') },
];

/** what kind of reading a page is: the numbered chapters, the appendix primers, or the glossary */
export const kindOf = (c: ChapterMeta) => (c.part !== PA ? 'chapter' : c.slug === 'glossary' ? 'reference' : 'primer');

export const PARTS = [...new Set(CHAPTERS.map((c) => c.part))];
export const chapterBySlug = (s: string) => CHAPTERS.find((c) => c.slug === s);
