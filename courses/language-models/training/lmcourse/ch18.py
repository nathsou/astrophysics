"""Chapter 18 — the modern Transformer block, measured: GPT-2's block against Llama's changes one at a time.

    uv run lmc ch18 ablation    # 7 runs of the 6 × 384 model at 6.25 × 10¹⁵ FLOPs (≈ 35 min on an RTX 4060 Ti)
    uv run lmc ch18 context     # loss by position up to 4 × the training context, for the RoPE models
    uv run lmc ch18 summary     # collect into course/content/chapters/18-modern-architecture/data.json

Every run has the compute-optimal shape of Chapter 17's largest budget and the same data order, schedule
and optimiser (Muon + AdamW); only the block changes. Two baseline seeds show how much runs vary anyway.
"""

from __future__ import annotations

import json
import math

from .paths import ROOT, TRAINING

OUT = TRAINING / "runs" / "ch18"
CHAPTER = ROOT / "course" / "content" / "chapters" / "18-modern-architecture"

LAYERS, WIDTH, CONTEXT, BATCH = 6, 384, 512, 64
BUDGET = 6.25e15
VARIANTS: dict[str, tuple[str, list[str]]] = {
    "gpt2": ("GPT-2 block (baseline)", []),
    "gpt2-seed2": ("GPT-2 block, another seed", ["seed=2"]),
    "rms": ("RMSNorm", ["norm_type=rms"]),
    "swiglu": ("SwiGLU MLP", ["mlp_type=swiglu"]),
    "rope": ("RoPE", ["pos=rope"]),
    "gqa": ("Grouped-query attention (2 KV heads)", ["kv_heads=2"]),
    "llama": ("All four (Llama-style)", ["norm_type=rms", "mlp_type=swiglu", "pos=rope", "kv_heads=2"]),
}


def _steps() -> int:
    from .ch17 import flops_per_token

    return round(BUDGET / flops_per_token(LAYERS, WIDTH) / (BATCH * CONTEXT))


def _final(name: str) -> dict | None:
    path = TRAINING / "runs" / name / "log.jsonl"
    if not path.exists():
        return None
    recs = [json.loads(line) for line in path.read_text().splitlines()]
    vals = [r for r in recs if "val_bits" in r]
    tps = [r["tokens_per_s"] for r in recs if "tokens_per_s" in r][2:]
    return {"val_bits": vals[-1]["val_bits"], "step": vals[-1]["step"], "tokens_per_s": sorted(tps)[len(tps) // 2] if tps else None,
            "curve": [[r["step"], round(r["train_bits"], 4)] for r in recs if "train_bits" in r]} if vals else None


def ablation() -> None:
    from . import train

    steps = _steps()
    for key, (label, sets) in VARIANTS.items():
        name = f"arch-{key}"
        f = _final(name)
        if f and f["step"] == steps:
            print(f"{name}: done")
            continue
        (TRAINING / "runs" / name / "log.jsonl").unlink(missing_ok=True)
        print(f"== {name}: {label}")
        train.main("coursegpt", overrides=[
            f"name={name}", f"layers={LAYERS}", f"width={WIDTH}", f"heads={WIDTH // 64}", f"context={CONTEXT}",
            f"batch={BATCH}", "accum=1", f"steps={steps}", f"warmup={max(50, steps // 20)}", f"eval_every={steps}",
            "eval_tokens=2097152", *sets,
        ])


def context(lengths: tuple[int, ...] = (512, 1024, 2048)) -> None:
    """Mean loss at each position (in bins of 64) of long validation windows, for models trained at 512."""
    import numpy as np
    import torch
    import torch.nn.functional as F

    from . import tokens
    from .model import GPT, GPTConfig

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    val = np.asarray(tokens.load("val"))
    out = {}
    for key in ("gpt2", "rope", "llama"):
        ckpt = torch.load(TRAINING / "runs" / f"arch-{key}" / "ckpt.pt", map_location=dev, weights_only=False)
        c = ckpt["config"]
        model = GPT(GPTConfig(vocab=8192, context=c["context"], width=c["width"], layers=c["layers"], heads=c["heads"],
                              norm_type=c["norm_type"], mlp_type=c["mlp_type"], pos=c["pos"], kv_heads=c["kv_heads"])).to(dev)
        model.load_state_dict(ckpt["model"])
        model.eval()
        T = max(lengths) if c["pos"] == "rope" else c["context"]
        n = min(256, (len(val) - 1) // T)
        x = torch.from_numpy(val[: n * T].astype(np.int64)).view(n, T).to(dev)
        y = torch.from_numpy(val[1 : n * T + 1].astype(np.int64)).view(n, T).to(dev)
        total = torch.zeros(T, device=dev)
        with torch.no_grad():
            for i in range(0, n, 8):
                logits, _ = model(x[i : i + 8])
                total += F.cross_entropy(logits.float().transpose(1, 2), y[i : i + 8], reduction="none").sum(0)
        per_pos = (total / n / math.log(2)).cpu().numpy()
        out[key] = [[int(b * 64), round(float(per_pos[b * 64 : (b + 1) * 64].mean()), 4)] for b in range(T // 64)]
        print(key, " ".join(f"{p}:{v:.2f}" for p, v in out[key][:: max(1, len(out[key]) // 8)]))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "context.json").write_text(json.dumps(out))


def summary() -> None:
    from .model import GPT, GPTConfig

    runs = []
    for key, (label, sets) in VARIANTS.items():
        f = _final(f"arch-{key}")
        if not f:
            continue
        opts = dict(s.split("=") for s in sets if not s.startswith("seed"))
        cfg = GPTConfig(vocab=8192, context=CONTEXT, width=WIDTH, layers=LAYERS, heads=WIDTH // 64,
                        **{k: (int(v) if k == "kv_heads" else v) for k, v in opts.items()})
        kv_bytes = 2 * LAYERS * CONTEXT * (cfg.kv_heads or cfg.heads) * 64 * 2  # bf16 cache at full context
        runs.append({"key": key, "label": label, **f, "params": GPT(cfg).num_parameters(), "kv_cache_bytes": kv_bytes})
    out = {"runs": runs, "steps": _steps(), "budget": BUDGET}
    if (OUT / "context.json").exists():
        out["context"] = json.loads((OUT / "context.json").read_text())
    CHAPTER.mkdir(parents=True, exist_ok=True)
    (CHAPTER / "data.json").write_text(json.dumps(out) + "\n")
    print(f"wrote {CHAPTER / 'data.json'}")
