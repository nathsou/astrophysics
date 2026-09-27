---
number: H
title: GPU & WGSL primer
summary: A reference for programming GPUs through WebGPU — the object model, WGSL’s types, address spaces, built-ins and synchronisation, memory layout rules, limits, a performance checklist, debugging, and a dictionary between WebGPU, CUDA and Metal terms.
duration: Reference; about 1 hour to read through
---

Chapter 8 introduces GPU programming as it needs it. This appendix is the reference to come back to: the pieces of WebGPU and WGSL that the course uses, and the handful of rules that cause most bugs. The authoritative sources are the WebGPU and WGSL specifications :cite[webgpu], which are unusually readable for standards documents.

## The object model

WebGPU exposes the GPU through a small set of objects, each created from the one before:

| Object | What it is | Created by |
|---|---|---|
| `GPU` | The entry point (`navigator.gpu`) | the browser |
| `GPUAdapter` | A physical GPU and its capabilities (`features`, `limits`, `info`) | `gpu.requestAdapter()` |
| `GPUDevice` | Your logical connection; creates everything else and owns a `queue` | `adapter.requestDevice({ requiredLimits, requiredFeatures })` |
| `GPUBuffer` | A block of GPU memory with declared usages (`STORAGE`, `UNIFORM`, `COPY_SRC`, `COPY_DST`, `MAP_READ`, …) | `device.createBuffer` |
| `GPUShaderModule` | Compiled WGSL source | `device.createShaderModule({ code })` |
| `GPUComputePipeline` | A shader entry point plus the layout of its bindings | `device.createComputePipeline` |
| `GPUBindGroup` | Which buffers are bound to which `@binding` slots | `device.createBindGroup` |
| `GPUCommandEncoder` | Records passes and copies into a command buffer | `device.createCommandEncoder()` |
| `GPUComputePassEncoder` | Records `setPipeline`, `setBindGroup`, `dispatchWorkgroups` | `encoder.beginComputePass()` |
| `GPUQueue` | Executes submitted command buffers in order; also `writeBuffer` | `device.queue` |

Pipelines and shader modules are expensive to create, so create them once and cache them. Bind groups are cheap. Buffers are somewhere in between, so pool them (Chapter 8’s `GpuContext` does both).

Everything submitted to the queue runs **asynchronously** and **in order**. The CPU only waits when it asks to: `buffer.mapAsync(…)` resolves once all work submitted before it has finished, and so does `queue.onSubmittedWorkDone()`. Two ordering facts matter in practice:

- Commands recorded in one command buffer execute in the order they were recorded, and each dispatch sees the writes of earlier ones. There is no need for explicit barriers between dispatches.
- `queue.writeBuffer` takes effect before any command buffer submitted *after* it, but after those submitted *before* it. Commands still being recorded into an encoder are not yet submitted, so a write can overtake them.

## WGSL at a glance

WGSL is statically typed, with Rust-like syntax and no implicit conversions.

**Scalar and vector types.** `bool`, `i32`, `u32`, `f32`, and `f16` (after `enable f16;`, with the `shader-f16` feature). Vectors `vec2<T>`, `vec3<T>` and `vec4<T>` have shorthands such as `vec3u` and `vec4f`, with swizzles like `v.xy` and `v.zyx`. Matrices are `matCxR<f32>`, for example `mat4x4f`. Literals carry their type: `1u`, `-2i`, `0.5` or `0.5f`, `1e-3`. Integer and float never mix without an explicit conversion such as `f32(i)`.

**Declarations.** `let` binds an immutable value, `var` a mutable variable, `const` a compile-time constant and `override` a constant set when the pipeline is created.

**Arrays and structs.** `array<f32, 256>` has a fixed size; `array<f32>` is runtime-sized, allowed only as the last member of a storage buffer, with `arrayLength(&buf)` giving its length. Structs are declared with `struct P { n: u32, lr: f32 }`.

**Address spaces** say where a variable lives:

| Declaration | Lives in | Shared by | Notes |
|---|---|---|---|
| `var x: f32` (in a function) | registers | one thread | the default for locals |
| `var<private> x: f32` (module scope) | registers | one thread | a per-thread global |
| `var<workgroup> tile: array<f32, 256>` | on-chip workgroup memory | the workgroup | uninitialised at start; ≥ 16 KB guaranteed |
| `var<uniform> p: Params` | uniform buffer | all threads | read-only, small (≥ 64 KB), stricter layout |
| `var<storage, read> x: array<f32>` | storage buffer | all threads | large (≥ 128 MB per binding by default) |
| `var<storage, read_write> y: array<f32>` | storage buffer | all threads | may not overlap any other binding of the same buffer in a dispatch |

**Resource declarations** carry their slot: `@group(0) @binding(3) var<storage, read_write> out: array<f32>;`.

**Entry points** are marked `@compute @workgroup_size(X, Y, Z)` and receive built-ins as parameters:

| Built-in | Type | Meaning |
|---|---|---|
| `global_invocation_id` | `vec3u` | this thread’s index in the whole dispatch |
| `local_invocation_id` | `vec3u` | index within the workgroup |
| `local_invocation_index` | `u32` | the same, flattened: `x + y·X + z·X·Y` |
| `workgroup_id` | `vec3u` | which workgroup |
| `num_workgroups` | `vec3u` | the dispatch size |
| `subgroup_invocation_id`, `subgroup_size` | `u32` | lane within a subgroup (with the `subgroups` feature) |

**Control flow** is C-like: `if`/`else`, `for`, `while`, `loop` (with an optional `continuing { break if … }` block), `switch`, and `return`. There is no recursion and there are no pointers into buffers beyond function-local `ptr<…>` parameters. `select(f, t, cond)` is a branch-free conditional.

**Built-in functions** cover the usual maths (`exp`, `log`, `pow`, `sqrt`, `inverseSqrt`, `tanh`, `abs`, `min`, `max`, `clamp`, `fma`, `floor`, `round`), vector operations (`dot`, `cross`, `length`, `normalize`), and packing (`pack2x16float`, `unpack4x8unorm`, …), which is used for quantised weights in Chapter 16.

## Synchronisation, atomics and uniformity

- **`workgroupBarrier()`** makes every thread in the workgroup wait until all have arrived, and makes their earlier writes to workgroup memory visible to each other. `storageBarrier()` does the same for storage-buffer writes *within the workgroup*. There is no barrier across workgroups inside a dispatch. To synchronise the whole grid, end the dispatch and start another.
- **Atomics** exist for `atomic<i32>` and `atomic<u32>` in storage or workgroup memory: `atomicAdd`, `atomicMax`, `atomicCompareExchangeWeak`, and so on. There are no float atomics in core WebGPU. A float sum can be emulated with a compare-exchange loop on the bit pattern (`bitcast<u32>`), or avoided by restructuring the computation, as Chapter 8 does for the embedding gradient.
- **Uniformity.** Barriers must be reached by all threads of the workgroup together, so WGSL requires them to be in **uniform control flow**. They cannot sit inside a branch or loop whose condition depends on a thread’s id or on data that could differ between threads. The compiler proves this statically and rejects shaders it cannot prove uniform. `workgroupUniformLoad(&x)` reads a workgroup variable and tells the compiler the result is the same for every thread.

## Memory layout

The host writes raw bytes, and the shader reads them as typed structs, so the two must agree on the byte offset of every field. WGSL aligns each field to its type’s alignment: 4 bytes for scalars, 8 for `vec2`, and 16 for `vec3` and `vec4`. A `vec3f` is 12 bytes but 16-aligned, so it usually leaves a hole. Uniform buffers add one more rule: array elements and nested structs are aligned to 16 bytes, so an `array<f32, 4>` in a uniform buffer takes 64 bytes, not 16.

::struct-layout

Two habits avoid most layout bugs. First, put scalars in uniform structs and avoid `vec3` in buffers altogether (use `vec4` or separate arrays). Second, keep large data in storage buffers of plain `f32` or `u32`, and do the indexing yourself, as every kernel in this course does.

## Limits

Every device guarantees at least these defaults. Adapters usually offer more, which must be requested explicitly in `requestDevice({ requiredLimits })`.

| Limit | Default | Typical desktop adapter |
|---|---|---|
| `maxComputeInvocationsPerWorkgroup` | 256 | 1,024 |
| `maxComputeWorkgroupSizeX` / `Y` / `Z` | 256 / 256 / 64 | 1,024 / 1,024 / 64 |
| `maxComputeWorkgroupsPerDimension` | 65,535 | 65,535 |
| `maxComputeWorkgroupStorageSize` | 16,384 bytes | 32,768 bytes |
| `maxStorageBufferBindingSize` | 128 MiB | up to the buffer size |
| `maxBufferSize` | 256 MiB | several GiB |
| `maxUniformBufferBindingSize` | 64 KiB | 64 KiB |
| `maxStorageBuffersPerShaderStage` | 8 | 8–10 |
| `maxBindGroups` | 4 | 4 |

The 65,535-workgroup limit per dimension is why the course’s one-dimensional kernels compute their index as `gid.x + gid.y · (num_workgroups.x · 256)` and dispatch a two-dimensional grid for large arrays (`groups1d` in `@lm/core/gpu`).

## Performance checklist

In rough order of how often each matters:

1. **Count bytes, not FLOPs.** Work out the arithmetic intensity and place the kernel on the roofline (Chapter 8). Memory-bound kernels speed up only by moving fewer bytes, through fusion, lower precision or reuse.
2. **Coalesce global memory access.** Neighbouring threads should read neighbouring addresses in the same instruction. Strided or scattered reads waste most of each memory transaction.
3. **Reuse through workgroup memory and registers.** Tiling (Chapter 8) is the main tool.
4. **Give the GPU enough threads.** Thousands of workgroups, not tens. A small dispatch leaves compute units idle, and a GPU hides memory latency only by switching between many threads. Using fewer registers and less workgroup memory per thread lets more threads be resident at once; this is called **occupancy**.
5. **Avoid divergence** within a subgroup. Branch on data only when neighbouring threads usually agree.
6. **Batch submissions and avoid readbacks.** Record many dispatches per command buffer, and read results back only when the CPU needs them.
7. **Avoid bank conflicts** in workgroup memory. Threads of a subgroup reading addresses that are multiples of 32 floats apart hit the same memory bank and are serialised. Padding a tile’s rows by one element fixes this.
8. **Use vector loads.** Reading `vec4f` from a storage buffer moves 16 bytes per instruction.

## Debugging

- **Errors are asynchronous.** A validation error does not throw; the object becomes invalid and a warning appears in the console. Wrap suspicious code in `device.pushErrorScope('validation')` … `await device.popErrorScope()` to catch it, and read `await module.getCompilationInfo()` for shader compiler messages with line numbers.
- **Out-of-bounds accesses do not crash.** WebGPU guarantees that a shader never touches memory outside its buffers. An out-of-range read returns some value from inside the buffer, or zero, and an out-of-range write is discarded or lands inside the buffer. A missing bounds check therefore produces *wrong answers* rather than a fault. Test kernels at sizes that are not multiples of the workgroup size.
- **Compare with a CPU reference.** Every kernel in the course is tested against the CPU tensor library, on awkward sizes (1, 17, 33, 257, …), with a relative tolerance of about $10^{-4}$ to allow for different summation orders.
- **Test in Node.** The `webgpu` npm package provides Dawn — Chrome’s WebGPU implementation — to Node, so kernels can be unit-tested outside the browser. The course’s Vitest suite does this and skips GPU tests where no adapter exists.
- **Device loss.** A GPU reset or driver crash invalidates the device, and `device.lost` resolves. Recreate the device and every object made from it.
- **Timing.** Wall-clock time around `await` includes submission and readback overheads; average over many repetitions. Where the adapter supports the `timestamp-query` feature, a compute pass can record GPU timestamps into a query set for precise per-kernel timings.

## Dictionary: WebGPU, CUDA and Metal

The same ideas go by different names on each platform:

| WebGPU / WGSL | CUDA | Metal (MSL) |
|---|---|---|
| invocation (thread) | thread | thread |
| workgroup | thread block | threadgroup |
| dispatch (`dispatchWorkgroups`) | grid (`kernel<<<grid, block>>>`) | grid (`dispatchThreadgroups`) |
| subgroup | warp (32 lanes) | SIMD-group (32 lanes) |
| `var<workgroup>` | `__shared__` | `threadgroup` |
| `var<storage>` | global memory (`__device__` pointers) | `device` buffers |
| `var<uniform>` | `__constant__` / kernel parameters | `constant` buffers |
| `workgroupBarrier()` | `__syncthreads()` | `threadgroup_barrier(mem_flags::mem_threadgroup)` |
| `local_invocation_id` | `threadIdx` | `thread_position_in_threadgroup` |
| `workgroup_id` | `blockIdx` | `threadgroup_position_in_grid` |
| `global_invocation_id` | `blockIdx * blockDim + threadIdx` | `thread_position_in_grid` |
| `atomicAdd` (integers only) | `atomicAdd` (also floats) | `atomic_fetch_add_explicit` |

**Triton** :cite[tillet2019], used in Chapter 8’s lab and again in Chapter 14, sits a level above all three. A Triton *program* is roughly a workgroup, and you write operations on whole tiles; the compiler maps them onto threads, shared memory and registers.

## Further reading

- The WebGPU and WGSL specifications :cite[webgpu], and the MDN WebGPU API documentation.
- Samuel Williams and colleagues, *Roofline* :cite[williams2009].
- Simon Boehm’s matmul worklog :cite[boehm2022] and Mark Harris’s reduction slides :cite[harris2007], both written for CUDA; every idea carries over to WGSL.
- David Goldberg, *What Every Computer Scientist Should Know About Floating-Point Arithmetic* :cite[goldberg1991].
