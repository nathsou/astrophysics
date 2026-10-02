---
number: 8
title: GPU compute with WebGPU
summary: Why neural networks run on graphics cards, and how to program one. We write WGSL kernels for element-wise operations, reductions and matrix multiplication, see why memory rather than arithmetic is usually the limit, and build a GPU backend with autograd that trains Chapter 7’s MLP hundreds of times faster.
duration: About 3 hours, including the lab
prerequisites: [tensors, automatic-differentiation, mlp-language-model, gpu-programming]
builds:
  - WebGPU context and buffer pool
  - WGSL kernels (element-wise, reductions, matmul, fused cross-entropy)
  - GpuTensor with autograd
  - GPU training loop
---

:::note
**Read this chapter in three sessions.** Session 1: understand parallel work. Session 2: explain performance. Session 3: combine results. Each session has a stopping point; the section menu remembers where you paused.
:::


At the end of Chapter 7 our MLP trained at about 150 steps per second, and a model with ten times the parameters would have been unbearably slow. Every model from here on is bigger. CourseGPT (Part IV) does about a thousand times more arithmetic per token than the MLP, and frontier models thousands of times more again. None of that is possible on a CPU running the loops we wrote in Chapter 4.

Neural networks run on **graphics processors** (GPUs): chips built to shade millions of pixels independently, which turn out to be just as good at the millions of independent multiply–adds inside a matrix product. This chapter programs one directly, from the browser, through **WebGPU** :cite[webgpu]. We write *kernels* — small programs that thousands of GPU threads run at once — in WebGPU’s shading language, WGSL. We then put them behind a tensor interface with the same autograd as Chapter 6. The payoff comes at the end: the same MLP, the same data, trained 20 to 300 times faster.

The main lesson, though, is not a speed-up. It is a way of thinking about performance that governs everything from here to Chapter 16: **moving data costs more than computing with it.** Keep an eye on bytes, not FLOPs.

:::note
Everything interactive in this chapter needs a browser with WebGPU: Chrome or Edge 113+, Safari 26+, or Firefox 141+ on Windows. The badge in the top bar shows what your browser offers. Without WebGPU the widgets show results measured on an Apple M4 Pro instead.
:::


:::note
**Session 1: understand parallel work.** Read through the first kernel and identify workgroups, invocations and memory. You can stop before performance tuning; GPU coding is an optional engine-building path.
:::

## Why GPUs?

A CPU core is built for **latency**: to finish one stream of instructions as fast as possible. Most of its silicon goes on making a single thread fast — large caches, branch prediction, out-of-order execution. A GPU is built for **throughput**: to finish a huge number of *independent* pieces of work, without caring how long any one of them takes. It spends its silicon on arithmetic units instead: thousands of simple lanes, grouped into compute units that execute the same instruction on 32 or so lanes at once.

The trick that makes this work is **latency hiding**. A GPU thread that waits hundreds of cycles for memory simply stalls, and the compute unit switches to another group of threads that is ready to run. With enough threads in flight, the arithmetic units never idle. That is why GPU programs are written for *tens of thousands* of threads, far more than there are lanes.

| | Apple M4 Pro CPU | Apple M4 Pro GPU | NVIDIA RTX 4060 Ti |
|---|---|---|---|
| Parallel lanes | 12 cores (each with SIMD units) | 16 cores × 128 ALUs | 34 SMs × 128 CUDA cores |
| float32 matmul (measured) | 2.6 GFLOP/s (our library), ≈2,900 (PyTorch) | ≈1,900 (this chapter), ≈5,400 (PyTorch) | ≈22,000 peak (spec) |
| Memory bandwidth | ≈120 GB/s (measured) | ≈125–180 GB/s measured, 273 spec | 288 GB/s (spec) |

The table holds a warning we will come back to. Our Chapter 4 library is about a thousand times slower than PyTorch *on the same CPU*: PyTorch calls Apple’s Accelerate library, which uses the chip’s matrix coprocessor and hand-tuned code. Much of the speed-up this chapter reports is really “tuned code versus teaching code”. We will measure honestly and say which is which.

:::history{year=2004 title="From pixel shaders to deep learning" people="Kyoung-Su Oh and Keechul Jung; Ian Buck; NVIDIA; Alex Krizhevsky"}
The first general-purpose GPU programs were disguised as graphics. Data went in as textures, the computation was written as a pixel shader, and the result was read back as an image. In 2004, Oh and Jung ran a neural network this way and reported a 20× speed-up over the CPU :cite[oh2004]. The same year, Stanford’s Brook language hid the disguise behind a streaming language :cite[buck2004]. Chellapilla, Puri and Simard trained convolutional networks on GPUs in 2006 :cite[chellapilla2006].

NVIDIA’s **CUDA** (2007) made GPUs programmable in something close to C, with the model this chapter uses: kernels, thread blocks and shared memory :cite[nickolls2008,lindholm2008]. Raina, Madhavan and Ng trained deep belief networks up to 70× faster on GPUs in 2009 :cite[raina2009]. In 2010, Cireşan and colleagues set a handwriting-recognition record with a plain, very large MLP trained on a GPU :cite[ciresan2010]. Then, in 2012, **AlexNet** won the ImageNet image-recognition competition by a wide margin. It was trained for about a week on two consumer GTX 580 cards :cite[krizhevsky2012], and after that deep learning and GPUs were inseparable. Sara Hooker has argued that this was partly luck — a *hardware lottery* — since neural networks happened to suit the chips that games had already paid for :cite[hooker2021].

WebGPU, standardised by the W3C, shipped in Chrome in 2023. It exposes the same compute model safely inside the browser, on top of Metal, Vulkan or Direct3D 12.
:::

## The execution model

A GPU program is split in two. The **host** code — TypeScript for us — allocates memory on the GPU, uploads data, and asks the GPU to run a **kernel** (WebGPU calls it a *compute shader*). The kernel is a function written from the point of view of *one thread*. The host launches it with a **dispatch**, which says how many **workgroups** of threads to run. The workgroup size is fixed in the kernel with `@workgroup_size`.

Every thread runs the same code. What makes threads differ is a set of built-in ids that tell each one where it is:

:::equation{#global-id caption="Each thread’s global index, from its workgroup and its position within it."}
$$
\term{gid}{\texttt{global\_invocation\_id}} \;=\; \term{wid}{\texttt{workgroup\_id}} \times \term{wsize}{S} \;+\; \term{lid}{\texttt{local\_invocation\_id}}
$$
:::

```terms
gid:
  label: global_invocation_id — the thread’s index in the whole dispatch
  what: A unique number for every thread in the dispatch (in each of x, y and z). Kernels usually use it as the index of the element to compute.
  why: It is how one piece of code, run by a million threads, ends up doing a million different things.
wid:
  label: workgroup_id — which workgroup the thread belongs to
  what: "The workgroup’s index in the dispatch grid: the host asked for dispatchWorkgroups(G), so this runs from 0 to G − 1."
lid:
  label: local_invocation_id — the thread’s position within its workgroup
  what: From 0 to S − 1. Threads in the same workgroup use it to divide up shared work, such as loading a tile.
wsize:
  label: "$S$ — the workgroup size"
  what: Threads per workgroup, fixed in the kernel by @workgroup_size. 64 or 256 are typical; WebGPU guarantees at least 256.
  effect: Too small and the hardware’s lanes go unused; larger groups can share more data through workgroup memory but need more of it.
```

Since the dispatch comes in whole workgroups, the number of threads is rounded *up* to a multiple of $S$. The extra threads at the end must do nothing — every kernel starts with a bounds check.

::dispatch-grid

Threads are organised this way because the hardware is. A workgroup runs on a single compute unit, so its threads can share that unit’s fast **workgroup memory** (CUDA calls it *shared memory*) and wait for each other at a **barrier**. Threads in different workgroups cannot cooperate at all: the GPU may run workgroups in any order, all at once or one after another. Within a workgroup, lanes execute in lock-step groups of 32 or so (NVIDIA *warps*, WebGPU *subgroups*). If threads in such a group take different sides of an `if`, both sides run one after the other, with half the lanes idle each time. This is called **divergence**.

The memory hierarchy mirrors the thread hierarchy:

| Memory | Visible to | Size (typical) | Speed |
|---|---|---|---|
| Registers (`var` in a function) | one thread | a few hundred bytes per thread | fastest |
| Workgroup memory (`var<workgroup>`) | one workgroup | 16–64 KB per compute unit (WebGPU guarantees 16 KB) | ~100× faster than global |
| Global memory (`var<storage>`) | all threads, and the host | gigabytes | slow: hundreds of cycles, limited bandwidth |

Appendix H collects the details of WGSL and the WebGPU API for reference. This chapter introduces what it needs as it goes.

## A first kernel

Here is a complete kernel: `saxpy` (“single-precision a·x plus y”), the hello-world of GPU computing.

```wgsl
struct P { n: u32, a: f32 }
@group(0) @binding(0) var<uniform> p: P;                      // small constants from the host
@group(0) @binding(1) var<storage, read> x: array<f32>;       // input buffers
@group(0) @binding(2) var<storage, read> y: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= p.n) { return; }          // the last workgroup has spare threads
  out[i] = p.a * x[i] + y[i];
}
```

WGSL looks like Rust with fewer features. Kernels read and write **buffers**, which are bound to numbered slots. `var<storage>` is a large array in global memory; `var<uniform>` holds a few read-only constants. There are no pointers into host memory, no allocation, no recursion and no strings — only arithmetic, arrays, loops and a few synchronisation primitives.

The host side is more ceremonious. WebGPU is a low-level API: it makes you spell out every object the GPU driver needs, so that nothing is hidden and nothing is slow by accident. Without any helpers, running the kernel once looks like this:

```ts
const adapter = await navigator.gpu.requestAdapter();          // a physical GPU
const device = await adapter!.requestDevice();                  // our logical connection to it

// 1. Buffers: GPU memory, with declared usages.
const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
const bx = device.createBuffer({ size: x.byteLength, usage });
device.queue.writeBuffer(bx, 0, x);                             // upload (by and bo similarly)

// 2. A pipeline: the compiled kernel plus the layout of its bindings.
const module = device.createShaderModule({ code: saxpyWgsl });
const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });

// 3. A bind group: which buffers go into which @binding slots.
const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
  { binding: 0, resource: { buffer: uniforms } }, { binding: 1, resource: { buffer: bx } },
  { binding: 2, resource: { buffer: by } },       { binding: 3, resource: { buffer: bo } },
] });

// 4. Record commands, then submit them to the GPU's queue.
const enc = device.createCommandEncoder();
const pass = enc.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, bind);
pass.dispatchWorkgroups(Math.ceil(n / 256));
pass.end();
enc.copyBufferToBuffer(bo, 0, staging, 0, n * 4);               // into a mappable buffer
device.queue.submit([enc.finish()]);

// 5. Read back: wait for the GPU, then map the staging buffer into JavaScript.
await staging.mapAsync(GPUMapMode.READ);
const result = new Float32Array(staging.getMappedRange().slice(0));
```

Notice what is *asynchronous*. `submit` returns immediately: the commands are queued, and the GPU gets to them when it can. The only place the CPU waits is `mapAsync`, which resolves once everything submitted before it has finished. A program that reads back after every small step spends most of its time waiting. We come back to this below.

The course library wraps this ceremony in a `GpuContext` (`@lm/core/gpu`), which does four things:

- **Caches pipelines** by kernel source, since compiling a shader takes milliseconds.
- **Pools buffers.** Creating GPU buffers is slow, so freed buffers go back into a pool, bucketed by size, and are handed out again.
- **Batches commands.** `run` records a dispatch into a pending command encoder, and nothing is submitted until someone needs a result. A training step becomes one submission of a few dozen dispatches rather than a few dozen round trips.
- **Packs uniforms** from a tiny spec: `{ spec: 'uf', values: [n, a] }` means a `u32` then an `f32`.

```ts
const gpu = await GpuContext.create();
const bx = gpu.upload(x), by = gpu.upload(y), bo = gpu.alloc(n * 4);
gpu.run({ code: saxpyWgsl, uniforms: { spec: 'uf', values: [n, a] }, buffers: [bx, by, bo], groups: [Math.ceil(n / 256)] });
const result = await gpu.readFloat32(bo, n);
```

::exercise{id="saxpy"}


:::note
**Session 2: explain performance.** Compare naive and tiled multiplication. Predict how operand reuse changes bytes transferred per multiply–add. Use the reference measurements if WebGPU is unavailable.
:::

## Bytes, not FLOPs: the roofline

How fast is `saxpy`? Each element needs 2 floating-point operations (a multiply and an add) and moves 12 bytes: two 4-byte loads and one 4-byte store. The ratio of the two is the kernel’s **arithmetic intensity**:

:::equation{#intensity caption="Arithmetic intensity: work done per byte moved."}
$$
\term{I}{I} \;=\; \frac{\text{floating-point operations}}{\text{bytes moved to or from memory}}, \qquad I_{\text{saxpy}} = \frac{2}{12} \approx 0.17\ \text{FLOP/byte}
$$
:::

```terms
I:
  label: "$I$ — arithmetic intensity"
  what: How many floating-point operations a kernel performs for each byte it reads or writes in global memory.
  why: Arithmetic and memory run in parallel on a GPU, and whichever takes longer sets the speed. Intensity says which one that is.
  effect: Low intensity (element-wise operations, well below 1) means the arithmetic units mostly wait for data. High intensity (a large matmul can reach hundreds) lets them run flat out.
  param: { key: roofline.intensity, min: 0.0625, max: 64, step: 0.01, log: true, value: 1 }
```

A GPU can stream at most $\beta$ bytes per second from memory and perform at most $P$ FLOP/s. A kernel with intensity $I$ therefore cannot exceed either limit. This is the **roofline model** of Williams, Waterman and Patterson :cite[williams2009]:

:::equation{#roofline caption="The roofline: performance is capped by arithmetic or by memory, whichever binds first."}
$$
\text{attainable FLOP/s} \;=\; \min\!\big(\,\term{peak}{P},\; \term{I2}{I} \times \term{bw}{\beta}\,\big)
$$
:::

```terms
peak:
  label: "$P$ — peak arithmetic throughput"
  what: The most floating-point operations per second the chip can do. We use the best matmul we measure, which is below the vendor’s figure.
I2:
  label: "$I$ — the kernel’s arithmetic intensity"
  what: FLOPs per byte of global-memory traffic.
  param: { key: roofline.intensity, min: 0.0625, max: 64, step: 0.01, log: true, value: 1 }
bw:
  label: "$\\beta$ — memory bandwidth"
  what: Bytes per second between global memory and the compute units, measured with a streaming kernel.
  why: Every byte a kernel touches has to cross this bus at least once.
```

On a log–log plot the rule draws a roof: a slope where memory binds, then a flat ceiling where arithmetic does. They meet at the **ridge point** $I = P/\beta$. On the M4 Pro that is about 15 FLOP/byte; on an RTX 4060 Ti it is about 77. A kernel below the ridge is **memory-bound**, and no amount of cleverness with arithmetic will speed it up; only moving fewer bytes will.

::roofline

`saxpy` sits far down the slope: about 20 GFLOP/s on a GPU that can do 1,900. That is not a bad kernel; it runs at the speed of memory. The same is true of every element-wise operation, of normalisation layers and of softmax. They are all memory-bound, on every GPU ever made. Matrix multiplication is the exception, and the reason neural networks are built from matrix multiplications.

## Making matrix multiplication fast

Multiplying two $n \times n$ matrices takes $2n^3$ FLOPs but only needs to read $2n^2$ numbers and write $n^2$. In principle its intensity is $2n^3 / (12 n^2) = n/6$ FLOP/byte, which is huge for large $n$. Whether a kernel gets anywhere near that depends entirely on how often it re-reads the same numbers.

### Version 1: one thread per output

The direct translation of the definition gives each output element $C_{ij} = \sum_k A_{ik} B_{kj}$ its own thread:

```wgsl
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y; let j = gid.x;
  if (i >= d.M || j >= d.N) { return; }
  var s = 0.0;
  for (var k = 0u; k < d.K; k++) { s += A[i * d.K + k] * B[k * d.N + j]; }
  C[i * d.N + j] = s;
}
```

Each multiply–add (2 FLOPs) issues two 4-byte loads, so the kernel asks memory for 8 bytes per 2 FLOPs: an intensity of $0.25$. The GPU’s caches catch some of the repeats — the whole of row $i$ of A is read by every thread in that row — but the kernel is still starved. On the M4 Pro it reaches about 240 GFLOP/s.

### Version 2: tiles in workgroup memory

The fix is the oldest trick in high-performance computing: **tiling**. A 16 × 16 workgroup computes a 16 × 16 tile of $C$. It walks along $K$ in steps of 16. At each step, every thread loads *one* element of a 16 × 16 tile of $A$ and one of a tile of $B$ into workgroup memory. After a barrier, every thread computes 16 multiply–adds from the fast on-chip copies. Each number fetched from global memory is now used 16 times instead of once, and the intensity rises 16-fold, to 4 FLOP/byte.

::matmul-tiling

The two barriers matter. The first makes sure the whole tile has arrived before anyone reads it. The second makes sure nobody overwrites the tile with the next step’s data while a slower thread is still reading it. Leave out either, and the kernel computes wrong answers only *sometimes* — the worst kind of bug. There is one more rule: *every* thread must reach every barrier. That is why the tiled kernel cannot return early for out-of-range threads. Instead, those threads load zeros and skip only the final write.

::exercise{id="tiled-matmul"}

### Version 3: more work per thread

Tiling moved the bottleneck from global memory to workgroup memory: each multiply–add still reads two floats from `As` and `Bs`. The library’s kernel goes one level further, to **registers**. Each of 256 threads computes a 4 × 4 block of outputs, so the workgroup covers a 64 × 64 tile of $C$. In the inner loop, a thread loads 4 values of A and 4 of B into registers and performs all 16 multiply–adds between them:

```wgsl
for (var k = 0u; k < TK; k++) {
  for (var r = 0u; r < 4u; r++) { av[r] = As[(lid.y * 4u + r) * TK + k]; }   // 4 loads
  for (var c = 0u; c < 4u; c++) { bv[c] = Bs[k * TS + lid.x * 4u + c]; }     // 4 loads
  for (var r = 0u; r < 4u; r++) {
    for (var c = 0u; c < 4u; c++) { acc[r * 4u + c] = fma(av[r], bv[c], acc[r * 4u + c]); }  // 16 FMAs
  }
}
```

That is 8 loads for 16 fused multiply–adds instead of 32 loads, and each value brought in from global memory is now used 64 times. Run all three on your own GPU:

::kernel-bench

On the M4 Pro the three versions reach roughly 240, 620 and 1,900 GFLOP/s at 2048 × 2048. The best is about 700 times faster than our CPU library. It is still only about a third of what PyTorch gets from the same GPU (about 5,400 GFLOP/s through Apple’s Metal Performance Shaders).

Vendor libraries close that gap with a long list of further tricks, each adding a few per cent. They load four floats at a time as vectors. They double-buffer, loading the next tile while computing on the current one. They lay out workgroup memory to avoid *bank conflicts*, and use subgroup operations to share registers between lanes. On NVIDIA hardware there are also **tensor cores**: units that multiply small matrices in a single instruction, at several times the float32 rate, in lower precision (Chapter 14). Simon Boehm’s worklog takes a CUDA kernel from 1% to 94% of cuBLAS step by step, and is the best next read :cite[boehm2022]. The classic paper on GPU matmul tuning is Volkov and Demmel’s :cite[volkov2008].

:::note
**Transposes for free.** Backpropagation through $C = AB$ needs $\partial A = \partial C\, B^\top$ and $\partial B = A^\top\, \partial C$ (Chapter 6). Rather than materialising transposed copies, the library’s kernel takes `transA`/`transB` flags and simply reads the operand with swapped strides. It also takes a batch dimension (the `z` of the dispatch grid), which attention will need in Chapter 10.
:::


:::note
**Session 3: combine results.** Understand barriers, reductions and fusion. Pick one optional kernel challenge; implementing every kernel is not required.
:::

## Reductions

Summing a vector is harder to parallelise than it looks, because every element contributes to *one* output. The standard solution works in two phases inside a single workgroup :cite[harris2007]:

1. Each of the 256 threads adds up a strided slice of the input — elements $t, t + 256, t + 512, \ldots$ — into its own register. Consecutive threads read consecutive addresses, which the memory system can combine (*coalesce*) into a few wide transactions.
2. The 256 partial sums go into workgroup memory and are combined by a **tree**. At each step, the first half of the active threads add in the second half, with a barrier between steps. After $\log_2 256 = 8$ steps, element 0 holds the total.

::reduction-tree

::exercise{id="reduce"}

A single workgroup is plenty for the loss of one batch. Reducing a billion numbers needs a second level: many workgroups each reduce a chunk, and a second dispatch reduces their results. The library needs two other reductions. **Column sums**, for bias gradients, use one thread per column looping down the rows, which is simple and fast enough when there are many columns. **Row reductions** — the maximum and the sum of exponentials in softmax — use one workgroup per row, each running the tree above.

:::warning
**Floating-point addition is not associative.** $(a + b) + c$ and $a + (b + c)$ can differ in the last bits :cite[goldberg1991]. A tree reduction adds in a different order from a CPU loop, so GPU and CPU results agree to about $10^{-6}$ relative error, not exactly. Worse, kernels that combine partial results in whatever order threads finish give answers that vary *from run to run*. Reproducible training on GPUs takes deliberate effort.
:::

## Fusion: softmax and cross-entropy in one pass

Chapter 5 derived the gradient of softmax followed by cross-entropy as one simple formula, and the library computes the two together for numerical stability. On a GPU there is a second reason to fuse them. Computed as separate operations — max, subtract, exponentiate, sum, divide, log, pick the target, and then the backward pass — each step would read and write the whole $N \times V$ logits array. Every one of those steps is memory-bound. The library’s kernel instead gives each row one workgroup and does everything in one pass:

1. A tree reduction finds the row maximum $m$.
2. A second tree reduction computes $s = \sum_j e^{z_j - m}$.
3. Each thread writes the gradient $(\operatorname{softmax}(\mathbf z)_j - [j = y]) / N$ for its columns, and thread 0 writes the row’s loss $\log s + m - z_y$.

The logits are read twice (a third time for the gradient) and the gradient written once. No probability array is ever stored. This is **kernel fusion**: keep intermediates on-chip, so that memory-bound steps share a single trip through memory. It is the most important optimisation in modern language-model engineering. FlashAttention (Chapter 14) is a fused attention kernel, and most of the speed of `torch.compile` comes from fusing element-wise operations.

## Scatter without atomics: the embedding gradient

The backward pass of an embedding lookup must *add* each row of the incoming gradient into the row of $\partial C$ for that token (Chapter 7). If two positions in the batch hold the same token — and with 65 characters, most do — two threads try to update the same memory at once. Plain read–modify–write then loses updates. This is a **race condition**.

CUDA solves this with `atomicAdd` on floats. Core WebGPU has atomics only for 32-bit integers, so the library turns the loop inside out: one thread per *output* element $(v, k)$ of $\partial C$ scans all positions and sums the gradients of those whose token is $v$. Each output then has exactly one writer, so there is nothing to race. The price is that every thread reads every id, $O(V \cdot d \cdot N)$ work in total. That is fine for 65 characters, but not for the 8,192-token vocabulary of Chapter 12. There, the standard fix is to sort the positions by token id first, so each token’s gradient rows sit next to each other and can be summed by a segmented reduction.

## Talking to the GPU efficiently

GPU kernels are fast; getting work to them is not free. Three habits matter as much as good kernels:

- **Batch the dispatches.** Each `submit` costs tens of microseconds on the CPU side. The library records the whole training step — 30 to 70 dispatches — into one command buffer.
- **Don’t wait for results you don’t need.** Reading the loss back after every step forces the CPU to wait for the GPU to drain, and the GPU to wait for the next step. The trainer below reads the loss once per animation frame, after dozens of steps.
- **Reuse memory.** Buffers go back to a pool after use, so a steady-state training step allocates nothing.

The asynchrony also creates ordering pitfalls. `queue.writeBuffer` (an upload) is ordered only against work that has already been *submitted*, not against commands still being recorded. So the context submits pending work before every upload. Uniforms use small buffers written at creation, which sidesteps the queue entirely.

Memory management needs thought too. The GPU buffers behind intermediate tensors are not reclaimed promptly by JavaScript’s garbage collector, so a training loop that creates a few hundred tensors per step would soon run out of memory. The library borrows TensorFlow.js’s answer, **scopes**. Every tensor created inside `scope(() => …)` is returned to the pool when the function ends, except the ones it returns and the parameters’ gradients.

## A GPU backend with autograd

With kernels for every operation the MLP needs, `GpuTensor` mirrors Chapter 4’s `Tensor`, with the same reverse-mode autograd as Chapter 6. Each operation records its inputs and a backward function, and `backward()` walks the graph in reverse topological order. The only differences are that data lives in GPU buffers and every operation is one or two kernel dispatches:

| Operation | Forward kernel | Backward |
|---|---|---|
| `a.matmul(w)` | register-blocked matmul | two matmuls with `transB` / `transA` |
| `a.add(b)`, `a.mul(b)` | element-wise, with `b` broadcast along trailing dimensions | element-wise; column sums for the broadcast operand |
| `a.tanh()`, `a.relu()` | element-wise | element-wise, using the saved output |
| `a.reshape(…)` | none (a view of the same buffer) | reshape the gradient |
| `embedding(C, ids)` | gather rows | one thread per output element (above) |
| `crossEntropy(z, y)` | fused, one workgroup per row | the gradient saved by the forward pass |

A training step reads almost exactly like Chapter 7’s:

```ts
const loss = scope(() => {
  const h = embedding(C, X).reshape(B, n * d).matmul(W1).add(b1).tanh();
  const loss = crossEntropy(h.matmul(W2).add(b2), Y);
  loss.backward();    // gradients accumulate in C.grad, W1.grad, … on the GPU
  opt.step();         // SGD with momentum: one kernel per parameter
  opt.zeroGrad();
  return loss;        // everything else is returned to the buffer pool
});
```

How do we know it is right? The library’s tests run the same MLP forward and backward on the CPU (Chapter 7) and on the GPU, from identical initial weights, and require every parameter’s gradient to agree to within $10^{-4}$. They run under Node too, using Dawn, Chrome’s WebGPU implementation, through the `webgpu` package. Comparing a new backend against a trusted slow one is the most useful testing habit in numerical code.

Now train:

::gpu-trainer

At Chapter 7’s size ($h = 128$, batch 64) the GPU is about 20× faster than the CPU library, finishing 20,000 steps in a few seconds. Even so, the GPU is mostly idle: each kernel has too little work to fill it, and the fixed cost of launching kernels dominates. At the larger size ($h = 1024$, batch 1,024; 170 times the arithmetic per step) the gap grows to a factor of 150–350. The run takes about a minute and a half on the M4 Pro, where the CPU library would need four to six hours.

With ten times the parameters and 16× larger batches, the MLP reaches about **2.43 bits per character** on the full validation split. That is its best result yet, but still short of Kneser–Ney’s 2.22. Watch the two curves part company. The training loss keeps falling, well below 2 bits, while validation levels off. Twenty thousand batches of 1,024 is 20 million examples drawn from a million characters, so the model sees each context about 20 times and starts to memorise them. That is :term[overfitting]{id=overfitting}, first met in Chapter 2; Chapter 12 adds the standard remedies.

So compute is no longer what holds the MLP back. As Chapter 7 concluded, the architecture is: it cannot share what it learns across positions, so extra capacity goes into memorising rather than generalising. The next three chapters fix that, and the GPU backend will grow with them: layer normalisation, batched matmuls and softmax for attention in Chapters 10–12, and AdamW in Chapter 13.

:::breakit
A few experiments to try in the exercise editors above:

- Remove the second `workgroupBarrier()` from your tiled matmul and run the tests many times. Do they fail every time? Why not?
- In the reduction, move the barrier inside the `if (lid.x < stride)`. WGSL rejects this at compile time: barriers must be in *uniform control flow*. Why is that rule necessary?
- Read the loss back after every step in the trainer (`await loss.item()` inside the loop). How much slower does training get at each model size?
:::

## Numbers on the GPU

A few numerical facts that differ from the CPU:

- **float32 only, by default.** Core WGSL has no 64-bit floats. 16-bit floats are available through the optional `shader-f16` feature, which we use for inference in Chapter 16. Every kernel in this chapter computes in float32, like the CPU library, so results agree to rounding.
- **Fused multiply–add.** `fma(a, b, c)` computes $ab + c$ with a single rounding. GPUs use it everywhere, which is one more reason CPU and GPU results differ in the last bits.
- **Edge cases vary between GPUs.** WGSL’s built-in `tanh` may return NaN for large arguments on some GPUs, so the library computes $\tanh x = 1 - 2/(e^{2x} + 1)$ with $x$ clamped to $\pm 15$. That clamp changes nothing in float32.
- **Softmax still needs the max trick.** $e^{z}$ overflows float32 above $z \approx 88$. The fused kernel subtracts the row maximum first, exactly as in Chapter 4.

## Lab: GPUs from PyTorch

```bash
cd training
uv run lmc ch08              # bandwidth, matmul GFLOP/s and MLP step time, CPU vs GPU
uv run lmc ch08 --triton     # on the Linux/NVIDIA machine: a tiled matmul written in Triton
```

The lab measures what PyTorch gets from your hardware. On the M4 Pro, float32 matmul reaches about 2,900 GFLOP/s on the CPU (through Accelerate) and 5,400 on the GPU (through MPS). The large MLP’s training step takes 3.1 ms on the CPU and 1.4 ms on the GPU — so against *tuned* code the GPU is only about 2× faster at this size. Our WebGPU backend takes about 4 ms per step, including uploading each batch from JavaScript.

On an RTX 4060 Ti, expect roughly 20 TFLOP/s in float32 and several times that in bfloat16 on the tensor cores. That hardware is what the rest of the course trains CourseGPT on.

The `--triton` option runs a matmul written in **Triton** :cite[tillet2019], OpenAI’s Python-embedded language for GPU kernels. Triton sits one level above WGSL: you write the tile-level program (“load a 64 × 64 tile of A…”), and the compiler decides how to split it across threads, workgroup memory and registers. Compare its structure with this chapter’s tiled kernel. It is the same algorithm, written as operations on whole tiles.

:::exercises
1. **Workgroup size.** Change `saxpy`’s workgroup size to 32, 64 and 1024, and time a vector of 16 million elements. Why does it barely matter for this kernel? (Hint: roofline.) What is the largest size WebGPU guarantees, and what happens if you exceed it?
2. **Intensity of the tiled kernel.** Derive the arithmetic intensity (with respect to global memory) of a tiled matmul with $T \times T$ tiles. Why can’t $T$ grow without limit?
3. **Upload once.** The trainer uploads every batch of token ids from JavaScript. Upload the whole training set once, and write a kernel that gathers a batch from random offsets produced by a GPU random-number generator. How much faster is a step at each size?
4. **Softmax kernel.** Write a row-wise softmax (one workgroup per row, two tree reductions) and test it against `Tensor.softmax`. It becomes part of attention in Chapter 10.
:::

:::challenge
1. **Close the gap.** Improve the register-blocked matmul: `vec4` loads, a larger block per thread (8 × 8), and double buffering of the tiles. How close to PyTorch’s MPS or cuBLAS figure can you get?
2. **Fast embedding backward.** Replace the $O(V d N)$ embedding backward with a sort-based version (a GPU radix sort on token ids, then a segmented sum). Measure it with a vocabulary of 8,192.
3. **GPU timing.** Where the browser supports the `timestamp-query` feature, measure each kernel’s GPU time directly instead of wall-clock time around a sync. Profile one training step: which kernels dominate at each model size?
:::

## Check your understanding

```quiz
q: "A kernel adds two float32 vectors element-wise. On a GPU with 1,000 GB/s of bandwidth and 50 TFLOP/s of float32 throughput, roughly what performance can it reach?"
options:
  - text: "About 83 GFLOP/s: one FLOP per 12 bytes, times 1,000 GB/s."
    correct: true
    why: "Intensity is 1/12 FLOP/byte, far below the ridge point (50 FLOP/byte), so bandwidth sets the limit: 1,000/12 ≈ 83 GFLOP/s."
  - text: About 50 TFLOP/s, since the arithmetic is trivial.
    why: The arithmetic is trivial but the data movement is not. The kernel is memory-bound.
  - text: About 1,000 GFLOP/s.
    why: That would need 1 FLOP per byte; element-wise addition does 1 FLOP per 12 bytes.
```

```quiz
q: "Why must every thread in a workgroup reach every workgroupBarrier()?"
options:
  - text: "A barrier waits until all threads of the workgroup arrive. If some threads skip it, the others would wait forever — so WGSL requires barriers in uniform control flow."
    correct: true
    why: That is why the tiled matmul keeps out-of-range threads in the loop (loading zeros) instead of returning early.
  - text: Barriers flush the GPU’s caches to global memory.
    why: A workgroup barrier synchronises execution and workgroup memory within one workgroup; it does nothing across workgroups.
  - text: Barriers are only needed for atomics.
    why: They are needed whenever threads read workgroup memory written by other threads.
```

```quiz
q: "Tiling a matmul with 16 × 16 tiles in workgroup memory mainly helps because…"
options:
  - text: "each value loaded from global memory is reused by 16 threads, cutting global-memory traffic 16-fold."
    correct: true
    why: Matmul has plenty of arithmetic; the naive kernel is limited by memory traffic, and tiling reduces it.
  - text: it reduces the number of floating-point operations.
    why: Every version does exactly 2MNK FLOPs. Only the data movement changes.
  - text: workgroup memory is larger than global memory.
    why: It is far smaller (tens of KB) — but much faster.
```

## Further reading

- Samuel Williams, Andrew Waterman and David Patterson, *Roofline* :cite[williams2009]. The one performance model worth memorising.
- Simon Boehm, *How to Optimize a CUDA Matmul Kernel for cuBLAS-like Performance* :cite[boehm2022]. Every trick in this chapter and a dozen more, measured one at a time.
- Mark Harris, *Optimizing Parallel Reduction in CUDA* :cite[harris2007]. Seven versions of the reduction, each faster than the last.
- John Nickolls and colleagues, *Scalable Parallel Programming with CUDA* :cite[nickolls2008]. The programming model, from its designers.
- Sara Hooker, *The Hardware Lottery* :cite[hooker2021]. On how the hardware we have shapes the ideas that win.
