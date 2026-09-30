import { C as escape_html, o as head } from "../../../chunks/server.js";
import { r as COURSE_TITLE } from "../../../chunks/outline.js";
//#region src/routes/control-room/+page.svelte
function _page($$renderer) {
	head("1uem6xk", $$renderer, ($$renderer) => {
		$$renderer.title(($$renderer) => {
			$$renderer.push(`<title>control-room · ${escape_html(COURSE_TITLE)}</title>`);
		});
	});
	$$renderer.push(`<div class="page svelte-1uem6xk"><h1>control-room</h1><p>Coming soon.</p></div>`);
}
//#endregion
export { _page as default };
