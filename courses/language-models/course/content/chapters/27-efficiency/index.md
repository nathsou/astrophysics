---
number: 27
title: Efficiency at scale
summary: "A survey: CourseGPT trains on one GPU in two hours; frontier models train on tens of thousands for months and then serve millions of users. We account for where the memory and time go, and follow the techniques that make both possible: data, tensor and pipeline parallelism, sharded optimisers, and the scheduling and memory management of serving."
duration: About 1 hour
prerequisites: [scaling-up, inference]
builds:
  - Memory accounting for parallel training
  - The pipeline bubble
  - Paged KV-cache allocation
---

CourseGPT has 30 million parameters. Its weights, gradients and optimiser state take half a gigabyte, and one consumer GPU trains it in two hours (Chapter 14). A model of 70 billion parameters needs 16 bytes per parameter for the same things — over a terabyte — before counting a single activation, and its training takes about $6ND \approx 6 \times 70 \times 10^9 \times 15 \times 10^{12} \approx 6 \times 10^{24}$ floating-point operations. At a realistic 40% of an H100’s 10¹⁵ bf16 operations per second, that is 500 GPU-years. Training it at all needs thousands of GPUs, and the problem becomes one of splitting the work among them without letting them wait for each other.

This chapter is a survey: our hardware has one GPU, so we cannot measure these techniques, but we can account for them exactly.

## Where the memory goes

With bf16 mixed precision and Adam (Chapter 14), each parameter costs 2 bytes of weights, 2 of gradients, and 12 of optimiser state: a float32 master copy of the weight and Adam’s two float32 moments. On top of that come the **activations** saved for the backward pass, which grow with the batch, the sequence length and the depth. **Activation recomputation** (Chapter 14) trades them for compute: keep only each layer’s input, and redo the layer’s forward pass during the backward :cite[chen2016] :cite[korthikanti2022].

## Data parallelism, and sharding it

The simplest way to use many GPUs is **data parallelism**: every GPU holds the whole model and processes a different slice of the batch; after the backward pass, the GPUs average their gradients with an **all-reduce**, and every GPU takes the same optimiser step. It scales the batch, not the model: every GPU still needs the full 16 bytes per parameter.

But every GPU holding the same optimiser state is wasteful. **ZeRO** :cite[rajbhandari2020] shards it: with $N$ GPUs, each keeps the Adam state for $1/N$ of the parameters and updates only those (stage 1); each also keeps only its $1/N$ of the gradients (stage 2); and finally only its $1/N$ of the weights, gathering the rest from the others just before each layer needs them and discarding them after (stage 3). PyTorch’s **FSDP** (Fully Sharded Data Parallel) is stage 3 :cite[zhao2023fsdp]. The cost is communication: stage 3 moves the weights over the network twice per step.

::exercise{id="zero-memory"}

::memory-planner

## Splitting the model: tensor and pipeline parallelism

When one layer’s computation is too large, or communication too frequent, the model itself is split.

**Tensor parallelism** splits each weight matrix across GPUs :cite[shoeybi2019]. In the MLP, the first matrix is split by columns, so each GPU computes part of the hidden layer with no communication; the second is split by rows, so each GPU produces a partial sum of the output, and one all-reduce adds them. Attention splits the same way, by heads. This needs two all-reduces per layer in each direction, so it is used within a server, where GPUs are joined by fast links (hundreds of gigabytes per second), typically 8-way.

**Pipeline parallelism** gives each GPU a consecutive group of layers :cite[huang2019gpipe]. Activations flow from one GPU to the next, which needs little bandwidth. The problem is idle time: the last GPU waits while the first processes the first micro-batch, and during the backward pass the order reverses. Splitting the batch into many **micro-batches** keeps the pipeline fuller.

::exercise{id="pipeline-bubble"}

::pipeline-schedule

Better schedules interleave forward and backward passes (one forward, one backward, …) to limit the activations held at once, or give each GPU several non-consecutive groups of layers to shrink the bubble further :cite[narayanan2021]. Large training runs combine all of these — **3D parallelism** — plus splitting long sequences across GPUs. Meta trained the 405-billion-parameter Llama 3 on up to 16,384 H100s with 8-way tensor parallelism inside each server, 16-way pipeline parallelism, and data parallelism across the rest, reaching 38–43% of the GPUs’ peak throughput :cite[llama3herd2024]. For mixture-of-experts models, **expert parallelism** places different experts on different GPUs and exchanges tokens between them (Chapter 19).

## Numbers and kernels

Chapter 14’s other savings carry over: bf16 arithmetic with float32 master weights :cite[micikevicius2018], and fused kernels such as FlashAttention that never write the attention matrix to memory :cite[dao2022] :cite[dao2023]. The newest GPUs compute in 8-bit floating point, and DeepSeek-V3 trained with FP8 matrix multiplications for most of its layers, keeping sensitive parts in higher precision :cite[deepseek2024v3].

At this scale hardware fails often. Llama 3’s 54-day pre-training run had 419 unexpected interruptions — about one every three hours — mostly from failing GPUs and memory :cite[llama3herd2024]. Checkpointing, fast restarts and detecting silently wrong results are part of the engineering.

## Serving

Chapter 16 built the pieces of inference: the KV cache, quantisation and speculative decoding. A server adds scheduling, because it serves many users at once, and because decoding one sequence leaves the GPU’s arithmetic mostly idle while batching many uses it.

- **Continuous batching.** Requests arrive and finish at different times. Rather than waiting for a whole batch to finish, the server adds new sequences to the running batch and removes finished ones at every step :cite[yu2022orca].
- **Paged attention.** Each sequence’s KV cache grows by one entry per token, to a length nobody knows in advance. Reserving the maximum for every request wastes most of the memory. vLLM stores the cache in fixed-size blocks, allocated as a sequence grows and addressed through a block table, like virtual-memory pages; sequences that share a prompt prefix can share its blocks :cite[kwon2023].
- **Splitting the work.** Prefill is compute-bound and decode is memory-bound (Chapter 16). Servers split long prefills into chunks mixed with decode steps, or run the two phases on different GPUs, so that neither starves the other.

::exercise{id="paged-kv"}

::paged-kv

Serving is where most of a successful model’s compute ends up being spent, and its economics set what models are deployed: a model that is 20% better but twice as expensive to serve is often not worth it. That pressure is behind much of Part V — grouped-query attention (Chapter 18), mixtures of experts (Chapter 19), quantisation and speculative decoding (Chapter 16) and distillation into smaller models.

:::history{year=2019 title="Megatron-LM" people="Mohammad Shoeybi, Mostofa Patwary, Raul Puri, Patrick LeGresley, Jared Casper and Bryan Catanzaro (NVIDIA)"}
In 2019 GPT-2, at 1.5 billion parameters, was the largest language model most people had heard of, and it fitted on one GPU. NVIDIA’s Megatron-LM paper showed how to split each Transformer layer across GPUs with a few lines of changes and two all-reduces, and trained an 8.3-billion-parameter model on 512 GPUs at 76% scaling efficiency :cite[shoeybi2019]. The same year Microsoft’s ZeRO removed the redundancy of data parallelism :cite[rajbhandari2020], and Google’s GPipe pipelined layers across accelerators :cite[huang2019gpipe]. Two years later, the three were combined to train a trillion-parameter model on 3,072 GPUs :cite[narayanan2021]. The training systems of every frontier model descend from these three papers.
:::

:::breakit
- In the memory planner, train the 405-billion-parameter model with data parallelism only and ZeRO stage 3. How many GPUs does it take to fit, and what does every GPU have to receive from the network at every layer?
- In the pipeline schedule, set 8 stages and 1 micro-batch. What fraction of the GPUs’ time is spent working?
- In the paged-attention widget, set the block size to 256. When does paging stop helping?
:::

:::exercises
1. **Communication.** A data-parallel all-reduce of $P$ bf16 gradients over $N$ GPUs sends about $2 \times 2P$ bytes from each GPU. For a 7-billion-parameter model on GPUs linked at 50 GB/s, how long does it take, and how does it compare with the step’s compute?
2. **Tensor-parallel MLP.** Show that splitting $W_1$ by columns and $W_2$ by rows computes $\mathrm{GELU}(\mathbf x W_1) W_2$ exactly, with one sum at the end. Why could we not split $W_1$ by rows instead?
3. **Prefix sharing.** A thousand requests share a 2,000-token system prompt. With paged attention and shared prefixes, how much KV-cache memory does the prompt take, compared with storing it per request?
:::

:::challenge
1. **Data parallelism on one machine.** With `torch.distributed` and two processes (on CPU with the gloo backend if you have one GPU), train CourseGPT’s draft model with data parallelism and check that the loss curve matches a single-process run with the combined batch.
2. **A paged KV cache.** Change `GptRunner`’s KV cache (Chapter 16) to allocate blocks on demand from a shared pool, and run two sequences at once.
:::

## Check your understanding

```quiz
q: "What does ZeRO stage 1 shard across data-parallel GPUs?"
options:
  - text: "The optimiser state — Adam's master weights and moments, 12 of the 16 bytes per parameter."
    correct: true
    why: Stage 2 adds the gradients and stage 3 the weights.
  - text: The activations.
    why: Activations are saved per micro-batch on each GPU; ZeRO does not shard them.
  - text: The layers.
    why: Assigning layers to GPUs is pipeline parallelism.
```

```quiz
q: "Why is tensor parallelism usually confined to the GPUs of one server?"
options:
  - text: "It communicates inside every layer, so it needs the fast links within a server."
    correct: true
    why: Two all-reduces per layer per pass would be far too slow over the network between servers.
  - text: Because a server has exactly as many GPUs as a layer has heads.
    why: Heads are divided among GPUs, but the reason is bandwidth.
  - text: Because it does not reduce memory.
    why: It divides the weights and much of the activations among the GPUs.
```

```quiz
q: "Why does a KV cache that reserves the maximum length for every request waste memory?"
options:
  - text: "Most requests are much shorter than the maximum, and the reserved space for tokens that never come is unusable by others."
    correct: true
    why: Paging allocates only what each sequence has used, to within one block.
  - text: The KV cache stores every layer twice.
    why: Keys and values are both needed; neither is wasted.
  - text: Because contiguous memory is slower.
    why: The issue is capacity, not access speed.
```

## Further reading

- Samyam Rajbhandari and colleagues, *ZeRO* :cite[rajbhandari2020].
- Deepak Narayanan and colleagues, *Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM* :cite[narayanan2021].
- Woosuk Kwon and colleagues, *Efficient Memory Management for Large Language Model Serving with PagedAttention* :cite[kwon2023].
- The Llama 3 Herd of Models, sections on infrastructure and scaling :cite[llama3herd2024].
