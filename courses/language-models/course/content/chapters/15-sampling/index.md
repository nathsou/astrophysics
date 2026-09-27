---
number: 15
title: Sampling & decoding
summary: A language model predicts a distribution over the next token; decoding turns those distributions into text. This chapter studies the choices — greedy decoding, temperature, top-k, top-p and min-p truncation, repetition penalties and beam search — on CourseGPT, and measures why the most probable text is rarely the best.
duration: About 2 hours
prerequisites: [scaling-up, probability]
builds:
  - A sampler with temperature, top-k, top-p, min-p and repetition penalties
  - Sampling with the Gumbel-max trick
  - Beam search
  - A measurement of the quality–diversity trade-off
---

CourseGPT does not write stories. At every step it produces a probability distribution over 8,192 tokens, and something else must pick one of them, append it, and ask again. That something is the **decoding strategy**, and it is not part of the model: the same weights can produce fluent stories, looping nonsense or word salad depending on how we choose.

Chapter 2 introduced the basic method — sample from the distribution with one uniform random number — and several chapters since have used a temperature to make samples more conservative. This chapter looks at the choices properly, now that we have a model good enough for them to matter. We try each on CourseGPT, see how it fails, and finish by measuring the trade-off that every strategy navigates: text the model finds likely against text that reads like the real thing.

## The most probable token

The simplest strategy is **greedy decoding**: always take the most probable token, $x_t = \arg\max_x P(x \mid x_{<t})$. It is deterministic and needs no random numbers. It is also, for open-ended text, a poor choice:

> *Mom said, “Clean your room.” Sam* and Lily did not like to clean. They wanted to play outside. They said, “No, Mom, we want to play outside.” Mom said, “You can play outside, but you have to clean your room first. Then you can go outside and play.” Sam and Lily did not want to clean. They wanted to play outside. They said, “No, Mom, we want to play outside.” Mom said, “You have to clean your room first. Then you can go outside and play.” Sam and Lily did not want to clean. They said, “No, Mom, we want to play outside.” Mom said, “You have to clean your room first. Then you can go outside and play.” …

That is CourseGPT decoding greedily from the prompt in italics, and it would go on forever. Not every greedy story loops; many are merely bland, the same safe choices every time. But loops are common, and once one starts, greedy decoding never escapes.

Why does greedy text fall into loops? Repetition reinforces itself: once a phrase appears in the context, the model predicts it will appear again — the induction heads of Chapter 10 exist precisely to copy what came before — so each repetition makes the next more likely. Holtzman and colleagues found the same behaviour in GPT-2 and called it **degeneration** :cite[holtzman2020].

Greedy decoding does not even find the most probable *sequence*. The best first token can lead to a mediocre continuation while a slightly less likely first token leads to a very likely one; beam search, later in the chapter, looks further ahead. But finding the most probable sequence turns out not to be what we want either.

## Sampling, and the unreliable tail

The alternative is to **sample**: draw $x_t$ from $P(\cdot \mid x_{<t})$, exactly as the model predicts. This is *ancestral sampling*, and if the model were perfect it would produce text statistically indistinguishable from its training data.

The model is not perfect, and its errors are concentrated in the **tail**: the thousands of tokens that each receive a tiny probability. Cross-entropy training punishes a zero probability infinitely, so a model learns to spread a little probability everywhere, as insurance; Hewitt and colleagues describe this as **smoothing** :cite[hewitt2022], like the add-k smoothing of Chapter 2. Each tail token is unlikely, but together they add up. If the tail holds 1% of the probability at each step, a 200-token story contains at least one tail token with probability $1 - 0.99^{200} \approx 87\%$. And one bad token is enough to derail a story, because every later prediction is conditioned on it.

So pure sampling is too random and greedy decoding is too predictable. Every practical strategy lies in between, and there are two ways to get there: reshape the distribution, or cut off its tail.

## Temperature

**Temperature** divides the logits by a constant $T$ before the softmax:

:::equation{#temperature caption="Softmax with temperature: T < 1 sharpens the distribution, T > 1 flattens it."}
$$
P_T(x_i) = \frac{\exp(z_i / \term{T}{T})}{\sum_j \exp(z_j / T)}
$$
:::

```terms
T:
  label: "$T$ — the temperature"
  what: A positive number dividing every logit. T = 1 leaves the model's distribution unchanged.
  why: The name comes from statistical physics, where the Boltzmann distribution gives a state of energy E the probability exp(−E / kT). Read the logits as negative energies; at low temperature the system settles into its lowest-energy state, at high temperature every state becomes nearly equally likely.
  effect: As T → 0 the distribution puts all its mass on the largest logit (greedy decoding); as T → ∞ it becomes uniform. Ratios of probabilities are raised to the power 1/T.
```

::temperature-explorer

Look at how differently the four contexts behave. After “Once upon a”, CourseGPT is almost certain (“ time”), and temperature barely matters until it is very high. After “a little girl named”, the model has a favourite name but many alternatives. After “He saw a big”, anything big will do, and the entropy is about 5.3 bits — roughly 40 equally likely choices. Lowering the temperature cuts off the tail in all of them, but it also makes the model’s favourite choices more dominant: at $T = 0.5$, half of all little girls are named Lily, up from under a third.

## Truncation

Temperature scales every token by the same rule. Truncation instead removes the tail outright and renormalises what remains. Three rules are common:

- **Top-k** :cite[fan2018] keeps the $k$ most probable tokens.
- **Top-p**, or **nucleus sampling** :cite[holtzman2020], keeps the smallest set of most probable tokens whose total probability reaches $p$.
- **Min-p** :cite[nguyen2024] keeps every token whose probability is at least a fraction $p_{\min}$ of the most probable token’s.

:::equation{#truncation caption="The sets of tokens kept by top-p and min-p truncation; sampling then uses P renormalised over the set."}
$$
V_{\text{top-}p} = \text{the smallest } V \text{ with } \sum_{x \in V} P(x) \ge \term{p}{p}, \qquad
V_{\min\text{-}p} = \Bigl\{\, x : P(x) \ge \term{pmin}{p_{\min}} \cdot \max_{x'} P(x') \Bigr\}
$$
:::

```terms
p:
  label: "$p$ — the nucleus mass"
  what: The share of probability top-p keeps, typically 0.9 to 0.95.
  why: The number of tokens kept adapts to the model's certainty; the discarded tail always holds at most 1 − p of the probability.
pmin:
  label: "$p_{\\min}$ — the min-p ratio"
  what: The cut-off relative to the most probable token, typically 0.05 to 0.1.
  why: It keeps the tokens that are competitive with the model's favourite. When the model is sure, the favourite is very probable and the cut is strict; when it is unsure, the cut is loose.
```

::truncation-compare

Top-k’s weakness is that $k$ does not know the context: a value that is generous after “Once upon a” is stingy after “He saw a big”. Top-p fixes that by thinking in probability rather than counts, and it is the most widely used rule. Min-p is newer. Its advantage shows at high temperature: flattening the distribution drags thousands of tail tokens into top-p’s nucleus, but none of them comes close to a tenth of the leader’s probability, so min-p still excludes them. That lets it combine a high temperature, for variety among plausible tokens, with a firm floor against implausible ones.

::exercise{id="truncation"}

Other rules exist. **Typical sampling** :cite[meister2023] keeps the tokens whose surprisal is closest to the distribution’s entropy, reasoning that human text is rarely *more* predictable than expected. **η-sampling** :cite[hewitt2022] cuts tokens below a threshold that depends on the entropy. They differ in detail; all share the idea that the tail is unreliable and should go.

## How the sampler draws

The pipeline has an order, and it matters. Hugging Face’s `generate()`, which our samplers follow, applies penalties to the logits first, then the temperature, then truncation. So `temperature=1.5, top_p=0.9` flattens the distribution *and then* takes its nucleus, which is larger than the nucleus at $T = 1$. Other libraries let you reorder the steps, and the same settings then give different results.

The final draw is Chapter 2’s inverse-CDF method: lay the probabilities end to end and see where a uniform number lands. On a GPU there is a neat alternative, the **Gumbel-max trick**: add independent noise $g_i = -\log(-\log u_i)$ to each logit and take the largest,

:::equation{#gumbel caption="The Gumbel-max trick: the index of the largest noisy logit is a sample from softmax(z / T)."}
$$
\arg\max_i \left( \frac{z_i}{T} + g_i \right) \sim \operatorname{softmax}(z / T), \qquad g_i = -\log(-\log u_i), \quad u_i \sim \text{Uniform}(0, 1)
$$
:::

No exponentials, no normalisation and no cumulative sum are needed, only an element-wise addition and an argmax, which parallelise well. Taking the $k$ largest noisy logits instead of one samples $k$ distinct tokens without replacement, the basis of stochastic beam search :cite[kool2019]. The trick goes back to Gumbel’s extreme-value statistics; Maddison and colleagues brought it to machine learning :cite[maddison2014].

::exercise{id="gumbel-max"}

## Penalising repetition

Since repetition feeds on itself, another approach is to fight it directly. CTRL’s **repetition penalty** :cite[keskar2019] reduces the logit of every token that has already appeared: positive logits are divided by $\theta$ and negative ones multiplied by it, with $\theta \approx 1.2$. OpenAI’s API offers two related knobs: a **frequency penalty** that subtracts a constant per previous occurrence, and a **presence penalty** that subtracts a constant once for any token that has appeared.

Penalties are blunt instruments. They cannot tell a pathological loop from legitimate repetition, and stories are full of legitimate repetition: the hero’s name, “the”, “said”. Set the penalty high in the playground at the end of the chapter and watch CourseGPT rename its characters mid-story to avoid repeating itself. Training can also attack the cause: **unlikelihood training** :cite[welleck2020] explicitly lowers the probability of repeated tokens during training.

::exercise{id="repetition-penalty"}

## Beam search

Greedy decoding commits to one token at a time. **Beam search** keeps several hypotheses: at each step it extends each of its $k$ partial sequences by every possible next token, scores all extensions by their total log-probability $\sum_t \log P(x_t \mid x_{<t})$, and keeps the best $k$. With $k = 1$ it is greedy decoding. With larger $k$ it finds sequences that greedy misses, whose first token looked worse but whose continuation is much better.

::beam-tree

::exercise{id="beam-search"}

Because every token multiplies the probability by a number below 1, longer sequences always score lower, and beam search prefers to stop early. Systems that let hypotheses end divide the score by a power of the length, $\sum_t \log P / |y|^\alpha$ :cite[wu2016]. Even so, the true most probable output is sometimes degenerate: Stahlberg and Byrne searched exactly for the most probable translations of a strong translation model and found that for over half the sentences it was the *empty* translation :cite[stahlberg2019]. Beam search works well in translation and speech recognition, where it began :cite[lowerre1976], because the input constrains the output tightly, and its limited search acts as a useful regulariser. For open-ended generation, it produces the same bland, repetitive text as greedy decoding, only more of it.

## Likely text is not good text

Why does maximising probability fail? Because good text is not maximally probable text. Real stories are *surprising* at a steady rate: each word is somewhat predictable, but writers regularly choose the less obvious option. Text that always takes the most probable path has far less surprise per token than real text, and text sampled at a high temperature has far more. We can measure both on CourseGPT.

::quality-diversity

Real stories sit at about 1.6 bits of surprise per token (1.13 nats) with 2% of their 4-grams repeated. Greedy decoding and beam search produce text CourseGPT finds far more probable — under 0.7 bits per token — but with two to three times the repetition, and far less variety across stories: 47% and 62% of their 4-grams are distinct, against 87% for real stories. Lowering the temperature moves steadily towards that corner. At the other end, $T = 1.5$ produces word salad at 8.7 bits per token.

Pure sampling at $T = 1$ lands close to the real stories, and top-p and min-p at $T = 1$ sit slightly on the safe side of them. That is a mark of how well CourseGPT is trained: its distributions match its data closely, so drawing from them reproduces the data’s statistics. The tail still matters, as the examples show — the $T = 1$ story drifts in and out of sense — but its full damage appears only when the distribution is flattened. The most striking point is **$T = 1.5$ with min-p 0.1**, which lands almost exactly on the real stories: the high temperature spreads probability among plausible tokens, and min-p removes the implausible ones that temperature dragged up. Top-p 0.9 at the same temperature fails, at 5.5 bits per token, because the flattened tail fills its nucleus. The repetition penalty removes repetition, but pays for it with surprise: it pushes the model away from words it has already used even when they are the right ones.

This is the **likelihood trap** :cite[zhang2021]: up to a point, more probable text is better text, and beyond that point it gets worse. A good decoding strategy aims to produce text whose statistics match those of real text, not text the model rates most highly.

## Controlling the output

Decoding is also where we impose hard constraints. Generation stops at a **stop sequence** — for CourseGPT, `<|endoftext|>` — or a length limit. **Constrained decoding** goes further: before each draw, set the logits of forbidden tokens to $-\infty$. If the allowed tokens are given by a grammar, the output is guaranteed to parse — valid JSON, a date, one of a list of labels. Willard and Louf showed how to compile a regular expression or grammar into a table of allowed tokens for each state, so the check costs almost nothing per step :cite[willard2023]. Chapter 23 uses exactly this to make models call tools reliably.

## The playground

Every setting of the chapter, on CourseGPT. Try greedy decoding, then pure sampling at $T = 1.5$ (watch the underlines turn red as surprising tokens appear, and the story unravel), then add min-p 0.1 at the same temperature.

::sampling-playground

:::history{year=2019 title="The curious case of neural text degeneration" people="Ari Holtzman, Jan Buys, Li Du, Maxwell Forbes and Yejin Choi"}
When GPT-2 appeared in 2019, the standard way to get text from a language model was beam search, inherited from machine translation, or sampling with a low temperature. Both produced dull text that repeated itself. Holtzman and colleagues asked why :cite[holtzman2020]. They showed that the probability GPT-2 assigned to each token of human-written text jumped around, often low, while beam-search text sat on a flat plateau of high probability: humans do not write the most probable next word. Pure sampling, on the other hand, hit the unreliable tail.

Their proposal, nucleus sampling, was one line of code, and it became a default in almost every generation library. The paper’s wider lesson — that decoding is part of the system, and that probability is not the same as quality — still holds for the largest models.
:::

:::breakit
- In the playground, set the temperature to 0 and a repetition penalty of 2. The loops disappear. What happens to the characters’ names, and why?
- Set top-k to 1. Which strategy is this? And top-p to 0.0001?
- Sample at temperature 3 with min-p 0.1, then with top-p 0.9. Explain the difference with the truncation widget.
- In the beam-search widget, raise the width to 6 and the steps to 10. Does the winning sequence end the story early? Why would beam search like `<|endoftext|>`?
:::

## Lab: decoding in PyTorch

`lmcourse/sampling.py` implements the chapter’s pipeline in PyTorch, batched, on logits rather than probabilities (discarded tokens get $-\infty$). A parity test checks that the TypeScript samplers produce the same distributions (`packages/core/src/sample/parity.test.ts`).

```sh
uv run lmc ch15 distributions   # the distributions used by the widgets above
uv run lmc ch15 tradeoff        # the quality–diversity measurement (≈ 10 minutes on a GPU)
```

The Hugging Face `transformers` library exposes the same pipeline as `model.generate(do_sample=True, temperature=…, top_k=…, top_p=…, min_p=…, repetition_penalty=…)`, and so do inference servers such as vLLM and llama.cpp, with the same names.

:::exercises
1. **Typical sampling.** Implement locally typical sampling: sort tokens by $\lvert -\log P(x) - H \rvert$, where $H$ is the entropy, and keep the smallest prefix of that order whose mass reaches $\tau$. Add it to the trade-off measurement.
2. **Tail mass.** For 1,000 positions of the validation set, measure how much probability CourseGPT puts outside the top-p 0.95 nucleus, and how often the *actual* next token lies outside it. Is the tail really unreliable?
3. **Temperature and calibration.** Find the temperature that minimises CourseGPT’s validation loss. Is it 1? What would it mean if it were not?
4. **No-repeat n-grams.** Implement the rule that forbids any 3-gram from occurring twice, and compare it with the repetition penalty in the playground.
:::

:::challenge
1. **Constrained decoding.** Make CourseGPT generate a story whose every sentence starts with a capital letter and ends with a full stop, by masking the logits with a small state machine over tokens.
2. **Stochastic beam search.** Implement the Gumbel-top-k trick :cite[kool2019] to sample $k$ distinct continuations without replacement, and compare their diversity with $k$ independent samples.
3. **A learned stop.** Measure, over many generations, how the probability of `<|endoftext|>` evolves through a story. Does CourseGPT know when a story is finished?
:::

## Check your understanding

```quiz
q: "Why does greedy decoding often produce repetitive loops?"
options:
  - text: "Once a phrase is in the context, the model predicts it is likely to recur, so always taking the most probable token feeds on its own repetitions."
    correct: true
    why: Repetition is self-reinforcing; nothing random breaks the cycle.
  - text: The model has a bug in its attention mask.
    why: The same model samples well; the problem is the decoding rule.
  - text: Greedy decoding uses a temperature above 1.
    why: Greedy is the T → 0 limit.
```

```quiz
q: "What does top-p = 0.9 keep when the most probable token has probability 0.95?"
options:
  - text: "Only that token: it alone already reaches 0.9."
    correct: true
    why: Top-p keeps the smallest set reaching p, so here sampling becomes greedy.
  - text: The tokens holding the top 90% of the vocabulary.
    why: p is a share of probability, not of tokens.
  - text: Every token with probability above 0.1.
    why: That would be a fixed threshold, closer to min-p.
```

```quiz
q: "Why is min-p more robust than top-p at high temperature?"
options:
  - text: "A high temperature spreads probability over thousands of tail tokens, which then fill top-p's nucleus; none of them reaches a fixed fraction of the top token, so min-p still excludes them."
    correct: true
    why: Min-p's threshold is relative to the leader, not to the cumulative mass.
  - text: Min-p is applied before the temperature.
    why: In our pipeline all truncation comes after the temperature.
  - text: Min-p always keeps exactly one token.
    why: It keeps every token within the ratio of the leader.
```

```quiz
q: "Why is beam search a good choice for translation but not for story writing?"
options:
  - text: "In translation the source sentence constrains the output, so the most probable output is usually good; in open-ended writing the most probable text is bland and repetitive."
    correct: true
    why: The likelihood trap bites hardest when many continuations are acceptable.
  - text: Beam search is too slow for long stories.
    why: Its cost is only a few times greedy decoding.
  - text: Beam search cannot produce an end-of-text token.
    why: It can, and often does so too early.
```

## Further reading

- Ari Holtzman and colleagues, *The Curious Case of Neural Text Degeneration* :cite[holtzman2020].
- Minh Nguyen and colleagues, *Turning Up the Heat: Min-p Sampling* :cite[nguyen2024].
- John Hewitt, Christopher Manning and Percy Liang, *Truncation Sampling as Language Model Desmoothing* :cite[hewitt2022].
- Clara Meister and colleagues, *Locally Typical Sampling* :cite[meister2023].
- Felix Stahlberg and Bill Byrne, *On NMT Search Errors and Model Errors* :cite[stahlberg2019].
