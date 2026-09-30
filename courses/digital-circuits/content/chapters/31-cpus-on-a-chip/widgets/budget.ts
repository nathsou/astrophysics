/**
 * What the three fits of the chapter cost, and where the cells go: the data of the "cell budget" figure. The numbers are
 * measured by `octet-fpga.test.ts` and `rv32-fpga.test.ts`, which fail when the flow's results move away from them.
 */
export interface Segment {
  label: string;
  cells: number;
}

export interface Fit {
  id: string;
  title: string;
  device: 'vFPGA-M' | 'vFPGA-L';
  /** Logic cells on the device. */
  capacity: number;
  total: number;
  flipFlops: number;
  blockRams: number;
  fmaxMHz: number;
  /** CPU seconds for the whole flow. */
  seconds: number;
  segments: Segment[];
}

export const FITS: Fit[] = [
  {
    id: 'octet',
    title: 'Octet',
    device: 'vFPGA-M',
    capacity: 1152,
    total: 541,
    flipFlops: 129,
    blockRams: 2,
    fmaxMHz: 43.3,
    seconds: 7.4,
    segments: [
      { label: 'ALU', cells: 97 },
      { label: 'control', cells: 94 },
      { label: 'registers, bus, memory glue, devices', cells: 350 },
    ],
  },
  {
    id: 'rv32-flops',
    title: 'RV32I, registers in flip-flops',
    device: 'vFPGA-L',
    capacity: 8192,
    total: 4735,
    flipFlops: 1113,
    blockRams: 0,
    fmaxMHz: 12.9,
    seconds: 31.3,
    segments: [
      { label: 'register file', cells: 3201 },
      { label: 'ALU', cells: 749 },
      { label: 'decode, program counter, ROM, devices', cells: 785 },
    ],
  },
  {
    id: 'rv32-ram',
    title: 'RV32I, registers in block RAM',
    device: 'vFPGA-L',
    capacity: 8192,
    total: 1476,
    flipFlops: 89,
    blockRams: 4,
    fmaxMHz: 20.0,
    seconds: 5.8,
    segments: [
      { label: 'register file', cells: 9 },
      { label: 'ALU', cells: 667 },
      { label: 'decode, program counter, ROM, devices', cells: 800 },
    ],
  },
];
