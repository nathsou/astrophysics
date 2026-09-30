---
number: 26
title: Interpretability
summary: We trained CourseGPT and know every one of its 30 million numbers, and still cannot say how it writes a story. Interpretability tries to. We read its intermediate layers with the logit lens, find the attention heads that copy from context, probe its residual stream for what it knows about a name, and train a sparse autoencoder that splits its activations into features we can inspect.
duration: About 1½ hours
prerequisites: [transformer, scaling-up]
builds:
  - The logit lens
  - Induction-head detection
  - A top-k sparse autoencoder
---

Everything about CourseGPT is known. We wrote its architecture, chose its data, and can print any of its weights or activations. Yet if you ask why it wrote “Lily” rather than “Max” at some point in a story, the honest answer is a list of 30 million numbers. **Interpretability** is the attempt to give better answers: to describe what a trained network computes in terms a person can understand and check.

It matters for more than curiosity. A model whose reasoning we can inspect is one whose failures we can anticipate, whose training we can debug, and whose claims about itself we can verify. Chapter 28 returns to that. This chapter applies four of the field’s tools to CourseGPT, each small enough to run in minutes.

## The residual stream

Chapter 11 introduced the Transformer as a **residual stream**: a vector per position, to which each attention layer and each MLP adds its contribution. Nothing is ever overwritten; the final layer normalisation and unembedding read the sum. This makes every intermediate state a partial answer in the same space as the final one :cite[elhage2021]. So we can ask of any layer: if the network stopped here, what would it predict?

## The logit lens

Take the residual stream after layer $\ell$, apply the final layer normalisation and the unembedding, and read off the distribution. This is the **logit lens** :cite[nostalgebraist2020]. It is crude — the later layers expect their input to have been processed by earlier ones, not to be read directly — and the **tuned lens** improves it by learning a small linear correction for each layer :cite[belrose2023]. But it is free, and it shows how a prediction takes shape.

::exercise{id="logit-lens"}

::logit-lens

The first rows are the embeddings read straight back out: since CourseGPT’s output layer is its embedding table, the embedding layer “predicts” the token it was given, which is never the next one. Averaged over validation text, each layer’s top prediction agrees with the final one 15% of the time after the first block, 31% after the fourth, 65% after the sixth and 77% after the seventh. The prediction forms gradually, mostly in the second half of the network, and in the prompt about Lily you can watch it settle: early layers offer “’s” (Lily’s…), middle layers “met”, and only the last layers commit to “saw”.

## Heads that copy

Chapter 10 met the **induction head**: an attention head that, at a token it has seen before, attends to whatever followed the earlier occurrence and copies it :cite[olsson2022]. It works with a **previous-token head** in an earlier layer, which writes into each position the identity of the token before it, so that the induction head can search for “the position whose previous token is my current token”. Together they complete patterns such as “Mr and Mrs Dursley … Mr and Mrs D” → “ursley”.

The standard test is simple: take a passage, repeat it, and watch the second copy. A model with strong induction heads predicts almost every token of the second copy by copying, and its induction heads light up: at each position of the second copy they attend to the position just after the current token’s first occurrence. The test is usually run on random tokens, so that nothing but copying can help.

::exercise{id="induction-score"}

::head-scores

CourseGPT fails the test. On a repeated 128-token passage of its own validation text, its loss falls only from 2.18 to 2.01 bits per token on the second copy, and on repeated random tokens from 17.3 to 15.8 bits. Given “The old owl sat on a red branch and sang to the moon.” twice, it does not repeat the sentence; after “The old owl sat on” it continues “owl was very happy”. Yet the machinery is there. Head 4 of layer 2 is an induction head: on that repeated sentence it puts 60% of its attention on the copying position, a clean diagonal stripe in the widget (on the longer passages, 17%). Whatever it retrieves, the later layers do not act on it. After a repeated “Once upon a time”, it gives the word “Once” a probability of 2⁻²¹: a new story does not start in the middle of one.

This is a finding about data. Web text is full of verbatim repetition — quotations, code, names, lists, boilerplate — and models trained on it develop strong induction heads early in training :cite[olsson2022]. Children’s stories repeat names and phrases, but almost never a passage, and CourseGPT has learned exactly that: it copies what stories copy (a character’s name, a refrain) and treats wholesale repetition as unlikely. Its previous-token heads are clear — head 6 of layer 0 puts half its attention on the preceding token — and an induction head sits on top of them; what the data never rewarded is acting on what it finds. An interpretability claim, like any other, holds for a model trained on particular data.

## Probing

Does CourseGPT know that Lily is a girl? It has no explicit variable for it, but if the information is in its residual stream, a simple classifier should be able to read it. A **probe** is such a classifier — usually linear, so that it can find only what is plainly there — trained on the model’s activations to predict a property :cite[alain2016].

We collected names from TinyStories whose stories consistently use “she” or “he” with them, and trained a logistic regression on the residual stream at every layer, in two places: at the name itself, and several words later, where the model will need the information to choose a pronoun.

::probe-results

At the name itself, the probe is right for 98–99% of the 96 held-out names at every layer, including layer 0, the token embeddings. That is not a sign of deep processing: the gender a story gives a name is a property of the name, and it is written into the name’s embedding. The shuffled-label control stays near 50%, so the probe is not simply memorising. At “Then”, several words later, the embedding layer knows nothing (54%, chance), and after the first block the probe is right 97% of the time: a single layer of attention has copied the information from the name to where the next pronoun will be needed.

Probes need care. A powerful enough probe can learn the task itself from the activations, so a high accuracy does not show that the model uses the information. **Control tasks** — the same probe on shuffled or arbitrary labels — measure how much a probe can fit by itself :cite[hewitt2019]. And reading information out is not the same as the model using it: that needs an **intervention**, changing the activation along the probe’s direction and checking that the model’s behaviour changes accordingly.

## Superposition

The ideal would be a network in which each neuron meant one thing. Real networks are not like that: a single neuron responds to unrelated inputs — a **polysemantic** neuron. One reason is **superposition** :cite[elhage2022]: a network can represent many more features than it has dimensions by storing each as a direction, as long as few are active at the same time. In $d$ dimensions there is room for exactly $d$ orthogonal directions, but for exponentially many *nearly* orthogonal ones, and if features are sparse, the small interference between them rarely matters.

::superposition

## Sparse autoencoders

If activations are sums of a few feature directions out of many, we can try to recover the directions. A **sparse autoencoder** (SAE) maps an activation vector $\mathbf x \in \mathbb R^d$ to $m \gg d$ feature activations, most of them zero, and reconstructs $\mathbf x$ from them :cite[bricken2023] :cite[cunningham2023]:

:::equation{#sae caption="A top-k sparse autoencoder: encode to many features, keep the k largest, decode."}
$$
\mathbf f \;=\; \mathrm{TopK}\big(\mathrm{ReLU}(W_\text{enc}^\top(\mathbf x - \mathbf b_\text{dec}) + \mathbf b_\text{enc})\big), \qquad \hat{\mathbf x} \;=\; W_\text{dec}^\top\, \mathbf f + \mathbf b_\text{dec}
$$
:::

```terms
f:
  label: "$\\mathbf f$ — the feature activations"
  what: m numbers per token, of which only the k largest are kept; the rest are set to zero.
  why: Sparsity is what makes the features interpretable. With every feature active, the autoencoder could reconstruct x with any basis at all.
W_dec:
  label: "$W_\\text{dec}$ — the dictionary"
  what: m rows of unit length, one direction in the residual stream per feature.
  effect: A feature's meaning is read from the contexts where it fires most, and from what its direction does to the model's output.
```

The original SAEs enforced sparsity with an L1 penalty on $\mathbf f$, which needs tuning and shrinks the activations; keeping exactly the top $k$ fixes the number of active features directly :cite[gao2024topk]. We trained one with $m = 4{,}096$ features and $k = 32$ on CourseGPT’s residual stream after block 4, streaming about 33 million tokens of activations through it.

::exercise{id="sae"}

With 32 active features out of 4,096, the autoencoder reconstructs the residual stream with 11.6% of its variance unexplained. Run the rest of CourseGPT on the reconstruction instead of the real activations, and the loss rises from 1.65 to 1.80 bits per token; replacing the activations with their average would give 9.7. By that measure the features capture 98% of what the network needs at that point. No feature died in training, and most fire on between 0.1% and 1% of tokens.

::feature-browser

Many of the features are simple: they fire on one token, such as “ sign”, “ tail” or “ upon”, sometimes only in one sense — the “ cream” of ice cream. Others are more interesting. One fires on the thing a character talks about or loves (“pasta”, “soup”, “the cat”); another on the end of a fall or a movement (“fell *to*”, “landed”), and directly promotes “ground” and “knees”; another on the name a speaker gives themselves (“I am *Rover*”); another on “to” when it means *in order to* and promotes verbs of care (“protect”, “guard”, “greet”). None of them was designed. The labels are ours, made by reading examples, and — as in the published work — some features resist any label at all.

Anthropic scaled the method to a production model, Claude 3 Sonnet, and found millions of features, some very abstract — features for the Golden Gate Bridge (in text and in images), for code with security vulnerabilities, for sycophantic praise — and showed that turning a feature up changed the model’s behaviour in the expected way :cite[templeton2024].

## Circuits

Features are the vocabulary; **circuits** are the sentences. A circuit is a subgraph of the network — a few heads, a few MLP features and the connections between them — that carries out an identifiable computation. The induction circuit is one. Others have been traced by hand: in GPT-2 small, the 26 attention heads that decide the indirect object in “When Mary and John went to the store, John gave a drink to” :cite[wang2023ioi]. Causal interventions can locate where a model stores a fact such as “the Eiffel Tower is in Paris” and edit it :cite[meng2022]. Attribution graphs now trace, for a single prompt, how features in a large model feed each other from input to output — revealing, for example, a model planning a rhyme several words ahead :cite[lindsey2025].

:::history{year=2022 title="Induction heads" people="Catherine Olsson, Nelson Elhage, Neel Nanda, Nicholas Joseph and colleagues (Anthropic)"}
Elhage and colleagues had reverse-engineered tiny attention-only Transformers and found, in two-layer models, a circuit that copied earlier sequences: the induction head :cite[elhage2021]. Olsson and colleagues then looked for it in models of every size :cite[olsson2022]. They found induction heads everywhere, and found that they formed at a particular point early in training, visible as a bump in the loss curve, at the same moment that the models suddenly got better at using long contexts — in-context learning. The paper argued, with six lines of evidence of varying strength, that induction heads are the mechanism behind most in-context learning in small models and plausibly much of it in large ones. It was an early case of a finding about a network’s internals predicting something about its behaviour.
:::

:::breakit
- Zero out the output of the strongest induction head (set its attention output to zero) and measure the loss on the second copy of a repeated sequence. How much of the copying does one head do?
- Train the SAE with $k = 4$ and $k = 128$. How do the reconstruction and the interpretability of the features change?
- Probe for gender with a probe that is an MLP of width 512 instead of linear. What does the shuffled-label control score now?
:::

## Lab: interpretability in PyTorch

```sh
uv run lmc ch26 lens     # the logit lens on two prompts and on validation text
uv run lmc ch26 heads    # previous-token and induction scores for all 64 heads
uv run lmc ch26 probe    # linear probes at every layer
uv run lmc ch26 sae      # a top-k SAE on the residual stream after block 4 (about 10 minutes)
```

`residuals` in `lmcourse/ch26.py` runs the blocks one at a time and keeps the residual stream after each; `attention` recomputes one block’s attention probabilities, which the fused attention kernel never materialises. The SAE keeps its decoder rows at unit length after every step, and removes from their gradient the component that would only change their length.

:::exercises
1. **Tuned lens.** Train one linear map per layer that makes the logit lens match the final distribution (minimise the KL divergence), and compare the agreement curves.
2. **Previous-token composition.** For the strongest induction head, find which earlier head's output its keys read most (compare the key weights with each earlier head's output directions).
3. **Steering.** Pick an SAE feature with a clear meaning, add a multiple of its decoder direction to the residual stream at every position while CourseGPT writes, and describe what changes.
4. **Dead features.** Count the features that never fire on a million tokens. Reinitialise them to the directions of the worst-reconstructed activations and train again.
:::

:::challenge
1. **Name gender, causally.** Find the direction the probe uses at the “later” position, and subtract it from the residual stream. Does CourseGPT start using the other pronoun?
2. **A circuit.** Trace how CourseGPT copies a character's name from the first sentence of a story when it is needed later: which heads attend from the later position to the name, and in which layers?
3. **SAEs on every layer.** Train an SAE on each layer and follow a feature (say, one that detects dialogue) from layer to layer by the similarity of decoder directions.
:::

## Check your understanding

```quiz
q: "Why can the logit lens be applied to any layer, not just the last?"
options:
  - text: "The residual stream is a running sum in the same space throughout, so every intermediate state can be read by the output layer."
    correct: true
    why: Each block adds to the stream rather than replacing it.
  - text: Every layer is trained to predict the next token.
    why: Only the final output is trained; intermediate readings are a side effect of the residual design.
  - text: The layers share their weights.
    why: They do not; each block has its own weights.
```

```quiz
q: "A linear probe reads a property from the residual stream with 99% accuracy. What does that show?"
options:
  - text: "That the information is linearly readable there — not that the model uses it."
    correct: true
    why: Using it is a causal claim, which needs an intervention.
  - text: That the model computes the property at that layer.
    why: It may have been present from the embeddings onwards, as with our names.
  - text: Nothing, unless the probe is non-linear.
    why: Linear probes are the stricter test; non-linear ones can compute the property themselves.
```

```quiz
q: "Why must a sparse autoencoder's features be sparse?"
options:
  - text: "Without sparsity any basis reconstructs the activations; sparsity picks out directions that each correspond to something that is usually absent."
    correct: true
    why: Sparse features match the hypothesis of superposition — many rare features sharing a small space.
  - text: To make the autoencoder faster.
    why: Speed is a side benefit, not the reason.
  - text: Because activations are mostly zero.
    why: Residual-stream activations are dense; the features found in them are sparse.
```

## Further reading

- Nelson Elhage and colleagues, *A Mathematical Framework for Transformer Circuits* :cite[elhage2021].
- Catherine Olsson and colleagues, *In-context Learning and Induction Heads* :cite[olsson2022].
- Nelson Elhage and colleagues, *Toy Models of Superposition* :cite[elhage2022].
- Adly Templeton and colleagues, *Scaling Monosemanticity* :cite[templeton2024].
