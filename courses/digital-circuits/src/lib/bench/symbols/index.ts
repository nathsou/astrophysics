/**
 * Symbol registry: which Svelte component draws each component type.
 *
 * Later milestones add their own symbols (FPGA primitives, DCL cells) with registerSymbol(). Types
 * without a symbol (sequential parts, blocks, subcircuits "sub:…" and "part:…", anything unknown)
 * are drawn by the generic Block.
 */
import type { SymbolComponent } from './types';
import Block from './Block.svelte';
import Wiring from './Wiring.svelte';
import Passive from './Passive.svelte';
import Sources from './Sources.svelte';
import Switches from './Switches.svelte';
import Semis from './Semis.svelte';
import Meters from './Meters.svelte';
import Gates from './Gates.svelte';
import IO from './IO.svelte';
import Displays from './Displays.svelte';

export type { SymbolProps, SymbolComponent } from './types';

const symbols = new Map<string, SymbolComponent>();

/** Register (or replace) the symbol drawn for one or more component types. */
export function registerSymbol(type: string | string[], component: SymbolComponent): void {
  for (const t of Array.isArray(type) ? type : [type]) symbols.set(t, component);
}

/** The symbol for a type: a registered one, else the generic block. */
export function symbolFor(type: string): SymbolComponent {
  return symbols.get(type) ?? Block;
}

/** Whether a type has a symbol of its own (not the generic block). */
export const hasSymbol = (type: string): boolean => symbols.has(type);

export { Block };

registerSymbol(['ground', 'rail', 'label', 'port'], Wiring);
registerSymbol(['resistor', 'capacitor', 'inductor', 'potentiometer', 'lamp'], Passive);
registerSymbol(['battery', 'supply', 'siggen'], Sources);
registerSymbol(['switch', 'spdt', 'pushbutton', 'relay'], Switches);
registerSymbol(['diode', 'led', 'npn', 'pnp', 'nmos', 'pmos', 'comparator'], Semis);
registerSymbol(['voltmeter', 'ammeter'], Meters);
registerSymbol(['not', 'buffer', 'tristate', 'and', 'or', 'nand', 'nor', 'xor', 'xnor'], Gates);
registerSymbol(['toggle', 'button', 'clock', 'const', 'indicator', 'probe'], IO);
registerSymbol(['seven-seg', 'hex-display'], Displays);
