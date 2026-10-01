# Course audit

Audit date: 1 October 2026. All ten courses were checked. The audit found shared rendering and navigation defects, history card problems, malformed mathematics, and mobile overflow. The verified fixes accompany this report; no website deployment was performed.

## Fixed issues

| Issue | Courses affected | Result |
| --- | --- | --- |
| Verilog, VHDL and C fences silently rendered as plain text | Digital Circuits; shared renderer used by Language Models, Proofcraft and Particle Physics | Supported Shiki grammars and aliases load as needed, with regression checks for token colors and escaping. |
| TypeScript examples lacked highlighting and shrank twice; code and history blocks could acquire empty paragraphs | Elements | Colored, escaped examples retain their intended size and valid block markup. |
| Equation markup and stylesheets used different KaTeX versions | CIC, Proofs Are Programs, Compiler Backends | The renderer and stylesheet use the same version through dependency overrides and updated lockfiles. |
| Dollar amounts became equations | Digital Circuits, Particle Physics | Currency markers are escaped in chapter prose and quiz explanations. |
| History cards rendered every paragraph twice | Digital Circuits, Particle Physics | The hook and remaining story render once each; footnotes and widgets have unique identities. Card height includes its borders. |
| An encoded internal placeholder broke chapter and appendix links | Digital Circuits, Language Models; related rendering in Proofcraft and Particle Physics | Prose and embedded quiz, hint and glossary links resolve against the course base path. |
| Chapter links escaped the course directory or lost their section target | Astrophysics | Markdown and MDX links preserve the hosting prefix and fragment; two stale exoplanet section links were corrected. |
| Heading IDs collided with equation IDs | Language Models, Particle Physics | Explicit equation and figure IDs take precedence; headings receive distinct IDs and matching contents links. |
| Repeated SVG and description IDs | Compiler Backends, Digital Circuits | Graph arrows, circuit grids and editor descriptions use instance-specific IDs. |
| Wide equations and citations widened phone pages | Markdown courses, particularly Particle Physics | Standalone double-dollar equations receive display layout; citations can wrap between words. |
| Mobile layout overflow | Astrophysics, Proofcraft | Animated orbit decoration is clipped; tables scroll; truth-table inputs can shrink; the quoted Zagier equation has its own paragraph. |
| Malformed fraction caused a visible equation error | Proofcraft | A stray form-feed character was restored to the intended LaTeX command. |

## Coverage and verification

The browser crawl covered 1,118 valid views at desktop and phone widths: 38 Astrophysics pages, 22 CIC views, 24 Proofs Are Programs views, 32 Compiler Backends views, 621 Elements views, 128 Incompleteness views, 42 Digital Circuits pages, 43 Particle Physics pages, 27 Proofcraft pages, and 41 Language Models pages. Broken placeholder URLs encountered during the crawl were investigated separately. No uncaught browser errors or broken images were observed in these views. Pages affected by fixes received additional targeted checks, including history-card flipping and reduced motion.

All ten courses built successfully and passed their type checks. Every Markdown chapter and appendix passes rendering regression checks, including actual Svelte compilation and equation-error detection. Elements' 620 modern text checks also pass. `npm run audit` checks the collection's 247 generated HTML files, including compatibility redirects, for local links, images, fragment targets, duplicate IDs and equation errors.

The existing CIC, Compiler Backends, Elements, Incompleteness, Language Models and Proofcraft test suites passed. The larger simulation and proof suites have the remaining failures below; they were not presented as clean test runs.

## Remaining work

- **Digital Circuits:** four existing performance assertions failed: the Octet and RV32 fitted-design timing estimates, a 4,000-LUT fitting time limit, and an analog simulation throughput target. The functional fit counts and correctness checks passed. Profile and rerun these benchmarks in isolation before changing their implementation or published timing claims.
- **Particle Physics:** five existing performance assertions failed in histogram filling, detector simulation, shower generation, reconstruction and fitting. Their numerical and functional checks passed. The run had concurrent build and test load, so these results do not establish the cause of the slowdown.
- **Proofs Are Programs:** two tests of the final kernel chapter exceeded their 60-second limit, with worker reporting timeouts. Other completed checks passed. Investigate that chapter separately; skipped exploratory tests remain skipped.
- **Accessibility:** existing Svelte warnings remain, including plot and canvas semantics and values captured at initialization. The audit fixes verified ID and layout defects; it does not certify full keyboard or screen-reader accessibility.
- **Scope limits:** simulations were exercised by the existing suites and page loading, not every possible user interaction. External citations, scientific claims, hardware procedures, real GPU execution and external toolchains were not independently revalidated. Browser checks blocked external network requests, so external links and remotely hosted media were not validated.

## Repeat the static audit

Build with `npm run build`, then run `npm run audit`. If the build uses `COURSES_BASE_PATH=/courses`, run `npm run audit -- --base-path /courses`. The checker emits JSON and returns a failing status when it finds an issue. Browser checks remain necessary for hash routes and interactive behavior.
