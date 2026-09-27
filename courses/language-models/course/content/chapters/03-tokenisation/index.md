---
number: 3
title: Tokenisation
summary: What should one symbol be — a character, a byte, a word? Implement byte-level byte-pair encoding, the method behind GPT-2 through today’s frontier models, and see how the choice of tokens shapes everything a model can and cannot do.
duration: About 3 hours, including the lab
prerequisites: [text-as-data, n-gram-models]
builds:
  - Byte-level BPE trainer
  - Encoder & decoder
  - Pre-tokeniser
  - GPT-2 tokeniser (from its published files)
---

Every equation so far has contained a symbol $x_t$ drawn from a vocabulary. In Chapter 2 that symbol was a character, and it served us well. But it is a choice, and one of the most consequential in the whole design of a language model. The vocabulary fixes what the model reads and writes. It sets how long every sequence is, which drives the cost of training and of attention (Chapter 10). It sets the size of the input and output layers. And it decides which patterns are easy to learn and which are nearly impossible — a model that sees `strawberry` as one token does not directly see its letters.

This chapter covers the tokeniser used by almost every modern LLM: **byte-level byte-pair encoding (BPE)**. We implement it from scratch, train it on Shakespeare in your browser, load GPT-2’s real tokeniser from its published files, and then look at the ways tokenisation goes wrong.

## Three simple answers

There are three obvious units to choose from, and each fails in a different way.

| Unit | Vocabulary | Sequence length | Unseen input? | Meaning per token |
|---|---|---|---|---|
| **Characters** (code points) | ~150,000 possible; ~100 in practice | long | new characters | very little |
| **Bytes** (UTF-8) | exactly 256 | longest | impossible — every string is bytes | very little |
| **Words** | unbounded (Heaps’ law) | short | constantly — names, typos, new words | a lot |

Characters and bytes give tiny vocabularies and complete coverage, but long sequences in which each step carries little information. Words give short, meaningful sequences but a vocabulary that never stops growing. Chapter 1’s Heaps’ law says any fixed word list will meet unknown words, which must be mapped to a catch-all `<unk>` token and lost.

Try the three on some text, alongside two learned tokenisers we are about to build and load:

::tokeniser-compare

The modern answer is in between: **subword** tokens. Frequent words become single tokens (` the`, ` and`, ` love`); rarer words are spelled out of smaller, reusable pieces (` thr` `ough`, ` J` `ul` `iet`); and because the smallest pieces are bytes, nothing is ever out of vocabulary. The question is how to choose the pieces.

:::history{year=1994 title="From a compression trick to machine translation" people="Philip Gage; Rico Sennrich, Barry Haddow and Alexandra Birch"}
Byte-pair encoding began as a data-compression algorithm. In 1994 Philip Gage described a simple scheme in *The C Users Journal*: find the most frequent pair of adjacent bytes, replace it with a byte value the file does not use, record the substitution, and repeat :cite[gage1994]. It compressed less well than the LZ family, but decompression was extremely fast. Twenty-two years later, Rico Sennrich, Barry Haddow and Alexandra Birch reused the idea for neural machine translation. They had the same open-vocabulary problem — German compounds, names, rare words — and learned merges over characters within words, so that rare words were translated piece by piece :cite[sennrich2016]. GPT-2 then made one decisive change: run BPE over *bytes* rather than characters, so the base vocabulary is exactly 256 symbols and any string can be encoded :cite[radford2019].
:::

## Byte-pair encoding

### Training

BPE training is greedy compression. Start with every text chunk as a sequence of UTF-8 bytes, so the vocabulary is the 256 byte values. Then repeat:

1. Count every pair of adjacent tokens across the corpus.
2. Take the most frequent pair $(a, b)$ and make it a new token, numbered $256 + i$ for the $i$-th merge.
3. Replace every occurrence of $a\,b$ in the corpus with the new token.

:::equation{#bpe-merge caption="The BPE merge rule: the pair occurring most often across all chunks."}
$$
(a^\star, b^\star) \;=\; \argmax_{(a,\,b)} \; \sum_{\term{wch}{w}} \term{fw}{f(w)} \cdot \term{nab}{\#_{a b}(w)}
$$
:::

```terms
wch:
  label: "$w$ — a chunk"
  what: One distinct pre-tokenised piece of text, such as ` the` or `,` — words with their leading space, punctuation, numbers.
  why: Merges are learned *within* chunks, never across them. That stops the tokeniser wasting vocabulary on accidents such as `dog.` versus `dog!`.
fw:
  label: "$f(w)$ — chunk frequency"
  what: How many times chunk $w$ occurs in the training corpus.
  why: We only store each distinct chunk once (TinyShakespeare’s 298,000 chunks contain about 15,000 distinct ones) and weight its pairs by its frequency, which makes training fast.
nab:
  label: "$\\#_{ab}(w)$ — pair occurrences"
  what: How many times token $a$ is immediately followed by token $b$ in chunk $w$, under the current merges.
  effect: Occurrences overlap, so `aaa` contains the pair $(a, a)$ twice, even though only one merge can happen there.
```

Merging a pair that occurs $N$ times shortens the corpus by exactly $N$ tokens. So each step of BPE takes the largest available bite out of the sequence length. It is a greedy algorithm for representing the corpus with as few tokens as possible, given a vocabulary budget. It is not optimal: a merge that helps now can block better merges later :cite[bostrom2020]. But it is simple, fast and remarkably effective.

Start with the two primitive operations:

::exercise{id="bpe-pairs"}

Then watch them at work on TinyShakespeare. The first merges are the most common pairs of bytes in English: ` t`, `he`, ` a`, `ou`… and by the twelfth, ` the` has become a single token.

::bpe-live

Now write the full training loop. Your version recounts every pair after each merge, which is simple but slow. The tests compare your merges against the course library’s fast trainer, merge for merge.

::exercise{id="bpe-train"}

:::details[How the library trains fast: incremental updates]
Recounting all pairs after every merge costs $O(\text{merges} \times \text{corpus size})$. The library’s `BpeTrainer` (and its Python twin) avoids this with three structures:

- **Pair counts** $c(a, b)$, summed over chunks weighted by frequency.
- **An index** from each pair to the set of chunks containing it.
- **A max-heap** of $(c, a, b)$ entries with *lazy deletion*: when a count changes we push a new entry and leave the old one in place, discarding it when it reaches the top with a stale count.

A merge visits only the chunks containing the pair. For each, it subtracts the chunk’s old pairs from the counts, rewrites the chunk, and adds its new pairs back. On TinyShakespeare this takes about half a second for 1,024 merges, against minutes for the naïve loop. Ties are broken deterministically — highest count, then smallest first id, then smallest second id — so the TypeScript and Python versions learn *identical* merges. A parity test in the repository checks this.
:::

### Encoding and decoding

A trained tokeniser is just the ordered list of merges. To encode a new chunk, start from its bytes and apply the merges **in the order they were learned**: repeatedly find the adjacent pair with the lowest merge rank and merge it, until no adjacent pair appears in the list. Applying merges in training order is what makes encoding reproduce how the training corpus was segmented. The obvious alternative, greedily matching the longest token from the left, gives different and usually worse segmentations.

Decoding is trivial and **lossless**. Each token maps to a fixed byte string (its two parents’ bytes, concatenated), so decoding is just concatenating bytes and reading them as UTF-8. That is also why a single token can be an incomplete character — GPT-2 often splits a Chinese character or an emoji across tokens — and why streaming output needs the buffered UTF-8 decoder from Chapter 1.

::exercise{id="bpe-encode"}

## Pre-tokenisation

Before BPE sees any text, a regular expression splits it into chunks, and merges never cross chunk boundaries. GPT-2’s pattern, which our course pattern follows closely, is:

```text
's|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

| Piece | Matches | Why |
|---|---|---|
| `'s\|'t\|'re\|…` | English contractions | keep `it's` → `it` + `'s`, so `'s` is one reusable token |
| ` ?\p{L}+` | a run of letters, with one optional leading space | words carry their preceding space: ` the` and `the` are different tokens |
| ` ?\p{N}+` | a run of digits | numbers never merge with letters |
| ` ?[^\s\p{L}\p{N}]+` | a run of punctuation or symbols | `...`, `?!`, `()` |
| `\s+(?!\S)` | whitespace not followed by a word | runs of spaces or newlines, leaving the last space for the next word |
| `\s+` | any remaining whitespace | a catch-all |

Two conventions deserve attention. First, the **leading space** belongs to the word. The model therefore has separate tokens for `the` at the start of a line and ` the` elsewhere, and a prompt ending in a space leaves the model in an unusual position. It must start the next word with no space, a combination rare in training. Second, **numbers**: GPT-2 lets BPE merge arbitrary digit strings, so `1234567` might become `123` `45` `67` while `1234568` splits differently. That inconsistency hurts arithmetic. LLaMA split numbers into single digits :cite[touvron2023]. GPT-4 and Llama 3 split them into groups of at most three digits :cite[dubey2024], which is what our course pattern does with `\p{N}{1,3}`.

::exercise{id="pretokenise"}

## Special tokens

A tokeniser also reserves a few **special tokens** that no text can produce by accident. GPT-2 has one, `<|endoftext|>` (id 50256), placed between documents during training so the model learns where one text ends and the next begins. Chat models add more to mark whose turn it is (Chapter 20).

Because special tokens are control signals, they must be **unforgeable**. If a user types the literal characters `<|endoftext|>` into a chat, the tokeniser has to encode them as ordinary text. Otherwise a user could end the system’s turn and impersonate it, an early form of prompt injection (Chapter 28). Our `encode` only emits special tokens when explicitly passed `allowSpecial: true`, which only trusted code should do. Try the *Special token* example in the first figure.

## How big should the vocabulary be?

More merges mean shorter sequences but a larger vocabulary. Every token needs a row in the model’s input embedding table and a column in its output layer. So the two sides of the trade-off are:

:::equation{#vocab-tradeoff caption="The vocabulary trade-off: parameters grow with V, sequence length shrinks with it."}
$$
\underbrace{2\,\term{Vt}{V}\,\term{dm}{d}}_{\text{embedding + output parameters}}
\qquad \text{versus} \qquad
\underbrace{\term{Tt}{T} \;=\; \frac{\term{Nb}{N_{\text{bytes}}}}{\term{rho}{\rho(V)}}}_{\text{tokens per text}}
$$
:::

```terms
Vt:
  label: "$V$ — vocabulary size"
  what: The number of distinct tokens, 256 + number of merges (+ special tokens).
  effect: Doubling $V$ doubles the embedding and output parameters, and makes each token rarer in the training data, so its row is trained on fewer examples.
dm:
  label: "$d$ — model width"
  what: The length of the vector representing each token inside the model (Chapter 7). CourseGPT uses a few hundred; frontier models use several thousand.
  why: Each of the $V$ tokens has a $d$-dimensional input embedding and a $d$-dimensional output weight vector.
Tt:
  label: "$T$ — sequence length in tokens"
  what: How many tokens a given text becomes.
  effect: Training and inference cost grow at least linearly in $T$, and self-attention grows as $T^2$. A fixed context window of $T$ tokens covers more text when tokens are longer.
Nb:
  label: "$N_{\\text{bytes}}$ — text length"
  what: The size of the text in UTF-8 bytes.
rho:
  label: "$\\rho(V)$ — bytes per token"
  what: The tokeniser’s compression rate. It increases with $V$, with diminishing returns — see the left panel of the figure below.
```

Compression is only half the story. What we care about is how well a *model* predicts text given the tokens. We can measure that already, with Chapter 2’s n-gram models, as long as we report cross-entropy per *character* rather than per token so that different tokenisers are comparable.

::vocab-experiment

Two results stand out:

- **A trigram over tokens rivals a 6-gram over characters.** At $V = 2048$ each token averages 2.5 characters, so two tokens of context cover about five characters. The token trigram reaches about 2.26 bits per character, close to Chapter 2’s best character model (2.22). Tokenisation is a way of stretching a fixed context over more text.
- **Bigger is not always better.** The trigram model gets *worse* beyond about 2,000 tokens, because each token trigram is rarer and the counts become sparse — Chapter 2’s problem again. Neural models suffer less, because they share information between similar tokens. That is part of why production vocabularies are much larger than the optimum here.

Real vocabularies: GPT-2 has 50,257 tokens; GPT-4’s tokeniser about 100,000; Llama 3 128,000 :cite[dubey2024]; some recent models 200,000–260,000. CourseGPT will use 8,192, which suits a 30M-parameter model trained on simple English.

## When tokenisation goes wrong

Many odd LLM behaviours turn out to be tokenisation problems. Use the first figure’s examples to see each of these:

- **Spelling and counting letters.** “How many r’s in *strawberry*?” is hard because the model sees one or two tokens, not ten letters. It can only answer from what it has learned *about* those tokens.
- **Arithmetic.** With GPT-2, `1234567` and `1234568` may split into different chunks, so the model sees digits in shifting groups. Consistent digit grouping measurably improves arithmetic.
- **Case and spacing.** `Hello`, ` Hello`, `hello` and `HELLO` are unrelated token ids. The model must learn separately that they mean the same thing.
- **Code.** GPT-2 spends one token per space of indentation. Later tokenisers added tokens for runs of spaces and tabs, making code up to several times cheaper.
- **Unequal languages.** A tokeniser trained mostly on English compresses other languages poorly, so the same content costs their speakers more tokens. That means more money, more latency and less effective context.

::multilingual-cost

Aleksandar Petrov and colleagues measured this for many tokenisers and languages. Some languages need more than ten times as many tokens as English for the same content :cite[petrov2023]. Tokeniser training data is a policy decision, whether or not anyone treats it as one.

:::history{year=2023 title="SolidGoldMagikarp" people="Jessica Rumbelow and Matthew Watkins"}
In early 2023, two researchers exploring GPT-3’s embedding space found a cluster of strange tokens — ` SolidGoldMagikarp`, ` TheNitromeFan`, ` petertodd` and others. When asked to repeat them, the model evaded, insulted the user, or produced something unrelated :cite[rumbelow2023]. The cause was a mismatch between two datasets. The tokeniser had been trained on data that included a Reddit forum where a few users counted to infinity, so their usernames occurred often enough to earn single tokens. The model itself was trained on data where those strings almost never appeared. Their embeddings were barely updated from random initialisation, and the model had no idea what they meant. Later work found such **under-trained tokens** in many open models, and methods to detect them automatically :cite[land2024]. The lesson: train the tokeniser on the same distribution as the model.
:::

## Beyond BPE

BPE is not the only subword method, and subwords may not be the end of the story.

- **WordPiece**, developed for Japanese and Korean voice search :cite[schuster2012] and used in Google’s translation system and in BERT, is very similar. It chooses merges that most increase the likelihood of the training data under a unigram model, and encodes by greedy longest match.
- **The Unigram language model** :cite[kudo2018unigram] works the other way round. It starts from a large candidate vocabulary and prunes it, keeping the tokens that best explain the corpus. Each text then has many possible segmentations with probabilities, found with the Viterbi algorithm. Sampling among them during training (*subword regularisation*) makes models more robust. BPE-dropout :cite[provilkov2020] brings the same idea to BPE.
- **SentencePiece** :cite[kudo2018] is a library implementing both BPE and Unigram. It treats the input as a raw stream, with spaces encoded as `▁`, so no language-specific pre-tokenisation is needed.
- **Tokeniser-free models** feed bytes directly to the network and let it learn the grouping. Examples are ByT5 :cite[xue2022byt5], MegaByte :cite[yu2023megabyte] and the Byte Latent Transformer, which groups bytes into variable-length patches according to how predictable they are :cite[pagnoni2024blt]. If they fully match subword models, most of this chapter’s pathologies disappear.

## Lab: the tokeniser module

| Piece | File |
|---|---|
| `BpeTrainer` (incremental), `BpeTokeniser`, `applyMerges`, `pretokenise` | `packages/core/src/tokenise/bpe.ts` |
| `loadGpt2` — GPT-2’s tokeniser from `vocab.bpe` and `encoder.json` | same file |
| Python twin, used to train CourseGPT’s tokeniser in Chapter 14 | `training/lmcourse/bpe.py` |

Train a tokeniser from the command line and inspect its first merges and a sample encoding:

```bash
cd training
uv run lmc ch03 --merges 1024
```

Two parity tests guard the implementation. `packages/core/src/tokenise/parity.test.ts` checks that the TypeScript trainer learns exactly the same merges as the Python one. It also checks that our GPT-2 encoder produces exactly the same token ids as OpenAI’s `tiktoken` library, on strings that include emoji, code and glitch tokens.

:::exercises
1. **Tokenise the corpus.** Encode TinyShakespeare with your 1,024-merge tokeniser and plot the frequency of each token against its rank. Is it Zipfian? How does its slope compare with Chapter 1’s word-level Zipf plot?
2. **Morphology for free?** List the tokens that end in `ing`, `ed` or `ly`, and those that begin with ` un`. Do merges capture English morphology? Where do they get it wrong?
3. **Round-trip property test.** Generate thousands of random Unicode strings (include emoji, combining marks and lone surrogates) and check that `decode(encode(s)) === s`. Which inputs fail, and is that a bug or a property of UTF-8?
4. **Token healing.** Encode `"The capital of France is"` and `"The capital of France is "` (trailing space) with GPT-2. Explain why the second is a worse prompt, and sketch a fix that backs up one token before generating.
:::

:::challenge
1. **Unigram tokenisation.** Implement Kudo’s Unigram LM tokeniser :cite[kudo2018unigram]: seed a large candidate vocabulary, run EM to estimate token probabilities, prune the least useful 20% each round, and segment with Viterbi. Compare its tokens with BPE’s at the same vocabulary size.
2. **Fast encoding.** Our encoder rescans the whole chunk after every merge, which is $O(n^2)$ in the chunk length. Rewrite it with a linked list and a priority queue to run in $O(n \log n)$, and benchmark it on a long chunk (a line of 10,000 digits).
3. **A tokeniser for Python code.** Train BPE on a corpus of Python source with a pre-tokeniser that keeps runs of spaces together. Compare its compression on code with GPT-2’s.
:::

## Check your understanding

```quiz
q: "Why can a byte-level BPE tokeniser encode any string, even one in a script it never saw during training?"
options:
  - text: It falls back to an `<unk>` token.
    why: Byte-level BPE has no `<unk>` token. That is its main advantage over word vocabularies.
  - text: "Its base vocabulary contains all 256 byte values, so any UTF-8 string can at least be spelled out byte by byte."
    correct: true
    why: Merges are shortcuts on top of the bytes. Unseen text simply gets fewer shortcuts.
  - text: It normalises all text to ASCII first.
    why: Byte-level BPE applies no normalisation at all.
```

```quiz
q: "A tokeniser was trained with merges [(t,h), (th,e), (e,r)]. How is the chunk `ther` encoded?"
options:
  - text: "`the` + `r`"
    correct: true
    why: "Merges apply in rank order. (t,h) first gives th·e·r, then (th,e) gives the·r. The (e,r) merge no longer applies, because e has already been absorbed."
  - text: "`th` + `er`"
    why: That is what you get if you apply (e,r) before (th,e) — but (th,e) was learned earlier, so it has priority.
  - text: "`t` + `h` + `e` + `r`"
    why: The merges do apply to this chunk.
```

```quiz
q: "In the vocabulary experiment, why does the token trigram model get worse beyond about 2,000 tokens, even though sequences keep getting shorter?"
options:
  - text: The tokeniser starts making mistakes.
    why: The tokeniser is lossless at every size.
  - text: "Each token trigram becomes rarer, so its counts are sparser and the model backs off more often — the data-sparsity problem from Chapter 2."
    correct: true
    why: A larger vocabulary means V³ possible trigrams sharing the same amount of training data.
  - text: Bits per character cannot go below 2.2.
    why: That is only the best our n-gram models achieve. Neural models go well below it.
```

## Further reading

- Andrej Karpathy, *Let’s build the GPT Tokenizer* (video, 2024) and the accompanying `minbpe` repository :cite[karpathy2024minbpe]. A two-hour, line-by-line build of a GPT-4-style tokeniser.
- Rico Sennrich, Barry Haddow and Alexandra Birch, *Neural Machine Translation of Rare Words with Subword Units* :cite[sennrich2016]. Short, clear and the origin of subword NLP.
- Aleksandar Petrov et al., *Language Model Tokenizers Introduce Unfairness Between Languages* :cite[petrov2023].
