# Vouch for VS Code

A minimal client for the Vouch language server of the course *For All Inputs* (`courses/formal-verification`).

1. In `courses/formal-verification`, run `npm ci` once.
2. In this folder, run `npm install`.
3. In VS Code, run **Developer: Install Extension from Location…** and pick this folder.
4. Open a `.vouch` file. If the course is somewhere else, set `vouch.courseDirectory`.

You get the same language server as the course's Workbench: diagnostics as you type, hover with types and
contracts, completion, signature help, go to definition, find references, rename, document symbols, semantic
highlighting, inlay hints, quick fixes, and verification results (failed properties as errors, a summary of the
badges in the status bar). Neovim and Helix setups are in `docs/VOUCH.md`.
