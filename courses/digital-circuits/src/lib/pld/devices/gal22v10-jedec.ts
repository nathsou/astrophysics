/**
 * JEDEC files for the GAL22V10: the standard layout (one L field per array row that is not all
 * zeros, then the 20 S0/S1 fuses, then the 64 signature fuses) in two flavours:
 *
 * - 'standard': `*QP24*` and upper-case checksums;
 * - 'galette': byte-for-byte what galette (and GALasm) write, for `validate:gal` comparisons.
 */
import { readJedec, writeJedec, JedecError, type JedecBlock, type JedecFile } from '../twolevel/jedec';
import { COLUMNS, CONFIG_BASE, FUSE_COUNT, PINS, ROWS, SIGNATURE_BASE } from './gal22v10';

export interface Gal22v10JedecOptions {
  style?: 'standard' | 'galette';
  /** Design specification lines for the 'standard' style. */
  header?: string[];
  /** galette version string for the 'galette' style (default 0.3.0). */
  galetteVersion?: string;
  security?: boolean;
  eol?: '\n' | '\r\n';
}

export const GAL22V10_BLOCKS: JedecBlock[] = [
  ...Array.from({ length: ROWS }, (_, r) => ({ start: r * COLUMNS, length: COLUMNS })),
  { start: CONFIG_BASE, length: 20, always: true },
  { start: SIGNATURE_BASE, length: 64, always: true },
];

export function writeGal22v10Jedec(fuses: ArrayLike<number>, opts: Gal22v10JedecOptions = {}): string {
  if (fuses.length !== FUSE_COUNT) throw new Error(`A GAL22V10 has ${FUSE_COUNT} fuses, not ${fuses.length}`);
  if (opts.style === 'galette') {
    return writeJedec(fuses, {
      header: [`GAL-Assembler:  Galette ${opts.galetteVersion ?? '0.3.0'}`, 'Device:         GAL22V10', ''],
      security: opts.security,
      blocks: GAL22V10_BLOCKS,
      hexCase: 'lower',
      eol: opts.eol,
    });
  }
  return writeJedec(fuses, {
    header: opts.header ?? ['Device: GAL22V10 (ATF22V10)'],
    pinCount: PINS,
    security: opts.security,
    blocks: GAL22V10_BLOCKS,
    hexCase: 'upper',
    eol: opts.eol,
  });
}

/** Read a GAL22V10 JEDEC file, checking the fuse and pin counts and both checksums. */
export function readGal22v10Jedec(text: string, strict = true): JedecFile {
  const f = readJedec(text, { strict, fuseCount: FUSE_COUNT });
  if (f.fuseCount !== FUSE_COUNT) throw new JedecError(`Expected ${FUSE_COUNT} fuses (QF${FUSE_COUNT}), found QF${f.fuseCount}`);
  if (f.pinCount !== undefined && f.pinCount !== PINS) throw new JedecError(`Expected a ${PINS}-pin device, found QP${f.pinCount}`);
  return f;
}
