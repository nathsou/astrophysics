/**
 * The course outline: single source of truth for navigation. A chapter becomes readable when a
 * matching `chapters/<nn>-<slug>/index.md` exists; until then it is listed as planned.
 */

export interface OutlineEntry {
  slug: string;
  number: string;
  title: string;
  summary: string;
  /** Which model capability this chapter adds (shown on the home page's "what you build" track). */
  builds?: string;
  milestone: string;
}

export interface OutlinePart {
  id: string;
  title: string;
  blurb: string;
  chapters: OutlineEntry[];
}

export const COURSE_TITLE = 'Language Models from Scratch';

export const PARTS: OutlinePart[] = [
  {
    id: '0',
    title: 'Orientation',
    blurb: 'Where we are going, and how the course works.',
    chapters: [
      { slug: 'what-is-a-language-model', number: '0', title: 'What is a language model?', summary: 'A tour of the finished model, the roadmap, and your lab setup.', milestone: 'M4' },
    ],
  },
  {
    id: 'I',
    title: 'Text & counting',
    blurb: 'Text as numbers, the first statistical models, and how text is cut into tokens.',
    chapters: [
      { slug: 'text-as-data', number: '1', title: 'Text as data', summary: 'Unicode, UTF-8, normalisation, corpora, Zipf’s law and entropy.', builds: 'Text utilities', milestone: 'M0' },
      { slug: 'n-gram-models', number: '2', title: 'N-gram models', summary: 'The chain rule, maximum likelihood, smoothing, cross-entropy and perplexity.', builds: 'N-gram LM', milestone: 'M1' },
      { slug: 'tokenisation', number: '3', title: 'Tokenisation', summary: 'Characters, words and subwords; implementing byte-level BPE.', builds: 'BPE tokeniser', milestone: 'M1' },
    ],
  },
  {
    id: 'II',
    title: 'Neural foundations',
    blurb: 'Tensors, gradients and GPUs — building our own deep-learning engine.',
    chapters: [
      { slug: 'tensors', number: '4', title: 'Tensors', summary: 'Shapes, strides, views, broadcasting and matrix multiplication.', builds: 'Tensor library', milestone: 'M2' },
      { slug: 'learning-as-optimisation', number: '5', title: 'Learning as optimisation', summary: 'Loss functions, gradient descent and the neural bigram model.', builds: 'Neural bigram', milestone: 'M2' },
      { slug: 'automatic-differentiation', number: '6', title: 'Automatic differentiation', summary: 'Computational graphs, reverse mode and gradient checking.', builds: 'Autograd', milestone: 'M2' },
      { slug: 'mlp-language-model', number: '7', title: 'An MLP language model', summary: 'Embeddings, initialisation, activation statistics and normalisation.', builds: 'MLP LM', milestone: 'M2' },
      { slug: 'gpu-compute', number: '8', title: 'GPU compute with WebGPU', summary: 'WGSL kernels, tiled matmul, reductions and a GPU backend.', builds: 'WebGPU backend', milestone: 'M2' },
    ],
  },
  {
    id: 'III',
    title: 'Sequences & attention',
    blurb: 'From recurrence to attention to the Transformer.',
    chapters: [
      { slug: 'recurrent-networks', number: '9', title: 'Recurrent networks', summary: 'Backpropagation through time, LSTMs and a character-level RNN.', builds: 'char-RNN', milestone: 'M3' },
      { slug: 'attention', number: '10', title: 'Attention', summary: 'Queries, keys and values; scaling, masking and multiple heads.', builds: 'Attention', milestone: 'M3' },
      { slug: 'transformer', number: '11', title: 'The Transformer', summary: 'Residual streams, normalisation, positional encodings and GPT.', builds: 'GPT block', milestone: 'M3' },
    ],
  },
  {
    id: 'IV',
    title: 'Training & running a real GPT',
    blurb: 'Train in the browser, scale up in PyTorch, then run CourseGPT on our own inference engine.',
    chapters: [
      { slug: 'training-loop', number: '12', title: 'The training loop', summary: 'Batches, evaluation and checkpoints — training char-GPT in your browser.', builds: 'char-GPT', milestone: 'M4' },
      { slug: 'optimisers', number: '13', title: 'Optimisers', summary: 'SGD, momentum, Adam, AdamW, schedules, clipping and Muon.', builds: 'AdamW', milestone: 'M4' },
      { slug: 'scaling-up', number: '14', title: 'Scaling up in PyTorch', summary: 'Parity tests, mixed precision, FlashAttention and training CourseGPT.', builds: 'CourseGPT', milestone: 'M4' },
      { slug: 'sampling', number: '15', title: 'Sampling & decoding', summary: 'Temperature, top-k, top-p, min-p, beam search and penalties.', builds: 'Sampler', milestone: 'M4' },
      { slug: 'inference', number: '16', title: 'Inference engine', summary: 'KV caches, quantisation and speculative decoding on WebGPU.', builds: 'Inference engine', milestone: 'M4' },
    ],
  },
  {
    id: 'V',
    title: 'Modern language models',
    blurb: 'Scaling, architecture refinements, alignment, reasoning, tools, evaluation and safety.',
    chapters: [
      { slug: 'scaling-laws', number: '17', title: 'Scaling laws', summary: 'Kaplan, Chinchilla and our own scaling sweep.', milestone: 'M5' },
      { slug: 'modern-architecture', number: '18', title: 'Modern architecture', summary: 'RMSNorm, SwiGLU, RoPE, GQA and long context.', builds: 'Llama-style blocks', milestone: 'M5' },
      { slug: 'mixture-of-experts', number: '19', title: 'Mixture-of-Experts', summary: 'Routing, load balancing and expert specialisation.', builds: 'MoE CourseGPT', milestone: 'M5' },
      { slug: 'fine-tuning', number: '20', title: 'Fine-tuning & LoRA', summary: 'Instruction tuning, loss masking and low-rank adapters.', builds: 'Instruct model', milestone: 'M6' },
      { slug: 'preference-learning', number: '21', title: 'Preference learning', summary: 'Reward models, RLHF, DPO and RLAIF.', builds: 'DPO', milestone: 'M6' },
      { slug: 'reasoning', number: '22', title: 'Reasoning models', summary: 'Chain of thought, test-time compute and GRPO.', builds: 'GRPO', milestone: 'M6' },
      { slug: 'tool-use', number: '23', title: 'Tool use & agents', summary: 'Function calling, constrained decoding, retrieval and agent loops.', builds: 'Tool-using model', milestone: 'M6' },
      { slug: 'multimodality', number: '24', title: 'Multimodality', summary: 'Vision transformers, CLIP and vision–language models (survey).', milestone: 'M7' },
      { slug: 'evaluation', number: '25', title: 'Evaluation', summary: 'Benchmarks, contamination, LLM judges and calibration.', builds: 'Eval harness', milestone: 'M7' },
      { slug: 'interpretability', number: '26', title: 'Interpretability', summary: 'Logit lens, induction heads, probing and sparse autoencoders.', builds: 'SAE', milestone: 'M7' },
      { slug: 'efficiency', number: '27', title: 'Efficiency at scale', summary: 'Parallelism, paged attention and serving (survey).', milestone: 'M7' },
      { slug: 'safety', number: '28', title: 'Safety', summary: 'Reward hacking, jailbreaks, prompt injection, backdoors and evaluations.', milestone: 'M7' },
      { slug: 'epilogue', number: '29', title: 'Epilogue', summary: 'From 30M parameters to the frontier.', milestone: 'M7' },
    ],
  },
];

export const APPENDICES: OutlineEntry[] = [
  { slug: 'linear-algebra', number: 'A', title: 'Linear algebra', summary: 'Vectors, matrices, norms, projections and decompositions.', milestone: 'M2' },
  { slug: 'calculus', number: 'B', title: 'Calculus & matrix calculus', summary: 'Derivatives, the chain rule, gradients and Jacobians.', milestone: 'M2' },
  { slug: 'probability', number: 'C', title: 'Probability', summary: 'Random variables, distributions, expectation and Bayes.', milestone: 'M2' },
  { slug: 'statistics', number: 'D', title: 'Statistics', summary: 'Estimation, likelihood, bias–variance and uncertainty.', milestone: 'M5' },
  { slug: 'information-theory', number: 'E', title: 'Information theory', summary: 'Entropy, cross-entropy, KL divergence and compression.', milestone: 'M1' },
  { slug: 'optimisation', number: 'F', title: 'Optimisation', summary: 'Convexity, conditioning, momentum and stochastic methods.', milestone: 'M4' },
  { slug: 'neural-networks', number: 'G', title: 'Neural-network background', summary: 'Neurons, universal approximation and a short history of deep learning.', milestone: 'M2' },
  { slug: 'gpu-programming', number: 'H', title: 'GPU & WGSL primer', summary: 'The GPU execution model and WGSL reference.', milestone: 'M2' },
  { slug: 'pytorch', number: 'I', title: 'PyTorch primer', summary: 'Tensors, autograd and modules — mapped to what we built.', milestone: 'M4' },
  { slug: 'reference', number: 'J', title: 'Glossary, timeline & bibliography', summary: 'Every term, paper and date in one place.', milestone: 'M1' },
];
