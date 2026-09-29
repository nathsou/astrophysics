// A minimal XML reader for the Perseus TEI file: elements, attributes and text, nothing more.
// The file has no DTD, no CDATA sections and only the five predefined entities, so a small
// hand-written tokenizer is easier to trust than a general parser configured to keep mixed content.

export interface XmlElement {
  kind: 'element';
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}
export interface XmlText {
  kind: 'text';
  text: string;
}
export type XmlNode = XmlElement | XmlText;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    const v = ENTITIES[e];
    if (v === undefined) throw new Error(`Unknown entity ${m}`);
    return v;
  });
}

export function parseXml(src: string): XmlElement {
  const root: XmlElement = { kind: 'element', name: '#root', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const end = lt === -1 ? src.length : lt;
    if (end > i) stack[stack.length - 1].children.push({ kind: 'text', text: decode(src.slice(i, end)) });
    if (lt === -1) break;
    if (src.startsWith('<!--', lt)) {
      i = src.indexOf('-->', lt) + 3;
      continue;
    }
    if (src.startsWith('<?', lt) || src.startsWith('<!', lt)) {
      i = src.indexOf('>', lt) + 1;
      continue;
    }
    const gt = src.indexOf('>', lt);
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const top = stack.pop();
      if (!top || top.name !== name) throw new Error(`Mismatched </${name}> at ${lt}`);
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const m = /^([^\s]+)/.exec(body)!;
    const el: XmlElement = { kind: 'element', name: m[1], attrs: {}, children: [] };
    for (const a of body.slice(m[1].length).matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)) el.attrs[a[1]] = decode(a[2]);
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
  }
  if (stack.length !== 1) throw new Error(`Unclosed <${stack[stack.length - 1].name}>`);
  return root;
}

export const elements = (n: XmlElement, name?: string): XmlElement[] =>
  n.children.filter((c): c is XmlElement => c.kind === 'element' && (name === undefined || c.name === name));

export function find(n: XmlElement, pred: (e: XmlElement) => boolean): XmlElement | undefined {
  for (const c of n.children) {
    if (c.kind !== 'element') continue;
    if (pred(c)) return c;
    const f = find(c, pred);
    if (f) return f;
  }
  return undefined;
}

export function textOf(n: XmlNode): string {
  return n.kind === 'text' ? n.text : n.children.map(textOf).join('');
}
