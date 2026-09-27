// Target-neutral in-memory object code: what an assembler produces before it
// is serialised into ELF.

export type Machine = 'rv64' | 'aarch64' | 'x86_64';

export interface Reloc {
  offset: number;
  type: number;
  typeName: string;
  sym: string;
  addend: bigint;
  /** human explanation for the course */
  why?: string;
}

export interface SymDef {
  name: string;
  section: string; // '' = undefined (external)
  offset: number;
  size: number;
  global: boolean;
  kind: 'func' | 'object' | 'notype';
}

export interface Section {
  name: string;
  bytes: Uint8Array;
  /** .bss has a size but no bytes in the file */
  size: number;
  align: number;
  relocs: Reloc[];
  flags: 'ax' | 'aw' | 'a' | 'bss';
}

export interface EncField {
  name: string;
  hi: number;
  lo: number;
  value: number;
  /** what this field means here, e.g. "rd = a0 (x10)" */
  meaning?: string;
}

export interface ListingEntry {
  section: string;
  addr: number;
  bytes: number[];
  text: string;
  fn?: string;
  /** MIR instruction id this came from */
  mi?: number;
  expandedFrom?: string;
  fields?: EncField[];
  format?: string;
  reloc?: Reloc;
  label?: string;
  note?: string;
}

export interface ObjectCode {
  machine: Machine;
  sections: Section[];
  symbols: SymDef[];
  listing: ListingEntry[];
  relaxations: { fn: string; at: number; what: string }[];
}
