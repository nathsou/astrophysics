/**
 * The steady-state solver of the switch-level engine: given one channel-connected component (a
 * set of nodes joined by conducting or possibly-conducting links), find the value every node
 * settles to. This is Bryant's MOSSIM II algorithm, extended to X-gated transistors.
 *
 * Signals and strengths. A signal is a value (0, 1 or X) with a strength, a small integer: the
 * charge a node stores (small < normal < large sizes), then the links that conduct (a resistor is
 * weak; transistors are weak, normal or strong by size; a switch contact is a wire), then the
 * supply (rails, ground and logic inputs, which nothing can overpower). A signal travelling along a
 * path is as strong as the weakest thing on it: its source, or any link it crosses.
 *
 * A node takes the value of the strongest signals that reach it; if the strongest ones disagree,
 * the node is X. A stronger signal *blocks* weaker ones at the node: they go no further. That is a
 * widest-path problem (maximise the minimum strength along a path), solved like Dijkstra's
 * algorithm with a bucket per strength level, strongest first.
 *
 * X-gated transistors might conduct or not. The node's value must cover every combination, so the
 * solver computes three things:
 *  - `sMin`, the *definite* strength of each node: the widest path using only links that surely
 *    conduct. In every combination the node is at least this strong.
 *  - `up0`, `up1`, `upX`: the strongest 0, 1 and X signal that *might* reach each node, through
 *    links that surely or possibly conduct. A signal is blocked at a node whose definite strength
 *    exceeds it (it would be blocked in every combination).
 * The node can end up 1 if a possible 1 (or X) is at least as strong as its definite strength; the
 * same for 0; if it can be both, it is X. With no X-gated transistor this is exactly the classic
 * algorithm; with some it is conservative (it never claims a value that some combination
 * contradicts) and exact in the common cases: an X transistor that fights a definite, stronger
 * driver loses, one in series with an off transistor does nothing.
 */

export const OFF = 0;
export const ON = 1;
/** Link state: the gate is X, so it may or may not conduct. */
export const MAYBE = 2;

export const V0 = 0;
export const V1 = 1;
export const VX = 2;

/** The netlist as the solver sees it: nodes and links, both numbered. */
export interface SwitchGraph {
  /** Number of nodes (nets). */
  readonly n: number;
  /** 1 for input nodes (supplies): fixed values, never solved, never relaying other signals. */
  readonly isInput: Uint8Array;
  /** Charge strength of each node (its size class). */
  readonly size: Uint8Array;
  /** Links incident to node i: linkOf[adjStart[i] … adjStart[i + 1] − 1]. */
  readonly adjStart: Int32Array;
  readonly adjLink: Int32Array;
  /** Link ends. */
  readonly linkA: Int32Array;
  readonly linkB: Int32Array;
  /** Strength of a link when it conducts. */
  readonly linkLevel: Uint8Array;
  /** OFF, ON or MAYBE. */
  readonly linkState: Uint8Array;
}

/** Scratch space and the algorithm; one per engine, reused for every component. */
export class ComponentSolver {
  readonly sMin: Uint8Array;
  readonly up0: Uint8Array;
  readonly up1: Uint8Array;
  readonly upX: Uint8Array;
  private readonly buckets: number[][];

  /**
   * @param maxLevel the supply strength (the highest level).
   * @param contentionLevel two disagreeing signals at least this strong are reported as contention.
   */
  constructor(
    private readonly g: SwitchGraph,
    private readonly maxLevel: number,
    private readonly contentionLevel: number,
  ) {
    this.sMin = new Uint8Array(g.n);
    this.up0 = new Uint8Array(g.n);
    this.up1 = new Uint8Array(g.n);
    this.upX = new Uint8Array(g.n);
    this.buckets = Array.from({ length: maxLevel + 1 }, () => []);
  }

  /**
   * Solve a component. `comp` lists its nodes (none of them inputs); `val` holds every node's
   * current value, which for the component's nodes is the charge they store. Results for each
   * node of `comp` go to `outVal` (0, 1, X), `outStrength` (the strength of the winning signal)
   * and `outContended` (two driven signals disagree). `hasMaybe` tells whether any link of the
   * component is MAYBE (contention is then not reported: it might not happen).
   */
  solve(comp: readonly number[], val: Uint8Array, hasMaybe: boolean, outVal: Uint8Array, outStrength: Uint8Array, outContended: Uint8Array): void {
    const { sMin, up0, up1, upX } = this;
    this.definite(comp);
    this.possible(comp, val, V0, up0);
    this.possible(comp, val, V1, up1);
    this.possible(comp, val, VX, upX);
    for (const n of comp) {
      const s = sMin[n]!;
      const a0 = up0[n]! >= s;
      const a1 = up1[n]! >= s;
      const ax = upX[n]! >= s;
      const can0 = a0 || ax;
      const can1 = a1 || ax;
      let v: number;
      let str: number;
      if (can0 && can1) {
        v = VX;
        str = Math.max(up0[n]!, up1[n]!, upX[n]!);
      } else if (can1) {
        v = V1;
        str = up1[n]!;
      } else if (can0) {
        v = V0;
        str = up0[n]!;
      } else {
        // Cannot happen (the definite path always delivers some signal); stay safe.
        v = VX;
        str = s;
      }
      outVal[n] = v;
      outStrength[n] = str;
      outContended[n] = !hasMaybe && a0 && a1 && Math.min(up0[n]!, up1[n]!) >= this.contentionLevel ? 1 : 0;
    }
  }

  /** Widest paths through links that surely conduct: the strength each node has in every case. */
  private definite(comp: readonly number[]): void {
    const { g, sMin, buckets } = this;
    for (const n of comp) {
      sMin[n] = g.size[n]!;
      buckets[sMin[n]!]!.push(n);
    }
    // Supplies next to the component inject their signal through the link between them.
    for (const n of comp) {
      for (let k = g.adjStart[n]!; k < g.adjStart[n + 1]!; k++) {
        const l = g.adjLink[k]!;
        if (g.linkState[l] !== ON) continue;
        const m = g.linkA[l] === n ? g.linkB[l]! : g.linkA[l]!;
        if (!g.isInput[m]) continue;
        const s = g.linkLevel[l]!;
        if (s > sMin[n]!) {
          sMin[n] = s;
          buckets[s]!.push(n);
        }
      }
    }
    this.run(sMin, true, false);
  }

  /** Strongest signal of value `v` that might reach each node (blocked by definite strengths). */
  private possible(comp: readonly number[], val: Uint8Array, v: number, up: Uint8Array): void {
    const { g, buckets } = this;
    for (const n of comp) {
      up[n] = val[n] === v ? g.size[n]! : 0;
      if (up[n]) buckets[up[n]!]!.push(n);
    }
    for (const n of comp) {
      for (let k = g.adjStart[n]!; k < g.adjStart[n + 1]!; k++) {
        const l = g.adjLink[k]!;
        if (g.linkState[l] === OFF) continue;
        const m = g.linkA[l] === n ? g.linkB[l]! : g.linkA[l]!;
        if (!g.isInput[m] || val[m] !== v) continue;
        const s = g.linkLevel[l]!;
        if (s > up[n]!) {
          up[n] = s;
          buckets[s]!.push(n);
        }
      }
    }
    this.run(up, false, true);
  }

  /**
   * Bucket-queue widest path, strongest level first. A node popped at level s relays min(s, link)
   * to its neighbours. With `block`, a node relays only if s reaches its definite strength.
   */
  private run(best: Uint8Array, onlyOn: boolean, block: boolean): void {
    const { g, buckets, sMin } = this;
    for (let lvl = this.maxLevel; lvl > 0; lvl--) {
      const bucket = buckets[lvl]!;
      while (bucket.length > 0) {
        const n = bucket.pop()!;
        if (best[n] !== lvl) continue; // superseded by a stronger signal
        if (block && lvl < sMin[n]!) continue; // blocked: the node is surely stronger than this
        for (let k = g.adjStart[n]!; k < g.adjStart[n + 1]!; k++) {
          const l = g.adjLink[k]!;
          const st = g.linkState[l]!;
          if (st === OFF || (onlyOn && st !== ON)) continue;
          const m = g.linkA[l] === n ? g.linkB[l]! : g.linkA[l]!;
          if (g.isInput[m]) continue;
          const ll = g.linkLevel[l]!;
          const s = ll < lvl ? ll : lvl;
          if (s > best[m]!) {
            best[m] = s;
            buckets[s]!.push(m);
          }
        }
      }
    }
  }
}
