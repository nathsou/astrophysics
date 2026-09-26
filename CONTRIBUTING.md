# The Cosmos, Computed: contributor guide

An interactive astrophysics textbook: long-form explanatory chapters with live simulations.
The reader is a **software engineer**: comfortable with calculus, vectors, a little linear algebra and code; not a physicist.
Every chapter should leave them able to *derive* the key results roughly, *estimate* them in their head, and *understand the algorithm* behind each simulation.

**Reference implementation:** `src/pages/ch/orbits.mdx`, `src/sims/orbit-integrators.ts` and `src/chapters/orbits.ts`. Read all three before writing anything, and match their tone, density and conventions.

## Stack

- **Astro 7 + MDX** (static site, built on Vite). Chapters are MDX pages in `src/pages/ch/<slug>.mdx`.
- **TypeScript 7** (`npm run typecheck`, strict mode). Sims are vanilla TS, with no UI framework.
- **KaTeX** at build time via remark-math/rehype-katex: `$inline$` and `$$display$$`.
- **WebGPU** for heavy sims (compute and rendering, WGSL). Canvas2D for plots and light 2D sims. No WebGL, no three.js, no charting libraries.

## Files you own

For a chapter with slug `foo` (slugs are listed in `src/course.ts`; do not change them):

| Path | Purpose |
|---|---|
| `src/pages/ch/foo.mdx` | The chapter. Its presence "publishes" it in the nav. |
| `src/sims/foo-*.ts` | Each sim is one module that default-exports `defineSim(...)`. **Prefix every sim with the chapter slug.** |
| `src/sims/foo/**` | Optional helper modules and `.wgsl` shaders for your sims (import WGSL with `?raw`). |
| `src/chapters/foo.ts` | Optional page script wiring `<Var>`/`<Out>` via `compute()`. |

**Do not edit shared files** (`src/lib/**`, `src/components/**`, `src/layouts/**`, `src/styles/**`, `src/scripts/**`, `src/course.ts`, `astro.config.mjs`, `package.json`). Other agents work in parallel.
If you need a shared utility, put it under `src/sims/foo/`. If a shared file has a real bug or a missing feature, work around it locally and **mention it in your final report**.
Do not install npm packages.

## Chapter structure and standards

Frontmatter:

```mdx
---
layout: ../../layouts/Chapter.astro
slug: foo
lede: One or two evocative sentences (italic subtitle).
---
import Sim from '../../components/Sim.astro';
...
```

The layout renders the title and part from `course.ts`. **Start the body with an `## h2`**, not an h1.

Each chapter should contain:

- **3,000–6,000 words** of real explanation, organised into 4–7 `##` sections with `###` subsections as needed. Build the physics from first principles: state the assumptions, derive the key results (show the important steps, skip the tedious algebra and say so), and interpret them physically. Give numbers for real objects.
- **1 flagship simulation**, the chapter's centrepiece, which is impressive, interactive and performant. It is usually `size="wide"` (the default).
- **2–4 smaller interactive figures**: plots with sliders, draggable diagrams, small sims.
- **≥ 2 `<KeyEq>`** boxes for the central equations, each with a `where` legend.
- **≥ 1 `<Fermi>`** back-of-envelope estimate.
- **≥ 1 `<Hood>`** "under the hood" section that explains the algorithm/numerics of the flagship sim, with a short excerpt of real code (TS or WGSL) from your sim and a discussion of complexity, stability and precision.
- **≥ 1 `<Predict>`** question before a sim, where intuition is often wrong.
- **Several `<Aside>` margin notes**: history, caveats, connections, and "in the real universe…" observations.
- **Draggable numbers** (`<Var>`/`<Out>`) where a formula has a satisfying "what if" (e.g. scaling laws).
- Cross-references to other chapters by number ("see Chapter 19") where relevant, with links like `[Chapter 19](/ch/black-holes/)`.
- A closing section that connects to what comes next.

Writing style: clear, precise, warm, and occasionally witty, but never padded. Explain *why*, not just *what*. Prefer concrete numbers to adjectives. Use SI units plus astronomer's units (M☉, AU, pc, yr) and state which. Be scientifically accurate and current as of 2026 (JWST, Gaia DR3, LIGO-Virgo-KAGRA O4, DESI, Euclid, Rubin/LSST, EHT…); state uncertainty where it exists.

### Components (`src/components/`)

```mdx
<Sim name="foo-collapse" size="wide" minHeight={480} params={{ mode: 'x' }}>
  **Bold lead-in.** Caption text explaining what to look at and what to try.
</Sim>
<!-- size: 'text' | 'wide' (default: text + margin) | 'full' (edge to edge) -->

<KeyEq title="Hydrostatic equilibrium">
$$ \frac{dP}{dr} = -\frac{G m(r) \rho}{r^2} $$
<Fragment slot="where">$P$ is the pressure, …</Fragment>
</KeyEq>

<Fermi title="How long would the Sun last on chemical fuel?"> … </Fermi>
<Hood title="Barnes–Hut on the GPU"> … ```ts code ``` … </Hood>
<Predict question="…?" choices={['A', 'B', 'C']} answer={1}> Explanation revealed after answering. </Predict>
<Aside>**Bold lead.** Margin note.</Aside>
<C k="Msun" />                      <!-- constant with tooltip; keys in src/lib/physics/constants.ts -->
<Var name="M" value={1} min={0.1} max={100} log /> and <Out name="tau" />
```

- **`<Aside>` placement:** put it **directly after** the paragraph or block it annotates. It is laid out in the margin column on the same row as the preceding block. Do not put two asides back to back, and do not put an Aside immediately before a `wide`/`full` Sim.
- **Hover-linked terms:** in LaTeX write `\htmlData{term=mass}{M}`, and in prose `<span data-term="mass">M</span>`. Hovering either highlights both. Sims can listen: `window.addEventListener('term:hover', (e) => (e as CustomEvent).detail)` (a string or null).
- **`<Var>`/`<Out>` wiring:** create `src/chapters/<slug>.ts` and call `compute('outName', ['var1', 'var2'], ({ var1, var2 }) => 'text')`. Sims can also use `vars.subscribe(name, fn)` and `vars.set(name, v)` from `src/lib/runtime/vars.ts` to link prose and figures.

### MDX gotchas

- `{` and `}` in prose start JS expressions. **Never put `<script>` in MDX.** Use `src/chapters/<slug>.ts`.
- `<` followed by a letter or digit starts JSX. Write `&lt;`, or use math: `$<$`.
- Inside `$…$`, braces are fine because remark-math handles them first. But a LaTeX `\\` line break must be inside `$$` display blocks.
- Use `\htmlData{term=x}{…}` only inside math. It needs KaTeX `trust`, which is enabled.
- Leave blank lines around block components (`<KeyEq>`, `<Sim>`, and so on) and around `$$` blocks.


## Depth of explanation (required in every chapter)

Readers choose a **depth** with a control in the chapter header and sidebar. The setting is global and remembered:

| Depth | Name | Reader | Allowed maths |
|---|---|---|---|
| 1 | **Intuitive** | Curious, no maths background | Words, pictures, analogies, and proportionalities like "P² ∝ a³". Almost no symbols. |
| 2 | **High school** | Comfortable with algebra | Algebra, powers, logs, basic trig, plugging numbers into formulas. No calculus, no vectors. |
| 3 | **Engineering** | Calculus, vectors, ODEs, a little linear algebra | Everything: derivations, differential equations, tensors when essential. |

The default is 2. **Every chapter must read well, top to bottom, at all three depths.** At depth 1 it should never feel like "the real text with holes in it".

Tools (see `src/pages/ch/orbits.mdx` for worked examples):

```mdx
import Tiers from '../../components/Tiers.astro';
import Level from '../../components/Level.astro';

<!-- Alternative versions of the same passage: shows the reader's depth (or the nearest shallower
     tier) plus a "Go deeper" pill that reveals the next tier below. Use for anything that exists in
     2–3 versions: definitions, KeyEqs, explanations. Slots may be any subset of l1/l2/l3. -->
<Tiers>
<Fragment slot="l1"> plain words </Fragment>
<Fragment slot="l2"> algebra version (a KeyEq may live here) </Fragment>
<Fragment slot="l3"> vectors/calculus version </Fragment>
</Tiers>

<!-- Extra content with no simpler counterpart (e.g. a derivation). Below min it collapses to a
     one-line pill titled `title` that the reader can expand in place. -->
<Level min={3} title="Deriving the effective potential"> … </Level>

<!-- Content only for shallow depths, hidden above max (e.g. a gentle analogy). -->
<Level max={1}> … </Level>

<!-- Inline fragments inside a sentence (no pill): -->
… the force <Level min={3} inline>$\vec F = -m\nabla\Phi$</Level> points inward …
```

Guidelines:
- **Structure:** headings (`##`/`###`), sims, photos, Fermi boxes and Predicts usually sit **outside** any gating, so everyone gets the story and the toys. Gate the *explanations*.
- **Depth 1 has its own prose**, not a stripped-down copy of depth 3. Use analogies, concrete numbers and the sims.
- **At depth 2**, every KeyEq should be algebra only. Put the calculus/vector form in the l3 tier.
- **Derivations** go in `<Level min={3} title="…">`, with a short pill title that says what is derived.
- **The `<Hood>` sections** are for everyone: they are already collapsed and describe the code. Keep them as they are.
- `<Var>`/`<Out>` numbers work at every depth. Keep them outside gating when possible.
- Blocks inside `Tiers`/`Level` stay in the article grid (Asides, wide Sims and Photos work inside them). Do not nest a `<Tiers>` inside another `<Tiers>`.
- Sims may adapt to the depth, for example by hiding expert readouts: read `document.documentElement.dataset.depth` and listen for `window` event `depth:change`. This is optional.

## Real images

Where they help and look beautiful, include **real astronomical images from reputable sources**. A chapter should usually have 2–5, used as openers, "what it really looks like" moments, or comparisons with the sims.

- **Allowed sources** (all free to reuse with credit): NASA (public domain; `images.nasa.gov` has an API at `https://images-api.nasa.gov/search?q=…&media_type=image`), ESA/Webb (`esawebb.org`, CC BY 4.0), ESA/Hubble (`esahubble.org`, CC BY 4.0), ESO (`eso.org/public/images`, CC BY 4.0), NOIRLab/NSF (`noirlab.edu/public/images`, CC BY 4.0), the EHT Collaboration (via ESO, CC BY 4.0), NASA/SDO, JPL. Do **not** use Wikipedia, stock sites or anything with unclear licensing.
- **Vendor them locally:** download to `public/img/<slug>/<name>.jpg` with `curl`, then resize with `sips -Z 1800 -s formatOptions 82 file.jpg` (macOS). Keep each file **≤ 400 KB** and ≤ 1800 px on the long side. Use the agencies' "large"/"screen" JPG renditions, never the multi-hundred-MB originals.
- **Verify** that each image is what you think it is (read its official description page) before writing the caption.
- Embed:

```mdx
import Photo from '../../components/Photo.astro';

<Photo src="/img/orbits/earthset-orion.jpg" alt="Accessible description" credit="NASA / Artemis II crew"
       license="Public domain" href="https://images.nasa.gov/details/art002e021278" size="wide" aspect="3 / 2">
**Bold lead.** Caption: what we are looking at, the scale, how it was taken, and how it connects to the physics.
</Photo>
```

  `size` is `text` (default), `wide` or `full`. `credit` and `href` (the official page) are **mandatory**. Give `license` as `Public domain` (NASA) or `CC BY 4.0` (ESA/ESO/NOIRLab/EHT, whose credit lines must follow the agency's requested format, e.g. "ESA/Webb, NASA & CSA, J. Lee").

## Simulations

### Contract (`src/lib/runtime/sim.ts`)

```ts
import { defineSim, Loop, createStage } from '../lib/runtime/sim';
import { Panel, fmt } from '../lib/ui/controls';
import { Plot, Series } from '../lib/ui/plot';
import { palette, onThemeChange } from '../lib/ui/theme';

export default defineSim({
  gpu: false,              // true → loader shows a fallback message when WebGPU is missing
  mount({ host, params, onDestroy }) {
    const stage = createStage(host, { aspect: 16 / 9 });   // responsive canvas + HTML overlay
    const loop = new Loop(step, render, 1 / 120);          // fixed-step physics, rAF render
    // Create the loop BEFORE calling stage.onResize(): onResize fires immediately.
    stage.onResize(() => loop.invalidate());
    const panel = new Panel(host);                          // sliders/buttons/readouts under the canvas
    return { setVisible: (v) => loop.setVisible(v), destroy: () => loop.destroy() };
  },
});
```

- The loader lazy-imports the module when the figure nears the viewport, and calls `setVisible(false)` when it leaves or the tab is hidden. **Do no work while invisible.**
- `host` is yours. Add stages, panels and grids inside it. Keep the whole figure visually self-contained.
- `Loop` has `paused`, `timeScale`, `simTime` and `invalidate()` (redraw once while paused).
- Colours come from the theme: `palette()` gives `fg, muted, faint, grid, axis, accent, accent2, accent3, good, bad, series[0..4]`. Re-read it on `onThemeChange`. The sim must look good in **dark and light** themes. For "physical" colours (stars, blackbodies) use `blackbodyRGB(T)`/`blackbodyCSS(T)` from `src/lib/physics/blackbody.ts`.
- Plots: use `Plot` (axes, linear/log, `line`, `fn`, `scatter`, `point`, `vline`, `hline`, `text`) and `Series` (ring buffer). Call `plot.resize(w,h,dpr)` in `stage.onResize`.
- Constants: `src/lib/physics/constants.ts`. Planck/CIE helpers: `src/lib/physics/blackbody.ts`.
- 3D: `OrbitCamera`, `perspective`, `lookAt` and `multiply` in `src/lib/runtime/camera.ts` (column-major, WebGPU depth range [0,1], Z up).

### WebGPU rules

- Get the shared device with `requireDevice()` from `src/lib/runtime/gpu.ts`. **Never call `requestAdapter`/`requestDevice` yourself.** Configure the canvas with `configureCanvas(canvas, device)`.
- Set `gpu: true` in `defineSim`.
- Destroy your buffers and textures in `destroy()`/`onDestroy`. Several sims share the device on one page.
- Keep per-frame work bounded. Target **60 fps on an M1-class laptop GPU**. Scale particle counts with a quality slider or presets (say, "32k / 131k / 524k").
- **f32 only on the GPU:** choose natural units so the numbers stay O(1), and discuss the precision choice in the `<Hood>`.
- Canvas size changes: `createStage` resizes `canvas.width/height`. Recreate depth textures on resize.
- Prefer compute shaders for physics (integration, force computation, histograms, FFTs) and render points with instanced quads plus additive blending for a glowing "astro" look. Apply tonemapping in the fragment shader.
- WGSL: put larger shaders in `src/sims/<slug>/*.wgsl` and import them as `import code from './foo/shader.wgsl?raw'`. Check `device.createShaderModule(...).getCompilationInfo()` in dev and log errors.

### CPU sims

- Use `Float64Array` for accuracy-sensitive integration. Avoid allocating per frame in hot loops.
- Anything heavier than about 2 ms per frame belongs on the GPU (or at lower resolution).

### Interaction and polish

- Every sim needs a caption that says **what to look at and what to try**.
- Offer 2–5 meaningful controls, not 15. Include presets where they help ("Sun", "Red dwarf", "Blue giant").
- Show live readouts of the relevant physical quantities in real units.
- Label axes with units. Label objects on canvas where it helps.
- Pointer interactions (drag bodies, click to place) are great, and must also work with touch (use pointer events).
- The page must work at 375 px wide. Sims shrink gracefully, panels wrap, and canvases are never wider than the host.

## Verification (required before you finish)

1. `npm run typecheck`: zero errors.
2. `npx astro build --outDir /tmp/astro-build-<slug>`: must succeed. **Always use your own `--outDir`**, because other agents build concurrently.
3. A dev server is already running at `http://localhost:4321` with hot module replacement (HMR). If browser tools are available, open **your own new tab** (never close or navigate other tabs), load `http://localhost:4321/ch/<slug>/`, scroll to each sim, take screenshots, and check the console for errors. Check both themes (the button at the bottom of the sidebar). If browser tools are not available, say so in your report.
4. Report which files you created, what the sims do, any shared-lib issues you found, and anything you couldn't verify.
