/**
 * `lowerToCircuit`: a drawable `Circuit` for a small DCL design (the inference viewer and the Device Studio's
 * logic view). It lowers the design (index.ts), then lays the gates out in columns by logic depth (layout.ts).
 *
 * The circuit's component ids are the element ids of `Lowered.elements`, so a component can be traced back to
 * its source span, and a source span to its components. `flatten(circuit)` gives an equivalent netlist
 * (`connect()` numbers its nets differently), which `createGateSim(lowered, flatten(circuit))` runs.
 */
import type { RtlDesign, RtlModule } from '../rtl';
import { layoutNetlist, LayoutError, type LayoutOptions, type LayoutResult } from './layout';
import { lowerToNetlist } from './index';
import type { Lowered, LowerOptions } from './types';

export { LayoutError, layoutNetlist };
export type { LayoutOptions, LayoutResult };

export interface LoweredCircuit extends LayoutResult {
  lowered: Lowered;
}

export function lowerToCircuit(design: RtlDesign | RtlModule, top?: string, options: LowerOptions & LayoutOptions = {}): LoweredCircuit {
  const { maxElements, ...lowerOptions } = options;
  const lowered = lowerToNetlist(design, top, { ...lowerOptions, io: true });
  const layout = layoutNetlist(lowered.netlist, lowered.rtl.name, { maxElements });
  // Label the parts: flip-flops and memories by the register they hold, gates not at all.
  for (const c of layout.circuit.components) {
    const info = lowered.elements[c.id];
    if (!info) continue;
    if (c.type === 'toggle' || c.type === 'indicator' || c.type === 'dff' || c.type === 'ram') c.label = info.label ?? (c.type === 'ram' ? 'RAM' : '');
    else c.label = '';
  }
  return { ...layout, lowered };
}
