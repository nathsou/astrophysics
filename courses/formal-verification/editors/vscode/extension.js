// A minimal VS Code client for the Vouch language server. It starts `npm run vouch -- lsp --stdio` in the course
// directory and lets vscode-languageclient do the rest. Install: `npm install` in this folder, then
// "Developer: Install Extension from Location…" (or copy the folder into ~/.vscode/extensions).
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const dir = vscode.workspace.getConfiguration('vouch').get('courseDirectory') || require('path').resolve(__dirname, '../..');
  const serverOptions = {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', '-s', 'vouch', '--', 'lsp', '--stdio'],
    options: { cwd: dir },
    transport: TransportKind.stdio,
  };
  client = new LanguageClient('vouch', 'Vouch', serverOptions, { documentSelector: [{ scheme: 'file', language: 'vouch' }] });
  // Verification verdicts arrive as a custom notification; show the latest in the status bar.
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  context.subscriptions.push(status);
  client.start().then(() => {
    client.onNotification('vouch/verdicts', (p) => {
      const all = p.verdicts.flatMap((d) => d.verdicts);
      const bad = all.filter((v) => v.status === 'violated').length;
      const ok = all.filter((v) => v.status === 'verified').length;
      status.text = `Vouch: ✓ ${ok}  ✗ ${bad}  ? ${all.length - ok - bad}`;
      status.show();
    });
  });
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };
