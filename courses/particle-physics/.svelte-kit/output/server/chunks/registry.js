import { i as PARTS, t as APPENDICES } from "./outline.js";
//#region src/lib/content/registry.ts
var chapterFiles = /* #__PURE__ */ Object.assign({ "/content/chapters/02-relativity-for-particles/index.md": () => import("./02-relativity-for-particles.js") });
var appendixFiles = /* #__PURE__ */ Object.assign({});
var slugOf = (p) => p.split("/").at(-2).replace(/^[0-9a-z]{1,2}-/, "");
var loaders = {
	chapter: new Map(Object.entries(chapterFiles).map(([p, l]) => [slugOf(p), l])),
	appendix: new Map(Object.entries(appendixFiles).map(([p, l]) => [slugOf(p), l]))
};
var chapterEntries = PARTS.flatMap((part) => part.chapters.map((c) => ({
	...c,
	kind: "chapter",
	part: part.id,
	available: loaders.chapter.has(c.slug),
	href: `/chapters/${c.slug}/`
})));
var appendixEntries = APPENDICES.map((a) => ({
	...a,
	kind: "appendix",
	available: loaders.appendix.has(a.slug),
	href: `/appendix/${a.slug}/`
}));
/** Reading order: chapters, then appendices. */
var ALL_ENTRIES = [...chapterEntries, ...appendixEntries];
function findEntry(kind, slug) {
	return ALL_ENTRIES.find((e) => e.kind === kind && e.slug === slug);
}
function loadContent(kind, slug) {
	return loaders[kind].get(slug);
}
function availableSlugs(kind) {
	return [...loaders[kind].keys()];
}
/** Previous/next *available* entries for page navigation. */
function neighbours(kind, slug) {
	const list = ALL_ENTRIES.filter((e) => e.available);
	const i = list.findIndex((e) => e.kind === kind && e.slug === slug);
	return {
		prev: i > 0 ? list[i - 1] : void 0,
		next: i >= 0 ? list[i + 1] : void 0
	};
}
//#endregion
export { neighbours as a, loadContent as i, availableSlugs as n, findEntry as r, ALL_ENTRIES as t };
