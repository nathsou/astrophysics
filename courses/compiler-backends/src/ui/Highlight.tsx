import type { ReactElement, ReactNode } from 'react';

const KW = /^(const|let|var|function|return|if|else|for|while|do|of|in|new|class|extends|implements|interface|type|export|import|from|as|switch|case|break|continue|default|throw|try|catch|finally|this|null|undefined|true|false|void|typeof|keyof|readonly|public|private|static|async|await|yield|number|string|boolean|bigint)$/;

/** Minimal TypeScript/C-ish highlighter for fenced code blocks. */
export function highlightTS(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/.*$|\/\*[\s\S]*?\*\/|`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|\b\d+n?\b|\b0x[0-9a-fA-F]+n?\b|[A-Za-z_$][\w$]*|\s+|.)/gm;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code))) {
    const s = m[0];
    let c: string | undefined;
    if (s.startsWith('//') || s.startsWith('/*')) c = 't-comment';
    else if (/^[`'"]/.test(s)) c = 't-imm';
    else if (/^(0x[0-9a-fA-F]+n?|\d+n?)$/.test(s)) c = 't-imm';
    else if (KW.test(s)) c = 't-kw';
    else if (/^[A-Z][\w$]*$/.test(s)) c = 't-sym';
    else if (/^[A-Za-z_$][\w$]*$/.test(s) && code[m.index + s.length] === '(') c = 't-label';
    out.push(c ? <span key={k++} className={c}>{s}</span> : s);
  }
  return out;
}

export function Pre(p: { children?: ReactNode }) {
  const child = p.children as ReactElement<{ className?: string; children?: string }> | undefined;
  const lang = child?.props?.className?.replace('language-', '');
  const text = typeof child?.props?.children === 'string' ? child.props.children : undefined;
  if (text !== undefined && lang && ['ts', 'typescript', 'js', 'c', 'rust'].includes(lang)) {
    return <pre className="wide inv" style={{ maxWidth: 'var(--col)' }}><code>{highlightTS(text.replace(/\n$/, ''))}</code></pre>;
  }
  return <pre className="inv">{p.children}</pre>;
}
