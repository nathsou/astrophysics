/**
 * Engine options a `::circuit` may pass on (`delayModel`, `seed`), merged with the ones its abstraction
 * level already sets (switch level: unit delay; analog: step). Kept apart from the widget so it can be tested.
 */
import type { EngineOptions } from '../sim/engine';
import type { EngineKind } from '../sim/netlist/types';

export type DelayModel = 'inertial' | 'transport';

export interface EngineProps {
  /** Digital engine: 'inertial' (the default) swallows pulses shorter than a gate's delay, 'transport' passes them. */
  delayModel?: string;
  /** Seed for anything random: the power-up state of gate loops, metastability. */
  seed?: number;
}

export interface Resolved {
  options: EngineOptions & { delayModel?: DelayModel };
  /** What is wrong with the props, if anything (the figure shows it; the options are then left out). */
  error?: string;
}

/**
 * `levelOptions` are those of the abstraction level and win on any clash. `delayModel` reaches only a
 * digital engine (the gates level, or the digital circuits that share it); `seed` reaches every engine.
 */
export function engineOptions(kind: EngineKind | undefined, levelOptions: Record<string, unknown>, props: EngineProps): Resolved {
  const options: Resolved['options'] = {};
  let error: string | undefined;
  if (props.seed !== undefined) {
    if (Number.isFinite(props.seed)) options.seed = props.seed;
    else error = `seed must be a number, not ${JSON.stringify(props.seed)}`;
  }
  if (props.delayModel !== undefined) {
    if (props.delayModel !== 'inertial' && props.delayModel !== 'transport') error = `delayModel must be "inertial" or "transport", not ${JSON.stringify(props.delayModel)}`;
    else if ((kind ?? 'digital') === 'digital') options.delayModel = props.delayModel;
  }
  return { options: { ...options, ...(levelOptions as EngineOptions) }, ...(error ? { error } : {}) };
}
