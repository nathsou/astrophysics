"""Chapter 8 lab: what a GPU buys you, measured with PyTorch.

    uv run lmc ch08                  # bandwidth, matmul throughput and MLP step time, CPU vs GPU
    uv run lmc ch08 --triton         # also a tiled matmul written in Triton (CUDA only)

Uses CUDA if available, then Apple's MPS, else the CPU alone.
"""

from __future__ import annotations

import time


def _device():
    import torch

    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _sync(device) -> None:
    import torch

    if device.type == "cuda":
        torch.cuda.synchronize()
    elif device.type == "mps":
        torch.mps.synchronize()


def _time(fn, device, budget: float = 0.3) -> float:
    """Seconds per call, averaged over enough repetitions to fill ~budget seconds."""
    fn()
    _sync(device)
    t0 = time.perf_counter()
    fn()
    _sync(device)
    once = time.perf_counter() - t0
    reps = max(1, min(200, int(budget / max(once, 1e-5))))
    t0 = time.perf_counter()
    for _ in range(reps):
        fn()
    _sync(device)
    return (time.perf_counter() - t0) / reps


def bandwidth(device) -> float:
    """GB/s for copying 256 MiB (read + write)."""
    import torch

    x = torch.empty(64 << 20, device=device)
    y = torch.empty_like(x)
    return 2 * x.numel() * 4 / _time(lambda: y.copy_(x), device) / 1e9


def matmul_gflops(device, n: int, dtype) -> float:
    import torch

    a = torch.randn(n, n, device=device, dtype=dtype)
    b = torch.randn(n, n, device=device, dtype=dtype)
    return 2 * n**3 / _time(lambda: a @ b, device) / 1e9


def mlp_step_ms(device, n=8, d=24, h=1024, batch=1024, V=65) -> float:
    """Milliseconds per SGD step of the Chapter 7 MLP at the 'large' browser configuration."""
    import torch
    import torch.nn.functional as F
    from torch import nn

    torch.manual_seed(0)
    model = nn.Sequential(
        nn.Embedding(V, d), nn.Flatten(), nn.Linear(n * d, h), nn.Tanh(), nn.Linear(h, V)
    ).to(device)
    opt = torch.optim.SGD(model.parameters(), lr=0.1, momentum=0.9)
    X = torch.randint(V, (batch, n), device=device)
    Y = torch.randint(V, (batch,), device=device)

    def step():
        loss = F.cross_entropy(model(X), Y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()

    return _time(step, device) * 1000


def triton_matmul(device, n: int) -> tuple[float, float] | None:
    """A tiled matmul in Triton: the chapter's WGSL kernel, one level of abstraction up."""
    try:
        import torch
        import triton
        import triton.language as tl
    except ImportError:
        return None

    @triton.jit
    def kernel(a_ptr, b_ptr, c_ptr, M, N, K, BM: tl.constexpr, BN: tl.constexpr, BK: tl.constexpr):
        # One program instance (≈ a workgroup) computes a BM × BN tile of C.
        pid_m, pid_n = tl.program_id(0), tl.program_id(1)
        rm = pid_m * BM + tl.arange(0, BM)
        rn = pid_n * BN + tl.arange(0, BN)
        rk = tl.arange(0, BK)
        acc = tl.zeros((BM, BN), dtype=tl.float32)
        for k0 in range(0, K, BK):
            # Tiles of A and B; Triton decides how to stage them in shared memory and registers.
            a = tl.load(
                a_ptr + rm[:, None] * K + (k0 + rk)[None, :],
                mask=(rm[:, None] < M) & ((k0 + rk)[None, :] < K),
                other=0.0,
            )
            b = tl.load(
                b_ptr + (k0 + rk)[:, None] * N + rn[None, :],
                mask=((k0 + rk)[:, None] < K) & (rn[None, :] < N),
                other=0.0,
            )
            acc += tl.dot(a, b, allow_tf32=False)
        tl.store(c_ptr + rm[:, None] * N + rn[None, :], acc, mask=(rm[:, None] < M) & (rn[None, :] < N))

    a = torch.randn(n, n, device=device)
    b = torch.randn(n, n, device=device)
    c = torch.empty(n, n, device=device)
    BM = BN = 64
    grid = (triton.cdiv(n, BM), triton.cdiv(n, BN))

    def run():
        kernel[grid](a, b, c, n, n, n, BM=BM, BN=BN, BK=32)

    run()
    err = (c - a @ b).abs().max().item()
    return 2 * n**3 / _time(run, device) / 1e9, err


def main(use_triton: bool = False) -> None:
    try:
        import torch
    except ImportError:
        print("This lab needs PyTorch: uv sync --extra torch")
        return
    torch.backends.cuda.matmul.allow_tf32 = False  # compare like with like: true float32
    dev = _device()
    cpu = torch.device("cpu")
    name = torch.cuda.get_device_name() if dev.type == "cuda" else dev.type
    print(f"Accelerator: {name}   (PyTorch {torch.__version__}, {torch.get_num_threads()} CPU threads)\n")

    print("Memory bandwidth (copy 256 MiB)")
    for d in [cpu] + ([dev] if dev != cpu else []):
        print(f"  {d.type:>4}: {bandwidth(d):7.0f} GB/s")

    print("\nMatrix multiplication, float32 (GFLOP/s)")
    sizes = [256, 512, 1024, 2048, 4096]
    print("  " + " " * 6 + "".join(f"{n:>9}" for n in sizes))
    for d in [cpu] + ([dev] if dev != cpu else []):
        row = [matmul_gflops(d, n, torch.float32) for n in sizes]
        print(f"  {d.type:>4}: " + "".join(f"{g:9.0f}" for g in row))
    if dev.type in ("cuda", "mps"):
        half = torch.bfloat16 if dev.type == "cuda" else torch.float16
        print(
            f"  {dev.type:>4} {str(half).split('.')[-1]} (tensor cores / fast paths): {matmul_gflops(dev, 4096, half):.0f} GFLOP/s at 4096"
        )

    print("\nChapter 7 MLP, h = 1024, batch 1024 (ms per SGD step)")
    c = mlp_step_ms(cpu)
    print(f"   cpu: {c:8.2f}")
    if dev != cpu:
        g = mlp_step_ms(dev)
        print(f"  {dev.type:>4}: {g:8.2f}   ({c / g:.0f}× faster)")

    if use_triton:
        if dev.type != "cuda":
            print("\nTriton needs an NVIDIA (or AMD) GPU; skipping.")
            return
        res = triton_matmul(dev, 4096)
        if res is None:
            print("\nTriton is not installed: uv pip install triton")
        else:
            print(
                f"\nTriton tiled matmul, 4096², float32: {res[0]:.0f} GFLOP/s (max error vs torch {res[1]:.1e})"
            )
