/**
 * The language server in a Web Worker: messages arrive as JSON strings (the @codemirror/lsp-client transport
 * format) and replies go back the same way.
 */
import { VouchLanguageServer } from './server';

const server = new VouchLanguageServer({ send: (m) => postMessage(JSON.stringify(m)) });
addEventListener('message', (e: MessageEvent<string>) => {
  server.handle(JSON.parse(e.data));
});
