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

## Baselines (TinyStories V2, CourseGPT's 8,192-token BPE)

N-grams: the whole validation split (the bigram's interpolation weight tuned on its first half, scored on the second).
Sweep runs: the first 1 M validation tokens. Bits per byte = bits per token ÷ 4.08 (bytes of story text per token).

| Model | Chapter | Validation bits/token | Bits/byte |
|---|---|---|---|
| Uniform over 8,192 tokens | 14 | 13.00 | 3.19 |
| Unigram | 14 | 8.42 | 2.06 |
| Bigram, interpolated with unigram | 14 | 5.13 | 1.26 |
| CourseGPT shape, AdamW 2e-3, 52 M tokens (sweep) | 14 | 2.35 | 0.58 |
| CourseGPT shape, Muon 0.04, 52 M tokens (sweep) | 14 | 2.06 | 0.51 |
| **CourseGPT** (8 × 512, Muon, 1.05 B tokens; whole validation split) | 14 | **1.647** | **0.404** |
| Draft model (2 × 256, 131 M tokens) | 16 | 2.31 | 0.57 |

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
- **M4** — Part IV (CourseGPT trained and running in the browser). ✅ built 2026-09-27: Chapters 0 and 12–16, appendices F and I. Weights hosting needs the `coursegpt-v1` release uploaded (see below).
- **M5–M7** — Part V in three batches; remaining appendices. Chapters 17–18 ✅ built 2026-09-29.

## Follow-ups noted during M0

- The editor's TypeScript service pulls in TypeScript twice: a 7 MB worker plus a 3.3 MB main-thread chunk
  from `@valtown/codemirror-ts`. Both load lazily, on first editor focus. We could slim this by writing our
  own thin worker client.
- Glossary (`:term[…]`) and `content/glossary.yaml` are wired up but not yet used by any chapter.
- Chapter 0 (tour of the finished model) waits for CourseGPT (M4); Chapter 1 is the entry point until then.
- GitHub Pages: ✅ the course now lives in the Interactive Courses monorepo (github.com/nathsou/courses, `courses/language-models/`), deployed with the other courses by the root workflow.

## Part IV on the Linux machine (RTX 4060 Ti) — done 2026-09-27

Setup notes: see the handoff in git history (commit d814b84) — `pnpm install`, `cd training && uv sync --extra torch`.
Headless Chromium only gets the NVIDIA WebGPU adapter with `--use-angle=vulkan --ignore-gpu-blocklist`; `scripts/cdp.mjs`
now adds these on Linux.

What exists now:
- **Data**: `lmc data tinystories` (TinyStories V2, GPT-4 stories), `lmc tokenise` → `training/data/tinystories/`
  (`tokeniser.json`, `train.bin` 536 M tokens, `val.bin` 5.4 M, uint16). BPE trained on the first 100 MB
  (21,499 distinct chunks, 4.08 bytes/token). The tokeniser is copied to `course/static/data/coursegpt/`.
- **Training** (`lmcourse/train.py`): presets `smoke`, `coursegpt`, `draft`; `--set key=value` overrides; memmap batches,
  bf16 autocast, `torch.compile`, Muon option, MFU against the GPU's bf16 peak, a fixed-seed sample per evaluation.
  Resume/export use the checkpoint's own config. CourseGPT: 8 × 512, context 512, 29.6 M parameters, 8,000 steps ×
  131 k tokens (1.05 B), Muon 0.04 + AdamW 4e-3, ≈ 2.1 h at ≈ 138 k tok/s (59% MFU).
- **Measurements**: `lmcourse/ch14.py` (sweep, speed, attention, precision, baselines, fixtures, summary),
  `ch15.py` (distributions, tradeoff), `ch16.py` (quant, speculative, weights), `ch00.py` (recorded tour). Each writes
  JSON under `runs/`, and `summary` writes the chapter's `data.json`.
- **Browser**: `@lm/core/sample` (temperature, top-k/p, min-p, penalties, beam search, speculative acceptance),
  `@lm/core/gpu` `GptRunner` (KV cache, `attendCached` kernel, int8 weight-only matmul), `$lib/models/coursegpt.ts`
  (loads tokeniser, CourseGPT and the draft model; shared runners).
- **Parity**: tokeniser ids (Python ↔ TS), sampler distributions (PyTorch ↔ TS), CourseGPT logits from the exported
  bf16 weights (PyTorch float64 ↔ WebGPU float32; skipped when the weights are absent), KV-cached ↔ full forward.

**Weights hosting** (decided: GitHub release assets fetched at build time). `course/content/weights.json` lists
the files and SHA-256 hashes; `scripts/weights.mjs` (run by the course build) downloads missing files into
`course/static/weights/` (git-ignored) and fails the build on CI if it cannot. To publish:
`gh release create coursegpt-v1 course/static/weights/coursegpt.safetensors course/static/weights/coursegpt-draft.safetensors`
(repository nathsou/courses), then fill the manifest with `node scripts/weights.mjs --hash`.

### Known loose ends
- Browser checkpoint restore reseeds the data sampler (not bit-identical to an uninterrupted run). The PyTorch loop
  now saves its NumPy sampler state.
- Checkpoints in the browser trainer support AdamW only.
- The browser char-GPT preset takes ≈8 minutes on the M4 Pro; the 2-layer "quick" preset ≈1.5 minutes.
- Timing figures in Chapters 12–13 were measured on the M4 Pro; Chapters 14–16 on the RTX 4060 Ti (the text says so).
- Our WebGPU decode is dominated by per-kernel overheads and the logits readback, not by weight bandwidth.

### Part V progress
- **Chapter 17 (scaling laws)** ✅ 2026-09-29. `lmcourse/ch17.py`: IsoFLOP sweep, 7 shapes (2×128 … 10×640), budgets
  1, 2.5, 6.25 × 10¹⁵ FLOPs, 32,768 tokens/step, CourseGPT's recipe. Optima 4.2 / 7.2 / 12.7 M parameters
  (9 → 6 tokens/parameter), N_opt ∝ C^0.60; L(N, D) = 1.69 + 5.2e4/N^0.77 + 1.3e5/D^0.73 bits/token; it predicts
  1.81 for CourseGPT (measured 1.647). A first sweep at 8,192 tokens/step (kept, shown in the chapter) gave
  N_opt ∝ C^0.75 and predicted 2.17: an untuned batch reproduced Kaplan's exponent (Porian et al., 2024).
- **Chapter 18 (modern architecture)** ✅ 2026-09-29. `GPTConfig` gained `norm_type` (layer/rms), `mlp_type`
  (gelu/swiglu, ⅔ hidden width), `pos` (learned/rope) and `kv_heads` (GQA); defaults keep the GPT-2 block and all
  checkpoints. `lmcourse/ch18.py`: 6×384 at 6.25e15 FLOPs, 7 runs. Seed noise 0.008; RMSNorm +0.001, SwiGLU −0.003,
  RoPE −0.029 (the only clear win), GQA(2 KV) +0.020, all four +0.021 bits/token. RoPE collapses past ≈ 600
  positions when trained at 512 (no interpolation). The browser engine does not implement these yet (a challenge).
- **Chapter 19 (mixture-of-experts)** ✅ 2026-09-29. `GPTConfig` gained `experts`, `top_k`, `expert_hidden`, `aux_coef`,
  `gate`. Same setting as Ch18 (dense 2.064): 8 experts top-2 2.005, no balancing loss 2.010 (one expert takes 43% of a
  layer's slots), 32 experts top-2 1.977 (120 M total / 14 M active). A first top-1 run renormalised the single gate to 1,
  so the router got no LM gradient: 2.161, worse than dense; kept as `e8k1-renorm` (`gate=renorm`) and discussed in the
  chapter. The corrected top-1 run (raw probability gate, as in Switch): 2.025.
  MoE throughput ≈ 116k tokens/s vs 255k dense (Python loop over experts).
- **Chapter 24 (multimodality, survey)** ✅ 2026-09-29. Browser only: patchify, CLIP loss, a contrastive toy with zero-shot.
- **Chapter 22 (reasoning)** ✅ 2026-09-29. 4×256 RoPE GPT on 6-digit addition, 3,000 steps: scratchpad 97.4%,
  direct 85.8%. Voting adds nothing to trained models (systematic errors); under-trained direct: one sample 46%, vote@32
  70% (= greedy), pass@32 79%. GRPO (lr 2e-5, 900 steps, group 8 × 32 prompts, β 0.02): one sample 50→63%, greedy
  72.5→75.6%, pass@8 77→78% — sharpening, as Yue et al. (2025) report; lr ≥ 1e-4 degrades, 3e-4 collapses.
- **Chapters 25 (evaluation), 26 (interpretability), 27 (efficiency, survey), 28 (safety), 29 (epilogue), Appendix D**
  written 2026-09-29; 27 and D need no GPU. 25, 26 and 28 have experiments (`lmcourse/ch25.py`, `ch26.py`, `ch28.py`).
- Chapter 20 is rerun at 3,000 fine-tuning steps (600 gave only 35% of required words used; the 600-step results are
  kept in `runs/ch20-600/`). Chapter 21 builds on its LoRA r = 16 model.
- Results placeholders (⟪…⟫) in a chapter's index.md are filled once its data is in; `scripts/cdp.mjs` crawls report them.
- **Workflow change (2026-09-29):** commit to a branch and open a PR; do not push to main. CI installs no PyTorch, so
  torch-dependent tests must skip without it. Book work is on `language-models/finish-book` (PR #10).
