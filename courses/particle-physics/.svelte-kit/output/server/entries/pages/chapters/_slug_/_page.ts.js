import { i as loadContent, n as availableSlugs, r as findEntry } from "../../../../chunks/registry.js";
import { error } from "@sveltejs/kit";
//#region src/routes/chapters/[slug]/+page.ts
var entries = () => availableSlugs("chapter").map((slug) => ({ slug }));
var load = async ({ params }) => {
	const loader = loadContent("chapter", params.slug);
	const entry = findEntry("chapter", params.slug);
	if (!loader || !entry) error(404, "Not written yet");
	return {
		mod: await loader(),
		entry
	};
};
//#endregion
export { entries, load };
