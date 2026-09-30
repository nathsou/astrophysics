/**
 * Structural validation of a Yosys JSON netlist against the format documented in the Yosys manual
 * (`write_json`): the shape of the file (`types.ts`), the ports and parameters of every internal cell
 * (`cells.ts`), the bits (net numbers, `"0"`, `"1"`, `"x"`, `"z"`), and the nets themselves: each net has one
 * driver, and every net that a cell reads or a port outputs has one. It returns a list of problems, empty when
 * the file is well-formed. It is what `validate:yosys` checks before it hands a file to Yosys.
 */
import { INTERNAL_CELLS, REQUIRED_PARAMETERS, paramInt } from './cells';

export interface ValidateOptions {
  /** Accept internal cell types the course's writer does not emit (a file written by Yosys itself). */
  allowUnknownInternal?: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DIRECTIONS = ['input', 'output', 'inout'];

export function validateYosysJson(json: unknown, opts: ValidateOptions = {}): string[] {
  const problems: string[] = [];
  const bad = (where: string, what: string) => problems.push(`${where}: ${what}`);
  if (!isRecord(json)) return ['the file is not a JSON object'];
  if (typeof json.creator !== 'string') bad('creator', 'missing or not a string');
  if (!isRecord(json.modules)) return [...problems, 'modules: missing or not an object'];
  const modules = json.modules;

  const checkValue = (where: string, v: unknown) => {
    if (typeof v !== 'string' && !(typeof v === 'number' && Number.isInteger(v))) bad(where, 'a parameter or attribute value must be an integer or a string');
  };
  const checkAttrs = (where: string, a: unknown) => {
    if (!isRecord(a)) return bad(where, 'missing or not an object');
    for (const [k, v] of Object.entries(a)) checkValue(`${where}.${k}`, v);
  };
  const bitOk = (b: unknown): boolean => (typeof b === 'number' && Number.isInteger(b) && b >= 2) || b === '0' || b === '1' || b === 'x' || b === 'z';
  const checkBits = (where: string, bits: unknown): bits is (number | string)[] => {
    if (!Array.isArray(bits)) {
      bad(where, 'bits must be an array');
      return false;
    }
    bits.forEach((b, i) => {
      if (!bitOk(b)) bad(`${where}[${i}]`, `${JSON.stringify(b)} is not a net number (2 or more) or one of "0", "1", "x", "z"`);
    });
    return true;
  };

  const tops: string[] = [];
  const children = new Map<string, Set<string>>();
  for (const [modName, mod] of Object.entries(modules)) {
    const at = `modules.${modName}`;
    if (!isRecord(mod)) {
      bad(at, 'not an object');
      continue;
    }
    checkAttrs(`${at}.attributes`, mod.attributes);
    if (isRecord(mod.attributes) && 'top' in mod.attributes && paramInt(mod.attributes.top as number | string) === 1) tops.push(modName);

    const ports = isRecord(mod.ports) ? mod.ports : (bad(`${at}.ports`, 'missing or not an object'), {});
    const cells = isRecord(mod.cells) ? mod.cells : (bad(`${at}.cells`, 'missing or not an object'), {});
    const netnames = isRecord(mod.netnames) ? mod.netnames : (bad(`${at}.netnames`, 'missing or not an object'), {});

    const drivers = new Map<number, string>();
    const readers: { net: number; where: string }[] = [];
    const drive = (net: unknown, who: string) => {
      if (typeof net !== 'number') return;
      const other = drivers.get(net);
      if (other !== undefined) bad(`${at}`, `net ${net} has two drivers: ${other} and ${who}`);
      else drivers.set(net, who);
    };
    const read = (net: unknown, where: string) => {
      if (typeof net === 'number') readers.push({ net, where });
    };

    for (const [portName, port] of Object.entries(ports)) {
      const where = `${at}.ports.${portName}`;
      if (!isRecord(port)) {
        bad(where, 'not an object');
        continue;
      }
      if (!DIRECTIONS.includes(port.direction as string)) bad(`${where}.direction`, `"${String(port.direction)}" is not input, output or inout`);
      if (checkBits(`${where}.bits`, port.bits)) {
        if (port.direction === 'input') port.bits.forEach((b) => drive(b, `input port ${portName}`));
        else port.bits.forEach((b) => read(b, `output port ${portName}`));
      }
    }

    const instanceOf = new Set<string>();
    for (const [cellName, cell] of Object.entries(cells)) {
      const where = `${at}.cells.${cellName}`;
      if (!isRecord(cell)) {
        bad(where, 'not an object');
        continue;
      }
      if (cell.hide_name !== 0 && cell.hide_name !== 1) bad(`${where}.hide_name`, 'must be 0 or 1');
      if (typeof cell.type !== 'string' || cell.type === '') {
        bad(`${where}.type`, 'missing or not a string');
        continue;
      }
      const type = cell.type;
      const params = isRecord(cell.parameters) ? cell.parameters : (bad(`${where}.parameters`, 'missing or not an object'), {});
      for (const [k, v] of Object.entries(params)) checkValue(`${where}.parameters.${k}`, v);
      checkAttrs(`${where}.attributes`, cell.attributes);
      const dirs = isRecord(cell.port_directions) ? cell.port_directions : (bad(`${where}.port_directions`, 'missing or not an object'), {});
      const conns = isRecord(cell.connections) ? cell.connections : (bad(`${where}.connections`, 'missing or not an object'), {});
      for (const [p, d] of Object.entries(dirs)) if (!DIRECTIONS.includes(d as string)) bad(`${where}.port_directions.${p}`, `"${String(d)}" is not input, output or inout`);
      for (const p of Object.keys(conns)) if (!(p in dirs)) bad(`${where}.connections.${p}`, 'has no entry in port_directions');
      for (const p of Object.keys(dirs)) if (!(p in conns)) bad(`${where}.port_directions.${p}`, 'has no entry in connections');
      for (const [p, bits] of Object.entries(conns)) {
        if (!checkBits(`${where}.connections.${p}`, bits)) continue;
        if (dirs[p] === 'output') bits.forEach((b) => drive(b, `${cellName}.${p}`));
        else bits.forEach((b) => read(b, `${cellName}.${p}`));
      }

      if (type.startsWith('$')) {
        const spec = INTERNAL_CELLS[type];
        if (!spec) {
          if (!opts.allowUnknownInternal) bad(`${where}.type`, `${type} is not an internal cell type the interchange writer emits`);
          continue;
        }
        for (const name of REQUIRED_PARAMETERS[type] ?? []) if (!(name in params)) bad(`${where}.parameters`, `${type} needs the parameter ${name}`);
        const p = (name: string) => paramInt(params[name] as number | string);
        for (const port of [...spec.inputs, ...spec.outputs]) {
          const bits = conns[port];
          if (!Array.isArray(bits)) {
            bad(`${where}.connections`, `${type} needs the port ${port}`);
            continue;
          }
          if (dirs[port] !== (spec.outputs.includes(port) ? 'output' : 'input')) bad(`${where}.port_directions.${port}`, `${port} of ${type} is an ${spec.outputs.includes(port) ? 'output' : 'input'}`);
          const w = spec.width(port, p);
          if (w !== undefined && !Number.isNaN(w) && bits.length !== w) bad(`${where}.connections.${port}`, `${bits.length} bits, but the parameters of ${type} say ${w}`);
        }
        for (const port of Object.keys(conns)) if (!spec.inputs.includes(port) && !spec.outputs.includes(port)) bad(`${where}.connections.${port}`, `${type} has no port ${port}`);
      } else {
        instanceOf.add(type);
        const child = modules[type];
        if (!isRecord(child)) {
          bad(`${where}.type`, `module ${type} is not in the file`);
          continue;
        }
        const childPorts = isRecord(child.ports) ? child.ports : {};
        for (const [port, bits] of Object.entries(conns)) {
          const cp = childPorts[port];
          if (!isRecord(cp)) {
            bad(`${where}.connections.${port}`, `module ${type} has no port ${port}`);
            continue;
          }
          if (Array.isArray(bits) && Array.isArray(cp.bits) && bits.length !== cp.bits.length) bad(`${where}.connections.${port}`, `${bits.length} bits, but ${type}.${port} has ${cp.bits.length}`);
          if (dirs[port] !== cp.direction) bad(`${where}.port_directions.${port}`, `${String(dirs[port])}, but ${type}.${port} is an ${String(cp.direction)}`);
        }
      }
    }
    children.set(modName, instanceOf);

    for (const [name, nn] of Object.entries(netnames)) {
      const where = `${at}.netnames.${name}`;
      if (!isRecord(nn)) {
        bad(where, 'not an object');
        continue;
      }
      if (nn.hide_name !== 0 && nn.hide_name !== 1) bad(`${where}.hide_name`, 'must be 0 or 1');
      checkAttrs(`${where}.attributes`, nn.attributes);
      if (checkBits(`${where}.bits`, nn.bits)) {
        for (const b of nn.bits) if (typeof b === 'number' && !drivers.has(b)) bad(`${where}.bits`, `net ${b} is not driven by anything`);
        const init = isRecord(nn.attributes) ? nn.attributes.init : undefined;
        if (typeof init === 'string' && init.length !== nn.bits.length) bad(`${where}.attributes.init`, `${init.length} bits for a ${nn.bits.length}-bit wire`);
      }
    }
    for (const r of readers) if (!drivers.has(r.net)) bad(at, `net ${r.net} is read by ${r.where} but nothing drives it`);
  }

  if (Object.keys(modules).length > 1 && tops.length !== 1) bad('modules', `exactly one module must have the top attribute, found ${tops.length}`);
  // No module contains itself, directly or not.
  const state = new Map<string, 1 | 2>();
  const cycle = (m: string, trail: string[]): void => {
    if (state.get(m) === 2) return;
    if (state.get(m) === 1) {
      bad('modules', `module ${m} contains itself (${[...trail, m].join(' > ')})`);
      return;
    }
    state.set(m, 1);
    for (const c of children.get(m) ?? []) if (c in modules) cycle(c, [...trail, m]);
    state.set(m, 2);
  };
  for (const m of Object.keys(modules)) cycle(m, []);
  return problems;
}
