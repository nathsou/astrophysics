---
number: 18
title: Modern architecture
summary: CourseGPT's block is GPT-2's, from 2019. Open models since Llama changed four of its parts — RMSNorm, gated SwiGLU MLPs, rotary position embeddings and grouped-query attention. We implement each, measure what each is worth on TinyStories at equal compute, and look at how rotary positions behave beyond the training context.
duration: About 2 hours
prerequisites: [transformer, scaling-laws]
builds:
  - RMSNorm, SwiGLU, RoPE and grouped-query attention, in TypeScript and PyTorch
  - An ablation of the modern block at equal compute
  - A measurement of length extrapolation
---

The Transformer of Chapter 11 is, part for part, GPT-2’s: pre-norm blocks with LayerNorm, an MLP with a GELU, learned position embeddings, and one key and value per attention head. Its outline has not changed since. Almost every detail inside it has. When Meta released Llama in 2023 :cite[touvron2023], its block collected four changes that had each proved themselves in earlier models, and Llama’s design became the default for open models since:

| Part | GPT-2 (2019) | Llama 3 (2024) |
|---|---|---|
| Normalisation | LayerNorm | RMSNorm |
| MLP | GELU, 4× width | SwiGLU, 3.5× width (2.7× in Llama 1 and 2) |
| Positions | learned embedding added to the input | rotary embeddings applied to queries and keys |
| Keys and values | one per head | shared by groups of heads (GQA) |
| Biases | yes | none |

Our models dropped the biases from the start (Chapter 11). This chapter takes each change in turn: what it does, why it helps, and — since we can — what it is worth. For that, the 6 × 384 model that Chapter 17 found compute-optimal at $6.25 \times 10^{15}$ FLOPs is trained seven times with the same data, schedule and optimiser: as GPT-2’s block, twice with different random seeds; with each change alone; and with all four.

## RMSNorm

LayerNorm (Chapter 7) subtracts the mean of each vector, divides by its standard deviation, then scales and shifts with learned parameters. Zhang and Sennrich asked which of those steps matter, and found that dropping the mean subtraction and the shift loses nothing :cite[zhang2019rms]:

:::equation{#rmsnorm caption="RMSNorm: divide by the root mean square, scale by a learned gain."}
$$
\operatorname{RMSNorm}(\mathbf x) \;=\; \frac{\mathbf x}{\sqrt{\tfrac{1}{C}\sum_i x_i^2 + \epsilon}} \odot \term{g}{\mathbf g}
$$
:::

```terms
g:
  label: "$\\mathbf g$ — the gain"
  what: One learned scale per coordinate, initialised to 1. There is no bias.
  why: What normalisation needs to do is keep the scale of the residual stream's contributions under control. Re-centring turns out not to be needed.
  effect: One reduction per vector instead of two, and half the parameters. On a GPU the saving is small in FLOPs but real in memory traffic.
```

Where the norm sits matters more than which norm it is. Chapter 11 placed it before each sublayer (**pre-norm**), as GPT-2 did, rather than after the residual addition as the original Transformer did; pre-norm keeps a clean path for gradients through the residual stream and trains stably without careful warm-up :cite[xiong2020]. Some recent models add a norm to the queries and keys too (**QK-norm**), which stops attention logits from growing without bound in long, large runs :cite[wortsman2023].

::exercise{id="rmsnorm"}

## Gated MLPs: SwiGLU

The MLP of every block so far computes $W_2\, \operatorname{GELU}(W_1 \mathbf x)$. A **gated linear unit** :cite[dauphin2017] computes two projections instead and multiplies them element by element, one passed through a nonlinearity and acting as a gate on the other. With the SiLU nonlinearity, $\operatorname{SiLU}(z) = z\, \sigma(z)$ :cite[ramachandran2017], it is SwiGLU :cite[shazeer2020]:

:::equation{#swiglu caption="The SwiGLU MLP: a gate, a value and an output projection."}
$$
\operatorname{MLP}(\mathbf x) \;=\; W_2 \bigl( \operatorname{SiLU}(\term{Wg}{W_g}\,\mathbf x) \odot W_1 \mathbf x \bigr)
$$
:::

```terms
Wg:
  label: "$W_g$ — the gate projection"
  what: A third matrix, of the same shape as W₁. Its output, through SiLU, decides element by element how much of W₁x passes.
  why: Multiplying two learned projections lets each hidden unit compute a product of features, not just a thresholded sum, which gives the MLP more expressive power per parameter.
  effect: Three matrices instead of two, so the hidden width shrinks to ⅔ of 4C (about 2.7C) to keep the parameter count equal; that is what our models and Llama do.
```

Shazeer tested a family of GLU variants in a Transformer and found them consistently better than the plain MLP. The paper’s conclusion is famously candid: “We offer no explanation as to why these architectures seem to work; we attribute their success, as all else, to divine benevolence.”

::exercise{id="swiglu"}

## Rotary position embeddings

Our models learn a vector for each position and add it to the token embedding before the first block. It works, but it has two weaknesses. The model must learn separately what “three tokens back” means at every position, since nothing tells it that positions 10 and 13 relate as 100 and 103 do. And there are no vectors at all for positions beyond the training context.

**Rotary position embeddings** (RoPE) :cite[su2021] encode position inside attention instead. Split each head’s query and key vectors into pairs of coordinates, and rotate each pair by an angle proportional to the position:

:::equation{#rope caption="RoPE rotates each coordinate pair i of a query or key at position m by the angle m·θᵢ."}
$$
\begin{pmatrix} x'_{i} \\ x'_{i + d/2} \end{pmatrix} = \begin{pmatrix} \cos m\theta_i & -\sin m\theta_i \\ \sin m\theta_i & \cos m\theta_i \end{pmatrix} \begin{pmatrix} x_{i} \\ x_{i + d/2} \end{pmatrix}, \qquad \term{theta}{\theta_i} = 10000^{-2i/d}
$$
:::

```terms
theta:
  label: "$\\theta_i$ — the frequency of pair i"
  what: "The angle pair i turns per position: 1 radian for the first pair, falling geometrically to about 1/10,000 for the last."
  why: A spread of frequencies, like the hands of a clock, lets attention tell apart both nearby positions (fast pairs) and distant ones (slow pairs).
```

The payoff is in the dot product. Rotating the query by $m\theta_i$ and the key by $n\theta_i$ changes their score exactly as rotating the query alone by $(m - n)\theta_i$ would: the score depends only on the **offset** $m - n$. Relative position is built into attention, and nothing is added to the residual stream.

::rope-explorer

::exercise{id="rope"}

## Sharing keys and values

In multi-head attention every head has its own keys and values, so the KV cache of Chapter 16 grows with the number of heads. Shazeer proposed **multi-query attention** (MQA), in which all query heads share a single key and value head :cite[shazeer2019]; it shrinks the cache by the number of heads, at some cost in quality. **Grouped-query attention** (GQA) :cite[ainslie2023] is the compromise that stuck: groups of query heads share one key/value head. Llama 3 70B has 64 query heads and 8 key/value heads.

::kv-heads

The saving is in inference memory and bandwidth, not training compute: the key and value projections shrink, but they were a small part of the FLOPs. At long contexts and large batches, though, the KV cache is what limits how many users one GPU can serve (Chapter 16), and dividing it by eight matters far more than a slightly smaller model.

::exercise{id="gqa"}

## What each change is worth

::ablation-results

Start with the noise: the two baseline runs, identical except for the random seed, finish 0.008 bits per token apart. Any smaller difference means nothing.

Measured against that, most of the changes do nothing we can detect at this scale. **RMSNorm** matches LayerNorm (+0.001) and is slightly faster — which is the claim its authors made for it. **SwiGLU** is ahead by 0.003, well within the noise. **RoPE** is the one clear win: 0.029 bits per token better, more than three times the noise, even though our straightforward implementation made each step 11% slower. **Grouped-query attention** with 2 key/value heads for 6 query heads is 0.020 worse. It has 8% fewer parameters, and it was not meant to improve the loss: it buys a KV cache three times smaller, 1.6 MB per sequence instead of 4.7.

The full Llama-style block ends 0.021 *worse* than the baseline — worse even than its parts suggest, since RoPE’s gain should have offset GQA’s loss. We would need more seeds to be sure of that last difference, but not to see the main point. These changes were chosen for models thousands of times larger, trained for far longer, where their benefits have been measured repeatedly: SwiGLU’s in Shazeer’s experiments, RMSNorm’s in speed, GQA’s in serving cost. At 14 million parameters and 70 million tokens they are mostly neutral, and an architecture change is only worth what it is worth at the scale you train at. RoPE, whose benefit is to make relative position easy to learn, is the one that pays off even here.

## Beyond the training context

Nothing stops a RoPE model from attending over 2,048 positions after training on 512: the rotation is defined for any position. Whether it *works* is another matter.

::long-context

Within the training context, the RoPE model ties the learned-position model over the first 64 positions and beats it everywhere after, by up to 0.12 bits per token. (For both, most of the benefit of context arrives within the first 64 tokens.) Just past 512 it holds up for a few dozen positions, then collapses: 4.8 bits per token by position 768, and beyond 1,500 worse than a unigram model that ignores context altogether. The slow pairs are the reason. A pair that turns by 1/10,000 of a radian per position has, at offsets beyond 512, reached angles it never produced in training, and the attention patterns learned for familiar angles misfire on unfamiliar ones. RoPE makes relative position *easy to learn*, not automatically extendable.

Extending the context of a trained model is therefore its own technique. **Position interpolation** :cite[chen2023pi] squeezes the longer range of positions into the trained one — position $m$ in a context twice as long is rotated as position $m/2$ — and a short fine-tuning run adapts the model. **YaRN** :cite[peng2023yarn] interpolates the slow pairs but leaves the fast ones alone, since those encode nearby positions that should not change. Most long-context models are trained at a modest length and extended in a final phase of training this way. **ALiBi** :cite[press2022] takes a different route, adding a penalty proportional to distance to each attention score, which extrapolates more gracefully. And **sliding-window attention**, as in Mistral 7B :cite[jiang2023], lets each layer attend only to the last few thousand positions, relying on stacked layers to carry information further.

:::history{year=2023 title="The Llama block" people="Hugo Touvron and colleagues (Meta)"}
None of Llama’s changes was new in 2023. RMSNorm was published in 2019, SwiGLU in 2020 and used in Google’s PaLM, rotary embeddings in 2021 by Jianlin Su and colleagues (first in a blog post, in Chinese), and multi-query attention in 2019. What Llama did was combine them, train on far more tokens per parameter than was then usual (Chapter 17), and release the weights to researchers :cite[touvron2023].

The weights spread well beyond their intended audience within a week, and within months dozens of models were built on them or copied their design. Llama 2 added grouped-query attention to its largest models; Llama 3 used it at every size :cite[dubey2024]. By 2024 the block in this chapter was simply what an open language model looked like, and most of the architectural novelty had moved elsewhere: into mixtures of experts (Chapter 19) and into longer contexts.
:::

:::breakit
- Set RoPE’s base to 100 instead of 10,000 in `rope_tables` and retrain the RoPE variant. What happens to the slow pairs, and to loss at long offsets?
- Train the SwiGLU variant with the full 4C hidden width instead of ⅔ of it. It has a third more parameters: is the comparison with the baseline still fair?
- Use multi-query attention (one key/value head) in the ablation. How much worse is it than GQA with 2 heads?
:::

## Lab: the ablation

```sh
uv run lmc ch18 ablation    # 7 runs of 6 × 384 at 6.25 × 10¹⁵ FLOPs (about 35 minutes)
uv run lmc ch18 context     # loss by position up to 2,048 tokens
uv run lmc train --preset coursegpt --set norm_type=rms mlp_type=swiglu pos=rope kv_heads=2 name=llama-course
```

`lmcourse/model.py` gained four options — `norm_type`, `mlp_type`, `pos` and `kv_heads` — whose defaults reproduce the original GPT-2 block exactly, so every earlier checkpoint still loads. The last command trains a Llama-style CourseGPT.

:::exercises
1. **Seeds.** Our ablation has one run per variant and two for the baseline. Train two more seeds of the Llama-style model and the baseline. Is the difference still clearly larger than the spread?
2. **QK-norm.** Add RMSNorm to queries and keys before RoPE, and train at a learning rate three times higher. Does it make training more stable?
3. **Position interpolation.** Take the RoPE model, scale positions by ½, fine-tune for 200 steps at context 1,024, and measure loss by position again.
4. **ALiBi.** Replace RoPE with ALiBi’s distance penalties (one slope per head) and compare extrapolation to 2,048 positions.
:::

:::challenge
1. **A Llama-style CourseGPT in the browser.** Add RMSNorm, SwiGLU, RoPE and GQA to the WebGPU `Gpt` class, with parity tests against the PyTorch model, and run a Llama-style CourseGPT in the Chapter 16 engine. How much smaller is its KV cache?
2. **Sliding windows.** Implement sliding-window attention with a window of 128 in the ablation model. How much does loss suffer at context 512, and how much memory does it save at 8,192?
3. **Parallel blocks.** GPT-J and PaLM compute the attention and the MLP in parallel from the same normalised input. Try it: is it as good, and is it faster?
:::

## Check your understanding

```quiz
q: "What does RMSNorm leave out compared with LayerNorm?"
options:
  - text: "The mean subtraction and the learned bias; it only divides by the root mean square and scales."
    correct: true
    why: The scale is what needs controlling; re-centring turned out to be unnecessary.
  - text: The learned gain.
    why: It keeps the gain; it drops the bias.
  - text: The division, keeping only the mean subtraction.
    why: The division is the part it keeps.
```

```quiz
q: "Why does RoPE make attention scores depend only on relative position?"
options:
  - text: "Rotating the query by mθ and the key by nθ changes their dot product exactly as rotating the query alone by (m − n)θ would."
    correct: true
    why: Rotations preserve dot products, so only the difference of the angles matters.
  - text: It adds the offset to every attention score.
    why: That is closer to ALiBi.
  - text: It removes the position information entirely.
    why: Position is still there, as rotation angles.
```

```quiz
q: "A model has 32 query heads and 8 key/value heads. By how much does its KV cache shrink compared with multi-head attention?"
options:
  - text: "By a factor of 4: only 8 heads of keys and values are stored instead of 32."
    correct: true
    why: The cache stores keys and values, not queries.
  - text: By a factor of 32.
    why: That would be multi-query attention, with one key/value head.
  - text: Not at all; only compute is saved.
    why: Memory is the main saving.
```

```quiz
q: "Why is the SwiGLU hidden width about ⅔ of the GELU MLP's?"
options:
  - text: "SwiGLU has three matrices instead of two; ⅔ of the width keeps the parameter count (and compute) the same."
    correct: true
    why: 3 × ⅔ = 2 matrices' worth.
  - text: The gate halves the number of active units.
    why: Every unit is computed; the gate scales it.
  - text: SiLU needs fewer units than GELU.
    why: The width change is about parameter count, not the nonlinearity.
```

## Further reading

- Hugo Touvron and colleagues, *LLaMA: Open and Efficient Foundation Language Models* :cite[touvron2023], and the Llama 3 report :cite[dubey2024].
- Jianlin Su and colleagues, *RoFormer* :cite[su2021].
- Noam Shazeer, *GLU Variants Improve Transformer* :cite[shazeer2020].
- Joshua Ainslie and colleagues, *GQA* :cite[ainslie2023].
- Bowen Peng and colleagues, *YaRN* :cite[peng2023yarn].
