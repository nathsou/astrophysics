---
number: 10
title: Attention
summary: Instead of squeezing the past into one state vector, let every position look back directly at every earlier position and take what it needs. Queries, keys and values; the √d scaling; causal masking; multiple heads; what attention costs; and a race on a memory task that recurrence loses badly.
duration: About 3 hours, including the lab
prerequisites: [recurrent-networks, linear-algebra]
builds:
  - Scaled dot-product attention
  - Causal masking
  - Multi-head attention
  - GPU batched matmul, permute and fused masked softmax
  - Attention-only language model
---

A recurrent network reads the text once, left to right, and must decide *as it reads* what to keep in its fixed-size state. When it reaches a point where something from 300 characters back would help — the name of the speaker, the opening quotation mark, the word it is repeating — that information is either still in the state or gone for good.

**Attention** takes the opposite approach: keep everything and look things up when needed. At every position, the model computes a *query* describing what it is looking for, compares it with a *key* at every earlier position, and takes a weighted average of those positions’ *values*, weighted by how well each key matched. Nothing has to be remembered in advance, because the past is always there to consult. And since every position does its lookup independently, all positions can be computed at once, as a few large matrix multiplications — just what a GPU is good at.

This chapter builds attention up from a soft dictionary lookup to multi-head causal self-attention. It adds the GPU kernels attention needs, and ends with two experiments. One shows attention’s main strength: a memory task it solves perfectly and an LSTM cannot. The other shows its limits: an attention-only language model that is fast, but not yet as good as the LSTM. Chapter 11 supplies the missing pieces.

## A soft dictionary lookup

A Python dictionary maps a query to the value stored under an *identical* key. Attention relaxes “identical” to “similar”. It scores every key against the query and returns an average of all the values, weighted by the scores. With vectors for queries, keys and values, the score is a dot product, and softmax turns the scores into weights that are positive and sum to one:

:::equation{#lookup caption="Attention for one query: score every key, normalise, average the values."}
$$
\alpha_j \;=\; \frac{\exp(\term{qk}{\mathbf q \cdot \mathbf k_j})}{\sum_{j'} \exp(\mathbf q \cdot \mathbf k_{j'})}, \qquad \text{output} \;=\; \sum_j \term{al}{\alpha_j}\, \term{vj}{\mathbf v_j}
$$
:::

```terms
qk:
  label: "$\\mathbf q \\cdot \\mathbf k_j$ — the match score"
  what: How well key $j$ matches the query — large when they point in similar directions (Appendix A).
  why: A dot product is cheap, differentiable, and for a whole set of queries and keys it is a single matrix product.
al:
  label: "$\\alpha_j$ — the attention weight on item $j$"
  what: The softmax of the scores. The weights are positive and sum to one, so the output is a weighted average.
  effect: A sharp distribution (one weight near 1) behaves like a hard lookup; a flat one averages many items.
vj:
  label: "$\\mathbf v_j$ — the value stored at item $j$"
  what: What item $j$ contributes if it is attended to. Keys decide *whether* to read an item; values decide *what* is read.
```

::attention-lookup

Separating keys from values is what makes this flexible. An item can be *found* by one property (its key) and *contribute* another (its value). A pronoun can find its antecedent by matching on “a recently mentioned person” and then read out the person’s name.

## Queries, keys and values from the same sequence

In **self-attention**, all three come from the same sequence. Each position $t$ has a vector $\mathbf x_t$ (for us, a character embedding plus a position embedding). Three learned matrices project it into a query, a key and a value: $\mathbf q_t = \mathbf x_t W_Q$, $\mathbf k_t = \mathbf x_t W_K$ and $\mathbf v_t = \mathbf x_t W_V$. Stacking the positions as rows gives matrices $Q$, $K$ and $V$ of shape $(T, d)$, and all $T$ lookups become three matrix operations:

:::equation{#sdpa caption="Scaled dot-product attention, for all positions at once."}
$$
\operatorname{Attention}(Q, K, V) \;=\; \operatorname{softmax}\!\Big( \frac{\term{QKT}{Q K^\top}}{\term{sqd}{\sqrt{d}}} + \term{M}{M} \Big)\, V
$$
:::

```terms
QKT:
  label: "$QK^\\top$ — every query against every key"
  what: A $T \\times T$ matrix of scores. Entry $(i, j)$ is how well position $i$’s query matches position $j$’s key.
  why: Computing all the scores as one matrix product is what makes attention fast on a GPU — and what makes its cost grow as $T^2$.
sqd:
  label: "$\\sqrt{d}$ — the scaling"
  what: The square root of the query/key dimension.
  why: Dot products of $d$-dimensional vectors with independent unit-variance entries have standard deviation $\\sqrt d$. Dividing keeps the scores’ spread near 1, so the softmax doesn’t saturate as $d$ grows (see the widget below).
  param: { key: attn.dim, min: 1, max: 1024, step: 1, log: true, value: 64 }
M:
  label: "$M$ — the causal mask"
  what: "$0$ where position $i$ may look at position $j$ (that is, $j \\le i$), and $-\\infty$ where it may not."
  why: A language model predicts the next token, so it must not see the future. With $-\\infty$ added, $e^{-\\infty} = 0$ and future positions get exactly zero weight.
```

The softmax is taken along each row, so row $i$ of the result is position $i$’s weighted average of values. Vaswani and colleagues introduced this form, with its $\sqrt d$ scaling, in the Transformer paper :cite[vaswani2017].

::scaling-demo

**Causal masking** is what makes self-attention usable for language modelling. Without the mask, position $i$ could simply copy the value at position $i + 1$ — the token it is supposed to predict. With it, the $T \times T$ weight matrix is lower-triangular. A single forward pass over a sequence of $T$ tokens then produces $T$ honest next-token predictions, each using only its own past. This is the same “every position is a training example” efficiency the RNN had, without the sequential loop.

::exercise{id="causal-attention"}

## Where is everything? Positions

Look at the attention formula again: nothing in it depends on *where* a token is. Shuffle the input positions (and the mask) and the outputs shuffle in exactly the same way. Attention treats its input as a *set*. A language model obviously needs order — “dog bites man” is not “man bites dog” — so position has to be injected into the vectors themselves.

The simplest way, used by GPT-2 and by this chapter’s models, is a **learned position embedding**: a second table with one vector per position, $0 \ldots T - 1$, added to the token embedding. With it, attention can learn to look at, say, “the previous position” by matching on position components. Chapter 11 compares this with the sinusoidal encodings of the original Transformer, and Chapter 18 with rotary embeddings (RoPE), which most current models use.

::exercise{id="previous-token"}

## Multiple heads

One attention pattern per position is limiting: a token may need to look at the previous character, the start of the word *and* the speaker’s name, all at once. **Multi-head attention** runs $h$ attention operations — **heads** — in parallel, each with its own smaller projections. It concatenates their outputs and mixes them with one more matrix:

:::equation{#mha caption="Multi-head attention: h independent heads, each of dimension d = C / h."}
$$
\operatorname{MHA}(X) = \big[\, \operatorname{head}_1 \,;\, \ldots \,;\, \operatorname{head}_h \,\big]\, W_O, \qquad \operatorname{head}_i = \operatorname{Attention}\big(X W_Q^{(i)},\, X W_K^{(i)},\, X W_V^{(i)}\big)
$$
:::

In practice, the $h$ query projections are stored side by side as one $C \times C$ matrix, and likewise for keys and values. The heads are then split out by a reshape and a transpose: $(B, T, C) \to (B, T, h, d) \to (B, h, T, d)$. Every head in every sequence of the batch is attended in one batched matrix product. Multi-head attention costs about the same as single-head attention of full width, but it can attend to $h$ places at once.

::exercise{id="multi-head"}

:::note
**On the GPU.** Attention needs three new operations in our backend, all in `@lm/core/gpu`. The first is a **batched matrix product** — the matmul kernel from Chapter 8, dispatched with the batch in its third grid dimension. The `transB` flag computes $QK^\top$ without materialising the transpose. The second is a **permute** kernel that reorders dimensions, for splitting and merging heads. The third is a **fused softmax** that scales, masks and normalises each row in one pass, with one workgroup per row, and whose backward pass is the formula derived in Appendix B. The library’s tests check the whole multi-head computation, forward and backward, against the CPU tensor library.
:::

## What attention costs

For a sequence of length $T$ and width $C$, the projections cost $O(TC^2)$, like any other layer. The scores and the weighted sums cost $O(T^2 C)$. And the attention matrix itself — $h \times T \times T$ numbers for every sequence in the batch — must be stored for the backward pass. At $T = 4096$ with 4 heads and a batch of 8, that is two gibibytes per layer, in float32.

The PyTorch lab below measures it. On an M4 Pro, an attention layer is *faster* than an LSTM up to about 2,000 tokens, despite doing more arithmetic, because the arithmetic is parallel. Beyond that, the $T^2$ term takes over:

| Sequence length $T$ | 128 | 512 | 1,024 | 2,048 | 4,096 |
|---|---|---|---|---|---|
| One attention layer (forward + backward) | 3 ms | 7 ms | 19 ms | 64 ms | 241 ms |
| One LSTM layer (forward + backward) | 7 ms | 25 ms | 48 ms | 82 ms | 163 ms |

The quadratic cost is attention’s main weakness, and much modern engineering is about it. FlashAttention (Chapter 14) computes attention without ever storing the $T \times T$ matrix. KV caches (Chapter 16) avoid recomputing keys and values during generation. Sparse and linear attention variants, and the state-space models mentioned at the end of Chapter 9, trade some of attention’s power for linear cost (Chapter 18).

## A race: look it up, or remember it?

Here is a task that separates the two approaches. The input is a list of key–value pairs, then a question mark and one of the keys, and the answer is that key’s value. For example, `c 7 f 1 k 3 ? f` should produce `1`. The keys, values and question change every time, so nothing can be memorised across examples. It is **associative recall**, a standard probe of what sequence models can remember :cite[graves2014,arora2023zoology].

An LSTM has to store every pair in its state as it reads, because it doesn’t yet know which will be asked for. Attention can simply look the key up when the question arrives. It needs two layers to do so. In the first, each value attends to the key just before it, so the value’s position now “knows” its key. In the second, the question’s key attends to the position whose key matches and reads its value. This two-step pattern — find where this token appeared before, then read what came next — is an **induction head** :cite[elhage2021,olsson2022]. Induction heads are believed to underlie much of large language models’ ability to learn from their context.

::recall-race

With 16 pairs, the attention model typically sits at chance for several hundred steps. Then it jumps to 100% within about a hundred steps, as the two layers discover the circuit together. That sudden **phase change** is itself characteristic of induction heads. The LSTM, with 128 units of state, stays close to chance: 16 pairs is too much to hold. The PyTorch lab trains both for twice as long, and the LSTM reaches about 23%. Even with 4 pairs, the LSTM learns far more slowly than attention. Recent work has shown that this gap, between models that *look up* and models that *compress*, persists in large models: Transformers are much better at copying and recall than fixed-state models of the same size :cite[jelassi2024].

## An attention-only language model

Now the real task. The model below is the simplest possible attention language model. Character and position embeddings are added together. Then one or two layers each *add* the output of multi-head attention to their input, $\mathbf x \leftarrow \mathbf x + \operatorname{MHA}(\mathbf x)$, and a linear layer reads out the next-character logits. The addition, a **residual connection**, means each layer refines the representation rather than replacing it. Chapter 11 explains why that matters so much.

::attention-lm

The result is instructive. One layer reaches about **2.9 bits per character** and two layers about **2.6**, worse than both the MLP and the LSTM. PyTorch gets the same numbers from the same architecture (lab below), so this is not a bug. A training step takes about as long as the LSTM’s on the same number of characters, roughly 25 ms in the browser on an M4 Pro. But it contains no sequential loop, so it scales with the GPU, while the LSTM’s 64 dependent steps do not.

What is missing? Attention only *moves* information between positions: each output is a weighted average of value vectors, which are linear functions of the input. Apart from the softmax, there is no non-linear computation at each position — nothing like the MLP’s hidden layer, which let it combine the context into features. The Transformer adds exactly that: a small MLP applied at every position after each attention layer, plus normalisation to keep a deep stack stable. With those, Chapter 11’s model will beat the LSTM comfortably.

Meanwhile, the attention maps show what the heads learned:

::attention-maps

The summary table measures each head. In our runs, most heads split their weight between the current character and the one before it: the diagonal and the band just below it, which together give the model a bigram-and-trigram view. Some layer-1 heads form **vertical stripes** instead: every later position in a stretch attends to one particular earlier character, typically the last space or newline. That marks where the current word or line began, which says a lot about what comes next. Click a row to read its pattern as text. With characters and only 128 of them there is little to copy, but on a passage that repeats a name, look in layer 2 for heads that attend to the character *after* an earlier occurrence of the current one: induction heads again.

:::history{year=2014 title="From alignment to attention" people="Dzmitry Bahdanau, Kyunghyun Cho and Yoshua Bengio; Minh-Thang Luong; Ashish Vaswani and colleagues"}
Attention entered deep learning through machine translation. The sequence-to-sequence models of 2014 (Chapter 9) compressed the whole source sentence into the final state of an LSTM, and their quality fell sharply on long sentences. Bahdanau, Cho and Bengio let the decoder look back at *all* the encoder’s states instead :cite[bahdanau2015]. At each output word it computed a soft alignment — a weighted average of source positions — and the weights, when plotted, recovered word alignments between the languages without anyone having taught them. Luong, Pham and Manning simplified the scoring to a dot product :cite[luong2015]. Around the same time, Neural Turing Machines :cite[graves2014] and Memory Networks :cite[weston2015] used attention to read from an external memory.

In 2017, Vaswani and colleagues asked what would happen if the recurrence were removed altogether. Their Transformer, built from self-attention, feed-forward layers and residual connections, trained faster *and* translated better. The paper’s title, *Attention Is All You Need* :cite[vaswani2017], became one of the most cited in the history of computer science.
:::

:::breakit
- In the scaling widget, set $d = 512$ and compare the two panels. Then imagine training with the unscaled version: which gradients would be tiny, and why would early training stall?
- Remove the causal mask from your multi-head exercise and train it as a language model. The training loss plunges towards zero. Why is that a disaster rather than a success? (Hint: what does position $i$ get to see?)
- Remove the position embeddings from the attention-only model (lab: delete `self.pos`). What does the loss do, and why can the model still learn something?
:::

## Lab: attention in PyTorch

```bash
cd training
uv run lmc ch10 lm --layers 2         # the attention-only model (≈ 2.58 bits/char on the M4 Pro, 20 s)
uv run lmc ch10 recall --pairs 16     # attention vs LSTM on associative recall
uv run lmc ch10 speed                 # attention vs LSTM time as the sequence grows; manual vs fused attention
```

The lab uses `torch.nn.functional.scaled_dot_product_attention`, PyTorch’s fused attention, which dispatches to FlashAttention-style kernels where the hardware supports them. It also checks that function against a hand-written `manual_attention`, which is the equation above in four lines.

:::exercises
1. **Non-causal attention.** Change the mask so that each position attends only to itself and the previous two positions — a *local* or *sliding-window* attention. What does it cost, as a function of $T$? What can’t it do?
2. **Scaling, measured.** In your causal-attention exercise, feed random $Q$ and $K$ with $d = 256$, with and without the $1/\sqrt d$. Compute the average entropy of the attention rows in each case, and compare with the widget.
3. **Heads versus width.** In the lab’s language model, compare 1, 4 and 16 heads at a fixed width of 128. Does splitting help?
4. **Induction heads on repeated text.** Feed the trained model a passage made of the same 60 random characters twice. Measure its loss on the second copy. What do the layer-2 attention maps show there?
:::

:::challenge
1. **Recall capacity.** In the lab, find the largest number of pairs an LSTM with 128 units can learn in 10,000 steps, and compare with an LSTM of 512 units. How does the capacity scale with the state size?
2. **Cross-attention.** Build a tiny encoder–decoder: one sequence (say, a string) is encoded with self-attention, and a second sequence (its reversal) is produced by a decoder whose queries attend to the encoder’s keys and values. What must change in the mask?
3. **Attention without softmax.** Replace the softmax with $\operatorname{relu}(QK^\top)$ normalised by its row sum, or with no normalisation at all (linear attention). Train on the recall task. What breaks?
:::

## Check your understanding

```quiz
q: "In self-attention, what is the difference between a key and a value?"
options:
  - text: "The key decides how strongly a position is attended to (it is matched against queries); the value is what that position contributes to the output."
    correct: true
    why: Separating the two lets a position be found by one property and contribute another.
  - text: They are the same vector used twice.
    why: They come from different learned projections, W_K and W_V, of the same input.
  - text: Keys belong to the current position, values to earlier ones.
    why: Every position has a query, a key and a value.
```

```quiz
q: "Why are the attention scores divided by √d?"
options:
  - text: "Dot products of d-dimensional vectors have a spread that grows like √d; without scaling, large d saturates the softmax and its gradients vanish."
    correct: true
    why: The scaling keeps the scores' standard deviation near 1 at initialisation.
  - text: To make the attention weights sum to one.
    why: The softmax already does that.
  - text: To reduce the cost of the matrix product.
    why: Scaling costs extra (a little); it is about the statistics of the scores.
```

```quiz
q: "Why can't a language model use attention without the causal mask during training?"
options:
  - text: "Each position could look at the next token — the one it must predict — and copy it, learning nothing useful for generation."
    correct: true
    why: The training loss would collapse, but at generation time the future isn't available.
  - text: The softmax would overflow.
    why: The mask changes which entries count, not their size.
  - text: The attention matrix would not be square.
    why: It is T × T either way.
```

```quiz
q: "An attention layer processes a sequence of length T. How does its cost grow with T, compared with an RNN layer?"
options:
  - text: "Attention does O(T²) work but in parallel; an RNN does O(T) work but strictly one step after another."
    correct: true
    why: That is why attention is faster for moderate T on a GPU, and slower for very long T.
  - text: Both are O(T).
    why: Every query is compared with every key — T² scores.
  - text: Attention is O(T), the RNN O(T²).
    why: The other way round.
```

## Further reading

- Ashish Vaswani and colleagues, *Attention Is All You Need* :cite[vaswani2017].
- Jay Alammar, *The Illustrated Transformer* :cite[alammar2018]. The clearest pictures of queries, keys and values.
- Dzmitry Bahdanau, Kyunghyun Cho and Yoshua Bengio, *Neural Machine Translation by Jointly Learning to Align and Translate* :cite[bahdanau2015].
- Nelson Elhage and colleagues, *A Mathematical Framework for Transformer Circuits* :cite[elhage2021], and Catherine Olsson and colleagues, *In-context Learning and Induction Heads* :cite[olsson2022]. What attention-only models compute, read off their weights.
