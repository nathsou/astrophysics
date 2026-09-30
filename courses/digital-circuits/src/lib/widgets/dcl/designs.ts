/**
 * The reference designs of `content/designs/*.dcl`, available to widgets by path
 * (`::dcl-playground{src="designs/counter.dcl"}`). Loaded eagerly: they are a few kilobytes, and the server
 * needs the text to render the code statically.
 */
const files = import.meta.glob('/content/designs/*.dcl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** The source of a design named like `designs/counter.dcl`, `counter.dcl` or `counter`. */
export function designSource(src: string): string | undefined {
  const name = src.replace(/^\/+/, '').replace(/^(content\/)?designs\//, '').replace(/\.dcl$/, '');
  return files[`/content/designs/${name}.dcl`];
}

export function designNames(): string[] {
  return Object.keys(files).map((f) => f.replace(/^.*\//, '').replace(/\.dcl$/, ''));
}

/** The file name to show for a `src`: `designs/counter` → `counter.dcl`. */
export function designFile(src: string | undefined): string {
  if (!src) return 'design.dcl';
  const base = src.replace(/^.*\//, '');
  return base.endsWith('.dcl') ? base : `${base}.dcl`;
}
