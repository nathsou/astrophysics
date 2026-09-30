import { o as base } from "../../chunks/internal2.js";
import { C as escape_html, S as attr, a as ensure_array_like, l as stringify, o as head, t as attr_class } from "../../chunks/server.js";
import { i as PARTS, n as COURSE_SUBTITLE, r as COURSE_TITLE, t as APPENDICES } from "../../chunks/outline.js";
import "../../chunks/paths.js";
import { t as ALL_ENTRIES } from "../../chunks/registry.js";
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const available = new Set(ALL_ENTRIES.filter((e) => e.available).map((e) => `${e.kind}/${e.slug}`));
		const STAGES = [
			{
				n: 1,
				name: "Machine",
				what: "Beams, luminosity, pile-up",
				from: "Part V"
			},
			{
				n: 2,
				name: "Generator",
				what: "Collisions and decays",
				from: "Parts I, IV"
			},
			{
				n: 3,
				name: "Detector",
				what: "Fields, matter, hits",
				from: "Part II"
			},
			{
				n: 4,
				name: "Reconstruction",
				what: "Tracks, jets, leptons",
				from: "Parts II, IV"
			},
			{
				n: 5,
				name: "Trigger",
				what: "Keep one in 40,000",
				from: "Part VII"
			},
			{
				n: 6,
				name: "Analysis",
				what: "Fits, p-values, discovery",
				from: "Part VII"
			}
		];
		const total = PARTS.reduce((n, p) => n + p.chapters.length, 0);
		const done = PARTS.reduce((n, p) => n + p.chapters.filter((c) => available.has(`chapter/${c.slug}`)).length, 0);
		head("1uha8ag", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>${escape_html(COURSE_TITLE)}</title>`);
			});
			$$renderer.push(`<meta name="description" content="An interactive textbook on particle physics. Build a mini-LHC in the browser: a machine, an event generator, a detector, reconstruction, a trigger and an analysis, and find the Higgs boson."/>`);
		});
		$$renderer.push(`<div class="home svelte-1uha8ag"><section class="hero"><p class="eyebrow ui svelte-1uha8ag">An interactive course · ${escape_html(done)} of ${escape_html(total)} chapters</p> <h1 class="svelte-1uha8ag">${escape_html(COURSE_TITLE)}</h1> <p class="sub svelte-1uha8ag">${escape_html(COURSE_SUBTITLE)}</p> <p class="lede svelte-1uha8ag">Particle physics is the study of the smallest things we know of, and the largest machine ever built to see them.
      This course teaches the Standard Model the way physicists found it out: by looking at tracks, measuring them,
      and asking what could have made them. Along the way you build a miniature version of the whole apparatus: a
      collider, a detector, the software that reads it out, and the analysis that turns billions of collisions into
      a discovery.</p> <div class="cta ui svelte-1uha8ag"><a class="primary svelte-1uha8ag"${attr("href", `${stringify(base)}/chapters/${stringify(PARTS[0].chapters[0].slug)}/`)}>Start with chapter 0</a> <a${attr("href", `${stringify(base)}/control-room/`)} class="svelte-1uha8ag">The Control Room</a></div></section> <section class="pipe svelte-1uha8ag" aria-labelledby="pipe-h"><h2 id="pipe-h" class="svelte-1uha8ag">The mini-LHC you build</h2> <p class="note svelte-1uha8ag">Six stages, each upgraded as the physics needs it. In chapter 29 the whole chain finds the Higgs boson, first in simulation and then in real data from the LHC experiments.</p> <ol class="stages ui svelte-1uha8ag"><!--[-->`);
		const each_array = ensure_array_like(STAGES);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let s = each_array[$$index];
			$$renderer.push(`<li class="svelte-1uha8ag"><span class="n svelte-1uha8ag">${escape_html(s.n)}</span> <strong>${escape_html(s.name)}</strong> <span>${escape_html(s.what)}</span> <em class="svelte-1uha8ag">${escape_html(s.from)}</em></li>`);
		}
		$$renderer.push(`<!--]--></ol></section> <section class="parts"><!--[-->`);
		const each_array_1 = ensure_array_like(PARTS);
		for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
			let part = each_array_1[$$index_2];
			$$renderer.push(`<div class="part svelte-1uha8ag"><h2 class="svelte-1uha8ag"><span class="pid ui svelte-1uha8ag">${escape_html(part.id === "0" ? "·" : `Part ${part.id}`)}</span> ${escape_html(part.title)}</h2> <p class="blurb svelte-1uha8ag">${escape_html(part.blurb)}</p> <ul class="svelte-1uha8ag"><!--[-->`);
			const each_array_2 = ensure_array_like(part.chapters);
			for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
				let c = each_array_2[$$index_1];
				const ok = available.has(`chapter/${c.slug}`);
				$$renderer.push(`<li${attr_class("svelte-1uha8ag", void 0, { "planned": !ok })}><span class="num ui svelte-1uha8ag">${escape_html(c.number)}</span> `);
				if (ok) $$renderer.push(`<!--[0--><a${attr("href", `${stringify(base)}/chapters/${stringify(c.slug)}/`)} class="svelte-1uha8ag">${escape_html(c.title)}</a>`);
				else $$renderer.push(`<!--[-1--><span class="t svelte-1uha8ag">${escape_html(c.title)}</span>`);
				$$renderer.push(`<!--]--> <span class="sum svelte-1uha8ag">${escape_html(c.summary)}</span> `);
				if (c.flagship) $$renderer.push(`<!--[0--><span class="flag ui svelte-1uha8ag">${escape_html(c.flagship)}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></li>`);
			}
			$$renderer.push(`<!--]--></ul></div>`);
		}
		$$renderer.push(`<!--]--> <div class="part svelte-1uha8ag"><h2 class="svelte-1uha8ag"><span class="pid ui svelte-1uha8ag">Reference</span> Appendices</h2> <ul class="svelte-1uha8ag"><!--[-->`);
		const each_array_3 = ensure_array_like(APPENDICES);
		for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
			let a = each_array_3[$$index_3];
			const ok = available.has(`appendix/${a.slug}`);
			$$renderer.push(`<li${attr_class("svelte-1uha8ag", void 0, { "planned": !ok })}><span class="num ui svelte-1uha8ag">${escape_html(a.number)}</span> `);
			if (ok) $$renderer.push(`<!--[0--><a${attr("href", `${stringify(base)}/appendix/${stringify(a.slug)}/`)} class="svelte-1uha8ag">${escape_html(a.title)}</a>`);
			else $$renderer.push(`<!--[-1--><span class="t svelte-1uha8ag">${escape_html(a.title)}</span>`);
			$$renderer.push(`<!--]--> <span class="sum svelte-1uha8ag">${escape_html(a.summary)}</span></li>`);
		}
		$$renderer.push(`<!--]--></ul></div></section></div>`);
	});
}
//#endregion
export { _page as default };
