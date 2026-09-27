// CFG clean-up: unreachable block removal, constant branch folding,
// block merging, empty-block forwarding and (optionally) if-conversion of
// simple diamonds into `select`.

import { Const, type Block, type Func, type Instr } from '../ir/ir';

export interface PassLog {
  msgs: string[];
}

function removePhiIncoming(b: Block, pred: Block) {
  for (const phi of b.phis) {
    const k = phi.blocks.indexOf(pred);
    if (k >= 0) {
      phi.args.splice(k, 1);
      phi.blocks.splice(k, 1);
    }
  }
}

export function removeUnreachable(fn: Func, log?: PassLog): boolean {
  fn.computePreds();
  const seen = new Set<Block>([fn.entry]);
  const work = [fn.entry];
  while (work.length) for (const s of work.pop()!.succs) if (!seen.has(s)) { seen.add(s); work.push(s); }
  const dead = fn.blocks.filter((b) => !seen.has(b));
  if (!dead.length) return false;
  for (const d of dead) {
    for (const s of d.succs) removePhiIncoming(s, d);
    log?.msgs.push(`removed unreachable block ${d.name}`);
  }
  fn.blocks = fn.blocks.filter((b) => seen.has(b));
  fn.computePreds();
  return true;
}

export function simplifyCFG(fn: Func, opts: { ifConvert?: boolean } = {}, log?: PassLog): boolean {
  let any = false;
  for (let changed = true; changed; ) {
    changed = false;
    fn.computePreds();
    for (const b of fn.blocks) {
      const t = b.terminator!;
      // condbr on a constant, or with identical targets -> br
      if (t.op === 'condbr') {
        const c = t.args[0];
        if (c instanceof Const || t.blocks[0] === t.blocks[1]) {
          const keep = c instanceof Const ? (c.v ? t.blocks[0] : t.blocks[1]) : t.blocks[0];
          const drop = c instanceof Const ? (c.v ? t.blocks[1] : t.blocks[0]) : undefined;
          if (drop && drop !== keep) removePhiIncoming(drop, b);
          t.op = 'br';
          t.args = [];
          t.blocks = [keep];
          log?.msgs.push(`${b.name}: branch ${c instanceof Const ? 'on constant' : 'with identical targets'} folded to 'br ${keep.name}'`);
          changed = true;
        }
      }
    }
    if (changed) { removeUnreachable(fn, log); any = true; continue; }

    for (const b of fn.blocks) {
      // merge b into its unique predecessor when that predecessor has b as unique successor
      if (b === fn.entry || b.preds.length !== 1) continue;
      const p = b.preds[0];
      if (p.succs.length !== 1 || p === b) continue;
      for (const phi of b.phis) {
        fn.replaceAllUses(phi, phi.args[0]);
        b.remove(phi);
      }
      p.instrs.pop();
      for (const i of b.instrs) { i.block = p; p.instrs.push(i); }
      for (const s of b.succs) for (const phi of s.phis) phi.blocks = phi.blocks.map((x) => (x === b ? p : x));
      fn.blocks.splice(fn.blocks.indexOf(b), 1);
      log?.msgs.push(`merged ${b.name} into its only predecessor ${p.name}`);
      changed = true;
      break;
    }
    if (changed) { any = true; continue; }

    for (const b of fn.blocks) {
      // forward empty blocks: b = { br T }
      if (b === fn.entry || b.instrs.length !== 1 || b.terminator!.op !== 'br') continue;
      const T = b.succs[0];
      if (T === b) continue;
      const phis = T.phis;
      const ok = b.preds.every((P) => {
        if (!T.preds.includes(P)) return true;
        return phis.every((phi) => phi.args[phi.blocks.indexOf(P)] === phi.args[phi.blocks.indexOf(b)]);
      }) && !b.preds.some((P) => P.terminator!.op === 'condbr' && P.succs.includes(T) && phis.length > 0);
      if (!ok || !b.preds.length) continue;
      for (const phi of phis) {
        const k = phi.blocks.indexOf(b);
        const v = phi.args[k];
        phi.args.splice(k, 1);
        phi.blocks.splice(k, 1);
        for (const P of b.preds) {
          if (!phi.blocks.includes(P)) { phi.args.push(v); phi.blocks.push(P); }
        }
      }
      for (const P of b.preds) P.terminator!.blocks = P.terminator!.blocks.map((x) => (x === b ? T : x));
      fn.blocks.splice(fn.blocks.indexOf(b), 1);
      log?.msgs.push(`forwarded empty block ${b.name}: predecessors now jump straight to ${T.name}`);
      changed = true;
      break;
    }
    if (changed) { any = true; continue; }

    if (opts.ifConvert) {
      for (const b of fn.blocks) if (ifConvert(fn, b, log)) { changed = true; any = true; break; }
    }
  }
  fn.computePreds();
  return any;
}

const cheap = (i: Instr) => i.isPure && i.op !== 'sdiv' && i.op !== 'srem';

/**
 * If-conversion: turn
 *     head: condbr %c, A, B      A: <few pure instrs> br J      B: ... br J
 *     J: %x = phi [%a, A], [%b, B]
 * into straight-line code with `select`. Also handles triangles (one arm empty).
 */
function ifConvert(fn: Func, head: Block, log?: PassLog): boolean {
  const t = head.terminator!;
  if (t.op !== 'condbr') return false;
  const [A, B] = t.blocks;
  const armOk = (X: Block) => X.preds.length === 1 && X.succs.length === 1 && X.instrs.length <= 3 && X.instrs.slice(0, -1).every(cheap);
  let J: Block | undefined, arms: Block[];
  if (armOk(A) && armOk(B) && A.succs[0] === B.succs[0]) { J = A.succs[0]; arms = [A, B]; }
  else if (armOk(A) && A.succs[0] === B) { J = B; arms = [A]; }
  else if (armOk(B) && B.succs[0] === A) { J = A; arms = [B]; }
  else return false;
  if (J.preds.length !== 2 || J === head) return false;
  const phis = J.phis;
  if (!phis.length || phis.length > 2) return false;
  // hoist arm instructions into head (they are pure, so speculation is safe)
  for (const X of arms) {
    for (const i of X.instrs.slice(0, -1)) {
      i.block = head;
      head.insertBefore(i, t);
      i.note = `speculated out of ${X.name} by if-conversion`;
    }
    X.instrs = X.instrs.slice(-1);
  }
  const fromTrue = arms.includes(A) ? A : head;
  const fromFalse = arms.includes(B) ? B : head;
  for (const phi of phis) {
    const vt = phi.args[phi.blocks.indexOf(fromTrue)];
    const vf = phi.args[phi.blocks.indexOf(fromFalse)];
    const sel = fn.newInstr('select', 'i64', [t.args[0], vt, vf], { name: phi.name, line: phi.line, note: `if-converted from phi in ${J.name}` });
    sel.block = head;
    head.insertBefore(sel, t);
    fn.replaceAllUses(phi, sel);
    J.remove(phi);
  }
  t.op = 'br';
  t.args = [];
  t.blocks = [J];
  for (const X of arms) fn.blocks.splice(fn.blocks.indexOf(X), 1);
  fn.computePreds();
  log?.msgs.push(`if-converted the branch in ${head.name} into ${phis.length} select(s)`);
  return true;
}
