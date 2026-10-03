/**
 * The LSP base protocol over byte streams (stdio): each message is a JSON body preceded by a
 * `Content-Length: n\r\n\r\n` header. Used by the command-line server (tools/vouch-cli) for VS Code, Neovim and Helix.
 */
export function frame(message: unknown): string {
  const body = JSON.stringify(message);
  return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
}

/** Incrementally split an incoming byte stream into JSON messages. */
export class MessageReader {
  private buffer = new Uint8Array(0);
  constructor(private onMessage: (m: unknown) => void) {}

  push(chunk: Uint8Array): void {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
    for (;;) {
      const headerEnd = indexOf(this.buffer, [13, 10, 13, 10]);
      if (headerEnd < 0) return;
      const header = new TextDecoder().decode(this.buffer.slice(0, headerEnd));
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const start = headerEnd + 4;
      if (this.buffer.length < start + len) return;
      const body = new TextDecoder().decode(this.buffer.slice(start, start + len));
      this.buffer = this.buffer.slice(start + len);
      this.onMessage(JSON.parse(body));
    }
  }
}

function indexOf(a: Uint8Array, pat: number[]): number {
  outer: for (let i = 0; i + pat.length <= a.length; i++) {
    for (let j = 0; j < pat.length; j++) if (a[i + j] !== pat[j]) continue outer;
    return i;
  }
  return -1;
}
