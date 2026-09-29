---
number: 19
title: Mixture-of-Experts
summary: A mixture-of-experts layer holds many MLPs and lets a learned router send each token to only a few of them, so a model can grow its parameters without growing the compute per token. We build one, train it against a dense model at equal compute, watch routers collapse without a balancing loss, and look at why the largest open models are mixtures.
duration: About 1½ hours
prerequisites: [modern-architecture, scaling-laws]
builds:
  - A mixture-of-experts MLP with top-k routing and a balancing loss
  - A comparison with a dense model at equal compute
  - Routing, capacity and expert load, measured
---

Chapter 17’s scaling laws say that a bigger model learns more from the same data. But in a dense Transformer every parameter takes part in processing every token, so a bigger model also costs more per token, to train and to run. **Mixture-of-experts** (MoE) models break that link. The MLP of each block, which holds two-thirds of a Transformer’s parameters, is replaced by many smaller MLPs — the **experts** — and a small **router** sends each token to only a few of them. The model can have eight or a hundred times the parameters of a dense model while each token uses no more compute than before.

The idea is old. Jacobs, Jordan, Nowlan and Hinton trained “adaptive mixtures of local experts” in 1991, with a gating network deciding which expert handled each input :cite[jacobs1991]. Shazeer and colleagues brought it to language models in 2017 with thousands of experts between LSTM layers :cite[shazeer2017]. Today many of the largest open models are mixtures: Mixtral 8×7B :cite[jiang2024mixtral] uses 13 of its 47 billion parameters per token, and DeepSeek-V3 :cite[deepseek2024v3] 37 of 671 billion.

## Routing

A router is a single linear layer. For a token’s hidden vector $\mathbf x$ it produces one score per expert, a softmax turns the scores into probabilities $p_e$, and the token goes to the $k$ experts with the highest probabilities. Their outputs are mixed with the probabilities as weights, renormalised over the chosen $k$:

:::equation{#moe caption="A mixture-of-experts layer with top-k routing: only the k chosen experts run."}
$$
\operatorname{MoE}(\mathbf x) \;=\; \sum_{e \,\in\, \operatorname{top}_k(\mathbf p)} \frac{p_e}{\sum_{e' \in \operatorname{top}_k(\mathbf p)} p_{e'}} \; \operatorname{MLP}_e(\mathbf x), \qquad \mathbf p = \operatorname{softmax}(\term{Wr}{W_r}\, \mathbf x)
$$
:::

```terms
Wr:
  label: "$W_r$ — the router"
  what: A C × E matrix scoring each of the E experts for the token. It is trained with everything else, through the gates, which multiply each chosen expert's output by its probability.
  why: The selection itself (top-k) has no gradient, but the gate weights do, so the router learns to raise the probability of experts whose outputs reduce the loss.
  effect: Experts that receive similar tokens become specialists in them; nothing tells them what to specialise in.
```

With $k = 2$ and each expert half the width of the dense MLP, a token uses exactly the dense model’s MLP compute, however many experts there are. That is how we compare the two fairly below. The Switch Transformer used $k = 1$, the cheapest possible routing :cite[fedus2022]; Mixtral uses 8 experts and $k = 2$; DeepSeek’s models use many small experts, with several active per token plus a few **shared experts** that every token uses :cite[dai2024deepseekmoe].

::exercise{id="route"}

## Keeping the experts busy

A router left to itself tends to **collapse**. Early in training, whichever experts happen to be slightly better receive more tokens, get more gradient, and become better still, while the rest starve. In the limit, a mixture of eight experts is one expert with seven idle neighbours. There is also a practical problem: in a large model the experts sit on different GPUs, so if one expert receives most of the tokens, its GPU does most of the work while the others wait.

The Switch Transformer’s remedy is an auxiliary **load-balancing loss**, added to the language-modelling loss with a small weight (we use 0.01):

:::equation{#balance caption="The Switch Transformer's load-balancing loss: 1 when routing is uniform, larger when it is lopsided."}
$$
\mathcal L_{\text{balance}} \;=\; E \sum_{e=1}^{E} \term{f}{f_e}\, \term{P}{P_e}
$$
:::

```terms
f:
  label: "$f_e$ — the share of routing slots expert e received"
  what: A count, so it has no gradient.
P:
  label: "$P_e$ — expert e's mean router probability"
  what: Averaged over the batch; it has a gradient.
  why: Minimising the product pushes probability away from experts that are already busy (large fₑ), towards idle ones.
```

::exercise{id="balance-loss"}

In a distributed implementation each expert also has a fixed **capacity**, a buffer of $\text{factor} \times \text{tokens} \times k / E$ slots, so that every device works on arrays of the same shape :cite[lepikhin2021]. Tokens that arrive at a full expert are **dropped**: they skip the MLP and continue along the residual stream unchanged. A capacity factor of 1.25 is typical; balancing keeps drops rare.

::router-playground

::exercise{id="capacity"}

Later work refined all of this. ST-MoE added a **router z-loss** penalising large router logits, for stability :cite[zoph2022], and DeepSeek-V3 replaced the auxiliary loss with a bias on each expert’s score that is nudged up or down after every step according to its load, balancing without distorting the language-modelling objective :cite[deepseek2024v3].

## Measured: experts at equal compute

We trained mixtures in Chapter 18’s setting: the 6 × 384 model, 2,127 steps of 32,768 tokens on TinyStories, the same data and optimiser. Every mixture uses exactly the dense model’s compute per token, so any difference comes from having more parameters to route between.

::moe-results

Both top-2 mixtures beat the dense model clearly. With 8 experts the validation loss fell from 2.064 to 2.005 bits per token, and with 32 experts to 1.977: differences of 0.059 and 0.087, against a seed-to-seed spread of 0.008 in Chapter 18. The 32-expert model holds 120 million parameters — 8.6 times the dense model’s 14 million — and uses the same 14 million for each token. That is the whole promise of mixtures, measured.

Without the balancing loss, the 8-expert model did almost as well (2.010), but its routing was lopsided: in its third layer one expert took 43% of the routing slots, where a uniform share is 12.5%, and another only 2%. Choose it in the heatmap. On one GPU imbalance costs little; spread over eight GPUs, one would do three and a half times its share of the work while others idled.

The top-1 run is a lesson in how easily routing goes wrong. Our first version renormalised the chosen experts’ probabilities to sum to 1, as Mixtral does for $k = 2$. With a single expert chosen, that makes the gate $p/p = 1$ whatever the router says, so the router received no gradient from the language-modelling loss at all — only from the balancing loss. It learned to spread tokens evenly and nothing else (its loads are the most uniform of all the runs), each expert saw a random eighth of the data, and the model finished at 2.161, worse than the dense model. The Switch Transformer multiplies the expert’s output by the raw router probability precisely so that the router learns which expert is best :cite[fedus2022]. With that fix, top-1 routing reached 2.025 bits per token: better than the dense model, though not as good as top-2 (2.005), and with livelier routing — one expert took 34% of a layer’s slots, since the router now had a reason to prefer some experts over others.

Equal FLOPs did not mean equal time. Our mixtures processed about 116,000 tokens per second against the dense model’s 255,000, and the 32-expert model 70,000: the implementation loops over the experts, gathering each one’s tokens into a separate small matrix multiplication. Production systems use kernels that handle all the experts’ uneven batches in one launch :cite[gale2023megablocks], but routing, gathering and scattering always cost something.

::routed-story

Nobody told the experts what to specialise in, and yet they did — by the *kind* of token rather than by topic. In the first layer, routing follows the token itself: in this story every “the” and “and” goes to expert 0, nouns (girl, store, sweets, mom, dad, toy) to expert 5, and the name Lucy with past-tense verbs (entered, noticed, gasped, ran) to expert 6. By the last layer the groups look grammatical: nouns go to expert 0, verbs and prepositions to expert 1, “a” and “little” to expert 2, “to” and “her” to expert 6, and punctuation to expert 7. Studies of Mixtral found the same: no expert specialised in a subject such as biology or mathematics, but routing followed syntax and even consecutive tokens :cite[jiang2024mixtral].

## Why mixtures, and why not always

Mixtures trade memory for compute. All the experts must be stored, and at inference every one of them must sit in fast memory even though each token uses a few, so an MoE model needs the memory of its total size but the compute of its active size. That suits large-scale serving, where many tokens in a batch keep every expert busy and the memory is spread over many GPUs. It suits a single GPU generating one sequence much less: as Chapter 16 showed, decoding is limited by reading weights, and a batch of one token reads only its $k$ experts, but those change from token to token, so the whole model must still be resident. A laptop that can hold a 47-billion-parameter mixture could also hold a dense model nearly as large.

Training brings its own difficulties: the routing must be balanced, the tokens must be exchanged between GPUs holding different experts (an all-to-all communication step), and mixtures have been harder to fine-tune stably than dense models. Their scaling behaviour has been measured too: at a given active compute, adding experts keeps improving the loss, with diminishing returns :cite[fedus2022].

:::history{year=2017 title="Outrageously large networks" people="Noam Shazeer, Azalia Mirhoseini, Krzysztof Maziarz, Andy Davis, Quoc Le, Geoffrey Hinton and Jeff Dean"}
In 2017 the largest language models had a few hundred million parameters. Shazeer and colleagues at Google inserted a layer of up to 131,072 experts between the LSTM layers of a translation and language model and trained a model of 137 billion parameters :cite[shazeer2017]. A noisy top-k gate picked a few experts per example; an importance loss kept them balanced. The paper’s title promised “outrageously large neural networks”, and it delivered them, at a compute cost similar to much smaller dense models.

The approach moved to Transformers with GShard (2020), which sharded a 600-billion-parameter translation model across 2,048 TPU cores :cite[lepikhin2021], and the Switch Transformer (2021), which showed that routing each token to a single expert was enough and trained models with over a trillion parameters :cite[fedus2022]. Open models followed with Mixtral in 2023, and by 2025 mixtures had become common among the largest open models.
:::

:::breakit
- Train the 8-expert model with a balancing weight of 1 instead of 0.01. What happens to the language-modelling loss?
- Initialise the router with one column much larger than the others. Does the balancing loss rescue it, and how quickly?
- Set the capacity factor to 0.5 in the playground with the favouritism at 0. What fraction of slots is dropped, and why is that a problem for the tokens concerned?
:::

## Lab: mixtures in PyTorch

```sh
uv run lmc ch19 train      # five mixtures of the 6 × 384 model (about an hour)
uv run lmc ch19 routing    # expert loads and a routed story
uv run lmc train --preset coursegpt --set experts=8 top_k=2 compile=false name=moe-course
```

`GPTConfig` gained `experts`, `top_k`, `expert_hidden`, `aux_coef` and `gate` (`gate=renorm` reproduces the top-1 mistake above). The implementation in `model.py` is the simplest correct one: a loop over experts, each gathering its tokens with `nonzero` and scattering its outputs back with `index_add_`. Production systems replace it with grouped matrix multiplications that process all experts in one kernel, and with expert parallelism across GPUs. The data-dependent shapes also stop `torch.compile` from capturing the loop, which is why our mixtures train with it switched off.

:::exercises
1. **Shared experts.** Add one expert that every token uses, in addition to its routed experts, as DeepSeek does. Does it help at equal compute?
2. **Loss-free balancing.** Replace the auxiliary loss with DeepSeek-V3’s per-expert bias: after each step, raise the bias of underloaded experts and lower that of overloaded ones by a small constant. Compare the final loads and loss.
3. **Expert specialisation.** For each expert in the last layer, list the 20 tokens it receives most often across the validation set. Are the specialisations interpretable?
4. **Capacity in training.** Add a capacity limit to the PyTorch MoE layer and measure how the loss changes with factors of 1, 1.25 and 2.
:::

:::challenge
1. **Grouped matrix multiplication.** Rewrite the MoE layer to sort tokens by expert and run all experts with one batched matrix product over padded groups. How much faster is it than the loop?
2. **Upcycling.** Initialise an 8-expert mixture by copying a trained dense model’s MLP into every expert (with small noise), then continue training. Does it beat training the mixture from scratch?
3. **An MoE CourseGPT in the browser.** Add routing to the WebGPU engine of Chapter 16. What happens to the time per token?
:::

## Check your understanding

```quiz
q: "An 8-expert, top-2 MoE layer has experts half the width of a dense MLP. Compared with the dense layer, how much compute does each token use, and how many parameters does the layer have?"
options:
  - text: "The same compute (two half-width experts), and four times the parameters (eight half-width experts)."
    correct: true
    why: Active compute is set by k and the expert width; parameters by the number of experts.
  - text: Eight times the compute and eight times the parameters.
    why: Only two experts run per token.
  - text: A quarter of the compute and the same parameters.
    why: Two half-width experts together match one full-width MLP.
```

```quiz
q: "Why does a router need a load-balancing loss?"
options:
  - text: "Without it, experts that start slightly better attract more tokens and more training, and routing can collapse onto a few experts."
    correct: true
    why: The rich get richer; balancing keeps every expert in use and the work spread across devices.
  - text: The router has no gradient without it.
    why: The router learns through the gate weights anyway.
  - text: To make every expert learn the same function.
    why: Balance is about how many tokens each expert gets, not what it learns.
```

```quiz
q: "Why is an MoE model harder to run on one small GPU than its active parameter count suggests?"
options:
  - text: "Different tokens use different experts, so every expert must be kept in memory even though each token uses only a few."
    correct: true
    why: Memory scales with total parameters, compute with active ones.
  - text: The router is expensive to compute.
    why: It is one small matrix product.
  - text: Experts cannot use a KV cache.
    why: The KV cache belongs to attention, which is unchanged.
```

## Further reading

- Noam Shazeer and colleagues, *Outrageously Large Neural Networks* :cite[shazeer2017].
- William Fedus, Barret Zoph and Noam Shazeer, *Switch Transformers* :cite[fedus2022].
- Albert Jiang and colleagues, *Mixtral of Experts* :cite[jiang2024mixtral].
- Damai Dai and colleagues, *DeepSeekMoE* :cite[dai2024deepseekmoe], and the DeepSeek-V3 technical report :cite[deepseek2024v3].
