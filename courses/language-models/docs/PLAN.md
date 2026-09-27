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

## Baselines (TinyShakespeare, character level, 90/10 split, full validation split)

Every model is compared on the same data so progress is visible across chapters.

| Model | Chapter | Validation bits/char | Perplexity |
|---|---|---|---|
| Uniform over 65 chars | 1 | 6.02 | 65 |
| Unigram | 2 | ≈ 4.8 | ≈ 28 |
| Bigram (counted, add-k) | 2 | ≈ 3.57 | ≈ 11.9 |
| Kneser–Ney, n = 6 (best n-gram) | 2 | 2.22 | 4.66 |
| Neural bigram (SGD) | 5 | ≈ 3.61 | ≈ 12.2 |
| MLP, browser CPU (n 8, d 16, h 128, SGD, 10k steps) | 7 | ≈ 2.94 | ≈ 7.7 |
| MLP, PyTorch (2 × 512, AdamW) | 7 | 2.28 | 4.85 |
| MLP, browser GPU (d 24, h 1024, batch 1024, momentum, 20k steps) | 8 | 2.43 | 5.4 |
| Vanilla RNN, H 256, browser GPU / PyTorch (2k Adam steps) | 9 | 2.32 / 2.31 | 5.0 |
| LSTM, H 256, browser GPU / PyTorch (2k Adam steps) | 9 | 2.24 / 2.20 | 4.7 |
| LSTM 2 × 512, dropout 0.25, PyTorch, 10k steps | 9 | 2.10 | 4.3 |
| Attention-only, 1 layer (C 128, 4 heads, T 128, 3k steps) | 10 | ≈ 2.9 | ≈ 7.5 |
| Attention-only, 2 layers, browser GPU / PyTorch | 10 | 2.57 / 2.58 | 5.9 |

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
- **M1** — Part I + appendices E and J. ✅ built 2026-09-27
- **M2** — Part II + appendices A, B, C, G, H. ✅ built 2026-09-27
- **M3** — Part III. ✅ built 2026-09-27 (Chapters 9–11)
- **M4** — Part IV (CourseGPT trained and running in the browser). Chapters 12–13 ✅ built 2026-09-27; 14–16 next (see handoff).
- **M5–M7** — Part V in three batches; remaining appendices.

## Follow-ups noted during M0

- The editor's TypeScript service pulls in TypeScript twice: a 7 MB worker plus a 3.3 MB main-thread chunk
  from `@valtown/codemirror-ts`. Both load lazily, on first editor focus. We could slim this by writing our
  own thin worker client.
- Glossary (`:term[…]`) and `content/glossary.yaml` are wired up but not yet used by any chapter.
- Chapter 0 (tour of the finished model) waits for CourseGPT (M4); Chapter 1 is the entry point until then.
- GitHub Pages: ✅ the course now lives in the Interactive Courses monorepo (github.com/nathsou/courses, `courses/language-models/`), deployed with the other courses by the root workflow.

## Handoff: moving to the Linux machine (RTX 4060 Ti) for Chapter 14 onwards

Written 2026-09-27 at the end of Chapter 13. Chapters 14+ need CUDA: CourseGPT (≈30M parameters, ≈1B
TinyStories tokens, ≈1.8×10¹⁷ FLOPs) is ≈17–20 h on the M4 Pro's MPS but ≈2.5–3.5 h on the 4060 Ti with
bf16 autocast and `torch.compile`; Part V labs want Triton, flash-attn and bitsandbytes.

### Setting up
1. Clone the courses monorepo (`git clone git@github.com:nathsou/courses.git`); this course is `courses/language-models/`, and everything below runs from there. Node ≥ 23 (the Vitest suite relies on type
   stripping) and pnpm 12: `pnpm install`.
2. Python: `cd training && uv sync --extra torch` — Linux resolves torch from the cu130 index (driver
   ≥ 580; with an older driver, switch the two cu130 entries in `pyproject.toml` to cu126). Check with
   `uv run python -c "import torch; print(torch.cuda.get_device_name())"`.
3. GPU tests and headless-browser checks use WebGPU through Vulkan: `vulkaninfo` should list the 4060 Ti.
   `pnpm test` runs the GPU kernel tests on Dawn (skipped if no adapter). `node scripts/cdp.mjs <url> <steps.json>`
   finds Chrome on Linux (or set `CHROME=`); if `navigator.gpu.requestAdapter()` returns null in headless
   Chrome, try adding `--use-angle=vulkan` to its flags.
4. Dev server: `npx vite dev --port 5199` in `course/`. Full checks: `pnpm test`, `pnpm typecheck`,
   `pnpm build`, `cd training && uv run pytest && uv run ruff check`.
5. Claude's memory notes live in `~/.claude/projects/<encoded path>/memory/` on the Mac; copy them to the
   matching folder on Linux (the encoded path will differ) if you want them to carry over.

### State of the code (what exists to build on)
- `@lm/core/gpu`: WebGPU backend with autograd — matmul (naive/tiled/register-blocked, batched, transposes),
  fused softmax/cross-entropy/LayerNorm/LSTM, GELU, dropout, permute, embedding, AdamW/SGD/Muon, clipping,
  `Gpt` (named parameters, same as PyTorch), safetensors I/O (`@lm/core`). Parity tests against PyTorch
  (`training/fixtures/gpt_parity*`) and the CPU tensor library.
- `course/src/lib/train/gpt.svelte.ts`: the browser training loop (schedules, accumulation, clipping,
  full-split evaluation, MFU, IndexedDB checkpoints, safetensors import/export, optimiser choice).
- `training/lmcourse/model.py` (GPT, browser-compatible names, `state_for_browser`) and
  `training/lmcourse/train.py` (`lmc train --preset …`, resume, export). Character-level only so far.

### Chapter 14 — to do
1. **Data.** Add TinyStories to `lmcourse/data.py` (`TinyStoriesV2-GPT4-train.txt` ≈2.2 GB and
   `-valid.txt` ≈22 MB from `huggingface.co/datasets/roneneldan/TinyStories`). Downloading needs Nathan's
   go-ahead; he runs `uv run lmc data tinystories`.
2. **Tokeniser.** Train BPE with 8,192 tokens (`lmcourse.bpe`, identical to the browser's) on a sample
   (≈50–100 MB) and add `<|endoftext|>`. Encoding all of TinyStories in pure Python is slow even with the
   per-pretoken cache — use `multiprocessing` over chunks and write `train.bin`/`val.bin` (uint16 memmaps).
3. **Training.** Generalise `train.py` to token files: memmap batches, bf16 autocast, `torch.compile`, fused
   AdamW (and a Muon option), logging MFU against the 4060 Ti's bf16 peak. Start with a ≈1-minute smoke
   run, then a small scaling sweep (also useful for Chapter 17), then CourseGPT (≈8 layers × 512, context
   512 — decide from the sweep).
4. **Parity and export.** Test that the browser `Gpt` + BPE tokeniser reproduce PyTorch's logits on
   CourseGPT; export safetensors. Decide how to host the weights for GitHub Pages (`course/static/weights/`
   is git-ignored; options: Git LFS, a GitHub release asset, or the Hugging Face Hub).
5. **Chapter text:** parity testing, mixed precision (bf16 vs fp16 and loss scaling), FlashAttention and
   memory, `torch.compile`, the data pipeline, the CourseGPT run and its measured MFU.

### Known loose ends
- Browser checkpoint restore reseeds the data sampler (not bit-identical to an uninterrupted run).
- Checkpoints in the browser trainer support AdamW only.
- The browser char-GPT preset takes ≈8 minutes on the M4 Pro; the 2-layer "quick" preset ≈1.5 minutes.
- Timing figures in the chapters were measured on the M4 Pro (say so where quoted).
