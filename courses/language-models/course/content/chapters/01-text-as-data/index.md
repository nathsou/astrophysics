---
number: 1
title: Text as data
summary: Before a model can predict text, it has to see it. How text becomes numbers — Unicode, UTF-8, normalisation — and what the statistics of real text tell us about the problem ahead.
duration: About 2½ hours, including the lab
builds:
  - Reading UTF-8 and malformed sequences
  - Corpus statistics
  - Entropy
---

A language model is a probability distribution over sequences of symbols. That single sentence is the whole course in miniature. Everything we build — from a table of counts to a Transformer with a KV cache — is a better way of estimating the same quantity:

:::equation{#chain-rule caption="The chain rule of probability: predicting a sequence one symbol at a time."}
$$
\term{P}{P}(x_1, x_2, \ldots, x_{\term{T}{T}}) \;=\; \prod_{t=1}^{T} P\big(\term{xt}{x_t} \,\big|\, \term{xlt}{x_{<t}}\big)
$$
:::

```terms
P:
  label: "$P$ — probability"
  what: The model’s probability for a sequence (left) or for one symbol given what came before (right).
  why: The chain rule turns a distribution over whole sequences — an astronomically large object — into a product of manageable next-symbol predictions.
  effect: Every chapter changes *how* $P(x_t \mid x_{<t})$ is computed — counts, a neural network, attention — but never *what* it is.
T:
  label: "$T$ — sequence length"
  what: The number of symbols in the sequence.
  why: The product has one factor per position.
  effect: Longer sequences mean more factors below 1, so the joint probability shrinks exponentially with $T$ — one reason we work with log-probabilities.
xt:
  label: "$x_t$ — the next symbol"
  what: The symbol at position $t$ — a character, a byte or a token, drawn from a finite **vocabulary**.
  why: This is what the model predicts at each step.
  effect: "Choosing the vocabulary — what one $x_t$ is — is a design decision with large consequences. This chapter and Chapter 3 are about exactly that."
xlt:
  label: "$x_{<t}$ — the context"
  what: All symbols before position $t$, i.e. $x_1, \ldots, x_{t-1}$.
  why: Language is not a sequence of independent draws; what comes next depends on what came before.
  effect: How much of the context a model can use — one symbol, $n-1$ symbols, or thousands — is the main axis of progress from Chapter 2 to Chapter 11.
```

Hover over any symbol in an equation to see what it means, why it is there and what happens if you change it. Click to pin the explanation. Some symbols are wired to sliders that drive the figures on the page — you will meet the first of those shortly.

Before we can estimate any of those probabilities we need to settle something more basic: **what is a symbol?** A computer stores numbers, not letters. This chapter follows text from the characters you see, through the numbers that represent them, to the statistical regularities that make prediction possible — and occasionally hard.

:::key
By the end of this chapter you can distinguish bytes, code points and graphemes, read a rank-frequency plot, and interpret entropy. The supplied `@lm/core/text` library handles encoding and fitting; the short entropy exercise is available if you want to connect the formula to code.
:::

For editor controls, saving work and optional labs, see [How the course works](../what-is-a-language-model/#how-the-course-works). Here, start with the character explorer.

## From characters to numbers

The first standard for turning characters into numbers that most programmers meet is **ASCII** (1963): 128 code values covering the English alphabet, digits, punctuation and a handful of control codes such as newline. Seven bits per character. That was enough for American teletypes, and nowhere near enough for the rest of the world.

For three decades, the fix was a patchwork of incompatible 8-bit **code pages** — Latin-1 for Western Europe, KOI8-R for Russian, Shift JIS for Japanese, and hundreds more. The same byte meant different characters depending on which table you assumed, which is why text used to arrive as mojibake such as `cafÃ©`.:sidenote[*Mojibake* (文字化け, “character transformation”) is the Japanese word for garbled text produced by decoding with the wrong table. That `Ã©` is exactly what you get by reading the UTF-8 bytes of `é` as Latin-1.]

:::history{year=1991 title="One code for every character" people="Joe Becker, Lee Collins, Mark Davis and the Unicode Consortium"}
In 1988 Joe Becker at Xerox circulated a draft titled *Unicode 88*, proposing “a unique, unified, universal” encoding for all the world’s scripts :cite[becker1988]. Unicode 1.0 followed in 1991, and it was later unified with the ISO 10646 standard. The early design assumed 16 bits (65,536 characters) would be plenty. It wasn’t: Unicode now reserves room for 1,114,112 code points and assigns just under 160,000 of them, from Latin and Han to Linear B, mathematical alphanumerics and emoji :cite[unicode].
:::

### Code points

Unicode assigns every character an integer called a **code point**, conventionally written in hexadecimal with a `U+` prefix: `A` is U+0041, `é` is U+00E9, `€` is U+20AC, `😀` is U+1F600. The range runs from U+0000 to U+10FFFF.

A code point is not the same as what a reader thinks of as one character. Unicode calls the reader’s notion a **grapheme cluster**, and a single grapheme can be several code points:

- `é` can be one code point (U+00E9) *or* two: `e` followed by U+0301 COMBINING ACUTE ACCENT.
- `👍🏽` is a thumbs-up followed by a skin-tone modifier.
- `👩‍👩‍👧‍👦` is seven code points: four people glued together by three invisible ZERO WIDTH JOINERs.

JavaScript adds a third notion. Its strings are sequences of 16-bit **UTF-16 code units**, so `'😀'.length === 2`. Code points above U+FFFF are stored as a pair of *surrogates*. That is why `for…of` (which iterates code points) and indexing with `s[i]` (which reads code units) can disagree.

::unicode-inspector

:::question
Before trying it above: how many graphemes, code points, UTF-8 bytes and UTF-16 units does the family emoji have? Now type it in. Which of those four numbers would you want a language model’s “length” to mean?
:::

### UTF-8: code points as bytes

A code point is an abstract number; files and networks carry bytes. An **encoding** maps between them. UTF-32 simply uses four bytes per code point: simple, but it quadruples the size of English text. UTF-16 uses two or four. **UTF-8**, which now carries the overwhelming majority of text on the web, uses between one and four bytes depending on the size of the code point:

:::equation{#utf8-length caption="Number of UTF-8 bytes used for a code point."}
$$
\term{utf8n}{n}(\term{cp}{c}) = \begin{cases}
1 & c \le \texttt{7F}_{16} \\
2 & \texttt{80}_{16} \le c \le \texttt{7FF}_{16} \\
3 & \texttt{800}_{16} \le c \le \texttt{FFFF}_{16} \\
4 & \texttt{10000}_{16} \le c \le \texttt{10FFFF}_{16}
\end{cases}
$$
:::

```terms
utf8n:
  label: "$n$ — bytes per code point"
  what: How many bytes UTF-8 spends on the code point $c$.
  why: Variable length is the whole trick. ASCII stays one byte, and the rare characters pay for the space.
  effect: "Scripts outside ASCII pay 2–4 bytes per character. A byte-level model therefore needs 2–3× more steps to read the same sentence in Greek, Hindi or Chinese — a fairness issue we return to in Chapter 3."
cp:
  label: "$c$ — code point"
  what: The Unicode code point being encoded, an integer from 0 to $\texttt{10FFFF}_{16}$ (1,114,111).
  why: UTF-8 is a function of this number alone. It knows nothing about fonts, languages or graphemes.
```

Each byte announces its role through its high bits. A byte starting `0` is a complete ASCII character. A byte starting `110`, `1110` or `11110` begins a 2-, 3- or 4-byte sequence. A byte starting `10` is a **continuation byte** carrying six payload bits. Try it:

::utf8-bits

This design, from 1992, has properties that are easy to take for granted:

1. **ASCII compatibility.** Every ASCII file is already valid UTF-8, byte for byte.
2. **Self-synchronisation.** Continuation bytes (`10xxxxxx`) can never be mistaken for lead bytes, so a decoder dropped into the middle of a stream finds the next character boundary within three bytes.
3. **No accidental NULs or slashes.** Bytes `00` and `2F` (`/`) only ever mean U+0000 and `/`, so C strings and file paths keep working.
4. **Sort order is preserved.** Comparing UTF-8 byte strings lexicographically gives the same order as comparing their code points.

:::history{year=1992 title="UTF-8 on a placemat" people="Ken Thompson and Rob Pike, Bell Labs"}
In September 1992 an X/Open committee was about to adopt a clumsier multi-byte encoding. Ken Thompson and Rob Pike, working on the Plan 9 operating system, designed an alternative over dinner in a New Jersey diner — Thompson reportedly sketched the bit-packing on a placemat — and had Plan 9 converted to it within days. Pike later told the story in an email that is still the best primary source :cite[pike2003]. The encoding was standardised as RFC 2279 and later tightened to today’s RFC 3629, which capped it at four bytes and forbade encoding surrogates :cite[rfc3629].
:::

#### Why a language model cares

UTF-8 bytes give us a vocabulary of exactly **256 symbols that can represent any text in any language**. There is no “unknown character”. GPT-2 made this the foundation of its tokeniser :cite[radford2019], and almost every modern LLM’s tokeniser starts from bytes. The cost is visible in the inspector: text outside ASCII takes more bytes, so byte-based models see it as longer sequences.

There is a practical consequence too. A model that emits bytes, or tokens made of bytes, can stop in the middle of a multi-byte character. Streaming LLM output therefore has to buffer incomplete UTF-8 sequences rather than decode each chunk separately — which is exactly what `TextDecoder`’s `stream: true` option is for:

```ts title="Decoding a token stream safely"
const decoder = new TextDecoder('utf-8');
let text = '';
for await (const chunk of tokenBytes) {
  // Holds back an incomplete trailing sequence until the next chunk completes it.
  text += decoder.decode(chunk, { stream: true });
}
text += decoder.decode(); // flush
```

Now implement both directions yourself. The encoder is short. The decoder is harder: malformed input must be handled exactly as browsers do, which is a good first taste of the “specification-accurate” code an inference engine needs.

:::question
**Read the bytes.** In the character explorer, compare `A`, `é`, and `🙂`. Predict their UTF-8 lengths before revealing the bytes: one, two, and four bytes respectively. The prefixes encode the sequence length; the remaining bits carry the code point. You do not need to implement a text codec to continue.
:::

:::question
**Find a broken sequence.** Use the decoder to inspect a missing continuation byte and an overlong encoding. Explain why a decoder must reject both. The supplied decoder handles those edge cases; the learning goal is to recognise malformed input.
:::

:::breakit
1. Encode `café` as UTF-8, then decode the bytes as Latin-1: `new TextDecoder('latin1').decode(new TextEncoder().encode('café'))`. Predict the output before you run it.
2. Split the UTF-8 bytes of `'日本'` after the fourth byte and decode each half *without* `stream: true`. How many replacement characters do you get, and why?
3. Switch the inspector above to your encoder, then deliberately break the 3-byte case (say, drop the `& 0x3F`). Which examples still look right? Which tests catch it?
:::

### Normalisation: when equal isn’t equal

Because `é` can be spelled with one code point or two, two strings that render identically can differ byte for byte. So can `ﬁ` (a single ligature code point) and `fi`, or a full-width `Ａ` and an ordinary `A`. Unicode defines **normalisation forms** :cite[uax15] that rewrite strings into a canonical spelling:

- **NFC / NFD** handle *canonical equivalence*: the same abstract character spelled differently. NFC composes (`e` + ◌́ → `é`), NFD decomposes.
- **NFKC / NFKD** also fold *compatibility* variants: characters that mean the same but are presented differently (ligatures, full-width forms, superscripts, circled digits). They lose information: `x²` becomes `x2`.

::normalisation-lab

For a language model, the rule is simple and often broken: **pick a normalisation, apply it identically at training and at inference, and document it.** SentencePiece, used by many multilingual models, applies NFKC by default :cite[kudo2018]. GPT-2-style byte-level tokenisers apply none, so they see `é` and `e◌́` as different inputs. Neither is wrong, but mixing them is: a model trained on NFC text and served NFD text sees sequences it has rarely encountered.:sidenote[Normalisation also matters for safety. Visually identical *homoglyphs* — Cyrillic `а` (U+0430) versus Latin `a` (U+0061) — are a classic way to slip past keyword filters. Chapter 28 comes back to this.]

## Corpora

Models learn from a **corpus**: a large body of text. The scale has changed beyond recognition. The Brown Corpus of 1961 — a million words of carefully sampled American English — was the standard research dataset for decades :cite[kucera1967]. Modern pre-training sets are scraped from the web and filtered, with names such as C4 :cite[raffel2020], the Pile :cite[gao2020] and FineWeb :cite[penedo2024]. They are measured in trillions of tokens.

| Corpus | Year | Size | Used in this course |
|---|---|---|---|
| Brown Corpus | 1961 | ≈ 1 M words | — |
| TinyShakespeare | 2015 | 1.1 MB, ≈ 200 k words | Chapters 1–12 (small, fast, recognisable) |
| TinyStories | 2023 | ≈ 2 M short stories | CourseGPT, from Chapter 14 |
| FineWeb | 2024 | ≈ 15 T tokens | Optional capstone (a 2.5 B-token sample) |

We start with **TinyShakespeare**, a single file of Shakespeare’s plays that Andrej Karpathy assembled to demonstrate character-level RNNs :cite[karpathy2015]. It is small enough to load in your browser and distinctive enough that you can see a model improving. Our main model, CourseGPT, will train on **TinyStories** :cite[eldan2023]: simple children’s stories generated with a restricted vocabulary, designed so that even very small models learn to write fluent, coherent English. That design choice is what lets us train a genuine GPT on a single consumer GPU.

Two words are worth fixing now. A **token** is one occurrence of a unit in running text. A **type** is a distinct unit. “To be or not to be” has six word tokens but only four word types.

::corpus-explorer

A few things are worth noticing in the explorer. Space is by far the most common character, followed by `e`. A few dozen word types account for a large share of all word tokens. And thousands of types — the *hapax legomena* — occur exactly once. That lopsidedness has a name.

## Zipf’s law

Rank the word types by frequency, most frequent first, and plot frequency against rank on logarithmic axes. For almost any sizeable corpus in almost any language, you get something close to a straight line — a **power law**:

:::equation{#zipf caption="Zipf’s law. On log–log axes, log f = log C − s·log r: a straight line with slope −s."}
$$
\term{f}{f}(\term{r}{r}) \;=\; \frac{\term{C}{C}}{r^{\term{s}{s}}}
$$
:::

```terms
f:
  label: "$f(r)$ — frequency"
  what: How many times the word of rank $r$ occurs in the corpus.
  why: This is the observed quantity the law describes.
r:
  label: "$r$ — rank"
  what: The position of a word when all word types are sorted by frequency, most frequent first. The commonest word has $r = 1$.
  why: Zipf’s insight was to plot frequency against rank rather than against the word itself, which exposes the same shape in every corpus.
  effect: Hover the plot below — the tooltip shows which word sits at each rank.
C:
  label: "$C$ — scale"
  what: The predicted frequency of the top-ranked word.
  why: It sets the overall level of the curve and grows in proportion to corpus size.
  effect: On log–log axes, changing $C$ shifts the line up or down without changing its slope.
  param: { key: zipf.C, min: 100, max: 50000, step: 1, value: 5000, log: true }
s:
  label: "$s$ — Zipf exponent"
  what: How steeply frequency falls with rank. For words in natural language, $s \approx 1$.
  why: It is the (negated) slope of the line on log–log axes.
  effect: Larger $s$ concentrates more of the probability mass in the top few words; smaller $s$ gives a fatter tail of rare words. Drag it and watch the dashed line pivot.
  param: { key: zipf.s, min: 0.3, max: 2, step: 0.01, value: 1 }
```

The sliders under the equation drive the dashed model line in the plot. Try to match the observed curve by hand, then press **Fit**.

::zipf-plot

The fit for TinyShakespeare’s words gives $s \approx 1.2$, close to the classic $s \approx 1$ reported across many corpora. The exact value depends on the corpus, on how words are split, and on the fitting method. With $s = 1$, the $r$-th word is $1/r$ as frequent as the most common one: the second word is half as frequent as the first, and the tenth a tenth. Toggle the plot to characters and the picture changes completely: a small, closed alphabet does not have a long tail.

:::history{year=1935 title="The principle of least effort" people="George Kingsley Zipf (1902–1950)"}
Zipf, a Harvard linguist, popularised the rank–frequency law in *The Psycho-Biology of Language* :cite[zipf1935] and tried to explain it in *Human Behavior and the Principle of Least Effort* :cite[zipf1949]: speakers prefer a few short, general words, while listeners prefer many specific ones, and the tension settles into a power law. He was not first. The French stenographer Jean-Baptiste Estoup noticed the pattern in 1916, and the physicist Edward Condon in 1928. The explanation remains debated. George Miller showed in 1957 that even text typed by a “monkey” hitting random keys, with the space bar as one of them, produces Zipf-like word statistics :cite[miller1957], and a modern review is sceptical that any single mechanism accounts for it :cite[piantadosi2014].
:::

:::warning
Fitting a straight line to a log–log plot by least squares, as we do here, is quick and good for intuition, but it is a biased estimator for power-law exponents. The long tail contributes many noisy points with equal weight. For real estimates use maximum likelihood :cite[clauset2009] — one of this chapter’s challenges.
:::

Zipf’s law matters for language models in three ways:

1. **Sparsity.** Most types are rare, so most of what a model needs to know, it sees only a handful of times. Estimating probabilities for rare events is the central problem of Chapter 2.
2. **Vocabulary design.** A word-level vocabulary must either be enormous or map many real words to an “unknown” symbol. Subword tokenisation (Chapter 3) is the escape route.
3. **Imbalanced outputs.** The model’s next-token distribution is dominated by a few very common tokens, which shapes the training dynamics of the output layer.

:::question
**Read the slope.** Compare a straight segment and the curved tail of the rank-frequency plot. A single fitted exponent summarises the straight segment, but can hide a poor fit to the tail. Predict which part changes most when you shorten the corpus, then check the figure.
:::

## Heaps’ law: the vocabulary keeps growing

Zipf describes a fixed corpus. What happens as we read more? New word types keep appearing, just ever more slowly. **Heaps’ law** :cite[heaps1978] models vocabulary size as a sublinear power of text length:

:::equation{#heaps caption="Heaps’ law: vocabulary size after reading n tokens."}
$$
\term{V}{V}(\term{hn}{n}) \;=\; \term{K}{K}\, n^{\term{beta}{\beta}}
$$
:::

```terms
V:
  label: "$V(n)$ — vocabulary size"
  what: Number of distinct word types seen in the first $n$ tokens.
hn:
  label: "$n$ — tokens read"
  what: How far into the corpus we are, in word tokens.
K:
  label: "$K$ — scale"
  what: A corpus-dependent constant, often quoted as 10–100 for English words.
  why: $K$ and $\beta$ trade off against each other, so a fitted $K$ outside that range is common — what matters is the curve they produce together.
  param: { key: heaps.K, min: 1, max: 200, step: 0.1, value: 10, log: true }
beta:
  label: "$\\beta$ — growth exponent"
  what: How quickly new types appear. Typically 0.4–0.7 for English.
  why: "$\\beta < 1$ means diminishing returns: each new chunk of text contributes fewer new words. But $\\beta > 0$ means it never stops."
  effect: At $\beta = 1$ every token would be new; at $\beta = 0$ the vocabulary would be fixed. Real language sits in between.
  param: { key: heaps.beta, min: 0.2, max: 1, step: 0.005, value: 0.6 }
```

::heaps-plot

Because $\beta > 0$, **no finite word list covers future text**. However large a word-level vocabulary is, deployment will bring new names, typos, code identifiers and languages. That is the out-of-vocabulary problem, and it is why modern tokenisers are built from pieces that *can* spell anything: bytes and learned combinations of bytes.

## Information and entropy

We now have text as numbers and a feel for its statistics. The last idea we need before building models is a way to measure **uncertainty**, because a language model is ultimately judged by how uncertain it is about the next symbol. The measure comes from Claude Shannon’s 1948 paper, which founded information theory :cite[shannon1948].

Start with a single outcome $x$ that has probability $p(x)$. How much **information** does observing it carry? Shannon required three properties: certain events carry none, rarer events carry more, and information from independent events adds up. The logarithm is essentially the only function that satisfies all three:

:::equation{#surprisal caption="Surprisal (self-information) of an outcome." controls=false}
$$
\term{I}{I}(x) \;=\; -\log_{\term{b}{b}} \term{p}{p}(x)
$$
:::

**Entropy** is the average surprisal: how surprised you expect to be, before you look.

:::equation{#entropy caption="Shannon entropy: the expected surprisal of a random variable X."}
$$
\term{H}{H}(X) \;=\; \mathbb{E}\big[I(X)\big] \;=\; -\term{sum}{\sum_{x}}\, \term{p}{p}(x)\, \log_{\term{b}{b}} p(x)
$$
:::

```terms
I:
  label: "$I(x)$ — surprisal"
  what: The information carried by observing outcome $x$, measured in bits when $b = 2$.
  why: It turns probability into an additive quantity. For independent events, $p(x, y) = p(x)\,p(y)$, so $I(x, y) = I(x) + I(y)$.
  effect: A fair coin flip carries 1 bit; a 1-in-1024 event carries 10 bits; a certain event carries 0.
p:
  label: "$p(x)$ — probability"
  what: The probability of outcome $x$. The probabilities sum to 1 over all outcomes.
  effect: Drag the bars in the figure below — each bar is one $p(x)$.
b:
  label: "$b$ — base of the logarithm"
  what: The unit of information. $b = 2$ gives **bits**, $b = e$ **nats**, $b = 10$ hartleys.
  why: "Changing base only rescales: $\\log_b p = \\ln p / \\ln b$. Information theory and compression use bits; machine-learning code uses nats, because it calls the natural `log`."
  effect: Entropy in nats is $\ln 2 \approx 0.693$ times entropy in bits. The shape of every curve is unchanged.
  param: { key: entropy.b, min: 1.5, max: 16, step: 0.01, value: 2, log: true }
H:
  label: "$H(X)$ — entropy"
  what: The expected surprisal of $X$ — the average number of bits (for $b = 2$) needed to encode an outcome, using the best possible code.
  why: It is the irreducible uncertainty of the distribution. No lossless code can use fewer bits on average (Shannon’s source coding theorem).
  effect: Minimum 0 for a certain outcome. Maximum $\log_b k$ for $k$ equally likely outcomes. Language models are evaluated by closely related quantities — cross-entropy and perplexity — in Chapter 2.
sum:
  label: "$\\sum_x$ — sum over outcomes"
  what: Sums over every possible value $x$ of $X$ — for a character model, every symbol in the vocabulary.
  why: The expectation $\mathbb{E}[\cdot]$ of a discrete variable is a probability-weighted sum.
```

::entropy-explorer

Things to try in the explorer:

- Starting from the fair die, make one face more likely. Entropy falls: you are less uncertain.
- Compare the maximum for 27 symbols, $\log_2 27 \approx 4.75$ bits, with the entropy of English letters from Shakespeare, about 4.1 bits. The gap is how much letter frequencies alone tell you.
- $b^H$ is the **effective number of outcomes**: a distribution with entropy $H$ is as uncertain as a uniform choice among $b^H$ options. Remember this number. In Chapter 2 it reappears under the name **perplexity**, the standard metric for language models.

::exercise{id="entropy"}

### Entropy is compression

Shannon’s source coding theorem makes entropy operational: on average you cannot losslessly encode outcomes of $X$ in fewer than $H(X)$ bits, and good codes (Huffman coding, arithmetic coding) get arbitrarily close. The converse is the idea behind this whole course. **A model that predicts the next symbol well can compress text well, and vice versa.** Given a model’s probabilities, arithmetic coding spends about $-\log_2 p(x_t \mid x_{<t})$ bits on each symbol, so the model’s average surprisal *is* its compression rate. Large language models turn out to be excellent general-purpose compressors :cite[deletang2024].

### How predictable is English?

The unigram entropy of about 4.1 bits per character treats each letter as an independent draw. Real text is far more predictable, because context constrains what comes next. In 1951 Shannon measured this with a game: show a person the beginning of a passage, ask them to guess the next letter, and record how many guesses they need :cite[shannon1951]. From the distribution of guess counts he derived upper and lower bounds on the entropy of English as a *human* predicts it. With long contexts, his subjects came out at roughly 0.6 to 1.3 bits per character.

Play the game yourself. Then compare with two simple “players”. One guesses in order of overall letter frequency, a unigram model. The other uses the previous letter too, a bigram model.

::shannon-game

:::history{year=1948 title="A Mathematical Theory of Communication" people="Claude Shannon (1916–2001), Bell Labs"}
Shannon’s 1948 paper :cite[shannon1948] introduced entropy, channel capacity and the bit as the unit of information. It also contained what we would now call the first demonstrations of statistical language models. Shannon generated text from letter and word frequency tables of increasing order, drawing samples by flipping through a book to find the context and copying what followed. The zero-order samples were gibberish. By second-order word statistics, the output read like a garbled newspaper: “THE HEAD AND IN FRONTAL ATTACK ON AN ENGLISH WRITER…”. His 1951 follow-up :cite[shannon1951] introduced the guessing game above. Almost every idea in this course — prediction as the measure of understanding, the link between modelling and compression, cross-entropy as a score — can be traced to these two papers.
:::

The gap between the unigram player and you is the value of **context**. Closing that gap, with longer and longer context used ever more cleverly, is the story of language modelling from Markov chains to Transformers.

## Context: a first look ahead

The very first statistical study of the sequential structure of text predates Shannon by 35 years.

:::history{year=1913 title="Counting vowels in Eugene Onegin" people="Andrey Markov (1856–1922)"}
To show that his theory of dependent random sequences — now called **Markov chains** — applied to real data, Markov took the first 20,000 letters of Pushkin’s verse novel *Eugene Onegin* and counted by hand how often a vowel follows a vowel, a consonant follows a vowel, and so on :cite[markov1913]. The probability of a vowel was markedly different depending on whether the previous letter was a vowel. Letters are not independent, and the dependence can be captured by transition probabilities. Brian Hayes gives a readable account of the episode and its polemical backstory :cite[hayes2013].
:::

The table below is Markov’s idea with a computer’s patience: for every pair of characters in TinyShakespeare, how often does the second follow the first? Normalise each row and you have a conditional distribution $P(x_t \mid x_{t-1})$. That is a **bigram language model**, and you can already sample from it.

::bigram-teaser

The samples are not English, but they are recognisably *English-shaped*: plausible letter pairs, word-like lengths, the occasional real word. In Chapter 2 we make this precise. We derive the table as a maximum-likelihood estimate, evaluate it with cross-entropy and perplexity, fix its zero-probability problem with smoothing, and extend it to longer contexts until data sparsity — Zipf’s law again — stops us.

## Lab: the text module

Everything in this chapter is implemented in the course library under `packages/core/src/text/`. The reference code is what the widgets use unless you switch them to yours:

| Function | File | Exercise |
|---|---|---|
| `codePoints`, `graphemes`, `utf16Units` | `unicode.ts` | — |
| `utf8Encode`, `utf8Decode`, `decodeStep` | `unicode.ts` | ✓ |
| `countFrequencies`, `rankFrequencies`, `words` | `stats.ts` | — |
| `entropy`, `fitPowerLaw`, `vocabularyGrowth` | `stats.ts` | ✓ |

The Python side of the course lives in `training/`, managed with `uv`. It mirrors the same functions so you can check both implementations agree, and later it hosts the PyTorch training code. To set it up and reproduce this chapter’s numbers:

```bash
cd training
uv sync
uv run lmc data shakespeare
uv run lmc ch01
```

The last command prints the corpus statistics shown in the widgets above: token and type counts, unigram entropy, and the Zipf and Heaps fits. If a number differs between Python and the browser, one of them has a bug. Finding out which is a good habit to build now, because from Chapter 14 onward we rely on exactly this kind of **parity test** to trust a GPU implementation.

:::exercises
1. **Grapheme-safe reversal.** Write `reverseText(s)` that reverses by grapheme cluster, so `'é👍🏽'` becomes `'👍🏽é'`. Explain precisely why `[...s].reverse().join('')` fails, and why `s.split('').reverse()` fails worse.
2. **A streaming decoder.** Optional systems extension: using the supplied `decodeStep`, implement a `Utf8StreamDecoder` class with `push(bytes: Uint8Array): string` and `flush(): string` that never emits a replacement character for a sequence split across chunks. The reference streaming decoder is supplied in Chapter 16.
3. **Types, tokens and case.** How much does case-folding shrink the word vocabulary of TinyShakespeare? Which frequent words have the largest share of capitalised occurrences, and why?
4. **Your own corpus.** Paste a few thousand words of your own writing (or code) into `words()` and fit Zipf and Heaps. How does source code compare to prose?
:::

:::challenge
1. **Maximum-likelihood Zipf.** Implement the discrete power-law MLE of Clauset, Shalizi and Newman :cite[clauset2009], including the choice of $x_{\min}$, and compare it with the least-squares fit. Use a bootstrap to put error bars on $s$.
2. **Compression vs entropy.** Compress TinyShakespeare with gzip, bzip2 and xz (in Python: `zlib`, `bz2`, `lzma`; in the browser: `CompressionStream`). Report bits per character. Rank them against the unigram entropy, your Shannon-game bounds and the bigram model. Which compressor “knows” the most about English, and what is it modelling?
3. **The price of a script.** Take the Universal Declaration of Human Rights in ten languages and compute UTF-8 bytes per character and per word. Which languages pay the most in a byte-level model? Keep the table — Chapter 3 measures how much a learned tokeniser changes it.
4. **Normalisation from the source.** Download `UnicodeData.txt` from unicode.org, parse the canonical decomposition field, and implement NFD for the Latin-1 Supplement block. Verify it against `String.prototype.normalize`.
:::

## Check your understanding

```quiz
q: "A string is encoded in UTF-8 and has 12 bytes. What can you say for certain about its number of code points?"
options:
  - text: It is exactly 12.
    why: Only if the text is pure ASCII.
  - text: It is between 3 and 12.
    correct: true
    why: Each code point takes 1–4 bytes, so 12 bytes hold between 12 ÷ 4 = 3 and 12 code points.
  - text: It is exactly 6, because UTF-8 uses two bytes per character.
    why: That describes UTF-16 for text without surrogates, and even then only approximately.
```

```quiz
q: "A distribution over 8 outcomes has entropy 2 bits. Which statement is true?"
options:
  - text: The distribution must be uniform.
    why: The uniform distribution over 8 outcomes has log₂ 8 = 3 bits, not 2.
  - text: It is exactly as uncertain as a uniform choice among 4 outcomes.
    correct: true
    why: "The effective number of outcomes is 2^H = 4. Chapter 2 calls this perplexity."
  - text: Some outcome must have probability 0.
    why: Many distributions over 8 outcomes, all with non-zero probabilities, have entropy 2 bits.
```

```quiz
q: "Why do modern LLM tokenisers start from UTF-8 bytes rather than from Unicode code points?"
options:
  - text: Bytes are always shorter than code points.
    why: The opposite. A byte sequence is at least as long as the code point sequence.
  - text: "256 byte values can represent any text, so there is never an unknown symbol, and the base vocabulary stays small."
    correct: true
    why: Starting from ~160,000 code points would need a large base vocabulary and still fail on code points added in future Unicode versions.
  - text: GPUs can only process 8-bit integers.
    why: GPUs process all sorts of types. The reason is coverage and vocabulary size.
```

## Further reading

- Joel Spolsky, *The Absolute Minimum Every Software Developer Absolutely, Positively Must Know About Unicode and Character Sets* :cite[spolsky2003]. The classic, witty introduction.
- Unicode Standard Annex #29, *Text Segmentation* :cite[uax29]. The precise rules for grapheme clusters that `Intl.Segmenter` implements.
- Thomas Cover and Joy Thomas, *Elements of Information Theory*, chapters 2 and 5 :cite[cover2006]. Entropy and source coding, rigorously. [Appendix E](/appendix/information-theory/) of this course gives a gentler primer.
- Steven Piantadosi, *Zipf’s word frequency law in natural language* :cite[piantadosi2014]. What we know, and don’t, about why the law holds.
