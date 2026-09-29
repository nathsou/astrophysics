/** Completions from the analysis: keywords, names in scope, ports of an instance, members. */
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { Analysis } from './analysis';
import { completionsAt } from './queries';

export function dclCompletion(get: () => Analysis | undefined) {
  const source = (ctx: CompletionContext): CompletionResult | null => {
    const a = get();
    if (!a) return null;
    const r = completionsAt(a, ctx.state.doc.toString(), ctx.pos);
    if (!r || !r.options.length) return null;
    if (!ctx.explicit && r.from === ctx.pos && !/[.(,:]\s*$|(^|\n)\s*$/.test(ctx.state.doc.sliceString(Math.max(0, ctx.pos - 40), ctx.pos))) return null;
    return { from: r.from, options: r.options.map((o) => ({ label: o.label, type: o.type, detail: o.detail, info: o.info, apply: o.apply, boost: o.boost })), validFor: /^[A-Za-z_][A-Za-z0-9_]*$/ };
  };
  return autocompletion({ override: [source], icons: true, activateOnTyping: true, maxRenderedOptions: 40 });
}
