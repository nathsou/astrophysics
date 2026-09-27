---
number: 16
title: Inference engine
summary: Generating text is a different workload from training — one token at a time, limited by memory rather than arithmetic. We add a KV cache to our WebGPU engine, measure why decoding is memory-bound, quantise CourseGPT's weights to int8, and use speculative decoding to produce several tokens per pass of the model.
duration: About 2½ hours
prerequisites: [sampling, gpu-compute]
builds:
  - A KV cache and a cached-attention WGSL kernel
  - Int8 weight-only quantisation with a dequantising matmul kernel
  - Speculative decoding with a draft model and with prompt lookup
  - A decoding benchmark for your own GPU
---

In Chapters 14 and 15, CourseGPT generated each token by running the model over the entire story so far. Token 300 cost as much as a 300-token forward pass, even though the first 299 positions gave exactly the same results as the step before. This chapter builds a proper **inference engine**: code that runs a trained model as fast as possible, for generation.

Inference is a different problem from training. Training processes large batches of complete sequences, and its matrix products keep the GPU’s arithmetic units busy (Chapter 14 reached 59% of the peak). Generation produces one token at a time, each depending on the last, and — as we will measure — it spends most of its time waiting for memory. The techniques of this chapter, a KV cache, quantisation and speculative decoding, are how every production system copes, and our WebGPU engine gets all three.

## Two phases: prefill and decode

Generation has two phases. In **prefill**, the model reads the prompt. All its tokens are known, so they go through the model together, exactly as in training: matrix–matrix products, parallel across positions. Then comes **decode**: one new token per step, each step a forward pass for a single position, because the next token depends on this one.

A single position’s forward pass is a sequence of matrix–*vector* products. Each weight is read from memory and used once, for one multiply and one add. That is the root of everything that follows.

## The KV cache

Look at what a position’s computation depends on. In a causal Transformer, the keys and values at position $j$ are computed from tokens $1 \ldots j$ only, so they never change when later tokens arrive. When we generate token $t + 1$, the keys and values of positions $1 \ldots t$ are exactly those we computed at earlier steps. The **KV cache** stores them: for every layer, a $T_{\max} \times C$ matrix of keys and one of values. Each decode step then computes the new position only — its query, key and value, its attention over the cache, its MLP — and appends its key and value.

::kv-cache-cost

The cache trades memory for compute. For one sequence it holds

:::equation{#kv-memory caption="Memory held by the KV cache for one sequence."}
$$
\text{bytes} = 2 \times \term{L}{L} \times \term{T}{T} \times \term{C}{C} \times \text{bytes per number}
$$
:::

```terms
L:
  label: "$L$ — layers"
  what: Every layer caches its own keys and values.
T:
  label: "$T$ — positions cached"
  what: The prompt plus everything generated so far, up to the context length.
C:
  label: "$C$ — width of the keys (and of the values)"
  what: In our models, the model width. Models with multi-query or grouped-query attention share keys and values between heads, so C here is only the width of the few key–value heads (Chapter 18).
```

For CourseGPT at its full context of 512 tokens that is $2 \times 8 \times 512 \times 512 \times 4$ bytes, 17 MB in float32: small next to its 120 MB of weights. For large models the balance shifts. An 8-billion-parameter model with 32 layers and grouped-query attention stores about 128 KB per token in bfloat16, so a 32,000-token conversation needs 4 GB of cache — per user. Serving systems manage that memory carefully; vLLM’s **PagedAttention** allocates it in fixed-size pages, like an operating system’s virtual memory, so that many conversations can share one GPU without reserving memory they may never use :cite[kwon2023]. **Multi-query** and **grouped-query attention** shrink it at the source by sharing keys and values across heads :cite[shazeer2019,ainslie2023].

::exercise{id="kv-attention"}

### In our engine

`GptRunner` in `@lm/core/gpu` wraps a trained `Gpt` for generation. `runner.forward(cache, ids)` embeds the new tokens at positions `cache.length, …`, and in each layer computes their queries, keys and values, copies the keys and values into the cache, and calls a new kernel, `attendCached`. It runs one workgroup per (new token, head): the workgroup computes the scores against every cached key into fast workgroup memory, takes their maximum and the sum of exponentials with parallel reductions, and finally each thread produces one dimension of the output as a weighted sum of cached values. The same call handles prefill (many new tokens) and decode (one). A test checks that prefilling, decoding token by token, or feeding chunks all give the same logits as the full forward pass of Chapter 11.

::decode-bench

On an RTX 4060 Ti in Chromium, the medians are 10.4 ms per token without a cache, rising from about 10 to 12 ms as the context grows to 434 tokens; 5.5 ms with the cache, flat; and 5.4 ms with the cache and int8 weights. The cache halves the time — but not by the factor of hundreds that counting operations suggests, and int8 changes nothing. Both results say the same thing: at this scale a step costs about 5 ms whatever work it does. The next section explains why the arithmetic is nearly free, and what the time is spent on instead.

Writing the engine taught one more lesson. Our first version used Chapter 8’s tiled matrix product for decoding too, and took 9 ms per token. That kernel is built for large matrices: for a single row it launches only a handful of workgroups, each working through its tile in sequence, and most of the GPU sits idle. Decoding needs **matrix–vector** kernels, which give every workgroup a few outputs and split each output’s sum across its threads. With those, the step fell to 5.5 ms.

## Why decoding is memory-bound

A matrix–vector product with an $n \times n$ matrix does $2n^2$ floating-point operations and reads $n^2$ weights. In float32, that is 2 operations per 4 bytes: an **arithmetic intensity** of 0.5 FLOP/byte. Chapter 8’s roofline model :cite[williams2009] says a GPU is memory-bound below its *ridge point*, peak FLOP/s divided by bandwidth. For the RTX 4060 Ti that is $44 \times 10^{12} / 288 \times 10^{9} \approx 150$ FLOP/byte. Decoding one sequence is three hundred times below it.

So the time of a decode step is set by how fast the weights can be read: at 288 GB/s, the 16 GB of an 8-billion-parameter model in bfloat16 take 56 ms, a ceiling of about 18 tokens per second whatever the arithmetic units could do. Two things raise the ceiling. **Batching** decodes many sequences in the same step: the weights are read once and used for every sequence, so the arithmetic intensity grows with the batch. Serving systems use **continuous batching**, admitting new requests into the running batch at every step instead of waiting for a whole batch to finish :cite[yu2022]. And **fewer bytes per weight** means fewer bytes to read, which is where quantisation comes in.

::memory-bound

Our browser engine does not reach this ceiling. CourseGPT’s 120 MB of float32 weights could be read in about half a millisecond, but each decode step launches around a hundred small kernels and ends with a copy of the logits back to JavaScript, and those fixed costs dominate a model this small. Large models on server GPUs are much closer to the memory bound, which is why the next two techniques matter so much there.

## Quantisation

A float32 weight takes 4 bytes; bfloat16, 2. Quantisation goes further and stores each weight as a small integer — 8 bits, 4, even fewer — with a floating-point **scale** shared by a group of weights. The simplest scheme, symmetric absmax quantisation, maps each group’s largest magnitude to the largest integer:

:::equation{#absmax caption="Symmetric absmax quantisation with b bits: one scale per group G of weights."}
$$
s_G = \frac{\max_{i \in G} \lvert w_i \rvert}{\term{qmax}{2^{b-1} - 1}}, \qquad q_i = \operatorname{round}\!\left(\frac{w_i}{s_G}\right), \qquad \hat w_i = s_G\, q_i
$$
:::

```terms
qmax:
  label: "$2^{b-1} - 1$ — the largest integer"
  what: 127 for int8, 7 for int4, 3 for int3. Using ±qmax keeps the grid symmetric around zero.
  why: The rounding error of each weight is at most half a step, s_G / 2, so it is proportional to the largest weight in the group.
  effect: One large outlier makes the step large for its whole group. Smaller groups confine the damage, at the cost of storing more scales.
```

::exercise{id="quantise"}

::quant-explorer

On CourseGPT, int8 with one scale per output channel costs nothing measurable: 1.6536 bits per token against 1.6533 in float32, for a quarter of the memory. Four bits are where the trade-off begins. With one scale per channel, the loss rises by 0.11 bits per token; with a scale for every group of 32 weights, by less than half that, 0.05, for 10% more memory. Three bits cost a third of a bit per token, and two bits destroy the model: at 11.7 bits per token it predicts worse than a unigram count. Large models usually tolerate 4 bits better than small ones, and the methods below close much of the remaining gap, which is why 4-bit versions of billion-parameter models are common on laptops.

Our engine implements **weight-only** int8: `GptRunner.create(model, { int8: true })` quantises every weight matrix (per output channel, and the tied embedding per token), packs four int8 values into each 32-bit word, and runs a matmul kernel that unpacks and rescales them as it goes. Arithmetic stays in float32; only the memory holding the weights shrinks, from 119 MB to 30 MB. Production methods go further. LLM.int8() :cite[dettmers2022] quantises activations too, keeping the rare outlier features in 16 bits. GPTQ :cite[frantar2023] rounds weights one column at a time and adjusts the remaining ones to compensate for each rounding error, and AWQ :cite[lin2024] scales the weights that matter most for the activations before rounding; both make 4-bit models nearly as accurate as 16-bit ones. **Quantisation-aware training** :cite[jacob2018] simulates the rounding during training so the model learns to tolerate it.

## Speculative decoding

A decode step for one token and a forward pass over five tokens cost almost the same, because both are dominated by reading the weights. If we knew the next five tokens, we could check them all for the price of one step. **Speculative decoding** :cite[leviathan2023,chen2023] makes a guess and checks it:

1. A cheap **drafter** proposes $\gamma$ tokens, one after another.
2. The large **target** model runs once over all $\gamma$ drafts (with its KV cache), giving its own distributions $p$ at every draft position, plus one more.
3. The drafts are checked in order. Draft $x_i$, which the drafter sampled from $q_i$, is accepted with probability $\min(1, p_i(x_i) / q_i(x_i))$. At the first rejection, a replacement is sampled from the normalised excess $\max(0, p_i - q_i)$ and the round ends. If all are accepted, one bonus token is sampled from the target’s last distribution.
4. Both KV caches are rolled back to the tokens that survived.

The acceptance rule is the heart of the method, and it makes the output *exactly* as if the target had sampled alone. For one position, token $x$ is emitted either as an accepted draft, with probability $q(x) \min(1, p(x)/q(x)) = \min(p(x), q(x))$, or as a replacement after a rejection:

:::equation{#spec-correct caption="Speculative sampling emits each token with exactly the target's probability."}
$$
P(x) \;=\; \min\bigl(p(x), q(x)\bigr) \;+\; \Bigl(1 - \sum_y \min\bigl(p(y), q(y)\bigr)\Bigr) \frac{\max\bigl(0, p(x) - q(x)\bigr)}{\sum_y \max\bigl(0, p(y) - q(y)\bigr)} \;=\; p(x)
$$
:::

since $\sum_y \max(0, p - q) = 1 - \sum_y \min(p, q)$ and $\min(p, q) + \max(0, p - q) = p$. A bad drafter makes the method slow, never wrong. If each draft is accepted with probability $\alpha$, a round produces $(1 - \alpha^{\gamma + 1}) / (1 - \alpha)$ tokens on average for one pass of the target.

::exercise{id="speculative"}

For CourseGPT we trained a drafter with the same tokeniser: two layers of width 256, 3.8 million parameters, eight times smaller, in under three minutes on the 4060 Ti (`lmc train --preset draft`). With $\gamma = 4$, CourseGPT accepts enough of the drafter’s guesses to produce 2.7 tokens per pass of its own, and the gain grows up to about 3 tokens per pass at $\gamma = 6$ or 7 before the longer drafts are wasted. The first draft is accepted 70% of the time; each later one is less likely to be reached, since a round stops at the first rejection.

A drafter need not be a model. **Prompt lookup** :cite[saxena2023] searches the context for an earlier occurrence of the last few tokens and proposes what followed them. It costs nothing, and it is surprisingly effective whenever text repeats its context: code being edited, documents being summarised, or children’s stories that repeat their characters’ names.

::exercise{id="prompt-lookup"}

::speculative-demo

In the browser the drafter reproduces the lab’s numbers — about 2.8 tokens per CourseGPT pass at $\gamma = 4$ — and yet generation gets *slower*, about 0.7 to 0.9 times the speed of plain decoding. The reason is the one the benchmark found: in our engine a step of the two-layer drafter costs almost as much as a step of CourseGPT, because both are dominated by fixed overheads, so four draft steps and one check cost more than the 2.8 plain steps they replace. Speculative decoding pays when the drafter is much cheaper than the target, as a 4-billion-parameter drafter is for a 70-billion-parameter model. Prompt lookup costs nothing, so it can only help. On a fresh story it rarely finds anything (about 1.03 tokens per pass), but on text that repeats itself — try greedy decoding of the looping prompt from Chapter 15, “Mom said, “Clean your room.” Sam” — it produces 1.5 tokens per pass. Wall-clock ratios in the widget vary from run to run by tens of percent, because a GPU running such a stop-and-go workload keeps changing its clock speed; tokens per pass is the reliable measure.

## Serving many users

A production inference server combines everything in this chapter with scheduling. It batches the decode steps of many requests to use the GPU’s arithmetic (continuous batching), manages KV-cache memory in pages, shares the cache of common prompt prefixes such as a system prompt between requests, splits large models across several GPUs, and runs prefill and decode in ways that keep both efficient :cite[pope2022]. vLLM, SGLang, TensorRT-LLM and llama.cpp are open-source examples. The measure that matters there is not the speed of one sequence but the number of tokens per second per GPU at an acceptable latency for each user.

:::history{year=2022 title="Speculative decoding" people="Yaniv Leviathan, Matan Kalman and Yossi Matias; Charlie Chen and colleagues"}
Processors have long executed instructions *speculatively*: guessing the outcome of a branch, running ahead, and throwing the work away if the guess was wrong. In late 2022 and early 2023, two groups — Leviathan, Kalman and Matias at Google, and Chen and colleagues at DeepMind — independently brought the idea to language models :cite[leviathan2023,chen2023]. Both saw that decoding leaves the accelerator’s arithmetic idle, so checking several guessed tokens is almost free, and both found the rejection-sampling rule that keeps the output distribution exactly unchanged. Chen and colleagues sped up the 70-billion-parameter Chinchilla by two to two and a half times with a 4-billion-parameter drafter.

Speculative decoding is now standard in serving systems, in many variants: drafters that are extra heads on the target model itself, trees of drafts verified at once, and drafts from retrieval or from the prompt.
:::

:::breakit
- In the speculative-decoding widget, set the temperature to 1.5. What happens to the acceptance rate, and why do the draft model’s and CourseGPT’s distributions disagree more when both are flattened?
- Use the draft model with $\gamma = 8$. The number of tokens per target pass rises; does the wall-clock speed? Where does the time go?
- In `inference.ts`, forget to roll back the cache after a rejection (`tCache.length` unchanged). What does the model see, and how would you notice?
- Quantise CourseGPT to int2 in the Python lab (`fake_quantise` with 2 bits). Sample from it. What kind of mistakes does it make?
:::

## Lab: measuring inference in PyTorch

```sh
uv run lmc train --preset draft                 # the drafter (a few minutes)
uv run lmc ch16 quant                           # validation loss at 8, 4, 3 and 2 bits
uv run lmc ch16 speculative                     # tokens per target pass for γ = 1 … 8
```

The Python lab measures what does not depend on our engine: how much quality survives quantisation, and how often CourseGPT accepts the drafter’s guesses. The browser widgets measure the engine itself, on your machine.

:::exercises
1. **The cost of the cache.** Extend the benchmark to generate until the context is full (512 tokens). How does the time per token grow with position, with and without the cache? Which part of the forward pass grows?
2. **Batching.** Give `GptRunner.forward` a batch dimension: several caches, one token each, one set of weight reads. Measure tokens per second for batches of 1, 4 and 16.
3. **int4.** Write a WGSL matmul kernel for int4 weights (eight per 32-bit word) with a scale per group of 32 and compare its speed and CourseGPT’s validation loss with int8.
4. **Acceptance and temperature.** Using `lmc ch16 speculative`, measure the acceptance rate at temperatures 0, 0.7, 1 and 1.5. Explain the trend with the formula for P(x).
:::

:::challenge
1. **Flash-decoding.** Our cached-attention kernel gives each (token, head) one workgroup, so a single decode step of CourseGPT uses only 8 workgroups. Split the keys across several workgroups, each producing a partial softmax (maximum, sum and output), and combine them with the online-softmax rule of Chapter 14. How much faster is it at long contexts?
2. **Self-speculation.** Use CourseGPT’s own first four layers, with the final LayerNorm and output layer, as its drafter. How often are its guesses accepted?
3. **A tree of drafts.** Let the drafter propose its two most likely tokens at each of three steps (eight sequences) and verify all of them in one target pass with an attention mask that follows the tree.
:::

## Check your understanding

```quiz
q: "Why can the keys and values of earlier positions be cached during generation?"
options:
  - text: "With causal attention they depend only on the tokens up to their own position, so they never change when later tokens are added."
    correct: true
    why: That is also why the cache must be discarded when an earlier token changes.
  - text: Keys and values are the same for every position.
    why: They differ for every position; they just do not change over time.
  - text: The queries are cached too, so attention need not be recomputed.
    why: Only keys and values are reused; each new token brings a new query.
```

```quiz
q: "An 8-billion-parameter model is stored in bfloat16 on a GPU with 1 TB/s of memory bandwidth. Roughly how many tokens per second can it decode for a single user?"
options:
  - text: "About 60: each token requires reading all 16 GB of weights, which takes 16 ms."
    correct: true
    why: Decoding at batch size 1 is memory-bound.
  - text: "About 60,000, if the GPU does 1,000 TFLOP/s."
    why: The arithmetic (16 GFLOPs per token) is not the bottleneck; reading the weights is.
  - text: It depends only on the context length.
    why: The weights dominate the bytes read unless the context is very long.
```

```quiz
q: "Why does quantising in groups of 32 lose less accuracy than one scale per output channel?"
options:
  - text: "The rounding step is proportional to the largest weight sharing the scale; small groups keep an outlier from coarsening the steps of hundreds of other weights."
    correct: true
    why: The price is one extra scale per 32 weights.
  - text: Groups of 32 use more bits per weight.
    why: The integers have the same width; only the scales are extra.
  - text: Grouping removes the outliers.
    why: The outlier is still represented; it just only affects its own group.
```

```quiz
q: "A drafter's guesses are accepted with probability α = 0.8 each, with γ = 4. How many tokens does one pass of the target produce on average?"
options:
  - text: "(1 − 0.8⁵) / (1 − 0.8) ≈ 3.4"
    correct: true
    why: The accepted run of drafts is geometric, capped at γ, plus the one token the target adds.
  - text: "4 × 0.8 = 3.2"
    why: That ignores both the geometric stopping and the extra token.
  - text: "5, always"
    why: Only if every draft is accepted.
```

## Further reading

- Reiner Pope and colleagues, *Efficiently Scaling Transformer Inference* :cite[pope2022]: the arithmetic of memory, latency and batching.
- Yaniv Leviathan, Matan Kalman and Yossi Matias, *Fast Inference from Transformers via Speculative Decoding* :cite[leviathan2023].
- Woosuk Kwon and colleagues, *PagedAttention* :cite[kwon2023].
- Elias Frantar and colleagues, *GPTQ* :cite[frantar2023], and Tim Dettmers and colleagues, *LLM.int8()* :cite[dettmers2022].
