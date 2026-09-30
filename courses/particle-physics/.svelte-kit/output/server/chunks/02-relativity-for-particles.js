import "./internal.js";
import { C as escape_html, S as attr, d as html, i as derived, l as stringify, p as createContext, t as attr_class } from "./server.js";
import "./paths.js";
import { t as Icon } from "./Icon.js";
import "./registry.js";
import "./Slider.js";
//#region src/lib/components/content/zoom.ts
var [getZoom, setZoom] = createContext();
var [getHints, setHints] = createContext();
//#endregion
//#region src/lib/state/progress.svelte.ts
var SOLVED_KEY = "particle-physics:solved";
var DRAFT_KEY = "particle-physics:drafts";
function read(key, fallback) {
	return fallback;
}
var Progress = class {
	solved = {};
	drafts = {};
	loaded = false;
	load() {
		if (this.loaded || true) return;
		this.loaded = true;
		this.solved = read(SOLVED_KEY, {});
		this.drafts = read(DRAFT_KEY, {});
	}
	isSolved(id) {
		return id in this.solved;
	}
	markSolved(id) {
		if (this.solved[id]) return;
		this.solved[id] = Date.now();
		this.solved;
	}
	reset(id) {
		delete this.solved[id];
		delete this.drafts[id];
		this.solved;
		this.drafts;
	}
	draft(id, fallback) {
		this.load();
		return this.drafts[id] ?? fallback;
	}
	saveDraft(id, value) {
		this.drafts[id] = value;
		this.drafts;
	}
	/** Number of solved exercises whose id starts with the chapter slug. */
	countFor(slug) {
		return Object.keys(this.solved).filter((k) => k.startsWith(`${slug}/`)).length;
	}
};
new Progress();
//#endregion
//#region src/lib/components/exercise/ExerciseFrame.svelte
function ExerciseFrame($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { id, kind, title, prompt, hints = [], solution, solutionLabel = "Show a solution", children, footer } = $$props;
		let shownHints = 0;
		let mounted = false;
		const solved = derived(() => mounted);
		$$renderer.push(`<section${attr_class("exercise svelte-vrcpgi", void 0, { "solved": solved() })}${attr("aria-label", `${stringify(kind)}${title ? `: ${title}` : ""}`)}><header class="ui svelte-vrcpgi"><span class="kind svelte-vrcpgi">`);
		Icon($$renderer, {
			name: "exercises",
			size: 14
		});
		$$renderer.push(`<!----> ${escape_html(kind)}</span> `);
		if (title) $$renderer.push(`<!--[0--><span class="title svelte-vrcpgi">${escape_html(title)}</span>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <span class="spacer svelte-vrcpgi"></span> `);
		if (solved()) {
			$$renderer.push(`<!--[0--><span class="badge svelte-vrcpgi">`);
			Icon($$renderer, {
				name: "check",
				size: 13
			});
			$$renderer.push(`<!----> Solved</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></header> `);
		if (prompt) $$renderer.push(`<!--[0--><div class="prompt svelte-vrcpgi">${html(prompt)}</div>`);
		else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="body">`);
		children($$renderer);
		$$renderer.push(`<!----></div> `);
		if (footer) {
			$$renderer.push("<!--[0-->");
			footer($$renderer);
			$$renderer.push(`<!---->`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (hints.length || solution) {
			$$renderer.push(`<!--[0--><div class="help ui svelte-vrcpgi">`);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="help-buttons svelte-vrcpgi">`);
			if (shownHints < hints.length) {
				$$renderer.push(`<!--[0--><button class="svelte-vrcpgi">`);
				Icon($$renderer, {
					name: "tip",
					size: 14
				});
				$$renderer.push(`<!----> ${escape_html("Hint")} <span class="n svelte-vrcpgi">${escape_html(shownHints)}/${escape_html(hints.length)}</span></button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (solution) {
				$$renderer.push(`<!--[0--><button class="svelte-vrcpgi">`);
				Icon($$renderer, {
					name: "eye",
					size: 14
				});
				$$renderer.push(`<!----> ${escape_html(solutionLabel)}</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section>`);
	});
}
//#endregion
//#region src/lib/components/exercise/Numeric.svelte
function Numeric($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** true when the block was written as ```fermi */
		let { spec } = $$props;
		let text = "";
		ExerciseFrame($$renderer, {
			id: spec.id,
			kind: spec.fermi ? "Fermi estimate" : "Calculate",
			title: spec.title,
			prompt: spec.prompt,
			hints: spec.hints ?? [],
			solution: spec.solution,
			children: ($$renderer) => {
				$$renderer.push(`<form class="ui svelte-1mh0niy"><label><span class="sr svelte-1mh0niy">Your answer</span> <input${attr("value", text)} inputmode="decimal" placeholder="your answer" autocomplete="off" class="svelte-1mh0niy"/></label> `);
				if (spec.unit) $$renderer.push(`<!--[0--><span class="unit svelte-1mh0niy">${escape_html(spec.unit)}</span>`);
				else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <button type="submit" class="svelte-1mh0niy">Check</button></form> `);
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			},
			$$slots: { default: true }
		});
	});
}
//#endregion
//#region content/chapters/02-relativity-for-particles/index.md
var metadata = {
	"slug": "relativity-for-particles",
	"kind": "chapter",
	"title": "Relativity for particles",
	"summary": "Four-momenta, invariant mass, boosts, and real muon pairs from the LHC.",
	"number": "2"
};
var toc = [{
	"id": "a-test-chapter",
	"text": "A test chapter",
	"depth": 2
}];
var terms = {};
var references = [];
var glossary = {};
function Index_md($$renderer) {
	$$renderer.push(`<h2 id="a-test-chapter">A test chapter</h2> <p>Energy and momentum: <span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><msup><mi>E</mi><mn>2</mn></msup><mo>=</mo><msup><mi>p</mi><mn>2</mn></msup><mo>+</mo><msup><mi>m</mi><mn>2</mn></msup></mrow><annotation encoding="application/x-tex">E^2 = p^2 + m^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="katex-base"><span class="katex-strut" style="height:0.8141em;"></span><span class="mord"><span class="mord mathnormal" style="margin-right:0.0576em;">E</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height:0.8141em;"><span style="top:-3.063em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="katex-sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span></span></span></span></span><span class="mspace" style="margin-right:0.2778em;"></span><span class="mrel">=</span><span class="mspace" style="margin-right:0.2778em;"></span></span><span class="katex-base"><span class="katex-strut" style="height:1.0085em;vertical-align:-0.1944em;"></span><span class="mord"><span class="mord mathnormal">p</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height:0.8141em;"><span style="top:-3.063em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="katex-sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span></span></span></span></span><span class="mspace" style="margin-right:0.2222em;"></span><span class="mbin">+</span><span class="mspace" style="margin-right:0.2222em;"></span></span><span class="katex-base"><span class="katex-strut" style="height:0.8141em;"></span><span class="mord"><span class="mord mathnormal">m</span><span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height:0.8141em;"><span style="top:-3.063em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="katex-sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span></span></span></span></span></span></span></span>.</p> `);
	Numeric($$renderer, { spec: {
		"id": "test-fermi",
		"prompt": "How many seconds are in a year, roughly?",
		"answer": 315e5,
		"unit": "s",
		"fermi": true
	} });
	$$renderer.push(`<!---->`);
}
//#endregion
export { Index_md as default, glossary, metadata, references, terms, toc };
