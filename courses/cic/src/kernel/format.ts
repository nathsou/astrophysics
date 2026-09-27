import type { Environment } from './core/env.ts';
import type { Msg } from './core/typechecker.ts';
import { pp } from './core/pretty.ts';
import type { Message } from './frontend.ts';

export function formatMsg(env: Environment, msg: Msg): string {
  return msg
    .map((p) => {
      if (typeof p === 'string') return p;
      try {
        return pp(env, p.e, p.lctx);
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
    for (const d of g.lctx.decls) s += `    ${d.name} : ${pp(env, d.type, g.lctx)}\n`;
    s += `    ⊢ ${pp(env, g.type, g.lctx)}`;
  }
  return s;
}
