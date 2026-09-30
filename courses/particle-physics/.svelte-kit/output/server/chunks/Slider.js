import "./internal.js";
import { C as escape_html, S as attr, d as html, i as derived, l as stringify, n as attr_style, p as createContext, r as bind_props, s as props_id, t as attr_class } from "./server.js";
//#region src/lib/components/content/context.ts
var [getPageDocs, setPageDocs] = createContext();
//#endregion
//#region src/lib/state/params.svelte.ts
var Params = class {
	values = {};
	get(key, fallback) {
		return this.values[key] ?? fallback;
	}
	set(key, value) {
		this.values[key] = value;
	}
	/** Set the value only if no one has initialised it yet. */
	init(key, value) {
		if (!(key in this.values)) this.values[key] = value;
	}
};
var params = new Params();
var Focus = class {
	/** Id of the hovered/pinned equation term, or null. */
	term = null;
	/** Where the focus came from — lets a widget avoid reacting to its own hover. */
	source = null;
	set(term, source = null) {
		this.term = term;
		this.source = source;
	}
};
var focus = new Focus();
//#endregion
//#region src/lib/components/ui/Slider.svelte
function Slider($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const id = props_id($$renderer);
		let { value = void 0, min, max, step = .01, log = false, label, labelHtml, format = (v) => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2), oninput, compact = false, children } = $$props;
		const toPos = (v) => log ? Math.log(v) : v;
		const pos = derived(() => toPos(value));
		const fill = derived(() => (pos() - toPos(min)) / (toPos(max) - toPos(min)) * 100);
		$$renderer.push(`<div${attr_class("slider ui svelte-jchife", void 0, { "compact": compact })}><label${attr("for", id)} class="svelte-jchife">`);
		if (labelHtml) $$renderer.push(`<!--[0--><span class="lbl svelte-jchife">${html(labelHtml)}</span>`);
		else if (label) $$renderer.push(`<!--[1--><span class="lbl svelte-jchife">${escape_html(label)}</span>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		children?.($$renderer);
		$$renderer.push(`<!----> <output${attr("for", id)} class="num svelte-jchife">${escape_html(format(value))}</output></label> <input${attr("id", id)} type="range"${attr("min", toPos(min))}${attr("max", toPos(max))}${attr("step", log ? (toPos(max) - toPos(min)) / 500 : step)}${attr("value", pos())} class="svelte-jchife"${attr_style("", { "--fill": `${stringify(fill())}%` })}/></div>`);
		bind_props($$props, { value });
	});
}
//#endregion
export { setPageDocs as i, focus as n, params as r, Slider as t };
