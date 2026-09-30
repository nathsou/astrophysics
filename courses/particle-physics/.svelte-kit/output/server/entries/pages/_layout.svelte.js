import "../../chunks/internal.js";
import { o as base } from "../../chunks/internal2.js";
import { C as escape_html, S as attr, a as ensure_array_like, i as derived, l as stringify, t as attr_class } from "../../chunks/server.js";
import { t as nav } from "../../chunks/nav.svelte.js";
import { i as PARTS, n as COURSE_SUBTITLE, r as COURSE_TITLE } from "../../chunks/outline.js";
import "../../chunks/paths.js";
import { n as afterNavigate, t as page } from "../../chunks/state.js";
import { t as Icon } from "../../chunks/Icon.js";
import { t as ALL_ENTRIES } from "../../chunks/registry.js";
//#region src/lib/state/theme.svelte.ts
function read() {
	try {
		const t = localStorage.getItem("theme");
		return t === "light" || t === "dark" ? t : "system";
	} catch {
		return "system";
	}
}
function readPaper() {
	try {
		return localStorage.getItem("paper") === "white" ? "white" : "default";
	} catch {
		return "default";
	}
}
var Theme = class {
	choice = "system";
	paper = "default";
	/** The theme actually shown (resolves `system`). */
	resolved = "light";
	init() {
		this.choice = read();
		this.paper = readPaper();
		const mq = matchMedia("(prefers-color-scheme: dark)");
		const update = () => {
			this.resolved = this.choice === "system" ? mq.matches ? "dark" : "light" : this.choice;
		};
		mq.addEventListener("change", update);
		update();
		addEventListener("storage", (e) => {
			if (e.key === "paper") {
				this.paper = readPaper();
				this.applyPaper();
				return;
			}
			if (e.key !== "theme") return;
			this.choice = read();
			if (this.choice === "system") delete document.documentElement.dataset.theme;
			else document.documentElement.dataset.theme = this.choice;
			update();
		});
	}
	set(choice) {
		this.choice = choice;
		try {
			if (choice === "system") localStorage.removeItem("theme");
			else localStorage.setItem("theme", choice);
		} catch {}
		if (choice === "system") delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = choice;
		this.resolved = choice === "system" ? matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : choice;
	}
	setPaper(paper) {
		this.paper = paper;
		try {
			if (paper === "white") localStorage.setItem("paper", "white");
			else localStorage.removeItem("paper");
		} catch {}
		this.applyPaper();
	}
	applyPaper() {
		if (this.paper === "white") document.documentElement.dataset.paper = "white";
		else delete document.documentElement.dataset.paper;
	}
	cycle() {
		this.set(this.choice === "system" ? this.resolved === "dark" ? "light" : "dark" : this.choice === "dark" ? "light" : "system");
	}
};
var theme = new Theme();
//#endregion
//#region src/lib/components/layout/TopBar.svelte
function TopBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let scrolled = false;
		const onControl = derived(() => page.url.pathname.startsWith(`${base}/control-room`));
		const home = derived(() => page.url.pathname.replace(/\/$/, "") === base);
		const onUnits = derived(() => page.url.pathname.startsWith(`${base}/units`));
		$$renderer.push(`<header${attr_class("topbar ui svelte-11yu8dz", void 0, { "scrolled": scrolled })}><button class="icon-btn menu svelte-11yu8dz" aria-label="Open navigation"${attr("aria-expanded", nav.sidebarOpen)}>`);
		Icon($$renderer, { name: "menu" });
		$$renderer.push(`<!----></button> `);
		if (!home()) {
			$$renderer.push(`<!--[0--><button class="icon-btn collapse svelte-11yu8dz"${attr("aria-label", nav.sidebarCollapsed ? "Show the chapter list" : "Hide the chapter list")}${attr("aria-expanded", !nav.sidebarCollapsed)}${attr("title", nav.sidebarCollapsed ? "Show the chapter list" : "Hide the chapter list")}>`);
			Icon($$renderer, { name: "sidebar" });
			$$renderer.push(`<!----></button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <a class="brand svelte-11yu8dz"${attr("href", `${stringify(base)}/`)}><svg class="mark svelte-11yu8dz" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" class="tile svelte-11yu8dz"></rect><path d="M6 26C8 14 14 8 26 6" class="base svelte-11yu8dz"></path><path d="M6 26c4-1 9-5 11-10 1.5-3.6 1.5-6.6 0-9" class="wave svelte-11yu8dz"></path></svg> <span class="name svelte-11yu8dz">${escape_html(COURSE_TITLE)}</span></a> <span class="page-title svelte-11yu8dz"${attr("aria-hidden", true)}>${escape_html(nav.pageTitle ?? "")}</span> <span class="spacer svelte-11yu8dz"></span> <a${attr_class("icon-btn svelte-11yu8dz", void 0, { "current": onControl() })}${attr("href", `${stringify(base)}/control-room/`)} aria-label="The Control Room"${attr("aria-current", onControl() ? "page" : void 0)} title="The Control Room: run the whole pipeline">`);
		Icon($$renderer, { name: "control" });
		$$renderer.push(`<!----></a> <a${attr_class("icon-btn svelte-11yu8dz", void 0, { "current": onUnits() })}${attr("href", `${stringify(base)}/units/`)} aria-label="Units and constants"${attr("aria-current", onUnits() ? "page" : void 0)} title="Units and constants: the natural-units converter">`);
		Icon($$renderer, { name: "units" });
		$$renderer.push(`<!----></a> `);
		if (theme.resolved === "light") {
			$$renderer.push(`<!--[0--><button${attr_class("icon-btn svelte-11yu8dz", void 0, { "current": theme.paper === "white" })}${attr("aria-pressed", theme.paper === "white")} aria-label="White page background"${attr("title", theme.paper === "white" ? "Back to the warm paper background" : "Use a plain white page background")}>`);
			Icon($$renderer, { name: "page" });
			$$renderer.push(`<!----></button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <button class="icon-btn svelte-11yu8dz"${attr("aria-label", `Switch to ${theme.resolved === "dark" ? "light" : "dark"} theme`)}${attr("title", `Switch to ${theme.resolved === "dark" ? "light" : "dark"} theme`)}>`);
		Icon($$renderer, { name: theme.resolved === "dark" ? "sun" : "moon" });
		$$renderer.push(`<!----></button></header>`);
	});
}
//#endregion
//#region src/lib/components/layout/Sidebar.svelte
function Sidebar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const appendices = ALL_ENTRIES.filter((e) => e.kind === "appendix");
		const byKey = new Map(ALL_ENTRIES.map((e) => [`${e.kind}:${e.slug}`, e]));
		const current = derived(() => page.url.pathname.replace(base, ""));
		const isCurrent = (href) => current() === href || current() === href.slice(0, -1);
		function item($$renderer, key) {
			const e = byKey.get(key);
			const here = isCurrent(e.href);
			$$renderer.push(`<li${attr_class("svelte-6dohdz", void 0, {
				"here": here,
				"planned": !e.available
			})}>`);
			if (e.available) $$renderer.push(`<!--[0--><a${attr("href", `${stringify(base)}${stringify(e.href)}`)}${attr("aria-current", here ? "page" : void 0)} class="svelte-6dohdz"><span class="n svelte-6dohdz">${escape_html(e.number)}</span><span>${escape_html(e.title)}</span></a>`);
			else $$renderer.push(`<!--[-1--><span class="row svelte-6dohdz" title="Coming soon"><span class="n svelte-6dohdz">${escape_html(e.number)}</span><span>${escape_html(e.title)}</span></span>`);
			$$renderer.push(`<!--]--> `);
			if (here && nav.toc.length) {
				$$renderer.push(`<!--[0--><ul class="toc svelte-6dohdz"><!--[-->`);
				const each_array = ensure_array_like(nav.toc.filter((t) => t.depth === 2));
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let t = each_array[$$index];
					$$renderer.push(`<li${attr_class("svelte-6dohdz", void 0, { "active": nav.activeId === t.id })}><a${attr("href", `#${stringify(t.id)}`)} class="svelte-6dohdz">${escape_html(t.text)}</a></li>`);
				}
				$$renderer.push(`<!--]--></ul>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></li>`);
		}
		$$renderer.push(`<div${attr_class("scrim svelte-6dohdz", void 0, { "open": nav.sidebarOpen })}></div> <nav${attr_class("sidebar ui svelte-6dohdz", void 0, { "open": nav.sidebarOpen })} aria-label="Course contents"><!--[-->`);
		const each_array_1 = ensure_array_like(PARTS);
		for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
			let part = each_array_1[$$index_2];
			$$renderer.push(`<section class="svelte-6dohdz"><h2 class="svelte-6dohdz">`);
			if (part.id !== "0" && part.id !== "E") $$renderer.push(`<!--[0--><span class="part svelte-6dohdz">Part ${escape_html(part.id)}</span>`);
			else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <span class="ptitle svelte-6dohdz">${escape_html(part.title)}</span></h2> <ul class="trace svelte-6dohdz"><!--[-->`);
			const each_array_2 = ensure_array_like(part.chapters);
			for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
				let c = each_array_2[$$index_1];
				item($$renderer, `chapter:${c.slug}`);
			}
			$$renderer.push(`<!--]--></ul></section>`);
		}
		$$renderer.push(`<!--]--> <section class="svelte-6dohdz"><h2 class="svelte-6dohdz"><span class="ptitle svelte-6dohdz">Appendices</span></h2> <ul class="trace svelte-6dohdz"><!--[-->`);
		const each_array_3 = ensure_array_like(appendices);
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let a = each_array_3[$$index_3];
			item($$renderer, `appendix:${a.slug}`);
		}
		$$renderer.push(`<!--]--></ul></section></nav>`);
	});
}
//#endregion
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { children } = $$props;
		const home = derived(() => page.url.pathname.replace(/\/$/, "") === base);
		afterNavigate(() => nav.sidebarOpen = false);
		$$renderer.push(`<a class="skip ui svelte-12qhfyh" href="#main">Skip to content</a> `);
		TopBar($$renderer, {});
		$$renderer.push(`<!----> <div${attr_class("shell svelte-12qhfyh", void 0, { "home": home() })}>`);
		Sidebar($$renderer, {});
		$$renderer.push(`<!----> <main id="main" class="svelte-12qhfyh">`);
		children($$renderer);
		$$renderer.push(`<!----></main></div> <footer class="foot ui svelte-12qhfyh"><svg class="trace svelte-12qhfyh" viewBox="0 0 120 12" aria-hidden="true"><path d="M0 9h14V3h14v6h14V3h14v6h64" class="svelte-12qhfyh"></path></svg> <p class="t svelte-12qhfyh">${escape_html(COURSE_TITLE)}</p> <p class="s svelte-12qhfyh">${escape_html(COURSE_SUBTITLE)}</p></footer>`);
	});
}
//#endregion
export { _layout as default };
