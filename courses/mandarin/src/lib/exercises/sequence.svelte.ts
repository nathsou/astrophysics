/**
 * A run through an exercise's items. Each item ends when answered correctly (retries allowed)
 * or revealed; the score counts items right at the first attempt.
 */
export class Sequence {
  index = $state(0);
  /** null = not attempted yet; true/false = first attempt right/wrong. */
  first: (boolean | null)[] = $state([]);
  /** The current item is finished (answered correctly or revealed). */
  settled = $state(false);
  done = $state(false);
  round = $state(0);

  constructor(public readonly length: number) {
    this.first = Array(length).fill(null);
  }

  /** Record an attempt on the current item. Returns whether it settles the item. */
  attempt(ok: boolean): boolean {
    if (this.first[this.index] === null) this.first[this.index] = ok;
    if (ok) this.settled = true;
    return ok;
  }

  reveal(): void {
    if (this.first[this.index] === null) this.first[this.index] = false;
    this.settled = true;
  }

  next(): void {
    if (this.index + 1 >= this.length) {
      this.done = true;
      return;
    }
    this.index++;
    this.settled = false;
  }

  get score(): number {
    return this.first.filter((x) => x === true).length;
  }

  /** Passed: at least 60% right first time. */
  get passed(): boolean {
    return this.score >= Math.ceil(this.length * 0.6);
  }

  restart(): void {
    this.index = 0;
    this.first = Array(this.length).fill(null);
    this.settled = false;
    this.done = false;
    this.round++;
  }
}
