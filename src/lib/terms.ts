// Explanations for hoverable equation terms (\term{id}{tex} in LaTeX, <span data-term="id"> in prose).
// Global entries: every physical constant from constants.ts (keyed by its CONST key, e.g. \term{G}{G}).
// Chapters add or override entries with <Terms defs={{ id: ['Name', 'Why it is here…'] }} />.

import { CONST } from './physics/constants';

export interface TermDef {
  name: string;
  text?: string;
  value?: string;
}

const sup = (d: string) => [...d].map((x) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+x] ?? x).join('');
export const fmtConst = (v: number) =>
  v.toExponential(4).replace(/e\+?(-?)(\d+)/, (_, s: string, d: string) => (d === '0' ? '' : ` × 10${s ? '⁻' : ''}${sup(d)}`));

export const GLOBAL_TERMS: Record<string, TermDef> = Object.fromEntries(
  Object.entries(CONST).map(([k, c]) => [
    k,
    { name: c.name, value: `${c.symbol} = ${fmtConst(c.value)} ${c.unit}`, text: 'note' in c ? c.note : undefined },
  ]),
);
