import type { Component } from 'svelte';
import type { ElementState } from '../../sim/engine';
import type { ComponentDef, Params, PinDef, Rot } from '../../sim/netlist/types';

/**
 * Props every schematic symbol receives. A symbol draws in the component's own coordinates, in
 * pixels (grid units × GRID_PX), at rotation 0: the renderer applies the placement transform.
 *
 * Conventions:
 *  - Pin stubs are `<path class="stub" data-pin={index} d="M<pin> …">` running from the pin position
 *    to the body. The renderer colours them like wires, so they must start exactly on the pin.
 *  - Text that must stay readable uses `uprightAt(x, y, rot, flip)` from ../geometry.
 *  - Classes from symbols.css: ln (ink line), body (filled outline), ink (filled ink), thin, txt, …
 */
export interface SymbolProps {
  id: string;
  type: string;
  def: ComponentDef;
  /** Parameters with catalog defaults filled in (live: a toggled switch updates them). */
  params: Params;
  pins: PinDef[];
  /**
   * Live state: the engine's ElementState, plus values the renderer derives for display symbols:
   * `logic` (probe input), `reading` (meters), `brightness` (indicators without an engine value),
   * `segments`/`value` (displays).
   */
  state: ElementState;
  rot: Rot;
  flip: boolean;
  /** Unique prefix for SVG ids (gradients) within the page. */
  uid: string;
}

export type SymbolComponent = Component<SymbolProps>;
