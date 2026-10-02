---
number: 0
title: What is a language model?
summary: A tour of CourseGPT, the model this course builds — what it does, what is inside it, and the road from counting characters to running a trained Transformer in your browser — and how the course's interactive pieces, exercises and labs work.
duration: About 30 minutes
builds:
  - Your first exercise
---

:::note
**Choose a path.** To understand and train language models, use the supplied implementations and follow the explanations, figures and prediction questions. You may postpone GPU compute (Chapter 8) until after the Transformer, and sample advanced topics after inference. To implement the engine, take the coding exercises and optional GPU extensions as a second pass. Neither path requires every exercise.

**Before running a model:** the pretrained browser demo downloads tens of megabytes of weights on demand; the full site contains additional model assets. Larger browser experiments use WebGPU when available, and the later PyTorch labs need a separate Python environment and suitable hardware. Read the run's size and timing information before starting. The supplied figures and reference results let you continue when you cannot run a GPU lab.
:::


This is CourseGPT. It has 30 million parameters, it trained on about a billion token presentations from children’s stories, and it writes new ones. By the end of Part IV you will have built every piece of it yourself — the tokeniser, the tensors, the automatic differentiation, the GPU kernels, the Transformer, the training loop and the inference engine — and it will run on code you wrote. Here it is at work:

::course-gpt-tour

Press **Pick the next token** a few times. That loop is all a language model does when it writes. It reads the text so far as a sequence of **tokens**, turns them into a **probability for every possible next token**, and one token is chosen and appended. Then it reads the longer text and does it again. The stories, the grammar, the fact that a dog named Spot stays a dog and stays Spot: all of it emerges from predicting the next token well.

## One idea: predict the next token

A **language model** assigns probabilities to text. It does so one token at a time: for any beginning $x_1, \ldots, x_{t-1}$, it predicts a distribution over the next token, $P(x_t \mid x_1, \ldots, x_{t-1})$. Chapter 1 shows why this one ability is enough to give a probability to any text at all, and Chapter 2 builds the first such models by counting.

**Training** makes these predictions better. We show the model real text, measure how much probability it gave to each token that actually came next, and nudge its parameters to give more. CourseGPT was trained on 2.7 million short stories, about 536 million tokens, each seen twice. Nothing in that process mentions grammar, characters or plots; they are simply what helps to predict the next token of a story.

**Generating** reverses the process: instead of scoring given text, we draw tokens from the model’s predictions, one after another, as the tour above does. How we draw them matters a great deal, as Chapter 15 shows.

## What is inside

Follow one step of the tour through the model, and you meet the course’s chapters in order:

| Step | What happens | Where you build it |
|---|---|---|
| Text to tokens | The text is split into pieces from a vocabulary of 8,192, learned from the data | Chapters 1 and 3 |
| Tokens to vectors | Each token becomes a list of 512 numbers, its embedding | Chapters 4, 5 and 7 |
| Mixing context | Eight Transformer blocks let every position gather information from earlier ones through attention | Chapters 9, 10 and 11 |
| Vectors to probabilities | The last vector is compared with every token’s embedding, and a softmax turns the scores into probabilities | Chapters 5 and 11 |
| Choosing | A decoding rule picks the next token | Chapter 15 |
| Learning the numbers | Gradients of the prediction error, computed automatically, adjust all 30 million parameters | Chapters 5, 6, 12 and 13 |
| Doing it fast | GPU kernels, mixed precision, a KV cache and quantisation | Chapters 8, 14 and 16 |

## The road ahead

**Part I, Text and counting**, treats text as data: how characters become numbers, what the statistics of real text look like, and how far simple counting models get. It ends with a tokeniser.

**Part II, Neural foundations**, builds a small deep-learning engine: tensors, gradient descent, automatic differentiation, a neural language model, and a GPU backend written in WebGPU.

**Part III, Sequences and attention**, moves from recurrent networks to attention and assembles the Transformer.

**Part IV, Training and running a real GPT**, trains Transformers in the browser, then CourseGPT in PyTorch on a GPU, and brings it back to the browser with an inference engine of our own.

**Part V, Modern language models**, covers what turns a model like CourseGPT into a modern assistant: scaling laws, architectural improvements, mixture-of-experts, fine-tuning, learning from preferences, reasoning, tool use, evaluation, interpretability and safety.

## How the course works

Each chapter mixes several kinds of material, all of it interactive:

- **Equations you can explore.** Hover over a symbol in a numbered equation to see what it means, why it is there and what changing it does. Some symbols are linked to the widgets beside them.
- **Widgets.** Every chapter has interactive figures, most of them running real computations in your browser — often on your GPU.
- **Exercises.** You write the course’s code yourself, in TypeScript, in the page. Run tests when you are ready, and hints and a reference solution are there if you need them. Many exercises can then **replace the reference code** in the chapter’s widgets, so the figures run on your implementation. Your work is saved in your browser and can be exported.
- **Labs.** The `training/` directory holds the Python companion: parity checks against our TypeScript library, and from Chapter 14 the PyTorch training runs.
- **Break it**, **exercises**, **challenges** and **history** boxes at the end of each chapter suggest experiments, extensions, harder projects and where the ideas came from.

Try the first exercise now. The tour above chooses the most probable token each time; write the function that does it. When your tests pass, switch on your implementation and run the model live (with WebGPU), and the tour will pick tokens with your code.

::exercise{id="most-likely"}

## Setting up

The course runs in a web browser. Widgets that train or run models use **WebGPU**, which recent versions of Chrome and Edge support, as do Safari 26 and Firefox on Windows at the time of writing. Without WebGPU, those widgets fall back to recorded results or a message, and everything else works.

The labs need a local copy of the course repository, [Node.js](https://nodejs.org) 22 or later with pnpm, and [uv](https://docs.astral.sh/uv/) for Python:

```sh
git clone https://github.com/nathsou/courses.git
cd courses/courses/language-models
pnpm install && pnpm dev          # the course, locally
cd training && uv sync            # the Python lab; add --extra torch from Chapter 14
```

Everything before Chapter 14 runs on an ordinary laptop. Training CourseGPT needs a GPU: about two hours on an NVIDIA RTX 4060 Ti, longer on Apple silicon — or you can skip the run and use the trained weights, which the course provides.

The mathematics the course uses — linear algebra, calculus, probability, statistics, information theory and optimisation — is collected in the appendices, each written for this course and linked from the chapters where it is needed. You do not need to read them first.
