/**
 * The Yosys JSON netlist format (`write_json` / `read_json`), as far as the course's writer uses it. The
 * format is documented in the Yosys manual (*Yosys JSON netlist format*, `write_json`). One object per file:
 *
 * ```
 * { "creator": string,
 *   "modules": { <name>: {
 *     "attributes": { <name>: <value> },
 *     "ports":    { <name>: { "direction": "input" | "output" | "inout", "bits": [<bit>, …] } },
 *     "cells":    { <name>: { "hide_name": 0 | 1, "type": <string>, "parameters": {…}, "attributes": {…},
 *                             "port_directions": { <port>: <direction> }, "connections": { <port>: [<bit>, …] } } },
 *     "netnames": { <name>: { "hide_name": 0 | 1, "bits": [<bit>, …], "attributes": {…} } } } } }
 * ```
 *
 * A `<bit>` is a net number (an integer, 2 or more, shared by everything on the same net) or one of the
 * strings `"0"`, `"1"`, `"x"`, `"z"`. Arrays list the least significant bit first. A parameter or attribute
 * value is a JavaScript integer, or a string: a binary number written most significant bit first (a
 * 32-bit one for an integer), or text. Text that consists only of the characters 0, 1, x and z carries a
 * trailing space so that it cannot be mistaken for a binary number.
 */

export type YosysBit = number | '0' | '1' | 'x' | 'z';
export type YosysValue = number | string;
export type YosysDirection = 'input' | 'output' | 'inout';

export interface YosysPort {
  direction: YosysDirection;
  bits: YosysBit[];
}

export interface YosysCell {
  hide_name: 0 | 1;
  type: string;
  parameters: Record<string, YosysValue>;
  attributes: Record<string, YosysValue>;
  port_directions: Record<string, YosysDirection>;
  connections: Record<string, YosysBit[]>;
}

export interface YosysNetname {
  hide_name: 0 | 1;
  bits: YosysBit[];
  attributes: Record<string, YosysValue>;
}

export interface YosysModule {
  attributes: Record<string, YosysValue>;
  ports: Record<string, YosysPort>;
  cells: Record<string, YosysCell>;
  netnames: Record<string, YosysNetname>;
}

export interface YosysJson {
  creator: string;
  modules: Record<string, YosysModule>;
}
