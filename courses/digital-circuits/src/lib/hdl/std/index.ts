/**
 * The DCL standard library: modules that any design can instantiate without declaring them. The checker
 * looks a module name up here when the design does not declare it (`check(…, { std: false })` turns this
 * off). Each file also carries its own `test` blocks.
 */
import debouncer from './debouncer.dcl?raw';
import edgeDetect from './edge-detect.dcl?raw';
import fifo from './fifo.dcl?raw';
import sevenSeg from './seven-seg.dcl?raw';
import synchronizer from './synchronizer.dcl?raw';
import uartRx from './uart-rx.dcl?raw';
import uartTx from './uart-tx.dcl?raw';

export interface StdFile {
  /** The file name used in spans and diagnostics, such as `std/fifo.dcl`. */
  file: string;
  source: string;
  /** The modules it declares. */
  modules: string[];
}

function entry(file: string, source: string): StdFile {
  const modules = [...source.matchAll(/^(?:top\s+)?module\s+([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]!);
  return { file: `std/${file}`, source, modules };
}

const FILES: StdFile[] = [
  entry('synchronizer.dcl', synchronizer),
  entry('debouncer.dcl', debouncer),
  entry('edge-detect.dcl', edgeDetect),
  entry('fifo.dcl', fifo),
  entry('seven-seg.dcl', sevenSeg),
  entry('uart-tx.dcl', uartTx),
  entry('uart-rx.dcl', uartRx),
];

/** Every standard-library file. */
export function loadStd(): StdFile[] {
  return FILES;
}

/** The standard-library file that declares module `name`. */
export function findStd(name: string): StdFile | undefined {
  return FILES.find((f) => f.modules.includes(name));
}
