/**
 * A permission model of Rust-style ownership and borrowing (chapter 22), for a tiny language, one statement per line:
 *
 *   let a = new          a owns a new object: the whole permission, 1
 *   let r = &a           a shared borrow: r gets half of what a holds; a keeps the other half
 *   let m = &mut a       a mutable borrow: m gets all of a's permission; a keeps none
 *   let b = a            a move: b gets a's permission and ownership; a can no longer be used
 *   read x               needs some permission (any fraction above 0)
 *   write x              needs the whole permission, 1
 *   drop a               a must own the object and hold all of it (no borrow is alive)
 *
 * A borrow lives until its last use (as in Rust's non-lexical lifetimes); then its permission returns to the
 * variable it was borrowed from. This is a teaching model: real Rust tracks places, lifetimes and types.
 */
export interface PermLine {
  text: string;
  /** Permission held by each variable after this line (as a fraction), and its status. */
  holdings: { name: string; amount: number; owner: boolean; note?: string }[];
  error?: string;
}

type Stmt =
  | { k: 'new'; x: string }
  | { k: 'shared'; x: string; from: string }
  | { k: 'mut'; x: string; from: string }
  | { k: 'move'; x: string; from: string }
  | { k: 'read' | 'write' | 'drop'; x: string };

export function parseLine(text: string): Stmt {
  const t = text.replace(/\/\/.*$/, '').trim();
  let m = /^let\s+(\w+)\s*=\s*new$/.exec(t);
  if (m) return { k: 'new', x: m[1]! };
  m = /^let\s+(\w+)\s*=\s*&mut\s+(\w+)$/.exec(t);
  if (m) return { k: 'mut', x: m[1]!, from: m[2]! };
  m = /^let\s+(\w+)\s*=\s*&\s*(\w+)$/.exec(t);
  if (m) return { k: 'shared', x: m[1]!, from: m[2]! };
  m = /^let\s+(\w+)\s*=\s*(\w+)$/.exec(t);
  if (m) return { k: 'move', x: m[1]!, from: m[2]! };
  m = /^(read|write|drop)\s+(\w+)$/.exec(t);
  if (m) return { k: m[1] as 'read' | 'write' | 'drop', x: m[2]! };
  throw new Error(`Cannot read “${t}”. Write let a = new, let r = &a, let m = &mut a, let b = a, read x, write x or drop a.`);
}

const uses = (s: Stmt, name: string) => s.x === name || ('from' in s && s.from === name);

export function track(lines: string[]): PermLine[] {
  const prog = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  const stmts = prog.map(parseLine);
  // Last use of each name (for borrow lifetimes).
  const lastUse = new Map<string, number>();
  stmts.forEach((s, i) => {
    lastUse.set(s.x, i);
    if ('from' in s) lastUse.set(s.from, i);
  });
  const amount = new Map<string, number>();
  const owner = new Set<string>();
  const moved = new Set<string>();
  const dropped = new Set<string>();
  const lender = new Map<string, { from: string; amount: number }>();
  const out: PermLine[] = [];
  let failed = false;
  stmts.forEach((s, i) => {
    let error: string | undefined;
    // Borrows whose last use is before this line end now, returning their permission (innermost first).
    for (const [b, l] of [...lender].reverse()) {
      if ((lastUse.get(b) ?? -1) < i && !stmts.slice(i).some((x) => uses(x, b))) {
        amount.set(l.from, (amount.get(l.from) ?? 0) + (amount.get(b) ?? 0));
        amount.set(b, 0);
        lender.delete(b);
      }
    }
    const have = (x: string) => amount.get(x) ?? 0;
    const usable = (x: string): string | undefined => {
      if (!amount.has(x)) return `${x} does not exist`;
      if (moved.has(x)) return `${x} was moved out of`;
      if (dropped.has(x)) return `${x} was dropped`;
      return undefined;
    };
    if (!failed) {
      switch (s.k) {
        case 'new':
          amount.set(s.x, 1);
          owner.add(s.x);
          break;
        case 'shared': {
          error = usable(s.from) ?? (have(s.from) === 0 ? `${s.from} is mutably borrowed, so it cannot be read or shared` : undefined);
          if (!error) {
            const half = have(s.from) / 2;
            amount.set(s.from, half);
            amount.set(s.x, half);
            lender.set(s.x, { from: s.from, amount: half });
          }
          break;
        }
        case 'mut': {
          error = usable(s.from) ?? (have(s.from) < 1 ? `${s.from} holds only ${frac(have(s.from))} of the permission: a mutable borrow needs all of it, and some is lent out to a live borrow` : undefined);
          if (!error) {
            amount.set(s.x, 1);
            amount.set(s.from, 0);
            lender.set(s.x, { from: s.from, amount: 1 });
          }
          break;
        }
        case 'move':
          error = usable(s.from) ?? (!owner.has(s.from) ? `${s.from} is a borrow; it does not own anything to move` : have(s.from) < 1 ? `${s.from} is borrowed, so it cannot be moved` : undefined);
          if (!error) {
            amount.set(s.x, 1);
            owner.add(s.x);
            amount.set(s.from, 0);
            moved.add(s.from);
          }
          break;
        case 'read':
          error = usable(s.x) ?? (have(s.x) === 0 ? `${s.x} holds no permission: it is mutably borrowed` : undefined);
          break;
        case 'write':
          error = usable(s.x) ?? (have(s.x) < 1 ? `${s.x} holds ${frac(have(s.x))} of the permission; writing needs all of it (a shared borrow is still alive)` : undefined);
          break;
        case 'drop':
          error = usable(s.x) ?? (!owner.has(s.x) ? `${s.x} does not own the object` : have(s.x) < 1 ? `${s.x} is borrowed: dropping it now would leave a dangling reference` : undefined);
          if (!error) {
            amount.set(s.x, 0);
            dropped.add(s.x);
          }
          break;
      }
    }
    if (error) failed = true;
    out.push({
      text: prog[i]!,
      error,
      holdings: [...amount].map(([name, a]) => ({ name, amount: a, owner: owner.has(name), note: moved.has(name) ? 'moved' : dropped.has(name) ? 'dropped' : lender.has(name) ? `borrows ${lender.get(name)!.from}` : undefined })),
    });
  });
  return out;
}

export function frac(x: number): string {
  if (x === 1) return '1';
  if (x === 0) return '0';
  const d = Math.round(1 / x);
  return Math.abs(1 / d - x) < 1e-9 ? `1/${d}` : x.toFixed(3);
}
