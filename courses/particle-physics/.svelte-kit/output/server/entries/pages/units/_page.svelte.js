import { C as escape_html, o as head } from "../../../chunks/server.js";
import { r as COURSE_TITLE } from "../../../chunks/outline.js";
//#region src/routes/units/+page.svelte
function _page($$renderer) {
	head("l5gxhk", $$renderer, ($$renderer) => {
		$$renderer.title(($$renderer) => {
			$$renderer.push(`<title>units · ${escape_html(COURSE_TITLE)}</title>`);
		});
	});
	$$renderer.push(`<div class="page svelte-l5gxhk"><h1>units</h1><p>Coming soon.</p></div>`);
}
//#endregion
export { _page as default };
