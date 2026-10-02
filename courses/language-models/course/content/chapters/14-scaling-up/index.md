---
number: 14
title: Scaling up in PyTorch
summary: Our browser engine trained char-GPT in minutes, but CourseGPT needs a thousand times more computation. This chapter moves training to PyTorch on a consumer GPU and makes it fast — parity tests that prove both implementations compute the same model, a data pipeline for half a billion tokens, mixed precision, FlashAttention and compilation — then trains CourseGPT and brings it back to the browser.
duration: About 3 hours, plus a 2-hour training run
prerequisites: [optimisers, gpu-compute]
builds:
  - A tokenised TinyStories corpus and CourseGPT’s 8,192-token tokeniser
  - Parity tests between PyTorch and the browser engine
  - A fast PyTorch training loop (bfloat16, FlashAttention, torch.compile)
  - CourseGPT, trained, and running in the browser
---

Char-GPT, the model we trained in Chapter 12, has 1.8 million parameters and saw about 25 million characters of Shakespeare. CourseGPT, the model this course has been building towards, has **30 million parameters** and will read **a billion tokens** of children’s stories. That is roughly $2 \times 10^{17}$ floating-point operations: three and a half days for our WebGPU engine, about two hours for PyTorch on an NVIDIA RTX 4060 Ti.

So this is the chapter where we leave the browser for a while. Moving to PyTorch raises two questions, and the chapter answers them in turn. First, how do we know that the PyTorch model is *the same model* as ours, so that its weights will work when we bring them back? We test it: parity tests compare the two implementations number by number. Second, where does a GPU’s time actually go, and how do we get more of it doing useful arithmetic? The answers — 16-bit arithmetic, attention that never stores its attention matrix, and compiled kernels — are the same ones that make training frontier models possible, at a much smaller scale.

## The budget

Chapter 11 counted the cost of a Transformer: each token costs about 6 floating-point operations per parameter for the forward and backward passes, plus the attention scores. Multiplying by the number of training tokens gives the run’s total compute, and dividing by what the hardware actually achieves gives the time. Memory is a separate constraint: besides the weights we must hold the gradients, the optimiser’s state and every activation the backward pass will need.

::compute-budget

Set the model to CourseGPT and compare the hardware. On the M4 Pro in the browser, the run would take days; on the 4060 Ti, about two hours. Memory is not the problem for a model this small: 16 bytes per parameter for weights, gradients and AdamW’s two moments is under half a gigabyte, and the activations of a micro-batch of 32 sequences take a few gigabytes. Switch FlashAttention off, or raise the context to 4,096, and the activations grow quickly. Try GPT-2 small, too: 124 million parameters trained on 10 billion tokens need about forty times CourseGPT’s compute.

## The data pipeline

### TinyStories

CourseGPT learns from **TinyStories** :cite[eldan2023], a corpus of short stories written by GPT-3.5 and GPT-4 in the vocabulary of a young child. Eldan and Li designed it to answer a question: how small can a language model be and still write fluent, coherent English? Their answer was surprisingly small — models of a few tens of millions of parameters — because the stories use only a few thousand distinct words, and simple grammar, while still requiring the model to track characters, objects and events. We use the second version, which contains only the GPT-4 stories: 2.7 million stories, 2.2 GB of text.

```sh
uv run lmc data tinystories      # download both splits (2.2 GB and 22 MB)
uv run lmc tokenise              # train the tokeniser, encode everything (≈ 1 minute)
```

### A tokeniser for CourseGPT

We train a byte-level BPE tokeniser with the course’s own code (Chapter 3, `lmcourse/bpe.py`, which mirrors the TypeScript version merge for merge) on the first 100 MB of the training split. The vocabulary is the 256 bytes, 7,935 merges and one special token, `<|endoftext|>`: **8,192 tokens** in all. A power of two keeps the embedding and output matrices friendly to GPU kernels.

::course-tokeniser

Compression saturates early because TinyStories is so repetitive: by 4,000 merges almost every common word is a single token, and later merges only add rarer words. On the whole corpus the tokeniser averages 4.08 bytes per token, so the 2.19 billion bytes of training text become 536 million tokens. Text unlike TinyStories — Shakespeare, or technical English — breaks into many more pieces, just as Chapter 3’s Shakespeare tokeniser struggled with modern English.

### From text to token files

Encoding 2.2 GB of text is a real job for Python. Two things make it take seconds rather than hours. First, the per-chunk cache of Chapter 3: TinyStories has only about 21,500 distinct pre-tokenisation chunks, so after the first few thousand stories almost every word is already in the cache. Second, the stories are independent, so they can be encoded in parallel: `lmc tokenise` splits them into blocks of 2,000 and hands the blocks to one process per CPU core. On a 16-core machine the training split takes 21 seconds.

The token stream is simply all the stories concatenated, each preceded by `<|endoftext|>`:

```
<|endoftext|> Once upon a time … happy. <|endoftext|> One day, a little boy … <|endoftext|> …
```

It is stored as a flat file of **16-bit unsigned integers**, since every id is below $2^{16}$: 1.07 GB for the training split, half the size of 32-bit ids. The training loop opens it as a **memory map** (`np.memmap`), which lets the program index the file as if it were an array in memory. The operating system reads the pages actually touched, and caches them; nothing is loaded up front. Each batch is 32 random windows of 513 tokens (512 inputs and their 512 targets, shifted by one), exactly as in Chapter 12.

A random window usually spans the end of one story and the start of another. The model sees `<|endoftext|>` and learns that what follows is a fresh story, unrelated to the one before; GPT-2 and GPT-3 were trained on such streams. Some later models mask attention across document boundaries instead, so that tokens cannot attend to the previous document at all. At generation time, we give the model a lone `<|endoftext|>`, and it begins a new story.

## Two implementations, one model

The browser engine and the PyTorch lab implement the same architecture, but they share no code. The WebGPU `Gpt` class runs WGSL kernels that we wrote in Chapters 8–11; the PyTorch `GPT` calls cuBLAS and PyTorch’s own kernels. CourseGPT will be trained by one and run by the other. If they differ anywhere — a transposed weight matrix, a different GELU approximation, a LayerNorm with a different $\epsilon$, a missing $1/\sqrt{d}$ — the weights will load without complaint and produce nonsense, or, worse, something slightly degraded that we never notice.

A **parity test** rules this out. It gives both implementations the same inputs and weights and checks that they produce the same outputs:

1. Python builds a small model with random weights (not the initial ones, so that every parameter matters), runs a batch through it in float64, and writes the weights, the inputs, the logits and the loss to a fixture file (`training/fixtures/gpt_parity.json`).
2. A TypeScript test loads the weights into the WebGPU `Gpt`, runs the same batch, and compares the numbers.

Our models store linear weights as (inputs, outputs) and compute $x W$; PyTorch’s `nn.Linear` stores (outputs, inputs) and computes $x W^\top$. That is why the course’s PyTorch model uses plain parameter matrices with the browser’s layout and the browser’s names (`h3.attn.q`, `h3.mlp.fc`, …): a checkpoint then moves between the two without any renaming or transposition, and the parity test checks it.

“The same numbers” needs care, because floating-point arithmetic is not exact. Summing the same values in a different order gives slightly different results, and the GPU sums in a different order from the CPU. The comparison must allow for a tolerance, and the right tolerance depends on the precision. The standard test, used by `torch.allclose` and `numpy.allclose`, accepts each element if

:::equation{#allclose caption="The element-wise closeness test used for parity: an absolute tolerance for values near zero, plus a relative one for the rest."}
$$
\lvert a_i - e_i \rvert \;\le\; \term{atol}{\text{atol}} + \term{rtol}{\text{rtol}} \cdot \lvert e_i \rvert
$$
:::

```terms
atol:
  label: "atol — the absolute tolerance"
  what: An allowance that does not depend on the size of the expected value.
  why: Near zero, a relative tolerance would demand impossible accuracy; 10⁻¹⁰ versus 10⁻¹² is a relative error of 100, but both are "zero" for practical purposes.
rtol:
  label: "rtol — the relative tolerance"
  what: An allowance proportional to the expected value's size.
  why: Rounding errors are relative. In float32 a single operation is off by at most about 6 × 10⁻⁸ of its result, and errors grow through a long computation, so rtol ≈ 10⁻⁵ is typical for float32 and ≈ 10⁻² for bfloat16.
```

When a parity test fails, the size and location of the worst error are the best debugging clues. An error of $10^{-6}$ is rounding; an error of $0.1$ everywhere is a bug; an error confined to one position, or one head, points straight at the culprit.

:::question
**Choose a useful tolerance.** For a reference value near zero, a relative tolerance alone is ineffective. For large values, a fixed absolute tolerance can be too strict. The parity check combines both: absolute error ≤ absolute tolerance + relative tolerance × magnitude of the reference. Explain which term dominates in each case before comparing the two implementations.
:::

The course has parity tests at every level: the tensor operations of Chapter 4, the GPU kernels of Chapter 8, the Transformer of Chapter 11, and now the tokeniser and the trained CourseGPT. CourseGPT’s tokeniser test encodes 105 texts (TinyStories, punctuation, numbers, accents, emoji and odd whitespace) in both Python and TypeScript and requires identical ids — tokenisers must match *exactly*, since a single different id changes everything after it.

## Mixed precision

### Formats

A float32 number has 1 sign bit, 8 exponent bits and 23 mantissa bits: about seven significant decimal digits over a range from $10^{-38}$ to $10^{38}$. Neural networks do not need seven digits. Their weights and activations are noisy estimates anyway, and training is a noisy process. What they need is **range**: gradients can be as small as $10^{-10}$ and activations occasionally reach thousands.

::float-formats

Smaller formats are faster for two reasons. They halve the bytes moved to and from memory, which is what limits memory-bound kernels (Chapter 8). And modern GPUs have **tensor cores**, units that multiply small matrix tiles of 16-bit numbers, accumulating in float32, at many times the rate of ordinary arithmetic. On the RTX 4060 Ti, an $8192 \times 8192$ matrix product runs at 13.7 TFLOP/s in float32, 22.6 in **TF32** — a tensor-core mode that rounds float32 inputs to 10 mantissa bits — and 46.7 in bfloat16.

The two 16-bit formats trade range against precision differently. **float16** (IEEE half precision) keeps 10 mantissa bits but only 5 exponent bits, so it cannot represent anything above 65,504 or below about $6 \times 10^{-8}$. **bfloat16** (“brain float”, designed at Google Brain) keeps float32’s 8 exponent bits and only 7 mantissa bits: the top half of a float32. It has float32’s range with about two to three significant digits :cite[kalamkar2019]. Converting float32 to bfloat16 is just rounding off the bottom 16 bits, which you implement in the exercise below.

::exercise{id="bf16"}

### Mixed-precision training

Doing *everything* in 16 bits fails. A weight update is often a million times smaller than the weight itself; in bfloat16, $1 + 10^{-4}$ is exactly 1, so the update simply disappears. Sums over many elements (the variance in LayerNorm, the denominator of softmax, the loss) lose accuracy too. **Mixed-precision training** :cite[micikevicius2018] keeps precision where it matters and saves it where it does not:

- The **master weights** stay in float32, and so do the gradients with respect to them and the optimiser’s moments. Updates are applied in float32.
- Matrix multiplications — nearly all the FLOPs — run in 16 bits on the tensor cores, with float32 accumulation.
- Reductions and numerically delicate operations (softmax, LayerNorm, the cross-entropy loss) run in float32.

PyTorch implements this policy as **autocast**. Inside `with torch.autocast("cuda", dtype=torch.bfloat16):`, each operation casts its inputs to the precision it is allowed: `matmul` and `scaled_dot_product_attention` to bfloat16; `softmax`, `layer_norm` and `cross_entropy` to float32. The weights themselves remain float32 parameters, and the backward pass mirrors the casts. That single `with` block, which `lmc train` has used since Chapter 12, is the whole change to the training loop.

### Loss scaling

With float16, the narrow range causes a second problem. Gradients are small, and many of them fall below float16’s smallest number and **underflow** to zero: those parameters silently stop learning. The fix is **loss scaling**: multiply the loss by a large constant $S$ before the backward pass. By the chain rule every gradient is multiplied by $S$ too, which moves them all up into float16’s range. Divide the gradients by $S$ before the optimiser step, in float32, and the update is unchanged.

::loss-scaling

Choose $S$ too large and the largest gradients overflow to infinity instead. **Dynamic loss scaling** finds a good value automatically: start high; whenever a gradient overflows, skip that step and halve $S$; after a long run of good steps, double it. `torch.amp.GradScaler` does exactly this.

::exercise{id="loss-scaler"}

bfloat16 needs none of this, since its range is float32’s. That is why it became the standard for training on hardware that supports it: NVIDIA GPUs since the A100 (2020) and the RTX 30 series, and Google’s TPUs, for which it was designed. The frontier has since moved to 8-bit formats :cite[micikevicius2022] for the matrix multiplications, with careful per-tensor or per-block scaling — the same range problem again, in a harder form.

## Memory, and FlashAttention

### Where activation memory goes

To compute gradients, the backward pass needs the activations of the forward pass: the input to every matrix product, every LayerNorm, every GELU. Korthikanti and colleagues counted them for a GPT block :cite[korthikanti2022]: in 16-bit precision, about $34\,BTC$ bytes per block for the linear layers, norms and dropout, plus $5\,hBT^2$ bytes for the attention scores, probabilities and dropout mask, where $h$ is the number of heads.

The second term grows with the *square* of the context length. For CourseGPT’s micro-batch ($B = 32$, $T = 512$, 8 heads) it is 335 MB per layer, more than the $34\,BTC$ term; at $T = 4096$ it would be 21 GB per layer. Long contexts are, first of all, a memory problem.

The attention matrices are also a time problem. Computing $QK^\top$ takes one matrix product, but then the $T \times T$ scores are written to the GPU’s main memory, read back for the softmax, written again as probabilities, and read again for the product with $V$ — and all of it once more, in reverse, in the backward pass. Those steps do a few operations per byte moved, so they are memory-bound: the tensor cores sit idle while the memory system shuffles matrices that exist only for a moment.

### Softmax in one pass

The fix is to never form the matrix. For one query, attention is $o = \sum_i p_i v_i$ with $p_i = e^{s_i} / \sum_j e^{s_j}$. The difficulty is that the normaliser $\sum_j e^{s_j}$ — and, for numerical stability, the maximum score (Chapter 5) — depend on *all* the scores, so it seems we need them all before computing anything.

We do not. Process the keys in blocks, and keep three running quantities: the maximum score so far $m$, the sum of exponentials so far $\ell$ (relative to $m$), and the unnormalised output so far $\mathbf{a}$. When a new block arrives with scores $s_i$:

:::equation{#online-softmax caption="The online softmax update for one block of keys; after the last block, the output is a / ℓ."}
$$
m' = \max\bigl(m,\ \max_{i \in \text{block}} s_i\bigr), \qquad
\ell' = \term{corr}{e^{m - m'}}\,\ell + \sum_{i \in \text{block}} e^{s_i - m'}, \qquad
\mathbf{a}' = e^{m - m'}\,\mathbf{a} + \sum_{i \in \text{block}} e^{s_i - m'}\,\mathbf{v}_i
$$
:::

```terms
corr:
  label: "$e^{m - m'}$ — the correction factor"
  what: The factor by which everything accumulated so far is rescaled when the running maximum increases from m to m′.
  why: The old terms were computed as e^(sᵢ − m); multiplying by e^(m − m′) turns them into e^(sᵢ − m′), as if the new maximum had been known from the start.
  effect: If the maximum does not change, the factor is 1 and the new terms are simply added.
```

The result is exact, not an approximation. Milakov and Gimelshein described this **online softmax** in 2018 :cite[milakov2018]; Rabe and Staats used it to compute attention in memory proportional to $T$ rather than $T^2$ :cite[rabe2021].

::online-softmax

::exercise{id="online-softmax"}

### FlashAttention

**FlashAttention** :cite[dao2022] turns this idea into a fast GPU kernel. Each thread block loads one block of queries into its fast on-chip memory, then streams blocks of keys and values past it, updating $m$, $\ell$ and the output with the online softmax. Scores exist only in registers and shared memory, never in the GPU’s main memory. The backward pass does not store the probabilities either: it recomputes the scores block by block from $Q$ and $K$, using the saved $m$ and $\ell$ of each row. It does *more* arithmetic than the naive version, and it is still much faster, because arithmetic is cheap and memory traffic is not. Dao and colleagues called this being *IO-aware*.

In PyTorch it is one call, which our model has used since Chapter 11: `F.scaled_dot_product_attention(q, k, v, is_causal=True)` dispatches to a FlashAttention kernel when the inputs are 16-bit and the GPU supports it.

::attention-scaling

The measurement shows both effects. For one layer at $T = 4096$, the naive version takes 120 ms and 4 GB for its forward and backward passes; FlashAttention takes 7.3 ms and 129 MB. Each doubling of the context quadruples the naive version’s memory but only doubles FlashAttention’s, and at $T = 8192$ the naive version no longer fits on the 16 GB card at all. FlashAttention-2 :cite[dao2023] and -3 reorganised the work to use more of the GPU, and the idea — tile the computation so that intermediates never leave the chip — is now how every attention kernel is written.

When memory is still short, there is a general fallback: **activation checkpointing** :cite[chen2016]. Keep only some activations, such as each block’s input, and recompute the rest during the backward pass. It costs about one extra forward pass, a third more compute, in exchange for memory proportional to the number of layers rather than to everything inside them.

## Compilation

Our PyTorch model is written as ordinary Python. In **eager mode**, each operation launches its own GPU kernel as soon as Python reaches it: the LayerNorm, then the matrix product, then the GELU, then the addition of the residual. For a large matrix product that is fine. But an element-wise operation like GELU reads its input from memory, does a handful of operations per element, and writes the output back: it is memory-bound, and Chapter 8’s measurements showed such kernels run at a tiny fraction of the GPU’s arithmetic rate. A Transformer block has many of them.

**Kernel fusion** combines consecutive element-wise operations into one kernel, so the intermediate values stay in registers. `torch.compile` :cite[ansel2024] does this automatically:

1. **TorchDynamo** watches the Python bytecode run and records the tensor operations into a graph, falling back to Python for anything it cannot capture (a **graph break**).
2. **AOTAutograd** traces the backward pass of that graph ahead of time, so it can be optimised too.
3. **TorchInductor** generates code: fused kernels written in **Triton** (Chapter 8’s lab) for the element-wise operations and reductions, and calls to cuBLAS or FlashAttention for the big products.

The first training step is slow — compilation takes about a minute — and then every step is faster. Compiled code is specialised to the shapes it saw, so a different shape triggers a recompilation. That is why `lmc train` evaluates with the uncompiled model: the last validation batch is smaller than the rest, and one odd batch is not worth a recompilation.

One more thing wastes GPU time silently: **synchronisation**. PyTorch queues kernels on the GPU and returns immediately, so Python can run ahead and prepare the next step while the GPU works. Calling `.item()` on a GPU tensor, printing it, or converting it to NumPy forces Python to wait until the queue has drained, and the GPU then idles while Python catches up. The Chapter 12 loop read the loss with `.item()` at every step; the Chapter 14 version accumulates it on the GPU and reads it once every 100 steps.

::speed-ladder

Each optimisation of this chapter contributes. Moving the matrix products from float32 to bfloat16 speeds the step up by only 1.5 times, because with naive attention much of the time is memory-bound work that the tensor cores cannot help with. FlashAttention then more than doubles the throughput and cuts peak memory from 7.5 to 4.5 GB, and compilation adds another third. Together they take CourseGPT from about 30,000 to 137,000 tokens per second: 4.6 times faster, at 59% of the card’s bfloat16 peak. The two-hour run would have taken more than nine hours without them.

## Training CourseGPT

### Choosing the settings

CourseGPT has 8 blocks of width 512 with 8 heads of 64, a context of 512 tokens, and learned position embeddings: the Chapter 11 architecture, larger. With 8,192 tokens and the output layer tied to the embedding, it has 29.6 million parameters, 4.2 million of them in the token embedding. Each optimiser step processes 256 sequences, 131,072 tokens, as 8 micro-batches of 32 accumulated (Chapter 12). Training for 8,000 steps reads 1.05 billion tokens, about two passes over TinyStories. By Chapter 17’s rule of thumb, 20 tokens per parameter would be about 600 million; small models are routinely trained for longer than that, because they are cheap to run afterwards.

The learning rate still needs choosing. A full run is too expensive to repeat, so we train the same model for 1/20 of the budget at several learning rates, with AdamW and with Chapter 13’s Muon:

::lr-sweep

With AdamW, the learning rate matters a great deal: $2 \times 10^{-3}$ is best, $10^{-3}$ is too slow, and $8 \times 10^{-3}$ diverges within 300 steps, its loss jumping back above 6 bits per token. Muon — orthogonalised updates for the blocks’ matrices, AdamW for the embeddings and norms, as in Chapter 13 — is better than the best AdamW run at every learning rate tried, reaching 2.06 bits per token against 2.35. Its best rate, 0.04, is the largest we tried, which suggests an even larger one might be better still for so short a run; but the best rate usually falls as runs get longer, and Muon’s updates have a bounded size, so 0.04 is a safe choice for the full run. CourseGPT is trained with Muon at 0.04 (AdamW at $4 \times 10^{-3}$ for the rest), a 250-step warm-up and a cosine decay to a tenth of the peak.

### The run

```sh
uv run lmc train --preset coursegpt            # ≈ 2 hours on an RTX 4060 Ti
uv run lmc train --preset coursegpt --export   # runs/coursegpt/model.safetensors
```

::course-gpt-run

The run took 2 hours 9 minutes, at a median of 138,000 tokens per second: 59% of the 4060 Ti’s bfloat16 peak, with evaluations included in the wall time. CourseGPT finished at **1.65 bits per token** on validation (1.647 on the whole validation split), or 0.40 bits per byte of text — against 5.13 bits per token for the bigram model and 13 for a uniform guess. The training loss ended at the same value: after two passes over the data, with no dropout, the model shows no sign of overfitting, because 30 million parameters cannot memorise half a billion tokens.

Two features of the curve are worth noticing. First, the fast start: the model writes grammatical sentences after 65 million tokens, and from there its stories hold together better and better, as the samples show. Second, the late gains: more than half of the improvement between step 4,000 and step 8,000 came in the last 2,500 steps, as the cosine schedule lowered the learning rate. A lower learning rate lets the optimiser settle into the narrow parts of the loss surface that a high one keeps jumping across (Chapter 12).

## Back in the browser

`--export` writes the weights under the browser’s names in bfloat16, halving the download to about 60 MB; the browser converts them to float32 as it loads them (Chapter 12’s safetensors reader). The site cannot keep files that large in git, so the weights are published as an asset of a GitHub release, and the build downloads them into the site, checking a SHA-256 hash (`scripts/weights.mjs`).

Before trusting the browser’s CourseGPT we run one last parity test. Python loads the exported bfloat16 weights into the PyTorch model, converts them to float64, and records the logits for a TinyStories sentence; the TypeScript test (`packages/core/src/gpu/coursegpt.test.ts`) loads the same file into our WebGPU `Gpt` and compares. On the prompt “Once upon a time, there was a little girl named Lily…”, the largest difference between the two sets of next-token logits — which range up to 16.8 — is $1.8 \times 10^{-5}$, and the losses agree to seven significant figures. Float32 against float64, through eight layers, could hardly do better.

::course-gpt-live

The model you are running was trained by PyTorch with cuBLAS, FlashAttention and Triton kernels, in bfloat16, and it is being evaluated by WGSL kernels that we wrote ourselves, in float32. That the stories come out right is the parity test passing, at scale. Generation is slow because every new token recomputes the whole context; Chapter 15 looks at how to choose each token, and Chapter 16 makes generation fast.

:::history{year=2022 title="FlashAttention" people="Tri Dao, Daniel Fu, Stefano Ermon, Atri Rudra and Christopher Ré"}
By 2021, many researchers had tried to make attention cheaper with approximations — sparse patterns, low-rank projections, kernel tricks — trading quality for speed. Most delivered less real speed-up than their operation counts promised, because they ignored where the time actually went. Tri Dao and colleagues at Stanford took the opposite approach :cite[dao2022]: compute *exact* attention, but organise the computation around the GPU’s memory hierarchy, using the online softmax that Milakov and Gimelshein had published for a different purpose in 2018 :cite[milakov2018].

The result made GPT-2 training three times faster and made long contexts affordable. FlashAttention was adopted by every major framework within a year, and its lesson — count bytes moved, not just operations — has shaped kernel design ever since :cite[horace2022].
:::

:::breakit
- Train the smoke preset in float16 without loss scaling: add `dtype=torch.float16` to the autocast. What happens to the loss? Now add a `torch.amp.GradScaler` and watch its scale in the first 100 steps.
- In `lmc ch14 speed`, keep the naive attention and raise the context to 2,048. At what batch size does the 4060 Ti run out of memory, with and without FlashAttention?
- Change the parity fixture’s GELU to the exact (erf) form in `model.py` and run the TypeScript test. How large is the error? Would you notice it in the loss?
- Encode the corpus without the `<|endoftext|>` separators and train the smoke preset. How do the samples change?
:::

## Lab: the scaled-up training loop

All the chapter’s measurements come from `lmcourse/ch14.py`; the training loop is `lmcourse/train.py`, now about 300 lines:

```sh
uv run lmc data tinystories && uv run lmc tokenise   # data (≈ 2 minutes)
uv run lmc train --preset smoke                      # a one-minute run: check everything works
uv run lmc ch14 sweep                                # the learning-rate sweep (≈ 45 minutes)
uv run lmc train --preset coursegpt                  # CourseGPT (≈ 2 hours)
uv run lmc ch14 speed | attention | precision        # the chapter's measurements
uv run lmc train --preset coursegpt --set lr=2e-3 layers=6 name=mine   # any variation
```

Compared with Chapter 12’s loop, the changes are: token files read through a memory map, with pinned memory and asynchronous copies to the GPU; bfloat16 autocast; `torch.compile`; the loss accumulated on the GPU instead of read at every step; Muon as an option; MFU logged against the GPU’s bfloat16 peak; and a sample story written at every evaluation, with a fixed seed, so checkpoints can be compared.

:::exercises
1. **Tokeniser size.** Retrain the tokeniser with 4,096 and 16,384 tokens (`lmc tokenise --vocab … --force`) and train the smoke preset on each. Compare validation loss in *bits per byte*, which is independent of the tokeniser. Which is best for this model size, and why might the answer change for a larger model?
2. **Where the parameters are.** What fraction of CourseGPT’s parameters and of its FLOPs per token are in the token embedding and output layer? How would these change with GPT-2’s vocabulary of 50,257?
3. **Measure memory.** Use `torch.cuda.max_memory_allocated()` to measure one training step of CourseGPT at micro-batches of 8, 16, 32 and 64, with and without FlashAttention. Fit a line and compare its slope with the $34\,BTC + 5\,hBT^2$ estimate.
4. **Activation checkpointing.** Wrap each block’s forward in `torch.utils.checkpoint.checkpoint` and measure the memory saved and the throughput lost.
:::

:::challenge
1. **Flash attention in WGSL.** Write a WebGPU kernel for the forward pass of causal attention using the online softmax: one workgroup per block of queries, looping over blocks of keys in shared memory. Check it against `multiHeadAttention` and measure it at $T = 128$ to $2048$.
2. **Document masking.** Change the training loop so that no token attends across an `<|endoftext|>` boundary (pass an explicit mask, or use PyTorch’s `flex_attention`). Does validation loss improve?
3. **bfloat16 in the browser.** Store CourseGPT’s weights on the GPU as bfloat16 (two per 32-bit word) and unpack them in the matmul kernel. How much memory does it save, and does the parity test still pass at a looser tolerance?
:::

## Check your understanding

```quiz
q: "Why does bfloat16 training usually not need loss scaling, while float16 training does?"
options:
  - text: "bfloat16 has float32's 8-bit exponent, so small gradients stay representable; float16's 5-bit exponent underflows below about 6 × 10⁻⁸."
    correct: true
    why: The two formats differ in range, and underflow is a range problem.
  - text: bfloat16 has more mantissa bits than float16.
    why: It has fewer — 7 against 10.
  - text: bfloat16 is computed in float32 on tensor cores.
    why: Both 16-bit formats accumulate in float32 on tensor cores; the inputs are still 16-bit.
```

```quiz
q: "In mixed-precision training, why are the master weights kept in float32?"
options:
  - text: "Updates are often far smaller than the weights; in a 16-bit format, w + Δw would round back to w and learning would stall."
    correct: true
    why: bfloat16 cannot distinguish 1 from 1 + 10⁻⁴.
  - text: Tensor cores require float32 weights.
    why: Tensor cores multiply 16-bit inputs; the weights are cast for each product.
  - text: To make checkpoints smaller.
    why: It makes them larger; we export in bfloat16 for the browser.
```

```quiz
q: "FlashAttention does more arithmetic than naive attention. Why is it faster?"
options:
  - text: "It never writes the T × T scores and probabilities to the GPU's main memory; the naive version is limited by that memory traffic, not by arithmetic."
    correct: true
    why: The softmax and masking steps are memory-bound; fusing them into the matrix products removes the traffic.
  - text: It approximates attention with a low-rank matrix.
    why: FlashAttention is exact.
  - text: It skips the masked half of the matrix.
    why: Causal kernels do skip masked blocks, but that is at most a factor of two and not the main effect.
```

```quiz
q: "In the online softmax, what happens when a new block contains a score larger than the running maximum?"
options:
  - text: "The running sum and output are multiplied by e^(m − m′) < 1 before the new block's terms are added."
    correct: true
    why: That re-expresses the old terms relative to the new maximum.
  - text: The previous blocks are recomputed.
    why: Only two running numbers per query (and the output) need rescaling.
  - text: Nothing; the maximum only matters at the end.
    why: Without the rescaling the terms would be relative to different maxima.
```

```quiz
q: "Why is a parity test's tolerance larger for bfloat16 than for float32?"
options:
  - text: "Each bfloat16 value carries only about 3 significant digits, so the two implementations' rounding errors are correspondingly larger."
    correct: true
    why: Tolerances should match the precision of the arithmetic being compared.
  - text: bfloat16 has a smaller range.
    why: It has float32's range.
  - text: GPUs are less deterministic in bfloat16.
    why: Summation order varies in any precision; the precision sets how much it matters.
```

## Further reading

- Ronen Eldan and Yuanzhi Li, *TinyStories* :cite[eldan2023].
- Paulius Micikevicius and colleagues, *Mixed Precision Training* :cite[micikevicius2018].
- Tri Dao and colleagues, *FlashAttention* :cite[dao2022], and Tri Dao, *FlashAttention-2* :cite[dao2023].
- Horace He, *Making Deep Learning Go Brrrr From First Principles* :cite[horace2022]: compute, memory bandwidth and overhead, the three things a GPU program can be limited by.
- Vijay Korthikanti and colleagues, *Reducing Activation Recomputation in Large Transformer Models* :cite[korthikanti2022], and Samyam Rajbhandari and colleagues, *ZeRO* :cite[rajbhandari2020], for when one GPU is not enough.
