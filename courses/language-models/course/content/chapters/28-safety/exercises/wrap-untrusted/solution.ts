/**
 * Prepare text from an untrusted source (a web page, an email, a tool result) for a model's prompt:
 * between <untrusted> and </untrusted> tags, with every line prefixed by "^ " (so the model can tell, line by
 * line, that the text is data), and with "<" and ">" in the text replaced by "‹" and "›", so that the text cannot
 * close the tag itself.
 */
export function wrapUntrusted(text: string): string {
  const safe = text.replace(/</g, '‹').replace(/>/g, '›');
  const marked = safe
    .split('\n')
    .map((line) => `^ ${line}`)
    .join('\n');
  return `<untrusted>\n${marked}\n</untrusted>`;
}
