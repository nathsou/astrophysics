import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/** Syntax colours come from CSS variables so the editor follows the light/dark theme. */
export const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--code-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-fn)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--code-type)' },
  { tag: [t.definition(t.variableName)], color: 'var(--code-def)' },
  { tag: [t.propertyName], color: 'var(--code-prop)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--code-punct)' },
]);
