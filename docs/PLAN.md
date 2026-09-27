# Course plan — *Building a Language Model from Scratch*

This is the living plan for the course. It records the agreed decisions, the curriculum and the
milestones. Update it when decisions change.

## Decisions (agreed 2026-09-27)

| Topic | Decision | Notes |
|---|---|---|
| Site framework | **SvelteKit 2 + Svelte 5** (runes), `adapter-static`, Vite 8 | Prerendered static pages for GitHub Pages; widgets hydrate client-side. |
| Content format | Markdown + directives compiled to Svelte by our own preprocessor | `::widget{…}`, `:::history`, `:::equation`, `::exercise{…}`; KaTeX + Shiki at build time. |
| TypeScript | **TS 6** everywhere (revised 2026-09-27) | TS 7 is native-only with no JS API, which `svelte-check` and the in-browser language service require; TS 6 keeps one compiler across repo, tooling and browser. Revisit when Svelte tooling supports TS 7. |
| In-browser editor | **CodeMirror 6** | Many small editors per page, light, mobile-friendly. TS completions/diagnostics from a TS 6 language service in a worker (lazy-loaded). Code runs in a worker; tests shown inline. |
| Code-along | In-browser exercises (saved in IndexedDB, export/import) + “use my implementation” toggle feeding widgets | PyTorch labs are local scripts with pytest. |
| Compute (browser) | WebGPU for compute + primary rendering; WebGL2 fallback for visualisations; CPU fallback for small demos | |
| Compute (local) | PyTorch via **uv**; CUDA on RTX 4060 Ti 16 GB (primary), MPS on M4 Pro (fallback) | Scripts are device-agnostic. |
| Hosting | **GitHub Pages** (Actions deploy) | Weights: GitHub Release assets fetched at build time and bundled into the Pages artefact, sharded ≤ 50 MB, fp16/int8. |
| Language | British English | |
| Scope | Multimodality and efficiency-at-scale are lighter survey chapters (one lab each) | |
| Figures | Redrawn as interactive SVG with citations; short quotes only; CC-licensed images with attribution | |

## Models we train

| Model | Where | Size / data | Approx. time |
|---|---|---|---|
| Bigram, MLP, char-RNN | Browser | TinyShakespeare | seconds–minutes |
| char-GPT | Browser (our WebGPU engine) | 0.5–1 M params | 5–15 min |
| **CourseGPT** | PyTorch (4060 Ti) → browser | ~30–50 M, own BPE (8k), TinyStories | ~1–2 h (CUDA), 3–5 h (MPS) |
| Scaling sweep | PyTorch | 6–8 models, 0.1–10 M | ~1 h |
| MoE / SFT / LoRA / DPO / GRPO / SAE variants | PyTorch → browser | on CourseGPT | minutes–1 h each |
| Optional capstone: CourseGPT-Web | 4060 Ti | 124 M, FineWeb-Edu, ~2.5 B tokens (Chinchilla-optimal) | ~1.5 days |
| Scale-up comparisons | 4060 Ti | LoRA/DPO/GRPO on a small open model (e.g. Qwen3-0.6B) after we implement each method ourselves | ~1 h each |

## Chapter template

Motivation → theory (interactive equations) → visualisations → 🔬 lab (implement + experiment) →
💥 break it → exercises (extend the model) → 🏔 challenges → 📜 history → further reading →
check-your-understanding.

## Curriculum

**Part 0 — Orientation**
0. What is a language model? Tour of the finished CourseGPT; roadmap; setup.

**Part I — Text & counting**
1. Text as data — Unicode, UTF-8, normalisation, corpora, Zipf, entropy.
2. N-gram models — chain rule, MLE, smoothing, cross-entropy, perplexity.
3. Tokenisation — char/word/BPE/byte-level BPE/WordPiece/Unigram; implement BPE.

**Part II — Neural foundations**
4. Tensors — shapes, strides, views, broadcasting, matmul.
5. Learning as optimisation — gradient descent; neural bigram.
6. Automatic differentiation — scalar → tensor autograd.
7. MLP language model (Bengio 2003) — embeddings, init, activation statistics.
8. GPU compute with WebGPU — WGSL, tiled matmul, reductions, softmax; WebGPU backend.

**Part III — Sequences & attention**
9. Recurrent networks — BPTT, LSTM/GRU, char-RNN.
10. Attention — QKV, scaling, masking, multi-head.
11. The Transformer — residual stream, norms, FFN, positional encodings, GPT.

**Part IV — Training & running a real GPT**
12. The training loop — train char-GPT in the browser.
13. Optimisers — SGD → AdamW, schedules, clipping, Muon.
14. Scaling up in PyTorch — parity tests, bf16, compile, FlashAttention; train CourseGPT.
15. Sampling & decoding.
16. Inference engine — KV cache, quantisation, speculative decoding; CourseGPT in the browser.

**Part V — Modern LLMs**
17. Scaling laws · 18. Modern architecture · 19. Mixture-of-Experts · 20. Fine-tuning & LoRA ·
21. Preference learning (RLHF, DPO, RLAIF) · 22. Reasoning models (GRPO) · 23. Tool use & agents ·
24. Multimodality *(survey)* · 25. Evaluation · 26. Interpretability · 27. Efficiency at scale *(survey)* ·
28. Safety · 29. Epilogue.

**Appendices** — A linear algebra · B calculus · C probability · D statistics · E information theory ·
F optimisation · G neural networks · H GPU/WGSL · I PyTorch · J glossary, timeline, bibliography.

## Milestones

- **M0 — Platform** + Chapter 1 as proof of concept. ✅ built 2026-09-27, awaiting review
- **M1** — Part I.
- **M2** — Part II + appendices A, B, C, G.
- **M3** — Part III.
- **M4** — Part IV (CourseGPT trained and running in the browser).
- **M5–M7** — Part V in three batches; remaining appendices.

## Follow-ups noted during M0

- The editor's TypeScript service pulls in TypeScript twice: a 7 MB worker plus a 3.3 MB main-thread chunk
  from `@valtown/codemirror-ts`. Both load lazily, on first editor focus. We could slim this by writing our
  own thin worker client.
- Glossary (`:term[…]`) and `content/glossary.yaml` are wired up but not yet used by any chapter.
- Chapter 0 (tour of the finished model) waits for CourseGPT (M4); Chapter 1 is the entry point until then.
- GitHub Pages: create the repository, push, and enable Pages → "GitHub Actions" as the source.
