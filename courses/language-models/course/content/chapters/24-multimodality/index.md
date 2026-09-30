---
number: 24
title: Multimodality
summary: "A survey: how Transformers came to see and hear. Images become sequences of patches; contrastive training aligns pictures with captions; vision–language models feed image tokens to a language model; and audio, speech and image generation follow the same pattern: turn everything into tokens."
duration: About 1 hour
prerequisites: [transformer, fine-tuning]
builds:
  - Patches as tokens
  - The CLIP loss
---

Everything in this book has been text. The Transformer, though, does not care what its tokens stand for. It takes a sequence of vectors and returns a sequence of vectors, and the only place the word “language” appears is in the embedding table at the bottom and the unembedding at the top. Replace them, and the same machine reads images, sound or anything else that can be cut into a sequence.

This chapter is a survey. CourseGPT stays text-only — training a vision model worth the name needs data and compute beyond this course’s budget — but the pieces are small enough to build, and the ideas are the ones behind every model that looks at pictures.

## Images as sequences

Before 2020, computer vision meant convolutional networks :cite[lecun1989] :cite[krizhevsky2012], built on the assumption that nearby pixels matter most. The **Vision Transformer** (ViT) :cite[dosovitskiy2021] dropped the assumption. Cut the image into squares of $P \times P$ pixels, flatten each into a vector of $3P^2$ numbers, project it linearly to the model’s width, add a position embedding, and feed the sequence to an ordinary Transformer encoder. The paper’s title said it plainly: *An Image is Worth 16x16 Words*.

::exercise{id="patchify"}

::patch-grid

The patch size is the image’s tokeniser, and it sets a trade-off like the one of Chapter 3. Small patches keep detail but make long sequences, and attention’s cost grows with the square of the length: 16-pixel patches turn a 224 × 224 image into 196 tokens, 8-pixel patches into 784, and a 1,024 × 1,024 image at 16 pixels into 4,096. Vision–language models spend much of their context on images, and most of them compress the patch sequence before the language model sees it.

ViT needed a lot of data. Trained on ImageNet’s 1.3 million images it did worse than a convolutional network of similar size: without the convolution’s built-in assumption about locality, it had to learn it. Pre-trained on 300 million images, it did better. The pattern is the one of Chapter 17: with enough data and compute, general architectures overtake specialised ones.

## Aligning images and text: CLIP

A vision model trained to classify ImageNet knows 1,000 categories. The internet has billions of images with captions, which describe far more than 1,000 things. **CLIP** (Contrastive Language–Image Pre-training) :cite[radford2021] learned from 400 million of them. It trains two encoders — a Vision Transformer for images and a Transformer for text — so that an image and its caption map to nearby vectors, and an image and someone else’s caption do not.

For a batch of $N$ pairs, compute the $N \times N$ matrix of similarities between every image and every caption. Each row is a classification problem: which of the $N$ captions belongs to this image? Each column is the reverse. The loss is the cross-entropy over rows and over columns, averaged:

:::equation{#clip caption="CLIP's symmetric contrastive loss over a batch of N image–text pairs."}
$$
\mathcal L \;=\; \frac{1}{2N}\sum_{i=1}^{N}\left[-\log \frac{e^{\,\mathbf u_i \cdot \mathbf v_i / \tau}}{\sum_j e^{\,\mathbf u_i \cdot \mathbf v_j / \tau}} \;-\; \log \frac{e^{\,\mathbf u_i \cdot \mathbf v_i / \tau}}{\sum_j e^{\,\mathbf u_j \cdot \mathbf v_i / \tau}}\right]
$$
:::

```terms
u:
  label: "$\\mathbf u_i$, $\\mathbf v_j$ — the embeddings"
  what: The normalised image embedding of pair i and text embedding of pair j. Their dot product is their cosine similarity.
tau:
  label: "$\\tau$ — the temperature"
  what: Scales the similarities before the softmax, as in Chapter 15. CLIP learns it; it settles near 0.01.
  effect: The other N − 1 captions in the batch are the negatives, so bigger batches make the task harder and the embeddings better. CLIP used batches of 32,768.
```

This kind of loss, contrasting a positive pair against the rest of the batch, is called InfoNCE :cite[oord2018cpc]. SigLIP replaced the softmax over the batch with an independent sigmoid for every pair, which removes the need to gather the whole similarity matrix on one device :cite[zhai2023siglip].

::exercise{id="clip-loss"}

::clip-playground

The playground’s held-out pictures show CLIP’s most famous ability: **zero-shot classification**. To classify an image into categories CLIP was never trained on, write each category as a caption — “a photo of a dog”, “a photo of a cat” — embed the captions, and pick the one nearest the image. With no ImageNet training at all, CLIP matched the accuracy of the original ResNet-50 trained on ImageNet’s 1.3 million labelled images. And because the text encoder composes words, captions for combinations never seen together still land in sensible places.

## Vision–language models

CLIP matches images with text; it does not write. To make a language model that can talk about images, connect a vision encoder to it. The simplest recipe, **LLaVA** :cite[liu2023llava], takes a pre-trained CLIP image encoder and a pre-trained language model, and trains a small projection — a single linear layer at first, later a two-layer MLP — that maps each patch’s output vector into the language model’s embedding space. The projected patches are placed in the sequence alongside the text tokens, like words in a foreign language the model is about to learn. Training has two stages: first only the projection, on image–caption pairs, then the projection and the language model together, on instructions about images (Chapter 20’s supervised fine-tuning with pictures).

Other designs keep the modalities apart. **Flamingo** :cite[alayrac2022] left the language model frozen and inserted new cross-attention layers through which text tokens attend to image features. The trend has gone the other way, towards **early fusion**: models such as Chameleon :cite[chameleon2024] turn images into discrete tokens from the start, and train one Transformer on interleaved text and image tokens from scratch, so that it can also *write* images.

## Sound

Speech recognition followed the same path. **Whisper** :cite[radford2023whisper] converts audio into a spectrogram — the energy in each frequency band over time, an image of sound — reads it with a Transformer encoder, and writes the transcript with a Transformer decoder. Its advance was data, not architecture: 680,000 hours of audio with transcripts found on the web, which made it robust to accents, noise and languages that cleaner datasets missed.

To *generate* sound, a model needs audio tokens. Neural audio codecs such as EnCodec :cite[defossez2023] compress a waveform into a few discrete tokens per frame, using **residual vector quantisation**: a codebook approximates each frame’s vector, a second codebook approximates the error, and so on. A language model trained on these tokens continues audio as CourseGPT continues stories, and a decoder turns the tokens back into sound. Speech-to-speech assistants combine the two directions in one model, without passing through text.

## Generating images

Two families of models generate images. **Autoregressive** models tokenise images with a learned codebook — the VQ-VAE :cite[oord2017vqvae] — and predict image tokens one at a time, exactly as a language model predicts words; the first DALL·E worked this way :cite[ramesh2021]. **Diffusion models** :cite[ho2020] learn instead to remove noise: add Gaussian noise to a training image, and train a network to predict the noise that was added. To generate, start from pure noise and denoise it step by step. Latent diffusion :cite[rombach2022] runs the process in the compressed space of an autoencoder rather than on pixels, and the denoising network has itself become a Transformer operating on patches :cite[peebles2023]. Text conditions the generation through cross-attention to a text encoder’s outputs — often CLIP’s.

The two families have been converging: diffusion models now use Transformers on patch tokens, and autoregressive models generate images with continuous tokens or many tokens at a time.

:::history{year=2021 title="CLIP" people="Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, Gretchen Krueger and Ilya Sutskever"}
Learning visual concepts from captions was an old idea, but results had been disappointing. The CLIP paper describes the team first trying to *predict* captions from images, as a language model would, and finding it slow to learn: predicting the exact words of a caption is hard, and most of the words are irrelevant to what the image shows. Switching to the contrastive task — only recognising which caption goes with which image — made learning four times more efficient. OpenAI released the weights of the smaller models, and CLIP became a standard component: the image encoder of vision–language models and the text encoder that steered the image generators of 2022.
:::

:::breakit
- In the playground, hold out *all three* triangles instead of one of each shape. Can the model name a triangle it has never seen?
- Set the temperature to 1 in the contrastive loss. How quickly does training separate the pairs?
- Shuffle the patches of an image before a Vision Transformer without position embeddings reads them. Does its output change?
:::

:::exercises
1. **Tokens per image.** A vision–language model reads 1,024 × 1,024 images with 14-pixel patches and merges each 2 × 2 group of patch outputs into one token. How many tokens does an image cost? How many images fit in a 32,000-token context?
2. **Position embeddings for patches.** Extend RoPE (Chapter 18) to two dimensions: rotate half of each head’s dimensions by the patch’s row and half by its column.
3. **CLIP at batch size 2.** With only one negative per example, what is the loss when the model guesses at random? What does that say about the batch size?
4. **Nearest captions.** Using the playground’s trained encoders, find the caption nearest to the *average* of the red circle’s and the blue square’s embeddings.
:::

:::challenge
1. **A tiny ViT.** Train a 4-layer Vision Transformer on 28 × 28 handwritten digits (MNIST) with 7 × 7 patches in PyTorch, and compare it with a small convolutional network at equal parameters.
2. **CourseGPT sees.** Render short phrases as small images, encode them with the tiny ViT, and train a projection into CourseGPT’s embedding space so that it continues stories from pictures of their first words.
3. **Diffusion in one dimension.** Train a small MLP to denoise samples from a mixture of two Gaussians, and generate new samples by iterated denoising.
:::

## Check your understanding

```quiz
q: "A 336 × 336 image is cut into 14 × 14 patches. How many tokens does it make?"
options:
  - text: "576 (24 × 24)"
    correct: true
    why: 336 / 14 = 24 patches along each side.
  - text: "24"
    why: That is one row of patches.
  - text: "588 (3 × 14 × 14)"
    why: That is the number of values in one patch, not the number of patches.
```

```quiz
q: "In CLIP's loss, what are the negative examples for an image?"
options:
  - text: "The captions of the other images in the same batch."
    correct: true
    why: "No negatives need to be collected: the batch provides N − 1 of them for free."
  - text: Randomly generated captions.
    why: The negatives are real captions of other images.
  - text: There are none; the loss only pulls pairs together.
    why: Without pushing mismatched pairs apart, every embedding could collapse to the same point.
```

```quiz
q: "How does LLaVA let a language model read an image?"
options:
  - text: "A trained projection maps the image encoder's patch outputs into the language model's embedding space, where they sit in the sequence like tokens."
    correct: true
    why: The language model attends to projected image patches as it does to words.
  - text: The image is converted to a text description first.
    why: The model reads image features directly, not a caption.
  - text: New cross-attention layers are added to the frozen language model.
    why: That is Flamingo's design.
```

## Further reading

- Alexey Dosovitskiy and colleagues, *An Image is Worth 16x16 Words* :cite[dosovitskiy2021].
- Alec Radford and colleagues, *Learning Transferable Visual Models From Natural Language Supervision* (CLIP) :cite[radford2021].
- Haotian Liu and colleagues, *Visual Instruction Tuning* (LLaVA) :cite[liu2023llava].
- Jonathan Ho, Ajay Jain and Pieter Abbeel, *Denoising Diffusion Probabilistic Models* :cite[ho2020].
