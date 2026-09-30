/**
 * The relay armature as the reader sees it: a position between 0 (released, held off the core by the
 * spring) and 1 (pulled onto the core), driven by the engine's `energised` flag.
 *
 * The analog engine models the armature as a state machine, not as a mass on a spring: it decides at
 * the moment the coil current crosses 70 % of the rated value (pull-in) or 30 % (drop-out), and the
 * contacts follow `operateTime` seconds later, the one that opens at 30 % of the travel and the one
 * that closes at the end (see `models/switches.ts`). This class animates the same travel: it moves at
 * 1 / operateTime per second towards the target, and a change of mind mid-flight turns it round from
 * wherever it is.
 */
export class Armature {
  /** 0 = released, 1 = pulled in. */
  position = 0;

  /** Advance by `dt` simulated seconds towards the target; returns the new position. */
  update(dt: number, energised: boolean, operateTime: number): number {
    const target = energised ? 1 : 0;
    const step = Math.max(0, dt) / Math.max(1e-9, operateTime);
    if (this.position < target) this.position = Math.min(target, this.position + step);
    else if (this.position > target) this.position = Math.max(target, this.position - step);
    return this.position;
  }

  reset(): void {
    this.position = 0;
  }
}

/** Angle of the armature in degrees (left end up when released), for a gap angle `gap`. */
export function armatureAngle(position: number, gap = 9): number {
  return gap * (Math.max(0, Math.min(1, position)) - 1);
}
