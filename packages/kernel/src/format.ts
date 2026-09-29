import type { Environment } from './core/env.ts';
import type { Msg } from './core/typechecker.ts';
import { pp } from './core/pretty.ts';
import type { Message } from './frontend.ts';
import type { LocalDecl } from './core/env.ts';
import { exprEq } from './core/expr.ts';

/** consecutive hypotheses with the same type, shown on one line as in Lean: `p q r : Prop` */
export function groupHyps(decls: readonly LocalDecl[]): LocalDecl[][] {
  const out: LocalDecl[][] = [];
  for (const d of decls) {
    const last = out[out.length - 1];
    if (last && !d.value && !last[0].value && exprEq(last[0].type, d.type)) last.push(d);
    else out.push([d]);
  }
  return out;
}

export function formatMsg(env: Environment, msg: Msg): string {
  return msg
    .map((p) => {
      if (typeof p === 'string') return p;
      try {
        return pp(env, p.e, p.lctx, p.explicit ? { explicit: true } : {});
      } catch (e) {
        return `‹unprintable: ${(e as Error).message}›`;
      }
    })
    .join('');
}

export function formatMessage(env: Environment, src: string, m: Message): string {
  const line = src.slice(0, m.span.from).split('\n').length;
  let s = `${m.severity} (line ${line}): ${formatMsg(env, m.msg)}`;
  for (const g of m.goals ?? []) {
    s += '\n  goal' + (g.name ? ` ?${g.name}` : '') + ':\n';
    for (const grp of groupHyps(g.lctx.decls)) s += `    ${grp.map((d) => d.name).join(' ')} : ${pp(env, grp[0].type, g.lctx)}\n`;
    s += `    ⊢ ${pp(env, g.type, g.lctx)}`;
  }
  return s;
}
