import { i as loadContent, n as availableSlugs, r as findEntry } from "../../../../chunks/registry.js";
import { error } from "@sveltejs/kit";
//#region src/routes/appendix/[slug]/+page.ts
var entries = () => availableSlugs("appendix").map((slug) => ({ slug }));
var load = async ({ params }) => {
	const loader = loadContent("appendix", params.slug);
	const entry = findEntry("appendix", params.slug);
	if (!loader || !entry) error(404, "Not written yet");
	return {
		mod: await loader(),
		entry
	};
};
//#endregion
export { entries, load };
