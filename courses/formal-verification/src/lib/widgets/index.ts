// Widgets shared across chapters (chapter-specific ones live in content/chapters/<ch>/widgets/).
// Each export is used in Markdown as `::kebab-name{prop=…}` (see tools/markdown/compile.ts).
// Per-area widget files are re-exported here so that work on different parts does not collide on this file.
export * from './site.ts';
