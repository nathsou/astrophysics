import "./internal.js";
import { o as base } from "./internal2.js";
import { C as escape_html, S as attr, a as ensure_array_like, d as html, i as derived, l as stringify, n as attr_style, o as head, t as attr_class } from "./server.js";
import "./nav.svelte.js";
import { i as PARTS, r as COURSE_TITLE } from "./outline.js";
import "./paths.js";
import { t as Icon } from "./Icon.js";
import { a as neighbours, r as findEntry } from "./registry.js";
import { i as setPageDocs, n as focus, r as params, t as Slider } from "./Slider.js";
//#region src/lib/components/content/TermCard.svelte
function TermCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { def, anchor, pinned, onclose, onenter, onleave } = $$props;
		let pos = {
			top: 0,
			left: 0,
			above: false
		};
		const p = derived(() => def.param);
		$$renderer.push(`<div${attr_class("term-card ui svelte-1qida5u", void 0, {
			"pinned": pinned,
			"above": pos.above
		})} role="dialog" aria-label="Term explanation" tabindex="-1"${attr_style("", {
			top: `${stringify(pos.top)}px`,
			left: `${stringify(pos.left)}px`
		})}><header class="svelte-1qida5u"><div class="label svelte-1qida5u">${html(def.label)}</div> `);
		if (pinned) {
			$$renderer.push(`<!--[0--><button class="close svelte-1qida5u" aria-label="Close">`);
			Icon($$renderer, {
				name: "close",
				size: 15
			});
			$$renderer.push(`<!----></button>`);
		} else $$renderer.push(`<!--[-1--><span class="hint svelte-1qida5u">click to pin</span>`);
		$$renderer.push(`<!--]--></header> <dl class="svelte-1qida5u"><dt class="svelte-1qida5u">What</dt> <dd class="svelte-1qida5u">${html(def.what)}</dd> `);
		if (def.why) $$renderer.push(`<!--[0--><dt class="svelte-1qida5u">Why it’s here</dt> <dd class="svelte-1qida5u">${html(def.why)}</dd>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (def.effect) $$renderer.push(`<!--[0--><dt class="svelte-1qida5u">If you change it</dt> <dd class="svelte-1qida5u">${html(def.effect)}</dd>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></dl> `);
		if (p()) {
			$$renderer.push(`<!--[0--><div class="param svelte-1qida5u">`);
			Slider($$renderer, {
				min: p().min,
				max: p().max,
				step: p().step,
				log: p().log,
				value: params.get(p().key, p().value),
				oninput: (v) => params.set(p().key, v),
				label: "Try it — linked to the figures on this page"
			});
			$$renderer.push(`<!----></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/content/TermLayer.svelte
function TermLayer($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { docs, children } = $$props;
		setPageDocs(docs);
		let active = null;
		let hideTimer;
		function scheduleHide() {
			clearTimeout(hideTimer);
			hideTimer = setTimeout(() => {
				if (active && !active.pinned) close();
			}, 180);
		}
		function close() {
			active = null;
			if (focus.source === "equation") focus.set(null);
		}
		$$renderer.push(`<div class="term-layer">`);
		children($$renderer);
		$$renderer.push(`<!----></div> `);
		if (active && docs.terms[active.id]) {
			$$renderer.push("<!--[0-->");
			TermCard($$renderer, {
				def: docs.terms[active.id],
				anchor: active.el,
				pinned: active.pinned,
				onclose: close,
				onenter: () => clearTimeout(hideTimer),
				onleave: scheduleHide
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/layout/ChapterPage.svelte
function ChapterPage($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { mod, entry } = $$props;
		const Content = derived(() => mod.default);
		const meta = derived(() => mod.metadata);
		const part = derived(() => PARTS.find((p) => p.id === entry.part));
		const around = derived(() => neighbours(entry.kind, entry.slug));
		const eyebrow = derived(() => entry.kind === "appendix" ? `Appendix ${entry.number}` : `Chapter ${entry.number}${part() ? part().id === "0" || part().id === "E" ? ` · ${part().title}` : ` · Part ${part().id} — ${part().title}` : ""}`);
		const chipLabel = derived(() => entry.kind === "appendix" ? `APP-${entry.number}` : `CH-${entry.number.padStart(2, "0")}`);
		const chipSub = derived(() => entry.kind === "appendix" ? "REFERENCE" : part() ? part().id === "0" ? "PROLOGUE" : part().id === "E" ? "EPILOGUE" : `PART ${part().id}` : "");
		const PINS = [
			0,
			1,
			2,
			3,
			4,
			5,
			6
		];
		const prereqs = derived(() => (meta().prerequisites ?? []).map((s) => findEntry("chapter", s) ?? findEntry("appendix", s)).filter((e) => e !== void 0));
		head("1qc2rjx", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(entry.number)}. ${escape_html(meta().title)} — ${escape_html(COURSE_TITLE)}</title>`);
			});
			$$renderer.push(`<meta name="description"${attr("content", meta().summary)}/>`);
		});
		$$renderer.push(`<article class="article svelte-1qc2rjx"><header class="chapter-head wide svelte-1qc2rjx"><svg class="dip svelte-1qc2rjx" viewBox="0 0 176 116" aria-hidden="true"><!--[-->`);
		const each_array = ensure_array_like(PINS);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let i = each_array[$$index];
			$$renderer.push(`<rect class="pin svelte-1qc2rjx"${attr("x", 21 + i * 21)} y="4" width="9" height="16" rx="1.5"></rect><rect class="pin svelte-1qc2rjx"${attr("x", 21 + i * 21)} y="96" width="9" height="16" rx="1.5"></rect>`);
		}
		$$renderer.push(`<!--]--><rect class="pkg svelte-1qc2rjx" x="6" y="16" width="164" height="84" rx="5"></rect><path class="notch svelte-1qc2rjx" d="M6 48a10 10 0 0 1 0 20"></path><circle class="dot svelte-1qc2rjx" cx="20" cy="86" r="3.2"></circle><text class="ref svelte-1qc2rjx" x="92" y="56" text-anchor="middle">${escape_html(chipLabel())}</text><text class="sub svelte-1qc2rjx" x="92" y="76" text-anchor="middle">${escape_html(chipSub())}</text></svg> <div class="head-text svelte-1qc2rjx"><p class="eyebrow svelte-1qc2rjx">${escape_html(eyebrow())}</p> <h1 class="svelte-1qc2rjx">${escape_html(meta().title)}</h1> <p class="summary svelte-1qc2rjx">${escape_html(meta().summary)}</p> <div class="meta ui svelte-1qc2rjx">`);
		if (meta().duration) {
			$$renderer.push(`<!--[0--><span class="svelte-1qc2rjx">`);
			Icon($$renderer, {
				name: "history",
				size: 14
			});
			$$renderer.push(`<!----> ${escape_html(meta().duration)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (prereqs().length) {
			$$renderer.push(`<!--[0--><span class="assumes svelte-1qc2rjx">Assumes: <!--[-->`);
			const each_array_1 = ensure_array_like(prereqs());
			for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
				let p = each_array_1[i];
				if (i) $$renderer.push(`<!--[0-->, `);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
				if (p.available) $$renderer.push(`<!--[0--><a${attr("href", `${stringify(base)}${stringify(p.href)}`)}>${escape_html(p.number)}. ${escape_html(p.title)}</a>`);
				else $$renderer.push(`<!--[-1--><span title="Coming soon" class="svelte-1qc2rjx">${escape_html(p.number)}. ${escape_html(p.title)}</span>`);
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (meta().theorems?.length) {
			$$renderer.push(`<!--[0--><div class="builds ui svelte-1qc2rjx"><span class="label svelte-1qc2rjx">Theorems</span> <!--[-->`);
			const each_array_2 = ensure_array_like(meta().theorems);
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let b = each_array_2[$$index_2];
				$$renderer.push(`<span class="chip thm svelte-1qc2rjx">${escape_html(b)}</span>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (meta().techniques?.length) {
			$$renderer.push(`<!--[0--><div class="builds ui svelte-1qc2rjx"><span class="label svelte-1qc2rjx">Techniques</span> <!--[-->`);
			const each_array_3 = ensure_array_like(meta().techniques);
			for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
				let b = each_array_3[$$index_3];
				$$renderer.push(`<span class="chip svelte-1qc2rjx">${escape_html(b)}</span>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></header> `);
		TermLayer($$renderer, {
			docs: {
				terms: mod.terms,
				references: mod.references,
				glossary: mod.glossary
			},
			children: ($$renderer) => {
				if (Content()) {
					$$renderer.push("<!--[-->");
					Content()($$renderer, {});
					$$renderer.push("<!--]-->");
				} else {
					$$renderer.push("<!--[!-->");
					$$renderer.push("<!--]-->");
				}
			},
			$$slots: { default: true }
		});
		$$renderer.push(`<!----> `);
		if (mod.references.length) {
			$$renderer.push(`<!--[0--><section class="references svelte-1qc2rjx"><h2 id="references">References</h2> <ol class="svelte-1qc2rjx"><!--[-->`);
			const each_array_4 = ensure_array_like(mod.references);
			for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
				let r = each_array_4[$$index_4];
				$$renderer.push(`<li${attr("id", `ref-${stringify(r.key)}`)} class="svelte-1qc2rjx"><span class="authors svelte-1qc2rjx">${escape_html(r.authors)}</span> (${escape_html(r.year)}). `);
				if (r.url) $$renderer.push(`<!--[0--><a${attr("href", r.url)} target="_blank" rel="noopener"><em>${escape_html(r.title)}</em></a>`);
				else $$renderer.push(`<!--[-1--><em>${escape_html(r.title)}</em>`);
				$$renderer.push(`<!--]-->`);
				if (r.venue) $$renderer.push(`<!--[0-->. ${escape_html(r.venue)}`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->. `);
				if (r.note) $$renderer.push(`<!--[0--><span class="note svelte-1qc2rjx">${escape_html(r.note)}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></li>`);
			}
			$$renderer.push(`<!--]--></ol></section>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <nav class="pager ui svelte-1qc2rjx" aria-label="Chapter navigation">`);
		if (around().prev) $$renderer.push(`<!--[0--><a class="prev svelte-1qc2rjx"${attr("href", `${stringify(base)}${stringify(around().prev.href)}`)}><span class="dir svelte-1qc2rjx">← Previous</span><span class="t svelte-1qc2rjx">${escape_html(around().prev.number)}. ${escape_html(around().prev.title)}</span></a>`);
		else $$renderer.push(`<!--[-1--><span></span>`);
		$$renderer.push(`<!--]--> `);
		if (around().next) $$renderer.push(`<!--[0--><a class="next svelte-1qc2rjx"${attr("href", `${stringify(base)}${stringify(around().next.href)}`)}><span class="dir svelte-1qc2rjx">Next →</span><span class="t svelte-1qc2rjx">${escape_html(around().next.number)}. ${escape_html(around().next.title)}</span></a>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></nav></article>`);
	});
}
//#endregion
export { ChapterPage as t };
