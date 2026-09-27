"""Chapter 14 — scaling up in PyTorch: the measurements quoted in the chapter.

    uv run lmc ch14 sweep        # learning rates and optimisers for CourseGPT, at 5% of its budget (~45 min)
    uv run lmc ch14 speed        # throughput of fp32 / TF32 / bf16, eager / compiled, naive / flash attention
    uv run lmc ch14 attention    # time and memory of attention against context length
    uv run lmc ch14 precision    # float formats, and fp16 gradients with and without loss scaling
    uv run lmc ch14 summary      # collect everything into the chapter's data file

Each command writes JSON into runs/ch14/; `summary` gathers it (with CourseGPT's log) into
course/content/chapters/14-scaling-up/data.json, which the chapter's widgets import.
"""

from __future__ import annotations

import json
import math
import time

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch14"
CHAPTER = ROOT / "course" / "content" / "chapters" / "14-scaling-up"

# CourseGPT's shape at 1/20 of its token budget: 800 steps of 64 K tokens.
SWEEP_BASE = ["steps=800", "accum=4", "warmup=100", "eval_every=400", "eval_tokens=1048576"]
SWEEP = {
    "adamw-1e-3": ["optimizer=adamw", "lr=1e-3"],
    "adamw-2e-3": ["optimizer=adamw", "lr=2e-3"],
    "adamw-4e-3": ["optimizer=adamw", "lr=4e-3"],
    "adamw-8e-3": ["optimizer=adamw", "lr=8e-3"],
    "muon-0.01": ["optimizer=muon", "muon_lr=0.01", "lr=4e-3"],
    "muon-0.02": ["optimizer=muon", "muon_lr=0.02", "lr=4e-3"],
    "muon-0.04": ["optimizer=muon", "muon_lr=0.04", "lr=4e-3"],
}


def _records(name: str) -> list[dict]:
    path = TRAINING / "runs" / name / "log.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def sweep(only: list[str] | None = None) -> None:
    from . import train

    for key, settings in SWEEP.items():
        if only and key not in only:
            continue
        name = f"sweep-{key}"
        if any("val_bits" in r and r["step"] == 800 for r in _records(name)):
            print(f"{name}: done")
            continue
        (TRAINING / "runs" / name / "log.jsonl").unlink(missing_ok=True)
        print(f"== {name}")
        train.main("coursegpt", overrides=[*SWEEP_BASE, *settings, f"name={name}"])


def _train_step(model, x, y, opt, bf16: bool) -> None:
    import torch

    with torch.autocast("cuda", dtype=torch.bfloat16, enabled=bf16):
        _, loss = model(x, y)
    loss.backward()
    opt.step()
    opt.zero_grad(set_to_none=True)


def _naive_attention(q, k, v, is_causal=True):
    """Attention that materialises the (T × T) score and probability matrices."""
    import torch

    T = q.shape[-2]
    s = (q @ k.transpose(-2, -1)) * q.shape[-1] ** -0.5
    s = s.masked_fill(torch.ones(T, T, device=q.device, dtype=torch.bool).triu(1), float("-inf"))
    return s.softmax(-1) @ v


def speed(steps: int = 30) -> None:
    """One CourseGPT micro-batch (32 × 512) per step, under each combination of precision, compilation
    and attention kernel. Reports tokens/s, MFU against the bf16 peak, and peak memory."""
    import torch
    import torch.nn.functional as F

    from . import model as M
    from .train import PEAK_BF16, flops_per_token

    cfg = M.GPTConfig(vocab=8192, context=512, width=512, layers=8, heads=8)
    peak = next(v for k, v in PEAK_BF16.items() if k in torch.cuda.get_device_name())
    x = torch.randint(cfg.vocab, (32, cfg.context), device="cuda")
    y = torch.randint(cfg.vocab, (32, cfg.context), device="cuda")
    sdpa = F.scaled_dot_product_attention

    variants = [
        ("fp32", "highest", False, False, "naive"),
        ("tf32", "high", False, False, "naive"),
        ("bf16", "high", True, False, "naive"),
        ("bf16 + flash", "high", True, False, "flash"),
        ("bf16 + flash + compile", "high", True, True, "flash"),
    ]
    results = []
    for label, precision, bf16, compiled, attention in variants:
        torch.manual_seed(0)
        torch.set_float32_matmul_precision(precision)
        F.scaled_dot_product_attention = _naive_attention if attention == "naive" else sdpa
        model = M.GPT(cfg).cuda()
        opt = model.optimizer(1e-4)
        fwd = torch.compile(model) if compiled else model
        torch.cuda.reset_peak_memory_stats()
        try:
            for _ in range(5):
                _train_step(fwd, x, y, opt, bf16)
            torch.cuda.synchronize()
            t0 = time.time()
            for _ in range(steps):
                _train_step(fwd, x, y, opt, bf16)
            torch.cuda.synchronize()
        except torch.OutOfMemoryError:
            print(f"{label:<26} out of memory")
            del model, opt, fwd
            torch.cuda.empty_cache()
            continue
        dt = (time.time() - t0) / steps
        tps = x.numel() / dt
        tflops = tps * flops_per_token(model.num_parameters(), cfg) / 1e12
        mem = torch.cuda.max_memory_allocated() / 2**30
        results.append({"label": label, "tokens_per_s": tps, "tflops": tflops, "mfu": tflops * 1e12 / peak, "memory_gib": mem})
        print(f"{label:<26} {tps:>9,.0f} tok/s  {tflops:5.1f} TFLOP/s  MFU {tflops * 1e12 / peak:4.0%}  {mem:5.2f} GiB")
        del model, opt, fwd
        torch.cuda.empty_cache()
    F.scaled_dot_product_attention = sdpa
    torch.set_float32_matmul_precision("high")
    _write("speed", {"gpu": torch.cuda.get_device_name(), "batch": 32, "context": 512, "results": results})


def attention(max_log2: int = 14) -> None:
    """Forward + backward of one attention layer (batch 4, 8 heads of 64) in bf16, for T = 256 … 16,384:
    the naive version (which stores the T × T score matrix) against PyTorch's flash kernel."""
    import torch
    import torch.nn.functional as F

    B, H, D = 4, 8, 64
    rows = []
    for lg in range(8, max_log2 + 1):
        T = 1 << lg
        row = {"T": T}
        for kind in ("naive", "flash"):
            q, k, v = (torch.randn(B, H, T, D, device="cuda", dtype=torch.bfloat16, requires_grad=True) for _ in range(3))

            fn = F.scaled_dot_product_attention if kind == "flash" else _naive_attention
            try:
                fn(q, k, v, is_causal=True).sum().backward()
                torch.cuda.synchronize()
                torch.cuda.reset_peak_memory_stats()
                base = torch.cuda.memory_allocated()
                t0 = time.time()
                n = 5
                for _ in range(n):
                    fn(q, k, v, is_causal=True).sum().backward()
                torch.cuda.synchronize()
                row[f"{kind}_ms"] = (time.time() - t0) / n * 1000
                row[f"{kind}_mib"] = (torch.cuda.max_memory_allocated() - base) / 2**20
            except torch.OutOfMemoryError:
                row[f"{kind}_ms"] = row[f"{kind}_mib"] = None
            del q, k, v
            torch.cuda.empty_cache()
        rows.append(row)
        print(
            f"T {T:>6}: naive {_fmt(row['naive_ms'])} ms {_fmt(row['naive_mib'])} MiB   "
            f"flash {_fmt(row['flash_ms'])} ms {_fmt(row['flash_mib'])} MiB"
        )
    _write("attention", {"batch": B, "heads": H, "head_dim": D, "rows": rows})


def _fmt(v: float | None) -> str:
    return "  OOM" if v is None else f"{v:7.1f}"


def precision(checkpoint: str = "sweep-adamw-2e-3") -> None:
    """Gradient magnitudes of a partly trained CourseGPT, as a histogram of log₂|g|, and what fraction
    would underflow to zero in fp16 with and without loss scaling."""
    import torch

    from . import tokens
    from .model import GPT, GPTConfig

    ckpt = torch.load(TRAINING / "runs" / checkpoint / "ckpt.pt", map_location="cuda", weights_only=False)
    c = ckpt["config"]
    model = GPT(GPTConfig(vocab=8192, context=c["context"], width=c["width"], layers=c["layers"], heads=c["heads"])).cuda()
    model.load_state_dict(ckpt["model"])
    val = tokens.load("val")
    import numpy as np

    rng = np.random.default_rng(0)
    starts = rng.integers(0, len(val) - c["context"] - 1, 32)
    xy = torch.from_numpy(np.stack([val[s : s + c["context"] + 1] for s in starts]).astype(np.int64)).cuda()
    with torch.autocast("cuda", dtype=torch.bfloat16):
        _, loss = model(xy[:, :-1], xy[:, 1:])
    loss.backward()
    g = torch.cat([p.grad.flatten().float() for p in model.parameters()]).abs()
    g = g[g > 0]
    lg = torch.log2(g)
    lo, hi = -48, 0
    hist = torch.histc(lg.clamp(lo, hi - 1e-3), bins=hi - lo, min=lo, max=hi).tolist()
    fp16_min_sub, fp16_min_normal = 2.0**-24, 2.0**-14
    scales = {}
    for s in range(0, 21, 2):
        scaled = g * 2.0**s
        scales[s] = {
            "zero": (scaled < fp16_min_sub / 2).float().mean().item(),
            "subnormal": ((scaled >= fp16_min_sub / 2) & (scaled < fp16_min_normal)).float().mean().item(),
            "overflow": (scaled > 65504).float().mean().item(),
        }
    print(f"{g.numel():,} non-zero gradient entries; median |g| = 2^{lg.median().item():.1f}")
    for s, v in scales.items():
        print(f"  scale 2^{s:<2}: {v['zero']:.2%} flush to zero, {v['subnormal']:.2%} subnormal")
    _write("precision", {"checkpoint": checkpoint, "log2_min": lo, "hist": hist, "median_log2": lg.median().item(), "scales": scales})


def _write(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, indent=1))


def summary() -> None:
    """Collect the measurements and CourseGPT's training log into the chapter's data file."""
    from .tokens import OUT as TOKENS

    out: dict = {}
    for name in ("speed", "attention", "precision", "baselines", "evaluate"):
        path = OUT / f"{name}.json"
        if path.exists():
            out[name] = json.loads(path.read_text())
    out["sweep"] = []
    for key in SWEEP:
        recs = _records(f"sweep-{key}")
        vals = [r for r in recs if "val_bits" in r]
        if vals:
            out["sweep"].append({
                "run": key,
                "curve": [[r["step"], round(r["train_bits"], 4)] for r in recs if "train_bits" in r],
                "val_bits": vals[-1]["val_bits"],
            })
    recs = _records("coursegpt")
    if recs:
        cfg = next(r for r in recs if "config" in r)
        out["coursegpt"] = {
            "config": cfg["config"],
            "params": cfg["params"],
            "flops_per_token": cfg["flops_per_token"],
            "train": [[r["step"], round(r["train_bits"], 4), round(r["tokens_per_s"]), round(r.get("mfu", 0), 4)] for r in recs if "train_bits" in r],
            "val": [[r["step"], round(r["val_bits"], 4), round(r["elapsed"])] for r in recs if "val_bits" in r],
            "samples": [[r["step"], r["sample"]] for r in recs if "sample" in r],
        }
    out["tokeniser"] = {
        "meta": json.loads((TOKENS / "meta.json").read_text()),
        "merge_curve": [[m, round(b, 4)] for m, b in json.loads((TOKENS / "merge_curve.json").read_text())],
    }
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")


PARITY_TEXTS = [
    "Once upon a time, there was a little girl named Lily. She loved to play outside in the sun.",
    "\"Can I have 3 apples?\" asked Tom. \"No,\" said Mum. \"You can have 12,345!\"",
    "naïve café — 日本語 🙂 and a tab\there",
    "  leading spaces, trailing spaces  \n\n\nand blank lines",
    "I'm sure we'll see they've gone; it's John's.",
]


def fixtures(run: str = "coursegpt") -> None:
    """Parity fixtures for the browser: the tokeniser's ids for sample texts (always) and CourseGPT's
    logits for a prompt (when runs/coursegpt/model.safetensors exists). Also copies the tokeniser
    into the site, where the chapter's widgets and the browser model load it."""
    import shutil

    from . import tokens
    from .paths import COURSE_STATIC_DATA, FIXTURES

    tok = tokens.tokeniser()
    dest = COURSE_STATIC_DATA / "coursegpt"
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(tokens.OUT / "tokeniser.json", dest / "tokeniser.json")
    val = (tokens.DATA / "TinyStoriesV2-GPT4-valid.txt").read_text(encoding="utf-8")
    texts = PARITY_TEXTS + tokens.stories(val)[:100]
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / "coursegpt_tokens.json").write_text(
        json.dumps({"texts": texts, "ids": [tok.encode(t) for t in texts]}, ensure_ascii=False) + "\n"
    )
    print(f"wrote {FIXTURES / 'coursegpt_tokens.json'} and {dest / 'tokeniser.json'}")

    weights = TRAINING / "runs" / run / "model.safetensors"
    if not weights.exists():
        print(f"(no {weights}: skipping the logits fixture)")
        return
    import torch
    from safetensors import safe_open

    from .model import GPT, GPTConfig

    with safe_open(weights, "pt") as f:
        meta = f.metadata()
        state = {k: f.get_tensor(k).float() for k in f.keys()}  # noqa: SIM118
    cfg = GPTConfig(**json.loads(meta["config"]))
    model = GPT(cfg).double()
    names = dict(model.named_parameters())
    with torch.no_grad():
        for k, p in names.items():
            p.copy_(state[k if not k.startswith("blocks.") else "h" + k[len("blocks.") :]].double())
    ids = [tok.special[tokens.EOT], *tok.encode(PARITY_TEXTS[0])]
    x = torch.tensor([ids[:-1]])
    y = torch.tensor([ids[1:]])
    with torch.no_grad():
        logits, loss = model(x, y)
    (FIXTURES / "coursegpt_logits.json").write_text(json.dumps({
        "ids": ids[:-1],
        "targets": ids[1:],
        "last_logits": logits[0, -1].tolist(),
        "loss": loss.item(),
    }) + "\n")
    print(f"wrote {FIXTURES / 'coursegpt_logits.json'} (loss {loss.item():.4f} nats/token)")


def baselines() -> None:
    """Chapter 2's models on CourseGPT's tokens, for scale: uniform, unigram, and a bigram model
    interpolated with the unigram (weight tuned on the first half of validation, scored on the second)."""
    import numpy as np

    from . import tokens

    train, val = np.asarray(tokens.load("train")), np.asarray(tokens.load("val"))
    V = int(max(train.max(), val.max())) + 1
    meta = json.loads((tokens.OUT / "meta.json").read_text())
    uni = np.bincount(train, minlength=V).astype(np.float64) + 1
    uni /= uni.sum()
    pair = train[:-1].astype(np.int64) * V + train[1:]
    counts = np.bincount(pair, minlength=V * V).reshape(V, V).astype(np.float32)
    rows = counts.sum(1, keepdims=True)
    half = len(val) // 2

    def bits(ids: np.ndarray, lam: float) -> float:
        a, b = ids[:-1], ids[1:]
        p_bi = counts[a, b] / np.maximum(rows[a, 0], 1)
        p = lam * p_bi + (1 - lam) * uni[b]
        return float(-np.log2(p).mean())

    grid = [round(x, 2) for x in np.arange(0.5, 1.0, 0.01)] + [0.995, 0.998, 0.999]
    lam = min(grid, key=lambda x: bits(val[:half], x))
    result = {
        "uniform": math.log2(V),
        "unigram": float(-np.log2(uni[val]).mean()),
        "bigram": bits(val[half:], lam),
        "bigram_lambda": lam,
        "bytes_per_token": meta["val"]["bytes_per_token"],
    }
    for k in ("uniform", "unigram", "bigram"):
        print(f"{k:>8}: {result[k]:.3f} bits/token = {result[k] / result['bytes_per_token']:.3f} bits/byte")
    _write("baselines", result)


def evaluate(run: str = "coursegpt") -> None:
    """Validation loss of a trained run on the whole validation split (training evaluates a prefix)."""
    import torch
    import torch.nn.functional as F

    from . import tokens
    from .ch15 import load

    model, _, dev = load(run)
    torch.set_float32_matmul_precision("highest")
    val = torch.from_numpy(tokens.load("val").astype("int64")).to(dev)
    T = model.cfg.context
    n = (len(val) - 1) // T
    x, y = val[: n * T].view(n, T), val[1 : n * T + 1].view(n, T)
    total = 0.0
    with torch.no_grad():
        for i in range(0, n, 32):
            logits, _ = model(x[i : i + 32])
            total += F.cross_entropy(logits.float().flatten(0, 1), y[i : i + 32].flatten(), reduction="sum").item()
    bits = total / (n * T) / math.log(2)
    meta = json.loads((tokens.OUT / "meta.json").read_text())
    result = {"run": run, "tokens": n * T, "val_bits": bits, "bits_per_byte": bits / meta["val"]["bytes_per_token"]}
    print(f"{run}: {bits:.4f} bits/token = {result['bits_per_byte']:.4f} bits/byte over {n * T:,} tokens")
    _write("evaluate", result)
