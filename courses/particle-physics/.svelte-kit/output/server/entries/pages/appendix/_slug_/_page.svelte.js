import "../../../../chunks/server.js";
import { t as ChapterPage } from "../../../../chunks/ChapterPage.js";
//#region src/routes/appendix/[slug]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { data } = $$props;
		$$renderer.push(`<!---->`);
		ChapterPage($$renderer, {
			mod: data.mod,
			entry: data.entry
		});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
export { _page as default };
