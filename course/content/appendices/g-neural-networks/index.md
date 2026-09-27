---
number: G
title: Neural-network background
summary: Where neural networks came from and why they work — artificial neurons and the perceptron, the XOR problem, multi-layer networks and backpropagation, universal approximation, activation functions, losses and regularisation, the architectures that preceded the Transformer, and a short history of deep learning.
duration: About 1½ hours
---

The course builds neural networks from the ground up, but mostly in the service of language modelling. This appendix steps back to fill in the wider picture: the ideas and history the field shares with vision, speech and everything else, and the vocabulary that papers assume. The standard textbook is Goodfellow, Bengio and Courville’s *Deep Learning* :cite[goodfellow2016]. Michael Nielsen’s online book is a gentler introduction :cite[nielsen2015].

## The artificial neuron

In 1943, Warren McCulloch and Walter Pitts described an idealised neuron :cite[mcculloch1943]. It sums weighted binary inputs and fires if the total exceeds a threshold, and networks of such units can compute any logical function. Frank Rosenblatt’s **perceptron** (1958) added the crucial ingredient: a rule for *learning* the weights from examples :cite[rosenblatt1958]. The modern artificial neuron is the same computation with a smooth non-linearity in place of the hard threshold:

:::equation{#g-neuron caption="An artificial neuron: a weighted sum, a bias, and a non-linearity."}
$$
y \;=\; \term{phi}{\varphi}\Big( \sum_{i} \term{wi}{w_i}\, x_i + \term{bb}{b} \Big) \;=\; \varphi(\mathbf w \cdot \mathbf x + b)
$$
:::

```terms
phi:
  label: "$\\varphi$ — the activation function"
  what: A fixed non-linear function applied to the weighted sum. The perceptron used a step; modern networks use ReLU, GELU and their relatives.
  why: Without it, a stack of layers collapses into a single linear map (a product of matrices is a matrix), however deep the stack.
wi:
  label: "$w_i$ — the weights"
  what: How strongly each input pushes the neuron towards firing (positive) or away from it (negative). Learned from data.
bb:
  label: "$b$ — the bias"
  what: Shifts the threshold, so the neuron can fire even when all inputs are zero or stay quiet when they are large.
```

Geometrically, $\mathbf w \cdot \mathbf x + b = 0$ is a straight line (a hyperplane, in more dimensions). A single neuron with a step activation classifies points by which side of the line they fall on. The **perceptron learning rule** — after each misclassified example, move the line towards it, $\mathbf w \leftarrow \mathbf w + \eta\,(y - \hat y)\,\mathbf x$ — provably finds a separating line whenever one exists. Widrow and Hoff’s contemporaneous ADALINE trained a linear unit by gradient descent on squared error, the direct ancestor of every optimiser in this course :cite[widrow1960].

## The XOR problem

Not every problem has a separating line. The simplest counterexample is **exclusive or**: output 1 when exactly one of two inputs is on. In 1969, Marvin Minsky and Seymour Papert’s book *Perceptrons* analysed such limitations rigorously :cite[minsky1969]. Together with inflated expectations, it contributed to a collapse of funding for neural-network research that lasted much of the 1970s.

::xor-playground

The way out was known in principle: put a layer of **hidden** units between input and output. Each hidden unit draws its own line, and the output combines them, so the network can carve out any shape. What was missing was a way to train the hidden units. The perceptron rule needs to know each unit’s target, and hidden units have none.

## Backpropagation

The answer is the chain rule: compute how the loss depends on every weight, hidden or not, by propagating derivatives backwards through the network (Chapter 6). The mathematics — reverse-mode automatic differentiation — was described by Seppo Linnainmaa in his 1970 master’s thesis :cite[linnainmaa1976]. Paul Werbos proposed applying it to neural networks in his 1974 PhD thesis and developed the idea in 1982 :cite[werbos1982]. It became famous in 1986, when David Rumelhart, Geoffrey Hinton and Ronald Williams showed that networks trained this way learn useful **internal representations** :cite[rumelhart1986]. Their hidden units discovered features that no one had programmed. Every model in this course is trained by that algorithm.

Replacing the step with a smooth activation was essential, because a step has zero derivative almost everywhere, so no gradient can flow through it. The widget above trains its hidden layer exactly as Chapter 7 trains the MLP language model: tanh hidden units, a sigmoid output, a cross-entropy loss and gradient descent.

## Universal approximation

How much can a network with one hidden layer represent? In 1989, George Cybenko :cite[cybenko1989] and, independently, Kurt Hornik, Maxwell Stinchcombe and Halbert White :cite[hornik1989] proved that it can approximate *any* continuous function on a bounded region, to any accuracy, given enough hidden units. For ReLU networks there is a direct construction. Each unit $\operatorname{ReLU}(x - k)$ is a hinge at $k$, and a weighted sum of hinges is a piecewise-linear curve that can follow any continuous function.

::relu-approximator

The theorem is reassuring but says less than it seems. It promises that suitable weights *exist*, not that gradient descent will find them, and the number of units needed can grow exponentially with the input dimension. In practice, **depth** is what makes networks efficient. Each layer can reuse the features computed by the layer below, so deep networks represent many functions with far fewer units than shallow ones would need. Why training finds good solutions, and why they generalise, remains a lively research question.

## Activation functions

The choice of non-linearity matters mostly through its **derivative**, which multiplies every gradient that flows backwards through the layer (Chapter 6):

::activation-gallery

Sigmoid and tanh **saturate**: for large inputs their slope is almost zero, so gradients shrink layer after layer, and deep networks with them barely trained. This is the **vanishing-gradient problem**. The rectified linear unit (ReLU), popularised for deep networks by Nair and Hinton :cite[nair2010] and by Glorot, Bordes and Bengio :cite[glorot2011], has slope exactly 1 wherever it is active, and it made deep networks much easier to train. Transformers use smooth variants: GELU :cite[hendrycks2016] in GPT-2, and SiLU inside SwiGLU in most recent models (Chapter 18).

## Losses and outputs

The output layer and the loss are chosen together, to match what is being predicted:

| Task | Output layer | Loss | Gradient at the logits |
|---|---|---|---|
| Regression (predict a number) | linear | mean squared error | prediction − target |
| Binary classification | sigmoid | binary cross-entropy | probability − target |
| Multi-class (next token) | softmax | cross-entropy | probabilities − one-hot |

In each pairing the gradient simplifies to “prediction minus target”. That is no coincidence. Each pairing is maximum likelihood for an exponential-family distribution with its natural link function, and the simple gradient makes training well behaved. For probabilities, cross-entropy beats squared error because it punishes confident mistakes without bound and never saturates (Chapter 5, Appendix B).

## Generalisation and regularisation

A network with enough parameters can memorise its training set, as Chapter 8’s larger MLP starts to. What we want is **generalisation**: good predictions on data it has not seen. The standard tools are:

- **Held-out data.** Always measure on a validation set that training never touches (Chapter 2), and stop when validation loss stops improving (**early stopping**).
- **Weight decay.** Penalise large weights, equivalent to a Gaussian prior on them (Appendix C, Chapter 13).
- **Dropout.** Randomly zero a fraction of activations during training, so no unit can rely on any particular other :cite[srivastava2014]. Chapter 12 uses it for the small browser GPT.
- **More data.** The most reliable regulariser of all. Language models trained on trillions of tokens see most text only once, and barely overfit.

Classical statistics predicts that ever-larger models should overfit ever worse. Modern networks confound this: past the point where they can fit the training data perfectly, test error often *falls* again as models grow. This is **double descent** :cite[belkin2019]. It is one reason the field was willing to scale models to sizes that textbook theory would have forbidden, a story Chapter 17 takes up.

## Architectures before the Transformer

Architectures differ mainly in which assumptions — **inductive biases** — they build in about their input:

- **Convolutional networks** (Fukushima’s neocognitron :cite[fukushima1980]; LeCun and colleagues :cite[lecun1989]) apply the same small filter at every position of an image. They assume that local patterns matter wherever they appear, which suits images and made AlexNet’s 2012 breakthrough possible :cite[krizhevsky2012].
- **Recurrent networks** (Elman :cite[elman1990]; the LSTM of Hochreiter and Schmidhuber :cite[hochreiter1997]) process a sequence one step at a time with the same weights, carrying a memory forward. Chapter 9 builds one and meets its difficulties with long-range dependencies.
- **Attention** (Bahdanau, Cho and Bengio :cite[bahdanau2015]) lets a model look back directly at any earlier position. The **Transformer** (Vaswani and colleagues :cite[vaswani2017]) is built from attention alone. It gives up the recurrent network’s sequential processing for parallel training, and it is the subject of Chapters 10 and 11.

The historical trend is towards *weaker* built-in assumptions and *more* data and compute. Richard Sutton called this the *bitter lesson* :cite[sutton2019]: general methods that scale with computation eventually beat methods that build in human knowledge.

## A short history of deep learning

- **1943–1969: the first wave.** McCulloch–Pitts neurons, the perceptron and ADALINE. It ended with *Perceptrons* and the first “AI winter” for neural networks.
- **1986–1995: the second wave.** Backpropagation, hidden representations, convolutional networks reading cheques, and recurrent networks. It faded as support-vector machines and other methods with cleaner theory took over.
- **2006–2012: “deep learning”.** Layer-wise pre-training :cite[hinton2006], GPUs (Chapter 8), ReLUs and large datasets made deep networks trainable. AlexNet’s ImageNet win in 2012 convinced the field.
- **2013–2017: sequences.** Word embeddings :cite[mikolov2013], sequence-to-sequence translation with LSTMs, attention, and in 2017 the Transformer.
- **2018 onwards: pre-training and scale.** GPT :cite[radford2018] and BERT pre-trained Transformers on unlabelled text. GPT-2 :cite[radford2019] and GPT-3 :cite[brown2020] showed abilities emerging with scale, and scaling laws made that growth predictable :cite[kaplan2020]. Instruction tuning and human feedback turned language models into assistants :cite[ouyang2022], the path Part V of this course retraces.

## Further reading

- Ian Goodfellow, Yoshua Bengio and Aaron Courville, *Deep Learning* :cite[goodfellow2016]. The standard reference for the fundamentals; free online.
- Michael Nielsen, *Neural Networks and Deep Learning* :cite[nielsen2015]. Short, interactive and beautifully explained.
- Richard Sutton, *The Bitter Lesson* :cite[sutton2019]. Two pages that explain much of the field’s direction.
